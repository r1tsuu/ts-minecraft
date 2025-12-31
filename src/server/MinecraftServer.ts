import { Euler, Vector3 } from 'three'

import type { MinecraftEventBus } from '../shared/MinecraftEventBus.ts'
import type { WorldStorageAdapter } from './types.ts'

import { asyncPipe } from '../shared/AsyncPipe.ts'
import { BlocksRegistry } from '../shared/BlocksRegistry.ts'
import { Config } from '../shared/Config.ts'
import { Chunk, type ChunkCoordinates } from '../shared/entities/Chunk.ts'
import { Player } from '../shared/entities/Player.ts'
import { RequestChunksLoad } from '../shared/events/client/RequestChunksLoad.ts'
import { RequestChunksUnload } from '../shared/events/client/RequestChunksUnload.ts'
import { RequestPlayerJoin } from '../shared/events/client/RequestPlayerJoin.ts'
import { ResponseChunksLoad } from '../shared/events/server/ResponseChunksLoad.ts'
import { ResponsePlayerJoin } from '../shared/events/server/ResponsePlayerJoin.ts'
import { pipe } from '../shared/Pipe.ts'
import { range } from '../shared/util.ts'
import { World } from '../shared/World.ts'
import { createTerrainGenerator } from './TerrainGenerator.ts'

export type MinecraftServer = Awaited<ReturnType<typeof createMinecraftServer>>

export const createMinecraftServer = async ({
  eventBus,
  storage,
}: {
  eventBus: MinecraftEventBus
  storage: WorldStorageAdapter
}) => {
  const blocksRegistry = new BlocksRegistry()
  const terrainGenerator = createTerrainGenerator(blocksRegistry)

  const players = await storage.readPlayers()
  const spawnChunks = Chunk.coordsInRadius(0, 0, Config.RENDER_DISTANCE)

  const world = new World()

  const readChunks = (coords: ChunkCoordinates[]) =>
    asyncPipe(coords)
      .mapArray(async (coord) => ({ ...coord, chunk: await storage.readChunk(coord) }))
      .execute()

  const chunks = await asyncPipe(readChunks(spawnChunks))
    .mapArray((readChunk) =>
      readChunk.chunk.unwrapOr(() => world.addEntity(terrainGenerator.generateChunkAt(readChunk))),
    )
    .execute()

  world.addEntities(players, chunks)

  eventBus.subscribe(RequestChunksLoad, (event) =>
    asyncPipe(event.chunks)
      .mapArray((coord) =>
        world
          .getEntity(Chunk.getWorldID(coord), Chunk)
          .unwrapOr(() => world.addEntity(terrainGenerator.generateChunkAt(coord))),
      )
      .map((chunks) => new ResponseChunksLoad(chunks))
      .tap((response) => eventBus.reply(event, response))
      .execute(),
  )

  eventBus.subscribe(RequestChunksUnload, (event) =>
    world.removeEntities(event.chunks.map(Chunk.getWorldID)),
  )

  eventBus.subscribe(RequestPlayerJoin, (event) => {
    pipe(event.playerUUID)
      .map((uuid) =>
        world
          .getEntity(uuid, Player)
          .unwrapOr(() =>
            world.addEntity(
              new Player(uuid, getPlayerSpawnPosition(), Euler.zero(), new Vector3()),
            ),
          ),
      )
      .map(() => new ResponsePlayerJoin(world))
      .tap((response) => eventBus.reply(event, response))
  })

  const getPlayerSpawnPosition = (): Vector3 => {
    const centralChunk = world.getEntity(Chunk.getWorldID({ x: 0, z: 0 }), Chunk).unwrap()

    return pipe(range(Config.WORLD_HEIGHT))
      .filterIter((y) => centralChunk.getBlock(0, y, 0).isSome())
      .iterLast()
      .value()
      .map((y) => new Vector3(0, y + 2, 0))
      .unwrap()
  }

  console.log('Minecraft server created.')

  return {
    world,
  }
}
