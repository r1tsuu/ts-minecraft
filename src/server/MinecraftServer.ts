import type { BlockInWorld, ChunkCoordinates } from '../types.ts'

import { BlocksRegistry } from '../blocks/BlocksRegistry.ts'
import { createConfig, type SharedConfig } from '../config.ts'
import { type MinecraftEvent, MinecraftEventQueue } from '../queue/MinecraftQueue.ts'
import {
  findByXYZ,
  findChunkByXZ,
  getChunksCoordinatesInRadius,
  rawVector3,
  zeroRawVector3,
} from '../util.ts'
import { TerrainGenerator } from './TerrainGenerator.ts'
import {
  type DatabaseChunkData,
  type DatabasePlayerData,
  type DatabaseWorldMetaData,
  WorldDatabase,
} from './WorldDatabase.ts'

export class MinecraftServer {
  blocksRegistry: BlocksRegistry
  config: SharedConfig
  currentTick: number = 0
  loadedChunks: DatabaseChunkData[] = []

  terrainGenerator: TerrainGenerator

  private constructor(
    private readonly database: WorldDatabase,
    private readonly eventQueue: MinecraftEventQueue,
    private readonly meta: DatabaseWorldMetaData,
    private players: DatabasePlayerData[],
  ) {
    this.config = createConfig()
    this.blocksRegistry = new BlocksRegistry()
    this.terrainGenerator = new TerrainGenerator(this.blocksRegistry, this.config)
  }

  static async create(
    eventQueue: MinecraftEventQueue,
    worldDatabaseName: string,
  ): Promise<MinecraftServer> {
    const database = await WorldDatabase.create(worldDatabaseName)
    const players: DatabasePlayerData[] = await database.fetchPlayers()
    const meta = await database.fetchWorldMeta()

    const server = new MinecraftServer(database, eventQueue, meta, players)

    await server.initialize()

    return server
  }

  async dispose(): Promise<void> {
    MinecraftEventQueue.unregisterHandlers(this)
    await this.database.dispose()
    this.loadedChunks = []
    this.currentTick = 0
    this.players = []
  }

  @MinecraftEventQueue.Handler('Client.RequestChunksLoad')
  protected async onRequestChunksLoad(
    event: MinecraftEvent<'Client.RequestChunksLoad'>,
  ): Promise<void> {
    const response: DatabaseChunkData[] = []

    const coordsToLoad: ChunkCoordinates[] = []

    for (const chunk of event.payload.chunks) {
      // first check if chunk is already loaded
      const loadedChunk = findChunkByXZ(this.loadedChunks, chunk.chunkX, chunk.chunkZ)

      if (loadedChunk) {
        response.push(loadedChunk)
      } else {
        coordsToLoad.push({ chunkX: chunk.chunkX, chunkZ: chunk.chunkZ })
      }
    }

    const loadedFromDb = await this.database.fetchChunksByCoordinates(coordsToLoad)

    for (const chunk of loadedFromDb) {
      this.loadedChunks.push(chunk)
      response.push(chunk)
    }

    const chunksToInsertToDb: DatabaseChunkData[] = []
    for (const coord of coordsToLoad) {
      const alreadyLoaded = findChunkByXZ(this.loadedChunks, coord.chunkX, coord.chunkZ)

      if (!alreadyLoaded) {
        const generatedChunk = this.terrainGenerator.generateChunk(coord.chunkX, coord.chunkZ)
        this.loadedChunks.push(generatedChunk)
        response.push(generatedChunk)
        chunksToInsertToDb.push(generatedChunk)
      }
    }

    if (chunksToInsertToDb.length > 0) {
      await this.database.createChunks(chunksToInsertToDb)
    }

    await this.syncMeta()

    await this.eventQueue.respond(event, 'Server.ResponseChunksLoad', {
      chunks: response,
    })
  }

  @MinecraftEventQueue.Handler('Client.RequestPlayerJoin')
  protected async onRequestPlayerJoin(event: MinecraftEvent<'Client.RequestPlayerJoin'>) {
    let playerData = this.players.find((player) => player.uuid === event.payload.playerUUID)

    if (!playerData) {
      const centralChunk = findChunkByXZ(this.loadedChunks, 0, 0)!

      let latestBlock: BlockInWorld | null = null

      for (let y = 0; y < this.config.worldHeight; y++) {
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
        jumpStrength: this.config.defaultPlayerJumpStrength,
        pitch: 0,
        position: rawVector3(latestBlock.x, latestBlock.y + 4, latestBlock.z),
        uuid: event.payload.playerUUID,
        velocity: zeroRawVector3(),
        yaw: 0,
      }

      await this.database.createPlayer(playerData)
      this.players.push(playerData)
    }

    this.eventQueue.respond(event, 'Server.ResponsePlayerJoin', {
      playerData,
    })
  }

  @MinecraftEventQueue.Handler('Client.RequestSyncPlayer')
  protected async onRequestSyncPlayer(
    event: MinecraftEvent<'Client.RequestSyncPlayer'>,
  ): Promise<void> {
    const player = this.players.find((p) => p.uuid === event.payload.playerData.uuid)

    if (player) {
      Object.assign(player, event.payload.playerData)
      await this.database.updatePlayer(player)
    }

    await this.eventQueue.respond(event, 'Server.ResponseSyncPlayer', {})
  }

  private async initialize(): Promise<void> {
    const spawnChunksCoordinates = getChunksCoordinatesInRadius({
      centerChunkX: 0,
      centerChunkZ: 0,
      chunkRadius: this.config.spawnChunkRadius,
    })

    // Setup initial world state if this is the first server start
    if (!this.meta.lastLoadedAt) {
      for (const coordinates of spawnChunksCoordinates) {
        const chunk = this.terrainGenerator.generateChunk(coordinates.chunkX, coordinates.chunkZ)
        this.loadedChunks.push(chunk)
      }

      await this.database.createChunks(this.loadedChunks)
    } else {
      const chunks = await this.database.fetchChunksByUUIDs(
        this.meta.loadedChunks.map((chunk) => chunk.uuid),
      )
      this.loadedChunks.push(...chunks)
    }

    this.meta.lastLoadedAt = new Date()

    await this.syncMeta()

    this.eventQueue.registerHandlers(this)
  }

  private async syncMeta(): Promise<void> {
    this.meta.loadedChunks = this.loadedChunks.map((chunk) => ({
      chunkX: chunk.chunkX,
      chunkZ: chunk.chunkZ,
      uuid: chunk.uuid,
    }))
    await this.database.updateWorldMeta(this.meta)
  }
}
