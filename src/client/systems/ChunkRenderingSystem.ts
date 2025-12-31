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
  /**
   * Renders the specified blocks within a chunk.
   * @param chunk The chunk containing the blocks to render.
   * @param localPositions The local positions of the blocks within the chunk to render.
   */
  renderBlocks(chunk: Chunk, localPositions: RawVector3[]): void

  /**
   * Renders blocks at the specified world positions.
   * @param worldPositions The world positions of the blocks to render.
   */
  renderBlocksAt(worldPositions: RawVector3[]): void

  /**
   * Renders entire chunks.
   * @param chunks The chunks to render.
   */
  renderChunks(chunks: Chunk[]): void

  /**
   * Unrenders the specified blocks within a chunk.
   * @param chunk The chunk containing the blocks to unrender.
   * @param localPositions The local positions of the blocks within the chunk to unrender.
   */
  unrenderBlocks(chunk: Chunk, localPositions: RawVector3[]): void

  /**
   * Unrenders blocks at the specified world positions.
   * @param worldPositions The world positions of the blocks to unrender.
   */
  unrenderBlocksAt(worldPositions: RawVector3[]): void

  /**
   * Unrenders entire chunks.
   * @param chunks The chunks to unrender.
   */
  unrenderChunks(chunks: Chunk[]): void
}

export const chunkRenderingSystemFactory = createSystemFactory((ctx) => {
  const blockMeshesCount = new HashMap<number, number>()
  const blockMeshesFreeIndexes = new HashMap<number, number[]>()
  const chunkBlockMeshesIndexes: HashMap<Chunk, HashMap<string, number>> = new HashMap()
  const chunksNeedingRender: Set<Chunk> = new Set()
  const chunkBlocksNeedingRender = new HashMap<Chunk, Set<string>>()
  const chunkBlocksNeedingUnrender = new HashMap<Chunk, Set<string>>()

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

  const renderBlocks = (chunk: Chunk, positions: RawVector3[]): void => {
    pipe(chunkBlocksNeedingRender.getOrSet(chunk, () => new Set())).tap((set) =>
      positions.map(getBlockKeyFromVector).forEach((blockKey) => set.add(blockKey)),
    )
  }

  const renderBlocksAt = (positions: RawVector3[]): void => {
    for (const worldPos of positions) {
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
  }

  const unrenderBlocksAt = (positions: RawVector3[]): void => {
    for (const worldPos of positions) {
      pipe(Chunk.mapToChunkCoordinates(worldPos.x, worldPos.z))
        .map((chunkCoord) => ctx.world.getEntity(Chunk.getWorldID(chunkCoord), Chunk))
        .mapSome((chunk) => chunkBlocksNeedingUnrender.getOrSet(chunk, () => new Set()))
        .tapSome((set) =>
          set.add(
            getBlockKeyFromVector({
              ...Chunk.mapToLocalCoordinates(worldPos.x, worldPos.z),
              y: worldPos.y,
            }),
          ),
        )
    }
  }

  const unrenderBlocks = (chunk: Chunk, positions: RawVector3[]): void => {
    pipe(chunkBlocksNeedingRender.getOrSet(chunk, () => new Set())).tap((set) =>
      set.delete(getBlockKeyFromVector(positions[0])),
    )
  }

  const hideMatrix = new Matrix4().makeScale(0, 0, 0)

  const unrenderBlock = (
    meshesNeedUpdate: Set<InstancedMesh>,
    chunk: Chunk,
    x: number,
    y: number,
    z: number,
    blockID?: number,
    blockMeshesIndexes?: HashMap<string, number>,
  ) => {
    if (!blockID) {
      const block = chunk.getBlock(x, y, z)
      if (block.isNone()) {
        return
      }
      blockID = block.value()
    }

    if (!blockMeshesIndexes) {
      const maybeblockMeshesIndexes = chunkBlockMeshesIndexes.get(chunk)
      if (maybeblockMeshesIndexes.isNone()) {
        return
      }
      blockMeshesIndexes = maybeblockMeshesIndexes.value()

      blockMeshesIndexes.get(getBlockKey(x, y, z)).tap((blockMeshIndex) => {
        const mesh = blockMeshes.get(blockID).unwrap()
        mesh.setMatrixAt(blockMeshIndex, hideMatrix)
        blockMeshesFreeIndexes.get(blockID).tap((indexes) => indexes.push(blockMeshIndex))
        meshesNeedUpdate.add(mesh)
      })
    }
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

      // Remove the chunk's block mesh indexes after unrendering
      chunkBlockMeshesIndexes.delete(chunk)
      chunksNeedingRender.delete(chunk)
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
    matrix.setPosition(blockWorldCoordinates.x, blockWorldCoordinates.y, blockWorldCoordinates.z)
    blockMesh.setMatrixAt(index, matrix)
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
      for (const blockKey of blockKeys) {
        const pos = getPositionFromBlockKey(blockKey)
        unrenderBlock(meshesNeedUpdate, chunk, pos.x, pos.y, pos.z)
      }

      // After processing, clear the set for this chunk
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
    renderBlocks,
    renderBlocksAt,
    renderChunks,
    unrenderBlocks,
    unrenderBlocksAt,
    unrenderChunks,
  }

  return {
    name: 'ChunkRenderingSystem',
    ...api,
  }
})
