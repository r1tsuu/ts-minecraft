import type { ChunkRenderingSystem } from './ChunkRenderingSystem.ts'
import type { PlayerUpdateSystem } from './PlayerUpdateSystem.ts'

import { Config } from '../../shared/Config.ts'
import { Chunk } from '../../shared/entities/Chunk.ts'
import { RequestChunksLoad } from '../../shared/events/client/RequestChunksLoad.ts'
import { RequestChunksUnload } from '../../shared/events/client/RequestChunksUnload.ts'
import { ResponseChunksLoad } from '../../shared/events/server/ResponseChunksLoad.ts'
import { Maybe } from '../../shared/Maybe.ts'
import { pipe } from '../../shared/Pipe.ts'
import { createSystemFactory } from './createSystem.ts'

export const chunkLoadingSystemFactory = ({
  chunkRenderingSystem,
  playerUpdateSystem,
}: {
  chunkRenderingSystem: ChunkRenderingSystem
  playerUpdateSystem: PlayerUpdateSystem
}) =>
  createSystemFactory((ctx) => {
    ctx.onEvent(ResponseChunksLoad, (event) => {
      ctx.world.addEntities(event.chunks)
      chunkRenderingSystem.queueChunksForRender(event.chunks)
    })

    // On each update, check if the player's chunk has changed and request new chunks if needed
    ctx.onUpdateBatch(Chunk, (currentChunks) => {
      const movementState = pipe(ctx.getClientPlayer())
        .map((p) => playerUpdateSystem.getMovementState(p))
        .value()

      if (!movementState.hasChunkChanged) {
        return
      }

      const chunksToShouldBeLoaded = Chunk.coordsInRadius(
        movementState.chunk.x,
        movementState.chunk.z,
        Config.RENDER_DISTANCE,
      )

      const chunksToLoad = chunksToShouldBeLoaded.filter(
        (coords) => !ctx.world.entityExists(Chunk.getWorldID(coords)),
      )

      if (chunksToLoad.length > 0) {
        ctx.eventBus.publish(new RequestChunksLoad(chunksToLoad))
      }

      const chunksToUnload = currentChunks.filter(
        (chunk) =>
          !chunksToShouldBeLoaded.some((coord) => coord.x === chunk.x && coord.z === chunk.z),
      )

      if (chunksToUnload.length > 0) {
        ctx.eventBus.publish(
          new RequestChunksUnload(
            chunksToUnload.map((chunk) => ({
              x: chunk.x,
              z: chunk.z,
            })),
          ),
        )

        ctx.world.removeEntities(chunksToUnload.map(Chunk.getWorldID))
        chunkRenderingSystem.queueChunksForUnrender(chunksToUnload)
      }

      pipe(ctx.getClientPlayer())
        .map((player) => playerUpdateSystem.getMovementState(player))
        .filter((movementState) => movementState.hasChunkChanged)
        .map(Maybe.from)
        .mapSome(({ chunk }) =>
          Chunk.coordsInRadius(chunk.x, chunk.z, Config.RENDER_DISTANCE).filter(
            (coords) => !ctx.world.entityExists(Chunk.getWorldID(coords)),
          ),
        )
        .tapSome(
          (coords) => coords.length > 0 && ctx.eventBus.publish(new RequestChunksLoad(coords)),
        )
    })

    return {
      name: 'ChunkLoadingSystem',
    }
  })
