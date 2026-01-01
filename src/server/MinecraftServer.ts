import { Euler, Vector3 } from 'three'

import type { MinecraftEventBus } from '../shared/MinecraftEventBus.ts'
import type { WorldStorageAdapter } from './types.ts'

import { asyncPipe } from '../shared/AsyncPipe.ts'
import { Config } from '../shared/Config.ts'
import { Chunk, type ChunkCoordinates } from '../shared/entities/Chunk.ts'
import { ItemStack, Player } from '../shared/entities/Player.ts'
import { RequestBlocksUpdate } from '../shared/events/client/RequestBlocksUpdate.ts'
import { RequestChunksLoad } from '../shared/events/client/RequestChunksLoad.ts'
import { RequestChunksUnload } from '../shared/events/client/RequestChunksUnload.ts'
import { RequestPlayerJoin } from '../shared/events/client/RequestPlayerJoin.ts'
import { RequestPlayerUpdate } from '../shared/events/client/RequestPlayerUpdate.ts'
import { ResponseChunksLoad } from '../shared/events/server/ResponseChunksLoad.ts'
import { ResponsePlayerJoin } from '../shared/events/server/ResponsePlayerJoin.ts'
import { Items } from '../shared/ItemRegistry.ts'
import { pipe } from '../shared/Pipe.ts'
import { range } from '../shared/util.ts'
import { World } from '../shared/World.ts'
import { createTerrainGenerator } from './TerrainGenerator.ts'

export type MinecraftServer = Awaited<ReturnType<typeof createMinecraftServer>>

export const createMinecraftServer = async ({
  eventBus,
  seed,
  storage,
}: {
  eventBus: MinecraftEventBus
  seed: string
  storage: WorldStorageAdapter
}) => {
  const terrainGenerator = createTerrainGenerator(seed)

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

  const createPlayer = (uuid: string): Player => {
    const player = new Player(uuid, getPlayerSpawnPosition(), Euler.zero(), new Vector3())
    const inventory = player.getInventory()

    inventory.setItemAt(0, new ItemStack(Items.Grass.id, 64))
    inventory.setItemAt(1, new ItemStack(Items.Dirt.id, 64))
    inventory.setItemAt(2, new ItemStack(Items.Stone.id, 64))

    return player
  }

  eventBus.subscribe(RequestPlayerJoin, (event) => {
    pipe(event.playerUUID)
      .map((uuid) =>
        world.getEntity(uuid, Player).unwrapOr(() => world.addEntity(createPlayer(uuid))),
      )
      .map(() => new ResponsePlayerJoin(world))
      .tap((response) => eventBus.reply(event, response))
  })

  eventBus.subscribe(RequestPlayerUpdate, (event) =>
    pipe(world.getEntity(event.playerID, Player)).tapSome((player) => {
      player.position.copy(event.position)
      player.rotation.copy(event.rotation)
      player.velocity.copy(event.velocity)
    }),
  )

  eventBus.subscribe(RequestBlocksUpdate, (event) => {
    for (const action of event.actions) {
      const chunkCoords = Chunk.mapToChunkCoordinates(action.position.x, action.position.z)
      const maybeChunk = world.getEntity(Chunk.getWorldID(chunkCoords), Chunk)
      if (maybeChunk.isNone()) continue
      const chunk = maybeChunk.value()
      const { x, z } = Chunk.mapToLocalCoordinates(action.position.x, action.position.z)

      switch (action.type) {
        case 'REMOVE': {
          chunk.removeBlock(x, action.position.y, z)
          break
        }
        case 'SET': {
          chunk.setBlock(x, action.position.y, z, action.blockID)
          break
        }
      }
    }
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

  // AUTOSAVE LOOP
  setInterval(async () => {
    const now = Date.now()
    asyncPipe(world.query().select(Player).execute())
      .mapIter((each) => each.entity)
      .collect()
      .tap((players) => storage.writePlayers(players))
      .map(() => world.query().select(Chunk).execute())
      .mapIter((each) => each.entity)
      .tapIter((chunk) => storage.writeChunk(chunk))
      .execute()
      .then(() => console.log(`Server autosave complete. Took ${Date.now() - now} ms.`))
  }, Config.SERVER_AUTOSAVE_INTERVAL_MS)

  console.log('Minecraft server created.')

  return {
    world,
  }
}
