import { Euler, Vector3 } from 'three'

import type { ContainerScope } from '../shared/Container.ts'

import { asyncPipe } from '../shared/AsyncPipe.ts'
import { Config } from '../shared/Config.ts'
import { Chunk } from '../shared/entities/Chunk.ts'
import { Player } from '../shared/entities/Player.ts'
import { RequestChunksLoad } from '../shared/events/client/RequestChunksLoad.ts'
import { RequestPlayerJoin } from '../shared/events/client/RequestPlayerJoin.ts'
import { ResponseChunksLoad } from '../shared/events/server/ResponseChunksLoad.ts'
import { ResponsePlayerJoin } from '../shared/events/server/ResponsePlayerJoin.ts'
import { MinecraftEventBus } from '../shared/MinecraftEventBus.ts'
import { pipe } from '../shared/Pipe.ts'
import { range } from '../shared/util.ts'
import { World } from '../shared/World.ts'
import { ServerContainer } from './ServerContainer.ts'
import { TerrainGenerator } from './TerrainGenerator.ts'

@MinecraftEventBus.ServerListener()
export class MinecraftServer {
  constructor(private readonly scope: ContainerScope) {}

  dispose(): void {
    this.scope.destroyScope()
  }

  @MinecraftEventBus.Handler(RequestChunksLoad)
  protected async onRequestChunksLoad(event: RequestChunksLoad): Promise<void> {
    const terrainGenerator = ServerContainer.resolve(TerrainGenerator).unwrap()
    const world = ServerContainer.resolve(World).unwrap()
    const eventBus = ServerContainer.resolve(MinecraftEventBus).unwrap()

    await asyncPipe(event.chunks)
      .mapArray((coord) =>
        world
          .getEntity(Chunk.getWorldID(coord), Chunk)
          .unwrapOr(() => world.addDirtyEntity(() => terrainGenerator.generateChunkAt(coord))),
      )
      .map((chunks) => new ResponseChunksLoad(chunks))
      .tap((response) => eventBus.reply(event, response))
      .execute()
  }

  @MinecraftEventBus.Handler(RequestPlayerJoin)
  protected async onRequestPlayerJoin(event: RequestPlayerJoin) {
    const world = ServerContainer.resolve(World).unwrap()
    const eventBus = ServerContainer.resolve(MinecraftEventBus).unwrap()

    pipe(event.playerUUID)
      .map((uuid) =>
        world
          .getEntity(uuid, Player)
          .unwrapOr(() =>
            world.addDirtyEntity(
              () => new Player(uuid, this.getPlayerSpawnPosition(), Euler.zero(), new Vector3()),
            ),
          ),
      )
      .map(() => new ResponsePlayerJoin(world))
      .tap((response) => eventBus.reply(event, response))
  }

  private getPlayerSpawnPosition(): Vector3 {
    const world = ServerContainer.resolve(World).unwrap()
    const centralChunk = world.getEntity(Chunk.getWorldID({ x: 0, z: 0 }), Chunk).unwrap()

    return pipe(range(Config.WORLD_HEIGHT))
      .filterIter((y) => centralChunk.getBlock(0, y, 0).isSome())
      .iterLast()
      .value()
      .map((y) => new Vector3(0, y + 2, 0))
      .unwrap()
  }
}
