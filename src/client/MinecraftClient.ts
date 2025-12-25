import { createConfig, type SharedConfig } from '../config.ts'
import {
  type AnyMinecraftEvent,
  createMinecraftEventQueue,
  type MinecraftEvent,
  type MinecraftEventQueue,
} from '../queue/minecraft.ts'
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
    this.eventQueue = createMinecraftEventQueue({
      environment: 'CLIENT',
    })

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

  private async onJoinWorld(event: MinecraftEvent<'JOIN_WORLD'>): Promise<void> {
    if (this.gameSession) {
      console.warn('Received JOIN_WORLD but already in a world.')
      return
    }

    const singlePlayerWorker = new SinglePlayerWorker()

    const unsubscribe = this.eventQueue.on('*', (event) => {
      if (this.shouldForwardEventToServer(event)) {
        singlePlayerWorker.postMessage(event.serialize())
      }
    })

    singlePlayerWorker.onmessage = (message: MessageEvent<AnyMinecraftEvent>) => {
      if (message.data.from === 'SERVER') {
        this.eventQueue.emit(
          message.data.type,
          message.data.payload,
          message.data.eventUUID,
          message.data.timestamp,
          message.data.from,
          true,
        )
      }
    }

    console.log('Waiting for single player worker to be ready...')
    await this.eventQueue.waitUntilOn('SINGLEPLAYER_WORKER_READY')
    console.log('Single player worker is ready.')
    const serverStartedResponse = await this.eventQueue.emitAndWaitResponse(
      'START_LOCAL_SERVER',
      {
        worldDatabaseName: `world_${event.payload.worldUUID}`,
      },
      'SERVER_STARTED',
    )

    console.log('Server started response:', serverStartedResponse)

    const playerJoinResponse = await this.eventQueue.emitAndWaitResponse(
      'REQUEST_PLAYER_JOIN',
      {
        playerUUID: this.localStorageManager.getPlayerUUID(),
      },
      'RESPONSE_PLAYER_JOIN',
    )

    const gameSession = new GameSession(this, singlePlayerWorker, {
      initialChunksFromServer: serverStartedResponse.payload.loadedChunks,
      player: playerJoinResponse.payload.playerData,
    })

    this.gameSession = gameSession

    gameSession.addOnDisposeCallback(unsubscribe)
    gameSession.startGameLoop()

    event.respond('JOINED_WORLD', {})
  }

  private setupEventListeners(): void {
    this.dispositions.push(this.eventQueue.on('JOIN_WORLD', this.onJoinWorld.bind(this)))
    this.dispositions.push(this.eventQueue.on('EXIT_WORLD', this.onExitWorld.bind(this)))
  }

  private shouldForwardEventToServer(event: AnyMinecraftEvent): boolean {
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
}
