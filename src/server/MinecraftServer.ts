import type { ContainerScope } from '../shared/Container.ts'
import type { Player } from '../shared/entities/Player.ts'
import type { Maybe } from '../shared/Maybe.ts'
import type { BlockInWorld, ChunkCoordinates } from '../types.ts'

import { BlocksRegistry } from '../shared/BlocksRegistry.ts'
import { chainAsync } from '../shared/ChainAsync.ts'
import { Config } from '../shared/Config.ts'
import { Chunk } from '../shared/entities/Chunk.ts'
import { type MinecraftEvent, MinecraftEventBus } from '../shared/MinecraftEventBus.ts'
import { Result } from '../shared/Result.ts'
import { Scheduler } from '../shared/Scheduler.ts'
import {
  findByXYZ,
  findChunkByXZ,
  getChunkCoordinates,
  getChunksCoordinatesInRadius,
  rawVector3,
  zeroRawVector3,
} from '../shared/util.ts'
import { ServerContainer } from './ServerContainer.ts'
import { TerrainGenerator } from './TerrainGenerator.ts'
import {
  type WorldStorageAdapter,
  WorldStorageAdapterSymbol as WorldStorageAdapterKey,
} from './types.ts'
import { type DatabaseChunkData } from './WorldDatabase.ts'

export class MinecraftServer {
  chunks: Map<string, Chunk> = new Map()
  players: Map<string, Player> = new Map()
  scope: ContainerScope = ServerContainer.createScope()

  private constructor(storage: WorldStorageAdapter) {
    this.scope.registerSingleton(storage, WorldStorageAdapterKey)
    this.scope.registerSingleton(new BlocksRegistry())
    this.scope.registerSingleton(new TerrainGenerator())
  }

  static create(storage: WorldStorageAdapter): Promise<MinecraftServer> {
    return chainAsync(Chunk.getCoordinatesInRadius(0, 0, Config.SPAWN_CHUNK_RADIUS))
      .parallel((spawnChunksCoords) => [
        storage.readPlayers(),
        storage.readChunks(spawnChunksCoords),
      ])
      .map(
        ([players, spawnChunks]) =>
          new MinecraftServer(storage, spawnChunks, eventBus, meta, players),
      )
      .tap((server) => server.initialize())
      .execute()
  }

  async dispose(): Promise<void> {
    this.eventBus.unregisterHandlers(this)
    this.scheduler.unregisterInstance(this)
    await this.database.dispose()
    this.loadedChunks = []
    this.currentTick = 0
    this.players = []
  }

  init() {}

  @MinecraftEventBus.Handler('Client.RequestChunksLoad')
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

    await this.eventBus.reply(event, 'Server.ResponseChunksLoad', {
      chunks: response,
    })
  }

  @MinecraftEventBus.Handler('Client.RequestPlayerJoin')
  protected async onRequestPlayerJoin(event: MinecraftEvent<'Client.RequestPlayerJoin'>) {
    let playerData = this.players.find((player) => player.uuid === event.payload.playerUUID)

    if (!playerData) {
      const centralChunk = findChunkByXZ(this.loadedChunks, 0, 0)!

      let latestBlock: BlockInWorld | null = null

      for (let y = 0; y < Config.WORLD_HEIGHT; y++) {
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
        position: rawVector3(latestBlock.x, latestBlock.y + 2, latestBlock.z),
        rotation: {
          x: 0,
          y: 0,
        },
        uuid: event.payload.playerUUID,
        velocity: zeroRawVector3(),
      }

      await this.database.createPlayer(playerData)
      this.players.push(playerData)
    }

    this.eventBus.reply(event, 'Server.ResponsePlayerJoin', {
      playerData,
    })
  }

  @MinecraftEventBus.Handler('Client.RequestSyncPlayer')
  protected async onRequestSyncPlayer(
    event: MinecraftEvent<'Client.RequestSyncPlayer'>,
  ): Promise<void> {
    const player = this.players.find((p) => p.uuid === event.payload.playerData.uuid)

    if (player) {
      Object.assign(player, event.payload.playerData)
      await this.database.updatePlayer(player)
    }

    await this.eventBus.reply(event, 'Server.ResponseSyncPlayer', {})
  }

  @MinecraftEventBus.Handler('Client.RequestSyncUpdatedBlocks')
  protected async onRequestSyncUpdatedBlocks(
    event: MinecraftEvent<'Client.RequestSyncUpdatedBlocks'>,
  ): Promise<void> {
    for (const blockUpdate of event.payload.updatedBlocks) {
      const chunkCoordinates = getChunkCoordinates({
        x: blockUpdate.position.x,
        z: blockUpdate.position.z,
      })

      const chunk = findChunkByXZ(
        this.loadedChunks,
        chunkCoordinates.chunkX,
        chunkCoordinates.chunkZ,
      )

      if (chunk) {
        const localX = blockUpdate.position.x - chunkCoordinates.chunkX * Config.CHUNK_SIZE
        const localZ = blockUpdate.position.z - chunkCoordinates.chunkZ * Config.CHUNK_SIZE

        if (blockUpdate.type === 'add') {
          chunk.data.blocks.push({
            typeID: blockUpdate.blockID,
            x: blockUpdate.position.x,
            y: blockUpdate.position.y,
            z: blockUpdate.position.z,
          })
          this.updatedChunks.add(chunk)
          continue
        }

        if (blockUpdate.type === 'remove') {
          const block = findByXYZ(chunk.data.blocks, localX, blockUpdate.position.y, localZ)
          if (block) {
            const index = chunk.data.blocks.indexOf(block)
            if (index !== -1) {
              chunk.data.blocks.splice(index, 1)
              this.updatedChunks.add(chunk)
              continue
            }
          }
        }
      }
    }

    this.eventBus.publish('Server.ResponseSyncUpdatedBlocks', {})
  }

  @Scheduler.Every(1000)
  protected async syncUpdatedChunks(): Promise<void> {
    if (this.updatedChunks.size === 0) {
      return
    }

    console.log(`Syncing ${this.updatedChunks.size} updated chunks to database...`)

    const chunksToUpdate = Array.from(this.updatedChunks)
    this.updatedChunks.clear()

    await this.database.updateChunks(chunksToUpdate)
  }

  // @Scheduler.Every(Config.TICK_RATE, {
  //   disabled: true, // Enable when ready to run the server tick loop
  //   runImmediately: true,
  // })
  // protected tick(): void {
  //   console.log(`Server Tick ${this.currentTick}`)
  //   this.currentTick++
  // }

  private async initialize(): Promise<void> {
    const spawnChunksCoordinates = getChunksCoordinatesInRadius({
      centerChunkX: 0,
      centerChunkZ: 0,
      chunkRadius: Config.SPAWN_CHUNK_RADIUS,
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

    this.eventBus.registerHandlers(this)
    this.scheduler.registerInstance(this)
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
