import type { MinecraftClient } from '../types.ts'

import { createConfig } from '../config.ts'
import { createMinecraftEventQueue, type MinecraftEvent } from '../queue/minecraft.ts'
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
    if (minecraft.gameContext) {
      console.warn('Received JOIN_WORLD but already in a world.')
      return
    }

    const singlePlayerWorker = new SinglePlayerWorker()

    // Forward relevant events to the single player worker
    const forwardMatcher = (event: MinecraftEvent) => {
      if (event.from === 'SERVER') {
        return false
      }

      if (event.type.startsWith('REQUEST_')) {
        return true
      }

      if (event.type === 'START_LOCAL_SERVER' || event.type === 'SERVER_STARTED') {
        return true
      }

      return false
    }

    const unsubscribe = minecraft.eventQueue.on('*', (event) => {
      if (forwardMatcher(event)) {
        singlePlayerWorker.postMessage(event.serialize())
      }
    })

    singlePlayerWorker.onmessage = (message: MessageEvent<MinecraftEvent>) => {
      console.log('Client worker message received:', message.data)
      if (message.data.from === 'SERVER') {
        minecraft.eventQueue.emit(
          message.data.type,
          message.data.payload,
          message.data.eventUUID,
          message.data.timestamp,
          message.data.from,
        )
      }
    }

    await minecraft.eventQueue.waitUntilOn('SINGLEPLAYER_WORKER_READY')
    const serverStartedResponse = await minecraft.eventQueue.emitAndWaitResponse(
      'START_LOCAL_SERVER',
      {
        worldDatabaseName: `world_${event.payload.worldUUID}`,
      },
      'SERVER_STARTED',
    )

    console.log('Server started response:', serverStartedResponse)

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
      singlePlayerWorker,
    })

    minecraft.gameContext = gameContext

    gameContext.addOnDisposeCallback(unsubscribe)

    initGameLoop(minecraft)
  })

  minecraft.eventQueue.on('EXIT_WORLD', (event) => {
    minecraft.getGameContext().dispose()
    minecraft.gameContext = null

    event.respond('EXITED_WORLD', {})
  })

  return minecraft
}
