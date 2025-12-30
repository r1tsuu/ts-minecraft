import { asyncPipe } from '../shared/AsyncPipe.ts'
import { BlocksRegistry } from '../shared/BlocksRegistry.ts'
import { Config } from '../shared/Config.ts'
import { Chunk } from '../shared/entities/Chunk.ts'
import { setCurrentEnvironment } from '../shared/env.ts'
import { World } from '../shared/World.ts'
import { MinecraftServer } from './MinecraftServer.ts'
import { TerrainGenerator } from './TerrainGenerator.ts'
import { type WorldStorageAdapter } from './types.ts'

setCurrentEnvironment('Server')

/**
 * Factory for creating MinecraftServer instances.
 * It sets up the server with necessary components,
 * loads initial data, and prepares the world.
 */
export class MinecraftServerFactory {
  constructor(private storage: WorldStorageAdapter) {}

  async build(): Promise<{
    server: MinecraftServer
    world: World
  }> {
    const blocksRegistry = new BlocksRegistry()
    const terrainGenerator = new TerrainGenerator(blocksRegistry)

    const players = await this.storage.readPlayers()
    const spawnChunks = Chunk.coordsInRadius(0, 0, Config.SPAWN_CHUNK_RADIUS)

    const world = new World()

    const chunks = await asyncPipe(this.storage.readChunks(spawnChunks))
      .mapArray((readChunk) =>
        readChunk.chunk.unwrapOr(() =>
          world.addDirtyEntity(() => terrainGenerator.generateChunkAt(readChunk)),
        ),
      )
      .execute()

    world.addEntities(players, chunks)

    const server = new MinecraftServer(world, terrainGenerator)

    return {
      server,
      world,
    }
  }
}
