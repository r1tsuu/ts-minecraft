import type { MinecraftEvent } from '../shared/MinecraftEvent.ts'

import { asyncPipe } from '../shared/AsyncPipe.ts'
import { BlocksRegistry } from '../shared/BlocksRegistry.ts'
import { serializeEvent } from '../shared/Event.ts'
import { ExitWorld } from '../shared/events/client/ExitWorld.ts'
import { JoinedWorld } from '../shared/events/client/JoinedWorld.ts'
import { JoinWorld } from '../shared/events/client/JoinWorld.ts'
import { RequestPlayerJoin } from '../shared/events/client/RequestPlayerJoin.ts'
import { StartLocalServer } from '../shared/events/client/StartLocalServer.ts'
import { ResponsePlayerJoin } from '../shared/events/server/ResponsePlayerJoin.ts'
import { ServerStarted } from '../shared/events/single-player-worker/ServerStarted.ts'
import { WorkerReady } from '../shared/events/single-player-worker/WorkerReady.ts'
import { type Maybe, None, Some } from '../shared/Maybe.ts'
import { eventBus, Handler, Listener } from '../shared/MinecraftEventBus.ts'
import SinglePlayerWorker from '../worker/SinglePlayerWorker.ts?worker'
import { ClientBlocksRegistry } from './ClientBlocksRegistry.ts'
import { GameSession } from './GameSession.ts'
import { GUI } from './gui/GUI.ts'
import { LocalStorageManager } from './LocalStorageManager.ts'

@Listener()
export class MinecraftClient {
  blocksRegistry = new BlocksRegistry()
  clientBlocksRegistry = new ClientBlocksRegistry(this.blocksRegistry)
  gameSession: Maybe<GameSession> = None()
  gui = new GUI(this)
  localStorageManager = new LocalStorageManager()
  singlePlayerWorker: Maybe<Worker> = None()

  dispose(): void {
    this.gui.dispose()
    this.singlePlayerWorker.tap((worker) => worker.terminate())
    this.gameSession.tap((session) => session.dispose())
    this.gameSession = None()
    this.singlePlayerWorker = None()
  }

  @Handler('*')
  protected forwardEventsToServer(event: MinecraftEvent): void {
    if (this.gameSession.isNone() || this.singlePlayerWorker.isNone()) {
      return
    }

    if (event.getType().startsWith('Client.Request') || event instanceof StartLocalServer) {
      this.singlePlayerWorker.value().postMessage(serializeEvent(event))
    }
  }

  @Handler(ExitWorld)
  protected onExitWorld(): void {
    this.gameSession.tap((session) => session.dispose())
    this.gameSession = None()
    this.singlePlayerWorker.tap((worker) => worker.terminate())
    this.singlePlayerWorker = None()
    console.log('Exited world.')
  }

  @Handler(JoinWorld)
  protected async onJoinWorld(event: JoinWorld): Promise<void> {
    if (this.gameSession.isSome()) {
      console.warn(`Received ${event.getType()} but already in a world.`)
      return
    }

    await asyncPipe(new SinglePlayerWorker())
      .tap((worker) => (worker.onmessage = (msg) => this.forwardEventsToServer(msg.data)))
      .tap((worker) => (this.singlePlayerWorker = Some(worker)))
      .tap(() => eventBus.waitFor(WorkerReady))
      .tap(() => eventBus.request(new StartLocalServer(event.worldUUID), ServerStarted))
      .map(() =>
        eventBus.request(
          new RequestPlayerJoin(this.localStorageManager.getPlayerUUID()),
          ResponsePlayerJoin,
        ),
      )
      .map(({ world }) => new GameSession(this, world))
      .tap((gameSession) => gameSession.enterGameLoop())
      .tap((gameSession) => (this.gameSession = Some(gameSession)))
      .tap(() => console.log(`Joined world ${event.worldUUID}`))
      .tap(() => eventBus.reply(event, new JoinedWorld()))
      .execute()
  }
}
