import { BoxGeometry, InstancedMesh, Matrix4 } from 'three'

import type { RawVector3 } from '../../types.ts'

import { Config } from '../../shared/Config.ts'
import { Chunk } from '../../shared/entities/Chunk.ts'
import { HashMap } from '../../shared/HashMap.ts'
import { pipe } from '../../shared/Pipe.ts'
import { getBlockKey, getBlockKeyFromVector, getPositionFromBlockKey } from '../../shared/util.ts'
import { createSystemFactory } from './createSystem.ts'

const MAX_BLOCK_COUNT_FOR_MESH =
  Config.RENDER_DISTANCE *
  Config.RENDER_DISTANCE *
  Config.CHUNK_SIZE *
  Config.CHUNK_SIZE *
  Config.WORLD_HEIGHT

export interface ChunkRenderingSystem {
  renderBlockAt(worldPosition: RawVector3): void
  /**
   * Renders entire chunks.
   * @param chunks The chunks to render.
   */
  renderChunks(chunks: Chunk[]): void
  unrenderBlockAt(worldPosition: RawVector3): void
  /**
   * Unrenders entire chunks.
   * @param chunks The chunks to unrender.
   */
  unrenderChunks(chunks: Chunk[]): void
}

export const chunkRenderingSystemFactory = createSystemFactory((ctx) => {
  const blockMeshesCount = new HashMap<number, number>()
  const blockMeshesFreeIndexes = new HashMap<number, number[]>()
  const chunkBlockMeshesIndexes = new HashMap<Chunk, HashMap<string, number>>()
  const chunksNeedingRender = new Set<Chunk>()
  const chunkBlocksNeedingRender = new HashMap<Chunk, Set<string>>()

  const chunkBlocksNeedingUnrender = new HashMap<Chunk, Set<{ blockID: number; key: string }>>()

  const intermediateMatrix = new Matrix4()
  const hideMatrix = new Matrix4().makeScale(0, 0, 0)

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
      mesh.frustumCulled = false // TODO: Produces artifacts.

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

  const renderChunks = (chunks: Chunk[]): void => {
    for (const chunk of chunks) {
      chunksNeedingRender.add(chunk)
    }
  }

  const renderBlockAt = (worldPos: RawVector3): void => {
    pipe(Chunk.mapToChunkCoordinates(worldPos.x, worldPos.z))
      .map((chunkCoord) => ctx.world.getEntity(Chunk.getWorldID(chunkCoord), Chunk))
      .mapSome((chunk) => chunkBlocksNeedingRender.getOrSet(chunk, () => new Set()))
      .tapSome((set) =>
        set.add(
          getBlockKeyFromVector({
            ...Chunk.mapToLocalCoordinates(worldPos.x, worldPos.z),
            y: worldPos.y,
          }),
        ),
      )
  }

  const unrenderBlockAt = (worldPos: RawVector3): void => {
    pipe(Chunk.mapToChunkCoordinates(worldPos.x, worldPos.z))
      .map((chunkCoord) => ctx.world.getEntity(Chunk.getWorldID(chunkCoord), Chunk))
      .mapSome((chunk) => ({
        chunk,
        set: chunkBlocksNeedingUnrender.getOrSet(chunk, () => new Set()),
      }))
      .tapSome(({ chunk, set }) => {
        const localCoords = Chunk.mapToLocalCoordinates(worldPos.x, worldPos.z)
        set.add({
          blockID: chunk.getBlock(localCoords.x, worldPos.y, localCoords.z).unwrapOrDefault(0),
          key: getBlockKeyFromVector({
            ...localCoords,
            y: worldPos.y,
          }),
        })
      })
  }

  const unrenderBlock = (
    meshesNeedUpdate: Set<InstancedMesh>,
    chunk: Chunk,
    x: number,
    y: number,
    z: number,
    blockID: number,
    blockMeshesIndexes?: HashMap<string, number>,
  ) => {
    if (!blockMeshesIndexes) {
      const maybeblockMeshesIndexes = chunkBlockMeshesIndexes.get(chunk)
      if (maybeblockMeshesIndexes.isNone()) {
        return
      }
      blockMeshesIndexes = maybeblockMeshesIndexes.value()
    }

    const blockKey = getBlockKey(x, y, z)

    blockMeshesIndexes.get(blockKey).tap((blockMeshIndex) => {
      const mesh = blockMeshes.get(blockID).unwrap()
      mesh.setMatrixAt(blockMeshIndex, hideMatrix)
      blockMeshesFreeIndexes.get(blockID).tap((indexes) => indexes.push(blockMeshIndex))
      meshesNeedUpdate.add(mesh)
      blockMeshesIndexes.delete(blockKey)
    })
  }

  const unrenderChunks = (chunks: Chunk[]): void => {
    const meshesNeedUpdate = new Set<InstancedMesh>()

    for (const chunk of chunks) {
      const blockMeshesIndexes = chunkBlockMeshesIndexes.get(chunk)

      if (blockMeshesIndexes.isNone()) {
        continue
      }

      for (const { blockID, x, y, z } of chunk.iterateBlocks()) {
        unrenderBlock(meshesNeedUpdate, chunk, x, y, z, blockID, blockMeshesIndexes.value())
      }

      // Free up all associated data
      chunkBlockMeshesIndexes.delete(chunk)
      chunksNeedingRender.delete(chunk)
      chunkBlocksNeedingRender.delete(chunk)
      chunkBlocksNeedingUnrender.delete(chunk)
    }

    for (const mesh of meshesNeedUpdate) {
      mesh.instanceMatrix.needsUpdate = true
    }
  }

  // Renders a single block within a chunk
  const renderBlock = (
    meshesNeedUpdate: Set<InstancedMesh>,
    meshInstanceCounts: HashMap<number, number>,
    chunk: Chunk,
    x: number,
    y: number,
    z: number,
    incomingBlockTypeID?: number,
    incomingBlockKey?: string,
  ) => {
    const blockKey = incomingBlockKey ?? getBlockKey(x, y, z)

    const blockMeshesIndexes = chunkBlockMeshesIndexes.getOrSet(chunk, () => new HashMap())

    if (blockMeshesIndexes.has(blockKey)) {
      return
    }

    const blockTypeID = incomingBlockTypeID ?? chunk.getBlock(x, y, z).unwrap()

    const freeList = blockMeshesFreeIndexes.get(blockTypeID).unwrap()
    const blockMesh = blockMeshes
      .get(blockTypeID)
      .expect(`No mesh found for block ID ${blockTypeID}`)

    const index = freeList.pop() ?? getNextBlockMeshIndex(blockTypeID)

    const blockWorldCoordinates = chunk.getBlockWorldCoordinates(x, y, z)
    intermediateMatrix.setPosition(
      blockWorldCoordinates.x,
      blockWorldCoordinates.y,
      blockWorldCoordinates.z,
    )
    blockMesh.setMatrixAt(index, intermediateMatrix)
    blockMeshesIndexes.set(blockKey, index)
    meshesNeedUpdate.add(blockMesh)

    const currentMax = meshInstanceCounts.getOrDefault(blockTypeID, 0)
    meshInstanceCounts.set(blockTypeID, Math.max(currentMax, index + 1))
  }

  ctx.onRenderBatch(Chunk, (chunks) => {
    const meshesNeedUpdate = new Set<InstancedMesh>()
    const meshInstanceCounts = new HashMap<number, number>()

    // Initialize counts with current mesh counts
    for (const [blockID, mesh] of blockMeshes) {
      meshInstanceCounts.set(blockID, mesh.count)
    }

    for (const [chunk, blockKeys] of chunkBlocksNeedingRender) {
      for (const blockKey of blockKeys) {
        const pos = getPositionFromBlockKey(blockKey)
        renderBlock(
          meshesNeedUpdate,
          meshInstanceCounts,
          chunk,
          pos.x,
          pos.y,
          pos.z,
          undefined,
          blockKey,
        )
      }

      // After processing, clear the set for this chunk
      chunkBlocksNeedingRender.delete(chunk)
    }

    for (const [chunk, blockKeys] of chunkBlocksNeedingUnrender) {
      for (const { blockID, key } of blockKeys) {
        const pos = getPositionFromBlockKey(key)
        unrenderBlock(meshesNeedUpdate, chunk, pos.x, pos.y, pos.z, blockID, undefined)
      }

      // After processing, clear the set for this chunk and its callbacks
      chunkBlocksNeedingUnrender.delete(chunk)
    }

    for (const chunk of ctx.isFirstFrame() ? chunks : chunksNeedingRender) {
      for (const { blockID, x, y, z } of chunk.iterateBlocks()) {
        renderBlock(meshesNeedUpdate, meshInstanceCounts, chunk, x, y, z, blockID)
      }
    }

    for (const mesh of meshesNeedUpdate) {
      console.log(`Updating instance matrix for mesh`, mesh)
      mesh.instanceMatrix.needsUpdate = true
    }

    // Update instance counts for better frustum culling
    for (const [blockTypeID, count] of meshInstanceCounts) {
      const mesh = blockMeshes.get(blockTypeID).unwrap()
      mesh.count = count
    }

    chunksNeedingRender.clear()
  })

  const api: ChunkRenderingSystem = {
    renderBlockAt,
    renderChunks,
    unrenderBlockAt,
    unrenderChunks,
  }

  return {
    api,
    name: 'ChunkRenderingSystem',
  }
})
