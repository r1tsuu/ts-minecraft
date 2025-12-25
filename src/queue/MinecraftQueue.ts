/* ===========================================================
 * Minecraft-specific queue
 * =========================================================== */

import type { DatabaseChunkData, DatabasePlayerData } from '../server/WorldDatabase.ts'
import type { ChunkCoordinates, UUID } from '../types.ts'

import { type AnyEvent, Event } from './Event.ts'
import { EventQueue } from './EventQueue.ts'

export type AnyMinecraftEvent = AnyEvent<MinecraftEventsData, MinecraftEventMetadata>

type MinecraftEventMetadata = {
  environment: 'CLIENT' | 'SERVER'
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

type MinecraftEventType = keyof MinecraftEventsData

export class MinecraftEvent<T extends ({} & string) | MinecraftEventType> extends Event<
  T,
  T extends keyof MinecraftEventsData ? MinecraftEventsData[T] : any,
  MinecraftEventMetadata
> {}

export class MinecraftEventQueue extends EventQueue<MinecraftEventsData, MinecraftEventMetadata> {
  constructor(environment: 'CLIENT' | 'SERVER') {
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

    // this.on('*', (event) => {
    //   console.log(`[MinecraftEventQueue][${environment}] Event emitted:`, event)
    // })
  }
}
