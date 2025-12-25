import type { MinecraftClient } from '../types.ts'

import { createConfig } from '../config.ts'
import { createMinecraftEventQueue, type MinecraftEventQueueEvent } from '../queue/minecraft.ts'
import { createClientBlockRegistry } from './blocks.ts'
import { createGameContext } from './gameContext.ts'
import { initGameLoop } from './gameLoop.ts'
import { initGUI } from './gui/init.ts'
import { createLocalStorageManager } from './localStorageManager.ts'
import SinglePlayerWorker from './singlePlayerWorker.ts?worker'

export const initMinecraftClient = () => {
  const eventQueue = createMinecraftEventQueue('CLIENT')

  const config = createConfig()

  const minecraft: MinecraftClient = {
    blocksRegistry: createClientBlockRegistry(),
    config,
    eventQueue,
    gameContext: null,
    getGameContext: () => {
      if (!minecraft.gameContext) {
        throw new Error('Game instance is not initialized')
      }

      return minecraft.gameContext
    },
    getGUI: () => {
      if (!minecraft.gui) {
        throw new Error('UI instance is not initialized')
      }

      return minecraft.gui
    },
    gui: null,
    localStorageManager: createLocalStorageManager(),
  }

  const ui = initGUI({
    minecraft,
  })

  minecraft.gui = ui

  minecraft.eventQueue.on('JOIN_WORLD', async (event) => {
    const singlePlayerWorker = new SinglePlayerWorker()

    minecraft.eventQueue.on('*', (event) => {
      if (event.type.startsWith('REQUEST_')) {
        singlePlayerWorker.postMessage(event)
      }
    })

    singlePlayerWorker.onmessage = (message: MessageEvent<MinecraftEventQueueEvent>) => {
      minecraft.eventQueue.emit(
        message.data.type,
        message.data.payload,
        message.data.eventUUID,
        message.data.timestamp,
      )
    }

    await minecraft.eventQueue.waitUntilOn('WORKER_READY')
    const serverStartedResponse = await minecraft.eventQueue.emitAndWaitResponse(
      'START_LOCAL_SERVER',
      {
        worldDatabaseName: `world_${event.payload.worldUUID}`,
      },
      'SERVER_STARTED',
    )

    const playerJoinResponse = await minecraft.eventQueue.emitAndWaitResponse(
      'REQUEST_PLAYER_JOIN',
      {
        playerUUID: minecraft.localStorageManager.getPlayerUUID(),
      },
      'RESPONSE_PLAYER_JOIN',
    )

    const gameContext = await createGameContext({
      initialChunksFromServer: serverStartedResponse.payload.loadedChunks,
      minecraft,
      player: playerJoinResponse.payload.playerData,
    })

    minecraft.gameContext = gameContext

    initGameLoop(minecraft)
  })

  minecraft.eventQueue.on('EXIT_WORLD', (event) => {
    minecraft.getGameContext().dispose()
    minecraft.gameContext = null

    event.respond('EXITED_WORLD', {})
  })

  return minecraft
}
