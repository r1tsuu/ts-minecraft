import { createConfig, type SharedConfig } from '../config.ts'
import {
  type AnyMinecraftEvent,
  type MinecraftEvent,
  MinecraftEventQueue,
} from '../queue/MinecraftQueue.ts'
import SinglePlayerWorker from '../worker/SinglePlayerWorker.ts?worker'
import { type ClientBlockRegisty, createClientBlockRegistry } from './blocks.ts'
import { GameSession } from './GameSession.ts'
import { GUI } from './gui/GUI.ts'
import { LocalStorageManager } from './LocalStorageManager.ts'

export class MinecraftClient {
  blocksRegistry: ClientBlockRegisty
  config: SharedConfig
  dispositions: Function[] = []
  eventQueue: MinecraftEventQueue
  gameSession: GameSession | null = null
  gui: GUI | null = null
  localStorageManager: LocalStorageManager

  constructor() {
    this.eventQueue = new MinecraftEventQueue('CLIENT')

    this.config = createConfig()
    this.blocksRegistry = createClientBlockRegistry()
    this.localStorageManager = new LocalStorageManager()

    this.gui = new GUI(this)

    this.setupEventListeners()
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

    for (const dispose of this.dispositions) {
      dispose()
    }
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

  private onExitWorld(): void {
    if (this.gameSession) {
      this.gameSession.dispose()
      this.gameSession = null
    }
  }

  private async onJoinWorld(event: MinecraftEvent<'Client.JoinWorld'>): Promise<void> {
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
      if (message.data.metadata.environment === 'SERVER') {
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

    const gameSession = new GameSession(this, singlePlayerWorker, {
      initialChunksFromServer: serverStartedResponse.payload.loadedChunks,
      player: playerJoinResponse.payload.playerData,
    })

    this.gameSession = gameSession

    gameSession.addOnDisposeCallback(unsubscribe)
    gameSession.startGameLoop()

    this.eventQueue.respond(event, 'Client.JoinedWorld', {})
  }

  private setupEventListeners(): void {
    this.dispositions.push(this.eventQueue.on('Client.JoinWorld', this.onJoinWorld.bind(this)))
    this.dispositions.push(this.eventQueue.on('Client.ExitWorld', this.onExitWorld.bind(this)))
  }

  private shouldForwardEventToServer(event: AnyMinecraftEvent): boolean {
    if (event.metadata.environment === 'SERVER') {
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
