/* ===========================================================
 * Minecraft-specific queue
 * =========================================================== */

import type { DatabaseChunkData, DatabasePlayerData } from '../server/WorldDatabase.ts'
import type { ChunkCoordinates, UUID } from '../types.ts'

import { type AnyEvent, Event } from './Event.ts'
import { EventQueue } from './EventQueue.ts'

export type AnyMinecraftEvent = AnyEvent<MinecraftEventsData, MinecraftEventMetadata>

export type MinecraftEventType = keyof MinecraftEventsData

type MinecraftEventMetadata = {
  environment: 'Client' | 'Server'
  isForwarded: boolean
}

type MinecraftEventsData = {
  'Client.ExitWorld': {}
  'Client.JoinedWorld': {}
  'Client.JoinWorld': {
    worldUUID: UUID
  }
  'Client.RequestChunksLoad': {
    chunks: ChunkCoordinates[]
  }
  'Client.RequestPlayerJoin': {
    playerUUID: UUID
  }
  'Client.RequestSyncPlayer': {
    playerData: DatabasePlayerData
  }
  'Client.StartLocalServer': {
    worldDatabaseName: string
  }
  'Server.ResponseChunksLoad': {
    chunks: DatabaseChunkData[]
  }
  'Server.ResponsePlayerJoin': {
    playerData: DatabasePlayerData
  }
  'Server.ResponseSyncPlayer': {}
  'Server.ServerTick': {
    currentTick: number
  }
  'SinglePlayerWorker.ServerStarted': {
    loadedChunks: DatabaseChunkData[]
  }
  'SinglePlayerWorker.WorkerReady': {}
}

export class MinecraftEvent<T extends ({} & string) | MinecraftEventType> extends Event<
  T,
  T extends keyof MinecraftEventsData ? MinecraftEventsData[T] : any,
  MinecraftEventMetadata
> {}

export class MinecraftEventQueue extends EventQueue<MinecraftEventsData, MinecraftEventMetadata> {
  constructor(environment: 'Client' | 'Server') {
    super()

    const coreEvents: {
      [K in keyof MinecraftEventsData]: K
    } = {
      'Client.ExitWorld': 'Client.ExitWorld',
      'Client.JoinedWorld': 'Client.JoinedWorld',
      'Client.JoinWorld': 'Client.JoinWorld',
      'Client.RequestChunksLoad': 'Client.RequestChunksLoad',
      'Client.RequestPlayerJoin': 'Client.RequestPlayerJoin',
      'Client.RequestSyncPlayer': 'Client.RequestSyncPlayer',
      'Client.StartLocalServer': 'Client.StartLocalServer',
      'Server.ResponseChunksLoad': 'Server.ResponseChunksLoad',
      'Server.ResponsePlayerJoin': 'Server.ResponsePlayerJoin',
      'Server.ResponseSyncPlayer': 'Server.ResponseSyncPlayer',
      'Server.ServerTick': 'Server.ServerTick',
      'SinglePlayerWorker.ServerStarted': 'SinglePlayerWorker.ServerStarted',
      'SinglePlayerWorker.WorkerReady': 'SinglePlayerWorker.WorkerReady',
    }

    for (const eventType of Object.keys(coreEvents)) {
      this.registerEventType(eventType)
    }

    this.addBeforeEmitHook((event) => {
      event.metadata.environment = event.metadata.environment ?? environment
      event.metadata.isForwarded = event.metadata.isForwarded ?? false
    })
  }

  /**
   * Decorator to mark a method as an event handler for Minecraft events.
   * @example
   * ```ts
   * class MyClass {
   *   @MinecraftEventQueue.Handler('Client.JoinWorld')
   *   onJoinWorld(event: MinecraftEvent<'Client.JoinWorld'>) {
   *     console.log('Player joined world with UUID:', event.payload.worldUUID)
   *   }
   * }
   * ```
   */
  static Handler<T extends '*' | ({} & string) | MinecraftEventType>(eventType: T) {
    return EventQueue.Handler<T>(eventType)
  }
}
