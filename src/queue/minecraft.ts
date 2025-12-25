/* ===========================================================
 * Minecraft-specific queue
 * =========================================================== */

import type { DatabaseChunkData, DatabasePlayerData } from '../server/worldDatabase.ts'
import type { UUID } from '../types.ts'

import { createEventQueue } from './createEventQueue.ts'

export const createMinecraftEventQueue = (environment: 'CLIENT' | 'SERVER') => {
  const queue = createEventQueue<{
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
    SERVER_STARTED: {}
    SERVER_TICK: {
      currentTick: number
    }
  }>({ environment })

  return queue
}

export type MinecraftEventQueue = ReturnType<typeof createMinecraftEventQueue>
export type MinecraftEventQueueEvent = Parameters<Parameters<MinecraftEventQueue['on']>[1]>[0]
