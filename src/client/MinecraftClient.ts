import {
  type AnyMinecraftEvent,
  type MinecraftEvent,
  MinecraftEventQueue,
} from '../queue/MinecraftQueue.ts'
import { BlocksRegistry } from '../shared/BlocksRegistry.ts'
import { Scheduler } from '../shared/Scheduler.ts'
import SinglePlayerWorker from '../worker/SinglePlayerWorker.ts?worker'
import { ClientBlocksRegistry } from './blocks.ts'
import { ClientContainer } from './ClientContainer.ts'
import { GameSession } from './GameSession.ts'
import { GUI } from './gui/GUI.ts'
import { LocalStorageManager } from './LocalStorageManager.ts'

export class MinecraftClient {
  constructor() {
    ClientContainer.registerSingleton(this)
    ClientContainer.registerSingleton(new BlocksRegistry())
    ClientContainer.registerSingleton(new ClientBlocksRegistry())
    ClientContainer.registerSingleton(new MinecraftEventQueue('Client'))
    ClientContainer.registerSingleton(new Scheduler())
    ClientContainer.registerSingleton(new LocalStorageManager())
    ClientContainer.registerSingleton(new GUI())
    ClientContainer.resolve(MinecraftEventQueue).unwrap().registerHandlers(this)
  }

  dispose(): void {
    MinecraftEventQueue.unregisterHandlers(this)

    const gameSession = ClientContainer.resolve(GameSession)

    if (gameSession.isSome()) {
      gameSession.value.dispose()
      ClientContainer.unregister(GameSession)
    }

    const gui = ClientContainer.resolve(GUI)
    if (gui.isSome()) {
      gui.value.dispose()
      ClientContainer.unregister(GUI)
    }

    ClientContainer.unregister(MinecraftEventQueue)
    ClientContainer.unregister(Scheduler)
    ClientContainer.unregister(LocalStorageManager)
    ClientContainer.unregister(MinecraftClient)
  }

  @MinecraftEventQueue.Handler('Client.ExitWorld')
  protected onExitWorld(): void {
    const gameSession = ClientContainer.resolve(GameSession)

    if (gameSession.isSome()) {
      gameSession.value.dispose()
      ClientContainer.unregister(GameSession)
    }
  }

  @MinecraftEventQueue.Handler('Client.JoinWorld')
  protected async onJoinWorld(event: MinecraftEvent<'Client.JoinWorld'>): Promise<void> {
    if (ClientContainer.resolve(GameSession).isSome()) {
      console.warn(`Received ${event.type} but already in a world.`)
      return
    }

    const singlePlayerWorker = new SinglePlayerWorker()

    const eventQueue = ClientContainer.resolve(MinecraftEventQueue).unwrap()

    const unsubscribe = eventQueue.on('*', (event) => {
      if (this.shouldForwardEventToServer(event)) {
        singlePlayerWorker.postMessage(event.intoRaw())
      }
    })

    singlePlayerWorker.onmessage = (message: MessageEvent<AnyMinecraftEvent>) => {
      if (message.data.metadata.environment === 'Server') {
        eventQueue.emit(message.data.type, message.data.payload, message.data.eventUUID, {
          environment: message.data.metadata.environment,
          isForwarded: true,
        })
      }
    }

    console.log('Waiting for single player worker to be ready...')
    await eventQueue.waitUntilOn('SinglePlayerWorker.WorkerReady')
    console.log('Single player worker is ready.')
    const serverStartedResponse = await eventQueue.emitAndWaitResponse(
      'Client.StartLocalServer',
      {
        worldDatabaseName: `world_${event.payload.worldUUID}`,
      },
      'SinglePlayerWorker.ServerStarted',
    )

    console.log('Server started response:', serverStartedResponse)

    const playerJoinResponse = await eventQueue.emitAndWaitResponse(
      'Client.RequestPlayerJoin',
      {
        playerUUID: ClientContainer.resolve(LocalStorageManager).unwrap().getPlayerUUID(),
      },
      'Server.ResponsePlayerJoin',
    )

    console.log('Player join response:', playerJoinResponse)

    const gameSession = ClientContainer.registerSingleton(
      new GameSession(
        serverStartedResponse.payload.loadedChunks,
        playerJoinResponse.payload.playerData,
      ),
    )

    gameSession.addOnDisposeCallback(unsubscribe)
    gameSession.addOnDisposeCallback(() => singlePlayerWorker.terminate())
    gameSession.enterGameLoop()

    eventQueue.respond(event, 'Client.JoinedWorld', {})
  }

  private shouldForwardEventToServer(event: AnyMinecraftEvent): boolean {
    if (event.metadata.environment === 'Server') {
      return false
    }

    if (event.type.startsWith('Client.Request')) {
      return true
    }

    if (event.type === 'Client.StartLocalServer') {
      return true
    }

    return false
  }
}
