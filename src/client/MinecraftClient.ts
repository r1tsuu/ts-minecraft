import { BlocksRegistry } from '../shared/BlocksRegistry.ts'
import { deserializeEvent, serializeEvent } from '../shared/Event.ts'
import { ExitWorld } from '../shared/events/client/ExitWorld.ts'
import { JoinedWorld } from '../shared/events/client/JoinedWorld.ts'
import { JoinWorld } from '../shared/events/client/JoinWorld.ts'
import { RequestPlayerJoin } from '../shared/events/client/RequestPlayerJoin.ts'
import { StartLocalServer } from '../shared/events/client/StartLocalServer.ts'
import { ResponsePlayerJoin } from '../shared/events/server/ResponsePlayerJoin.ts'
import { ServerStarted } from '../shared/events/single-player-worker/ServerStarted.ts'
import { WorkerReady } from '../shared/events/single-player-worker/WorkerReady.ts'
import { type Maybe, None, Some } from '../shared/Maybe.ts'
import { MinecraftEventBus } from '../shared/MinecraftEventBus.ts'
import SinglePlayerWorker from '../singleplayer/SinglePlayerWorker.ts?worker'
import { ClientBlocksRegistry } from './ClientBlocksRegistry.ts'
import { createGameLoop, type GameLoop } from './GameLoop.ts'
import { createGUI, type GUI } from './gui/GUI.ts'
import { LocalStorageManager } from './LocalStorageManager.ts'

export interface MinecraftClientContext {
  readonly blocksRegistry: BlocksRegistry
  readonly clientBlocksRegistry: ClientBlocksRegistry
  readonly eventBus: MinecraftEventBus
  getGameLoop(): Maybe<GameLoop>
  getSinglePlayerWorker(): Maybe<Worker>
  readonly gui: GUI
  readonly localStorageManager: LocalStorageManager
}

export const createMinecraftClient = (): MinecraftClientContext => {
  const eventBus = new MinecraftEventBus('Client')
  const blocksRegistry = new BlocksRegistry()
  const clientBlocksRegistry = new ClientBlocksRegistry(blocksRegistry)
  const localStorageManager = new LocalStorageManager()
  let gameLoop: Maybe<GameLoop> = None()
  let singlePlayerWorker: Maybe<Worker> = None()

  const gui = createGUI({
    eventBus,
    getGameLoop: () => gameLoop,
    localStorageManager,
  })

  const ctx: MinecraftClientContext = {
    blocksRegistry,
    clientBlocksRegistry,
    eventBus,
    getGameLoop: () => gameLoop,
    getSinglePlayerWorker: () => singlePlayerWorker,
    gui,
    localStorageManager,
  }

  eventBus.subscribe('*', (event) => {
    if (singlePlayerWorker.isNone()) {
      return
    }

    if (event.getType().startsWith('Client.Request') || event instanceof StartLocalServer) {
      singlePlayerWorker.value().postMessage(serializeEvent(event))
    }
  })

  eventBus.subscribe(JoinWorld, async (event) => {
    if (gameLoop.isSome()) {
      console.warn(`Received ${event.getType()} but already in a world.`)
      return
    }

    const worker = new SinglePlayerWorker()
    worker.onmessage = (msg) => eventBus.publish(deserializeEvent(eventBus, msg.data))
    singlePlayerWorker = Some(worker)

    await eventBus.waitFor(WorkerReady)
    console.log('Single-player worker is ready.')

    await eventBus.request(new StartLocalServer(event.worldUUID), ServerStarted)
    console.log(`Local server started for world ${event.worldUUID}.`)

    const { world } = await eventBus.request(
      new RequestPlayerJoin(localStorageManager.getPlayerUUID()),
      ResponsePlayerJoin,
    )

    const newGameLoop = createGameLoop(ctx, world)
    newGameLoop.execute()
    gameLoop = Some(newGameLoop)

    console.log(`Joined world ${event.worldUUID}`)
    eventBus.reply(event, new JoinedWorld())
  })

  eventBus.subscribe(ExitWorld, () => {
    gameLoop.tap((game) => game.dispose())
    gameLoop = None()
    singlePlayerWorker.tap((worker) => worker.terminate())
    singlePlayerWorker = None()
    console.log('Exited world.')
  })

  return ctx
}
