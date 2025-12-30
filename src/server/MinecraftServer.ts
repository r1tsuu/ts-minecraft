import { Euler, Vector3 } from 'three'

import { asyncPipe } from '../shared/AsyncPipe.ts'
import { Config } from '../shared/Config.ts'
import { Chunk } from '../shared/entities/Chunk.ts'
import { Player } from '../shared/entities/Player.ts'
import { RequestChunksLoad } from '../shared/events/client/RequestChunksLoad.ts'
import { RequestPlayerJoin } from '../shared/events/client/RequestPlayerJoin.ts'
import { ResponseChunksLoad } from '../shared/events/server/ResponseChunksLoad.ts'
import { ResponsePlayerJoin } from '../shared/events/server/ResponsePlayerJoin.ts'
import { eventBus, Listener, MinecraftEventBus } from '../shared/MinecraftEventBus.ts'
import { pipe } from '../shared/Pipe.ts'
import { range } from '../shared/util.ts'
import { World } from '../shared/World.ts'
import { TerrainGenerator } from './TerrainGenerator.ts'

@Listener()
export class MinecraftServer {
  constructor(
    readonly world: World,
    readonly terrainGenerator: TerrainGenerator,
  ) {}

  dispose(): void {}

  @MinecraftEventBus.Handler(RequestChunksLoad)
  protected async onRequestChunksLoad(event: RequestChunksLoad): Promise<void> {
    await asyncPipe(event.chunks)
      .mapArray((coord) =>
        this.world
          .getEntity(Chunk.getWorldID(coord), Chunk)
          .unwrapOr(() =>
            this.world.addDirtyEntity(() => this.terrainGenerator.generateChunkAt(coord)),
          ),
      )
      .map((chunks) => new ResponseChunksLoad(chunks))
      .tap((response) => eventBus.reply(event, response))
      .execute()
  }

  @MinecraftEventBus.Handler(RequestPlayerJoin)
  protected async onRequestPlayerJoin(event: RequestPlayerJoin) {
    pipe(event.playerUUID)
      .map((uuid) =>
        this.world
          .getEntity(uuid, Player)
          .unwrapOr(() =>
            this.world.addDirtyEntity(
              () => new Player(uuid, this.getPlayerSpawnPosition(), Euler.zero(), new Vector3()),
            ),
          ),
      )
      .map(() => new ResponsePlayerJoin(this.world))
      .tap((response) => eventBus.reply(event, response))
  }

  private getPlayerSpawnPosition(): Vector3 {
    const centralChunk = this.world.getEntity(Chunk.getWorldID({ x: 0, z: 0 }), Chunk).unwrap()

    return pipe(range(Config.WORLD_HEIGHT))
      .filterIter((y) => centralChunk.getBlock(0, y, 0).isSome())
      .iterLast()
      .value()
      .map((y) => new Vector3(0, y + 2, 0))
      .unwrap()
  }
}
