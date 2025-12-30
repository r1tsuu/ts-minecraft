import { BoxGeometry, InstancedMesh } from 'three'

import { Config } from '../../shared/Config.ts'
import { Chunk } from '../../shared/entities/Chunk.ts'
import { HashMap } from '../../shared/HashMap.ts'
import { pipe } from '../../shared/Pipe.ts'
import { System } from '../../shared/System.ts'
import { ClientBlocksRegistry } from '../ClientBlocksRegistry.ts'
import { ClientContainer } from '../ClientContainer.ts'
import { GameSession } from '../GameSession.ts'

const MAX_BLOCK_COUNT_FOR_MESH =
  (Config.RENDER_DISTANCE *
    Config.RENDER_DISTANCE *
    Config.CHUNK_SIZE *
    Config.CHUNK_SIZE *
    Config.WORLD_HEIGHT) /
  2

export class ChunkRenderingSystem extends System {
  private blockMeshesCount = new HashMap<number, number>()
  private blockMeshesFreeIndexes = new HashMap<number, Set<number>>()
  private geometry = new BoxGeometry()
  private blockMeshes: HashMap<number, InstancedMesh> = ClientContainer.resolve(
    ClientBlocksRegistry,
  )
    .map((registry) =>
      pipe(registry.iterateBlocks())
        .mapIter(({ id, material }) => {
          // Share a single geometry instance across all block types for better memory efficiency
          this.geometry.computeBoundingBox()
          this.geometry.computeBoundingSphere()
          this.blockMeshesCount.set(id, 0)
          this.blockMeshesFreeIndexes.set(id, new Set<number>())
          return {
            id,
            mesh: new InstancedMesh(this.geometry, material, MAX_BLOCK_COUNT_FOR_MESH),
          }
        })
        .iterToMap((e) => [e.id, e.mesh])
        .value(),
    )
    .unwrap()

  private chunkBlockMeshesIndexes: HashMap<Chunk, HashMap<string, number>> = new HashMap()

  private chunksNeedingRender: Set<Chunk> = new Set()

  private gameSession = ClientContainer.resolve(GameSession).unwrap()

  /**
   * Marks a chunk to be rendered on the next render cycle.
   * Use it in other systems when a chunk's data has changed
   */
  markChunkForRender(chunk: Chunk): void {
    this.chunksNeedingRender.add(chunk)
  }

  @System.RenderAll(Chunk)
  protected renderAll(chunks: Chunk[]): void {
    for (const chunk of this.gameSession.isFirstFrame() ? chunks : this.chunksNeedingRender) {
      for (const { blockID, x, y, z } of chunk.iterateBlocks()) {
        this.chunkBlockMeshesIndexes.getOrSet(chunk, () => new HashMap())
      }
    }

    this.chunksNeedingRender.clear()
  }
}
