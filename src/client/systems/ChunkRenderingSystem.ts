import { BoxGeometry, InstancedMesh, Matrix4 } from 'three'

import { Config } from '../../shared/Config.ts'
import { Chunk } from '../../shared/entities/Chunk.ts'
import { HashMap } from '../../shared/HashMap.ts'
import { Maybe } from '../../shared/Maybe.ts'
import { pipe } from '../../shared/Pipe.ts'
import { getBlockKey } from '../../shared/util.ts'
import { createSystemFactory } from './createSystem.ts'

const MAX_BLOCK_COUNT_FOR_MESH =
  Config.RENDER_DISTANCE *
  Config.RENDER_DISTANCE *
  Config.CHUNK_SIZE *
  Config.CHUNK_SIZE *
  Config.WORLD_HEIGHT

export const chunkRenderingSystemFactory = createSystemFactory((ctx) => {
  const blockMeshesCount = new HashMap<number, number>()
  const blockMeshesFreeIndexes = new HashMap<number, number[]>()
  const chunkBlockMeshesIndexes: HashMap<Chunk, HashMap<string, number>> = new HashMap()
  const chunksNeedingRender: Set<Chunk> = new Set()

  const matrix = new Matrix4()

  const geometry = new BoxGeometry()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()

  const blockMeshes = pipe(ctx.clientBlocksRegistry.iterateBlocks())
    .mapIter(({ id, material }) => {
      blockMeshesCount.set(id, 0)
      blockMeshesFreeIndexes.set(id, [])
      const mesh = new InstancedMesh(geometry, material, MAX_BLOCK_COUNT_FOR_MESH)
      mesh.count = 0
      ctx.scene.add(mesh)

      console.log(`Created InstancedMesh for block ID ${id}`)

      return {
        id,
        mesh,
      }
    })
    .iterToMap((x) => [x.id, x.mesh])
    .value()

  console.log('Created block meshes for chunk rendering:', blockMeshes)

  const getNextBlockMeshIndex = (blockID: number): number => {
    const currentCount = blockMeshesCount.get(blockID).unwrap()
    blockMeshesCount.set(blockID, currentCount + 1)
    return currentCount
  }

  /**
   * Marks a chunk to be rendered on the next render cycle.
   * Use it in other systems when a chunk's data has changed
   */
  const markChunkForRender = (chunk: Chunk): void => {
    chunksNeedingRender.add(chunk)
  }

  ctx.onRenderBatch(Chunk, (chunks) => {
    const meshesNeedUpdate = new Set<InstancedMesh>()
    const meshInstanceCounts = new HashMap<number, number>()

    for (const chunk of ctx.isFirstFrame() ? chunks : chunksNeedingRender) {
      for (const { blockID, x, y, z } of chunk.iterateBlocks()) {
        const blockKey = getBlockKey(x, y, z)
        const blockMeshesIndexes = chunkBlockMeshesIndexes.getOrSet(chunk, () => new HashMap())

        if (blockMeshesIndexes.has(blockKey)) {
          continue
        }

        const freeList = blockMeshesFreeIndexes.get(blockID).unwrap()
        const blockMesh = blockMeshes.get(blockID).expect(`No mesh found for block ID ${blockID}`)

        const index = Maybe.from(freeList.pop()).unwrapOr(() => getNextBlockMeshIndex(blockID))

        const blockWorldCoordinates = chunk.getBlockWorldCoordinates(x, y, z)
        matrix.setPosition(
          blockWorldCoordinates.x,
          blockWorldCoordinates.y,
          blockWorldCoordinates.z,
        )
        blockMesh.setMatrixAt(index, matrix)
        blockMeshesIndexes.set(blockKey, index)
        meshesNeedUpdate.add(blockMesh)

        const currentMax = meshInstanceCounts.getOrDefault(blockID, 0)
        meshInstanceCounts.set(blockID, Math.max(currentMax, index + 1))
      }
    }

    for (const mesh of meshesNeedUpdate) {
      console.log(`Updating instance matrix for mesh`, mesh)
      mesh.instanceMatrix.needsUpdate = true
    }

    // Update instance counts for better frustum culling
    for (const [blockTypeID] of meshInstanceCounts) {
      const mesh = blockMeshes.get(blockTypeID).unwrap()
      mesh.count = meshInstanceCounts.getOrDefault(blockTypeID, 0)
    }

    chunksNeedingRender.clear()
  })

  return {
    markChunkForRender,
    name: 'ChunkRenderingSystem',
  }
})
