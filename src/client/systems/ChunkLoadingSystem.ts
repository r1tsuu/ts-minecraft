import type { ChunkRenderingSystem } from './ChunkRenderingSystem.ts'
import type { PlayerUpdateSystem } from './PlayerUpdateSystem.ts'

import { Config } from '../../shared/Config.ts'
import { Chunk } from '../../shared/entities/Chunk.ts'
import { RequestChunksLoad } from '../../shared/events/client/RequestChunksLoad.ts'
import { RequestChunksUnload } from '../../shared/events/client/RequestChunksUnload.ts'
import { ResponseChunksLoad } from '../../shared/events/server/ResponseChunksLoad.ts'
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
      chunkRenderingSystem.renderChunks(event.chunks)
      console.log('Loaded chunks:', event.chunks)
    })

    // On each update, check if the player's chunk has changed and request new chunks if needed
    ctx.onUpdateBatch(Chunk, (currentChunks) => {
      const movementState = pipe(ctx.getClientPlayer())
        .map((p) => playerUpdateSystem.getMovementState(p))
        .value()

      if (!movementState.hasChunkChanged) {
        return
      }

      const chunksInRenderDistance = Chunk.coordsInRadius(
        movementState.chunk.x,
        movementState.chunk.z,
        Config.RENDER_DISTANCE,
      )

      const chunksToLoad = chunksInRenderDistance.filter(
        (coords) => !ctx.world.entityExists(Chunk.getWorldID(coords)),
      )

      if (chunksToLoad.length > 0) {
        ctx.eventBus.publish(new RequestChunksLoad(chunksToLoad))
      }

      const chunksToUnload = currentChunks.filter(
        (chunk) =>
          chunksInRenderDistance.findIndex(
            (coords) => coords.x === chunk.x && coords.z === chunk.z,
          ) === -1,
      )

      if (chunksToUnload.length > 0) {
        console.log('Unloading chunks:', chunksToUnload)
        ctx.eventBus.publish(
          new RequestChunksUnload(
            chunksToUnload.map((chunk) => ({
              x: chunk.x,
              z: chunk.z,
            })),
          ),
        )

        ctx.world.removeEntities(chunksToUnload.map(Chunk.getWorldID))
        chunkRenderingSystem.unrenderChunks(chunksToUnload)
      }
    })

    return {
      name: 'ChunkLoadingSystem',
    }
  })
