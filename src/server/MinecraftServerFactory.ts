import { BlocksRegistry } from '../shared/BlocksRegistry.ts'
import { asyncPipe } from '../shared/AsyncPipe.ts'
import { Config } from '../shared/Config.ts'
import { Chunk } from '../shared/entities/Chunk.ts'
import { Scheduler } from '../shared/Scheduler.ts'
import { World } from '../shared/World.ts'
import { MinecraftServer } from './MinecraftServer.ts'
import { ServerContainer } from './ServerContainer.ts'
import { TerrainGenerator } from './TerrainGenerator.ts'
import { type WorldStorageAdapter, WorldStorageAdapterSymbol } from './types.ts'

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
    const serverScope = ServerContainer.createScope()
    serverScope.registerSingleton(this.storage, WorldStorageAdapterSymbol)
    serverScope.registerSingleton(new BlocksRegistry())
    const terrainGenerator = new TerrainGenerator()
    serverScope.registerSingleton(terrainGenerator)

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
    serverScope.registerSingleton(world)
    serverScope.registerSingleton(new Scheduler())

    const server = new MinecraftServer(serverScope)
    serverScope.registerSingleton(server)

    return {
      server,
      world,
    }
  }
}
