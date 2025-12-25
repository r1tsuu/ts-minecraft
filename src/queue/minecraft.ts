/* ===========================================================
 * Minecraft-specific queue
 * =========================================================== */

import type { DatabaseChunkData, DatabasePlayerData } from '../server/worldDatabase.ts'
import type { UUID } from '../types.ts'

import { createEventQueue } from './createEventQueue.ts'

export const createMinecraftEventQueue = (environment: 'CLIENT' | 'SERVER') => {
  const queue = createEventQueue<{
    EXIT_WORLD: {}
    EXITED_WORLD: {}
    JOIN_WORLD: {
      worldUUID: UUID
    }
    JOINED_WORLD: {}
    REQUEST_CHUNKS_LOAD: {
      chunks: { chunkX: number; chunkZ: number }[]
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
    START_LOCAL_SERVER: {
      worldDatabaseName: string
    }
    WORKER_READY: {}
  }>({ environment })

  return queue
}

export type MinecraftEventQueue = ReturnType<typeof createMinecraftEventQueue>
export type MinecraftEventQueueEvent = Parameters<Parameters<MinecraftEventQueue['on']>[1]>[0]
