import { asyncPipe } from '../shared/AsyncPipe.ts'
import { BlocksRegistry } from '../shared/BlocksRegistry.ts'
import { Config } from '../shared/Config.ts'
import { Chunk } from '../shared/entities/Chunk.ts'
import { World } from '../shared/World.ts'
import { MinecraftServer } from './MinecraftServer.ts'
import { TerrainGenerator } from './TerrainGenerator.ts'
import { type WorldStorageAdapter } from './types.ts'

export const createMinecraftServer = async (
  storage: WorldStorageAdapter,
): Promise<{
  server: MinecraftServer
  world: World
}> => {
  console.log('Creating Minecraft server...')
  const blocksRegistry = new BlocksRegistry()
  const terrainGenerator = new TerrainGenerator(blocksRegistry)

  const players = await storage.readPlayers()
  const spawnChunks = Chunk.coordsInRadius(0, 0, Config.SPAWN_CHUNK_RADIUS)

  const world = new World()

  const chunks = await asyncPipe(storage.readChunks(spawnChunks))
    .mapArray((readChunk) =>
      readChunk.chunk.unwrapOr(() =>
        world.addDirtyEntity(() => terrainGenerator.generateChunkAt(readChunk)),
      ),
    )
    .execute()

  world.addEntities(players, chunks)

  const server = new MinecraftServer(world, terrainGenerator)

  console.log('Minecraft server created.')

  return {
    server,
    world,
  }
}
