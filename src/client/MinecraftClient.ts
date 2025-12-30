import type { MinecraftEvent } from '../shared/MinecraftEvent.ts'

import { asyncPipe } from '../shared/AsyncPipe.ts'
import { BlocksRegistry } from '../shared/BlocksRegistry.ts'
import { isComponent } from '../shared/Component.ts'
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
import { MinecraftEventBus } from '../shared/MinecraftEventBus.ts'
import { pipe } from '../shared/Pipe.ts'
import { Scheduler } from '../shared/Scheduler.ts'
import SinglePlayerWorker from '../worker/SinglePlayerWorker.ts?worker'
import { ClientBlocksRegistry } from './ClientBlocksRegistry.ts'
import { ClientContainer } from './ClientContainer.ts'
import { GameSession } from './GameSession.ts'
import { GUI } from './gui/GUI.ts'
import { LocalStorageManager } from './LocalStorageManager.ts'

@MinecraftEventBus.ClientListener()
export class MinecraftClient {
  gameSession: Maybe<GameSession> = None()
  singlePlayerWorker: Maybe<Worker> = None()

  private scope = pipe(ClientContainer.createScope())
    .tap((scope) => scope.registerSingleton(new MinecraftEventBus('Client')))
    .tap((scope) => scope.registerSingleton(new BlocksRegistry()))
    .tap((scope) => scope.registerSingleton(new ClientBlocksRegistry()))
    .tap((scope) => scope.registerSingleton(new Scheduler()))
    .tap((scope) => scope.registerSingleton(new LocalStorageManager()))
    .tap((scope) => scope.registerSingleton(new GUI()))
    .value()

  private eventBus = this.scope.resolve(MinecraftEventBus).unwrap()
  private localStorageManager = this.scope.resolve(LocalStorageManager).unwrap()

  dispose(): void {
    for (const instance of this.scope.iterateInstances()) {
      if (isComponent(instance)) {
        instance.dispose()
      }
    }

    this.singlePlayerWorker.tap((worker) => worker.terminate())
    this.gameSession.tap((session) => session.dispose())
    this.scope.destroyScope()
    this.gameSession = None()
    this.singlePlayerWorker = None()
  }

  @MinecraftEventBus.Handler('*')
  protected forwardEventsToServer(event: MinecraftEvent): void {
    if (this.gameSession.isNone() || this.singlePlayerWorker.isNone()) {
      return
    }

    if (event.getType().startsWith('Client.Request') || event instanceof StartLocalServer) {
      this.singlePlayerWorker.value().postMessage(serializeEvent(event))
    }
  }

  @MinecraftEventBus.Handler(ExitWorld)
  protected onExitWorld(): void {
    const gameSession = ClientContainer.resolve(GameSession)

    if (gameSession.isSome()) {
      gameSession.value().dispose()
      ClientContainer.unregister(GameSession)
    }
  }
  @MinecraftEventBus.Handler(JoinWorld)
  protected async onJoinWorld(event: JoinWorld): Promise<void> {
    if (this.gameSession.isSome()) {
      console.warn(`Received ${event.getType()} but already in a world.`)
      return
    }

    await asyncPipe(new SinglePlayerWorker())
      .tap((worker) => (worker.onmessage = (msg) => this.forwardEventsToServer(msg.data)))
      .tap((worker) => (this.singlePlayerWorker = Some(worker)))
      .tap(() => this.eventBus.waitFor(WorkerReady))
      .tap(() => this.eventBus.request(new StartLocalServer(event.worldUUID), ServerStarted))
      .map(() =>
        this.eventBus.request(
          new RequestPlayerJoin(this.localStorageManager.getPlayerUUID()),
          ResponsePlayerJoin,
        ),
      )
      .map(({ world }) => new GameSession(world))
      .tap((gameSession) => this.scope.registerSingleton(gameSession))
      .tap((gameSession) => gameSession.enterGameLoop())
      .tap((gameSession) => (this.gameSession = Some(gameSession)))
      .tap(() => console.log(`Joined world ${event.worldUUID}`))
      .tap(() => this.eventBus.reply(event, new JoinedWorld()))
      .execute()
  }
}
