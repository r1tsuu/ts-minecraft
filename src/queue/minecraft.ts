/* ===========================================================
 * Minecraft-specific queue
 * =========================================================== */

import type { BlockInWorld } from '../types.ts'
import type { DatabasePlayerData } from '../worker/database.ts'
import type { ActiveWorld } from '../worker/types.ts'

import { createEventQueue } from './createEventQueue.ts'

export const createMinecraftEventQueue = (environment: 'CLIENT' | 'SERVER') => {
  const queue = createEventQueue<{
    REQUEST_CHUNKS: {
      chunksCoordinates: {
        chunkX: number
        chunkZ: number
      }[]
      worldID: number
    }

    REQUEST_CREATE_WORLD: {
      name: string
      seed: string
    }

    REQUEST_DELETE_WORLD: {
      worldID: number
    }

    REQUEST_INITIALIZE_WORLD: {
      worldID: number
    }

    REQUEST_LIST_WORLDS: {}

    REQUEST_STOP_ACTIVE_WORLD: {}

    REQUEST_SYNC_PLAYER: {
      playerData: DatabasePlayerData
    }

    RESPONSE_ACTIVE_WORLD_STOPPED: {}

    RESPONSE_CHUNKS_GENERATED: {
      chunks: {
        blocks: BlockInWorld[]
        chunkX: number
        chunkZ: number
        id: number
      }[]
    }

    RESPONSE_INITIALIZED: {}

    RESPONSE_LIST_WORLDS: {
      worlds: {
        createdAt: Date
        id: number
        name: string
        seed: string
      }[]
    }

    RESPONSE_PLAYER_SYNCED: {}

    RESPONSE_WORLD_CREATED: {
      createdAt: Date
      id: number
      name: string
      seed: string
    }

    RESPONSE_WORLD_DELETED: {
      worldID: number
    }

    RESPONSE_WORLD_INITIALIZED: ActiveWorld
  }>({ environment })

  return queue
}

export type MinecraftEventQueue = ReturnType<typeof createMinecraftEventQueue>
