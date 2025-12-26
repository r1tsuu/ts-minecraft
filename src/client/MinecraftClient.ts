import {
  type AnyMinecraftEvent,
  type MinecraftEvent,
  MinecraftEventQueue,
} from '../queue/MinecraftQueue.ts'
import { Scheduler } from '../shared/Scheduler.ts'
import SinglePlayerWorker from '../worker/SinglePlayerWorker.ts?worker'
import { type ClientBlockRegisty, createClientBlockRegistry } from './blocks.ts'
import { GameSession } from './GameSession.ts'
import { GUI } from './gui/GUI.ts'
import { LocalStorageManager } from './LocalStorageManager.ts'

export class MinecraftClient {
  blocksRegistry: ClientBlockRegisty = createClientBlockRegistry()
  eventQueue: MinecraftEventQueue = new MinecraftEventQueue('Client')
  gameSession: GameSession | null = null
  gui: GUI | null = null
  localStorageManager: LocalStorageManager = new LocalStorageManager()
  scheduler: Scheduler = new Scheduler()

  constructor() {
    this.gui = new GUI(this)
    this.eventQueue.registerHandlers(this)
  }

  dispose(): void {
    if (this.gameSession) {
      this.gameSession.dispose()
      this.gameSession = null
    }

    if (this.gui) {
      this.gui.dispose()
      this.gui = null
    }

    MinecraftEventQueue.unregisterHandlers(this)
  }

  getGameSession(): GameSession {
    if (!this.gameSession) {
      throw new Error('Game instance is not initialized')
    }

    return this.gameSession
  }

  getGUI(): GUI {
    if (!this.gui) {
      throw new Error('UI instance is not initialized')
    }

    return this.gui
  }

  @MinecraftEventQueue.Handler('Client.ExitWorld')
  protected onExitWorld(): void {
    if (this.gameSession) {
      this.gameSession.dispose()
      this.gameSession = null
    }
  }

  @MinecraftEventQueue.Handler('Client.JoinWorld')
  protected async onJoinWorld(event: MinecraftEvent<'Client.JoinWorld'>): Promise<void> {
    if (this.gameSession) {
      console.warn(`Received ${event.type} but already in a world.`)
      return
    }

    const singlePlayerWorker = new SinglePlayerWorker()

    const unsubscribe = this.eventQueue.on('*', (event) => {
      if (this.shouldForwardEventToServer(event)) {
        singlePlayerWorker.postMessage(event.intoRaw())
      }
    })

    singlePlayerWorker.onmessage = (message: MessageEvent<AnyMinecraftEvent>) => {
      if (message.data.metadata.environment === 'Server') {
        this.eventQueue.emit(message.data.type, message.data.payload, message.data.eventUUID, {
          environment: message.data.metadata.environment,
          isForwarded: true,
        })
      }
    }

    console.log('Waiting for single player worker to be ready...')
    await this.eventQueue.waitUntilOn('SinglePlayerWorker.WorkerReady')
    console.log('Single player worker is ready.')
    const serverStartedResponse = await this.eventQueue.emitAndWaitResponse(
      'Client.StartLocalServer',
      {
        worldDatabaseName: `world_${event.payload.worldUUID}`,
      },
      'SinglePlayerWorker.ServerStarted',
    )

    console.log('Server started response:', serverStartedResponse)

    const playerJoinResponse = await this.eventQueue.emitAndWaitResponse(
      'Client.RequestPlayerJoin',
      {
        playerUUID: this.localStorageManager.getPlayerUUID(),
      },
      'Server.ResponsePlayerJoin',
    )

    console.log('Player join response:', playerJoinResponse)

    this.gameSession = new GameSession(this, {
      initialChunksFromServer: serverStartedResponse.payload.loadedChunks,
      initialPlayerFromServer: playerJoinResponse.payload.playerData,
    })

    this.gameSession.addOnDisposeCallback(unsubscribe)
    this.gameSession.addOnDisposeCallback(() => singlePlayerWorker.terminate())
    this.gameSession.enterGameLoop()

    this.eventQueue.respond(event, 'Client.JoinedWorld', {})
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
