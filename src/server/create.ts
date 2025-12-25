import type { BlockInWorld, UUID } from '../types.ts'

import { type BlocksRegistry, createBlocksRegistry } from '../blocks/registry.ts'
import { createConfig, type SharedConfig } from '../config.ts'
import { type MinecraftEventQueue } from '../queue/minecraft.ts'
import {
  findByXYZ,
  findChunkByXZ,
  getChunksCoordinatesInRadius,
  rawVector3,
  zeroRawVector3,
} from '../util.ts'
import { createTerrainGenerator, type TerrainGenerator } from './terrainGenerator.ts'
import {
  type DatabaseChunkData,
  type DatabasePlayerData,
  type DatabaseWorldMetaData,
  getWorldDatabase,
} from './worldDatabase.ts'

export type MinecraftServerInstance = {
  blocksRegistry: BlocksRegistry
  config: SharedConfig
  currentTick: number
  database: Awaited<ReturnType<typeof getWorldDatabase>>
  destroy: () => Promise<void>
  eventQueue: MinecraftEventQueue
  loadedChunks: DatabaseChunkData[]
  meta: DatabaseWorldMetaData
  nextTickScheduledAt: number
  players: DatabasePlayerData[]
  terrainGenerator: TerrainGenerator
}

export const createMinecraftServer = async ({
  eventQueue,
  serverStartedEventUUID,
  worldDatabaseName,
}: {
  eventQueue: MinecraftEventQueue
  serverStartedEventUUID: UUID
  worldDatabaseName: string
}) => {
  const database = await getWorldDatabase({ databaseName: worldDatabaseName })
  const loadedChunks: DatabaseChunkData[] = []
  const players: DatabasePlayerData[] = await database.fetchPlayers()
  const meta = await database.fetchWorldMeta()

  const config = createConfig()

  const spawnChunksCoordinates = getChunksCoordinatesInRadius({
    centerChunkX: 0,
    centerChunkZ: 0,
    chunkRadius: config.spawnChunkRadius,
  })

  const blocksRegistry = createBlocksRegistry()

  // let serverTickTimeout: null | number = null

  const server: MinecraftServerInstance = {
    blocksRegistry,
    config,
    currentTick: 0,
    database,
    destroy: async () => {},
    eventQueue,
    loadedChunks,
    meta,
    nextTickScheduledAt: 0,
    players,
    terrainGenerator: createTerrainGenerator({ blocksRegistry, config }),
  }

  // Setup initial world state if this is the first server start
  if (!meta.lastLoadedAt) {
    for (const coordinates of spawnChunksCoordinates) {
      const chunk = server.terrainGenerator.generateChunk(coordinates.chunkX, coordinates.chunkZ)
      loadedChunks.push(chunk)
    }

    await database.createChunks(loadedChunks)
  } else {
    const chunks = await database.fetchChunksByUUIDs({
      uuids: meta.loadedChunks.map((chunk) => chunk.uuid),
    })
    loadedChunks.push(...chunks)
  }

  meta.lastLoadedAt = new Date()

  const syncMeta = async () => {
    meta.loadedChunks = loadedChunks.map((chunk) => ({
      chunkX: chunk.chunkX,
      chunkZ: chunk.chunkZ,
      uuid: chunk.uuid,
    }))
    await database.updateWorldMeta(meta)
  }

  await syncMeta()

  eventQueue.emit(
    'SERVER_STARTED',
    {
      loadedChunks,
    },
    serverStartedEventUUID,
  )

  eventQueue.on('REQUEST_PLAYER_JOIN', async (event) => {
    let playerData = server.players.find((player) => player.uuid === event.payload.playerUUID)

    if (!playerData) {
      const centralChunk = findChunkByXZ(loadedChunks, 0, 0)!

      let latestBlock: BlockInWorld | null = null

      for (let y = 0; y < config.worldHeight; y++) {
        const maybeBlock = findByXYZ(centralChunk.data.blocks, 0, y, 0)

        if (maybeBlock) {
          latestBlock = maybeBlock
        } else {
          break
        }
      }

      if (!latestBlock) {
        throw new Error('TODO: Include spawn platform generation')
      }

      playerData = {
        canJump: true,
        direction: zeroRawVector3(),
        jumpStrength: config.defaultPlayerJumpStrength,
        pitch: 0,
        position: rawVector3(latestBlock.x, latestBlock.y + 4, latestBlock.z),
        uuid: event.payload.playerUUID,
        velocity: zeroRawVector3(),
        yaw: 0,
      }

      await database.createPlayer(playerData)
      server.players.push(playerData)
    }

    event.respond('RESPONSE_PLAYER_JOIN', {
      playerData,
    })
  })

  eventQueue.on('REQUEST_CHUNKS_LOAD', async (event) => {
    const response: DatabaseChunkData[] = []

    const coordsToLoad: { chunkX: number; chunkZ: number }[] = []

    for (const chunk of event.payload.chunks) {
      // first check if chunk is already loaded
      const loadedChunk = findChunkByXZ(loadedChunks, chunk.chunkX, chunk.chunkZ)

      if (loadedChunk) {
        response.push(loadedChunk)
      } else {
        coordsToLoad.push({ chunkX: chunk.chunkX, chunkZ: chunk.chunkZ })
      }
    }

    const loadedFromDb = await database.fetchChunksByCoordinates({ coordinates: coordsToLoad })

    for (const chunk of loadedFromDb) {
      loadedChunks.push(chunk)
      response.push(chunk)
    }

    const chunksToInsertToDb: DatabaseChunkData[] = []
    for (const coord of coordsToLoad) {
      const alreadyLoaded = findChunkByXZ(loadedChunks, coord.chunkX, coord.chunkZ)

      if (!alreadyLoaded) {
        const generatedChunk = server.terrainGenerator.generateChunk(coord.chunkX, coord.chunkZ)
        loadedChunks.push(generatedChunk)
        response.push(generatedChunk)
        chunksToInsertToDb.push(generatedChunk)
      }
    }

    if (chunksToInsertToDb.length > 0) {
      await database.createChunks(chunksToInsertToDb)
    }

    await syncMeta()
    event.respond('RESPONSE_CHUNKS_LOAD', {
      chunks: response,
    })
  })

  eventQueue.on('REQUEST_SYNC_PLAYER', async (event) => {
    const player = server.players.find((p) => p.uuid === event.payload.playerData.uuid)

    if (player) {
      Object.assign(player, event.payload.playerData)
      await database.updatePlayer(player)
    }

    await event.respond('RESPONSE_SYNC_PLAYER', {})
  })

  server.nextTickScheduledAt = performance.now() + config.tickDurationMs

  // const handleTick = async () => {}

  // const serverTick = async () => {
  //   const now = performance.now()
  //   const delta = now - server.nextTickScheduledAt

  //   server.nextTickScheduledAt += config.tickDurationMs
  //   server.currentTick += 1

  //   await handleTick()

  //   eventQueue.emit('SERVER_TICK', {
  //     currentTick: server.currentTick,
  //   })

  //   serverTickTimeout = setTimeout(serverTick, Math.max(0, config.tickDurationMs - delta))
  // }

  // serverTickTimeout = setTimeout(serverTick, config.tickDurationMs)

  return server
}
