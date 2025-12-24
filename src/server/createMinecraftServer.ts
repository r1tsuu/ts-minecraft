import type { SharedConfig } from '../config/createConfig.ts'

import { type BlocksRegistry, createBlocksRegistry } from '../blocks/registry.ts'
import { createMinecraftEventQueue, type MinecraftEventQueue } from '../queue/minecraft.ts'
import { getChunksCoordinatesInRadius } from '../util.ts'
import {
  type DatabaseChunkData,
  type DatabasePlayerData,
  type DatabaseWorldMetaData,
  getWorldDatabase,
} from './worldDatabase.ts'

export type MinecraftServerInstance = {
  config: SharedConfig
  database: Awaited<ReturnType<typeof getWorldDatabase>>
  eventQueue: MinecraftEventQueue
  loadedChunks: DatabaseChunkData[]
  meta: DatabaseWorldMetaData
  players: DatabasePlayerData[]
  registry: BlocksRegistry
}

export const createMinecraftServer = async ({
  config,
  worldDatabaseName,
}: {
  config: MinecraftServerInstance['config']
  worldDatabaseName: string
}) => {
  const database = await getWorldDatabase({ databaseName: worldDatabaseName })
  const eventQueue = createMinecraftEventQueue('SERVER')
  const loadedChunks: DatabaseChunkData[] = []
  const players: DatabasePlayerData[] = await database.fetchPlayers()
  const meta = await database.fetchWorldMeta()

  const spawnChunksCoordinates = getChunksCoordinatesInRadius({
    centerChunkX: 0,
    centerChunkZ: 0,
    chunkRadius: config.spawnChunkRadius,
  })

  const server: MinecraftServerInstance = {
    config,
    database,
    eventQueue,
    loadedChunks,
    meta,
    players,
    registry: createBlocksRegistry(),
  }

  // Setup initial world state if this is the first server start
  if (!meta.lastLoadedAt) {
  }
}
