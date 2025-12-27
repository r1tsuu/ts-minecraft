import type { ContainerScope } from '../shared/Container.ts'

import { BlocksRegistry } from '../shared/BlocksRegistry.ts'
import {
  type AnyMinecraftEvent,
  type MinecraftEvent,
  MinecraftEventQueue,
} from '../shared/MinecraftEventQueue.ts'
import { Scheduler } from '../shared/Scheduler.ts'
import SinglePlayerWorker from '../worker/SinglePlayerWorker.ts?worker'
import { ClientBlocksRegistry } from './blocks.ts'
import { ClientContainer } from './ClientContainer.ts'
import { GameSession } from './GameSession.ts'
import { GUI } from './gui/GUI.ts'
import { LocalStorageManager } from './LocalStorageManager.ts'

@MinecraftEventQueue.ClientListener()
export class MinecraftClient {
  private scope: ContainerScope
  constructor() {
    ClientContainer.registerSingleton(this)
    const scope = ClientContainer.createScope(this)
    scope.registerSingleton(new MinecraftEventQueue('Client'))
    scope.registerSingleton(new BlocksRegistry())
    scope.registerSingleton(new ClientBlocksRegistry())
    scope.registerSingleton(new Scheduler())
    scope.registerSingleton(new LocalStorageManager())
    scope.registerSingleton(new GUI())

    this.scope = scope
  }

  dispose(): void {
    for (const instance of this.scope.listChildren()) {
      instance.dispose()
    }
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

    const gameSession = this.scope.registerSingleton(
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
