import type { MinecraftEvent } from '../shared/MinecraftEvent.ts'

import { asyncPipe } from '../shared/AsyncPipe.ts'
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
import { GameLoop } from './GameLoop.ts'
import { GUI } from './gui/GUI.ts'
import { LocalStorageManager } from './LocalStorageManager.ts'

export class MinecraftClient {
  blocksRegistry = new BlocksRegistry()
  clientBlocksRegistry = new ClientBlocksRegistry(this.blocksRegistry)
  eventBus = new MinecraftEventBus('Client')
  gameLoop: Maybe<GameLoop> = None()
  gui: GUI
  localStorageManager = new LocalStorageManager()
  singlePlayerWorker: Maybe<Worker> = None()

  constructor() {
    this.gui = new GUI(this)

    this.eventBus.subscribe('*', this.forwardEventsToServer.bind(this))
    this.eventBus.subscribe(JoinWorld, this.onJoinWorld.bind(this))
    this.eventBus.subscribe(ExitWorld, this.onExitWorld.bind(this))
  }

  dispose(): void {
    this.gui.dispose()
    this.singlePlayerWorker.tap((worker) => worker.terminate())
    this.gameLoop.tap((game) => game.dispose())
    this.gameLoop = None()
    this.singlePlayerWorker = None()
  }

  private forwardEventsToServer(event: MinecraftEvent): void {
    if (this.singlePlayerWorker.isNone()) {
      return
    }

    if (event.getType().startsWith('Client.Request') || event instanceof StartLocalServer) {
      this.singlePlayerWorker.value().postMessage(serializeEvent(event))
    }
  }

  private onExitWorld(): void {
    this.gameLoop.tap((game) => game.dispose())
    this.gameLoop = None()
    this.singlePlayerWorker.tap((worker) => worker.terminate())
    this.singlePlayerWorker = None()
    console.log('Exited world.')
  }

  private async onJoinWorld(event: JoinWorld): Promise<void> {
    if (this.gameLoop.isSome()) {
      console.warn(`Received ${event.getType()} but already in a world.`)
      return
    }

    await asyncPipe(new SinglePlayerWorker())
      .tap(
        (worker) =>
          (worker.onmessage = (msg) =>
            this.eventBus.publish(deserializeEvent(this.eventBus, msg.data))),
      )
      .tap((worker) => (this.singlePlayerWorker = Some(worker)))
      .tap(() => this.eventBus.waitFor(WorkerReady))
      .tap(() => console.log('Single-player worker is ready.'))
      .tap(() => this.eventBus.request(new StartLocalServer(event.worldUUID), ServerStarted))
      .tap(() => console.log(`Local server started for world ${event.worldUUID}.`))
      .map(() =>
        this.eventBus.request(
          new RequestPlayerJoin(this.localStorageManager.getPlayerUUID()),
          ResponsePlayerJoin,
        ),
      )
      .map(({ world }) => new GameLoop(this, world))
      .tap((gameLoop) => gameLoop.execute())
      .tap((gameLoop) => (this.gameLoop = Some(gameLoop)))
      .tap(() => console.log(`Joined world ${event.worldUUID}`))
      .tap(() => this.eventBus.reply(event, new JoinedWorld()))
      .execute()
  }
}
