import { BoxGeometry, InstancedMesh, Matrix4 } from 'three'

import { Config } from '../../shared/Config.ts'
import { Chunk } from '../../shared/entities/Chunk.ts'
import { HashMap } from '../../shared/HashMap.ts'
import { Maybe } from '../../shared/Maybe.ts'
import { pipe } from '../../shared/Pipe.ts'
import { System } from '../../shared/System.ts'
import { getBlockKey } from '../../shared/util.ts'
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
  private blockMeshesFreeIndexes = new HashMap<number, number[]>()
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
          this.blockMeshesFreeIndexes.set(id, [])
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

  private matrix = new Matrix4()

  /**
   * Marks a chunk to be rendered on the next render cycle.
   * Use it in other systems when a chunk's data has changed
   */
  markChunkForRender(chunk: Chunk): void {
    this.chunksNeedingRender.add(chunk)
  }

  @System.RenderAll(Chunk)
  protected renderAll(chunks: Chunk[]): void {
    const meshesNeedUpdate = new Set<InstancedMesh>()
    const meshInstanceCounts = new HashMap<number, number>()

    for (const chunk of this.gameSession.isFirstFrame() ? chunks : this.chunksNeedingRender) {
      for (const { blockID, x, y, z } of chunk.iterateBlocks()) {
        const blockKey = getBlockKey(x, y, z)
        const chunkBlockMeshesIndexes = this.chunkBlockMeshesIndexes.getOrSet(
          chunk,
          () => new HashMap(),
        )

        if (!chunkBlockMeshesIndexes.has(blockKey)) {
          continue
        }

        const freeList = this.blockMeshesFreeIndexes.get(blockID).unwrap()
        const blockMesh = this.blockMeshes
          .get(blockID)
          .expect(`No mesh found for block ID ${blockID}`)

        const index = Maybe.When(freeList.length > 0, () => freeList.pop()!).unwrapOr(() =>
          this.getNextBlockMeshIndex(blockID),
        )

        const blockWorldCoordinates = chunk.getBlockWorldCoordinates(x, y, z)
        this.matrix.setPosition(
          blockWorldCoordinates.x,
          blockWorldCoordinates.y,
          blockWorldCoordinates.z,
        )
        blockMesh.setMatrixAt(index, this.matrix)
        chunkBlockMeshesIndexes.set(blockKey, index)
        meshesNeedUpdate.add(blockMesh)

        const currentMax = meshInstanceCounts.getOrDefault(blockID, 0)
        meshInstanceCounts.set(blockID, Math.max(currentMax, index + 1))
      }
    }

    for (const mesh of meshesNeedUpdate) {
      mesh.instanceMatrix.needsUpdate = true
    }

    // Update instance counts for better frustum culling
    for (const [blockTypeID] of meshInstanceCounts) {
      const mesh = this.blockMeshes.get(blockTypeID).unwrap()
      mesh.count = meshInstanceCounts.getOrDefault(blockTypeID, 0)
    }

    this.chunksNeedingRender.clear()
  }

  private getNextBlockMeshIndex(blockID: number): number {
    const currentCount = this.blockMeshesCount.get(blockID).unwrap()
    this.blockMeshesCount.set(blockID, currentCount + 1)
    return currentCount
  }
}
