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
  EXIT_WORLD: {}
  JOIN_WORLD: {
    worldUUID: UUID
  }
  JOINED_WORLD: {}
  REQUEST_CHUNKS_LOAD: {
    chunks: ChunkCoordinates[]
  }
  REQUEST_PLAYER_JOIN: {
    playerUUID: UUID
  }
  REQUEST_SYNC_PLAYER: {
    playerData: DatabasePlayerData
  }
  RESPONSE_CHUNKS_LOAD: {
    chunks: DatabaseChunkData[]
  }
  RESPONSE_PLAYER_JOIN: {
    playerData: DatabasePlayerData
  }
  RESPONSE_SYNC_PLAYER: {}
  SERVER_STARTED: {
    loadedChunks: DatabaseChunkData[]
  }
  SERVER_TICK: {
    currentTick: number
  }
  SINGLEPLAYER_WORKER_READY: {}
  START_LOCAL_SERVER: {
    worldDatabaseName: string
  }
}

type MinecraftEventType = keyof MinecraftEventsData

export class MinecraftEvent<T extends MinecraftEventType> extends Event<
  T,
  MinecraftEventsData[T],
  MinecraftEventMetadata
> {}

const debug = true

export class MinecraftEventQueue extends EventQueue<MinecraftEventsData, MinecraftEventMetadata> {
  constructor(environment: 'CLIENT' | 'SERVER') {
    super()

    this.addBeforeEmitHook((event) => {
      event.metadata.environment = event.metadata.environment ?? environment
      event.metadata.isForwarded = event.metadata.isForwarded ?? false
    })

    if (debug) {
      this.on('*', (event) => {
        console.log(`[MinecraftEventQueue][${environment}] Event emitted:`, event)
      })
    }
  }
}
