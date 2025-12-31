import type { ChunkRenderingSystem } from './ChunkRenderingSystem.ts'
import type { PlayerUpdateSystem } from './PlayerUpdateSystem.ts'

import { Config } from '../../shared/Config.ts'
import { Chunk } from '../../shared/entities/Chunk.ts'
import { RequestChunksLoad } from '../../shared/events/client/RequestChunksLoad.ts'
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
      chunkRenderingSystem.queueChunksForRender(...event.chunks)
    })

    ctx.onUpdate(() =>
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
        ),
    )

    return {
      name: 'ChunkLoadingSystem',
    }
  })
