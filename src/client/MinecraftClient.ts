import { asyncPipe } from '../shared/AsyncPipe.ts'
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
import { createGameLoop, type GameLoop } from './GameLoop.ts'
import { createGUI, type GUI } from './gui/GUI.ts'
import { LocalStorageManager } from './LocalStorageManager.ts'
import { createTexturesRegistry, type TexturesRegistry } from './TexturesRegistry.ts'

export interface MinecraftClientContext {
  readonly eventBus: MinecraftEventBus
  getGameLoop(): Maybe<GameLoop>
  getSinglePlayerWorker(): Maybe<Worker>
  readonly gui: GUI
  readonly localStorageManager: LocalStorageManager
  readonly texturesRegistry: TexturesRegistry
}

export const createMinecraftClient = async (): Promise<MinecraftClientContext> => {
  const texturesRegistry = await createTexturesRegistry()
  const eventBus = new MinecraftEventBus('Client')
  const localStorageManager = new LocalStorageManager()
  let maybeGameLoop: Maybe<GameLoop> = None()
  let maybeSinglePlayerWorker: Maybe<Worker> = None()

  const gui = createGUI({
    eventBus,
    getGameLoop: () => maybeGameLoop,
    localStorageManager,
    texturesRegistry,
  })

  const ctx: MinecraftClientContext = {
    eventBus,
    getGameLoop: () => maybeGameLoop,
    getSinglePlayerWorker: () => maybeSinglePlayerWorker,
    gui,
    localStorageManager,
    texturesRegistry,
  }

  eventBus.subscribe('*', (event) => {
    if (maybeSinglePlayerWorker.isNone()) {
      return
    }

    if (event.getType().startsWith('Client.Request') || event instanceof StartLocalServer) {
      maybeSinglePlayerWorker.value().postMessage(serializeEvent(event))
    }
  })

  eventBus.subscribe(JoinWorld, async (event) => {
    if (maybeGameLoop.isSome()) {
      console.warn(`Received ${event.getType()} but already in a world.`)
      return
    }

    await asyncPipe(new SinglePlayerWorker())
      .tap(() => console.log('Starting single-player worker...'))
      .tap(
        (worker) =>
          (worker.onmessage = (msg) => eventBus.publish(deserializeEvent(eventBus, msg.data))),
      )
      .tap((worker) => (maybeSinglePlayerWorker = Some(worker)))
      .tap(() => eventBus.waitFor(WorkerReady))
      .tap(() => console.log('Single-player worker is ready.'))
      .map(() => localStorageManager.getWorld(event.worldUUID).seed)
      .tap((seed) => console.log(`Starting local server with seed ${seed}...`))
      .tap(() => gui.requestLock())
      .map((seed) => eventBus.request(new StartLocalServer(seed, event.worldUUID), ServerStarted))
      .tap(() => console.log(`Local server started for world ${event.worldUUID}.`))
      .map(() =>
        eventBus.request(
          new RequestPlayerJoin(localStorageManager.getPlayerUUID()),
          ResponsePlayerJoin,
        ),
      )
      .tap((event) => console.log('Player joined the local server.', event))
      .map((res) => createGameLoop(ctx, res.world))
      .tap((gameLoop) => gameLoop.execute())
      .tap((gameLoop) => (maybeGameLoop = Some(gameLoop)))
      .tap(() => console.log(`Joined world ${event.worldUUID}`))
      .tap(() => eventBus.reply(event, new JoinedWorld()))
  })

  eventBus.subscribe(ExitWorld, () => {
    maybeGameLoop.tap((game) => game.dispose())
    maybeGameLoop = None()
    maybeSinglePlayerWorker.tap((worker) => worker.terminate())
    maybeSinglePlayerWorker = None()
    console.log('Exited world.')
  })

  return ctx
}
