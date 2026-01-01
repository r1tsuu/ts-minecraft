import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Uint16BufferAttribute,
} from 'three'

import type { RawVector2, RawVector3 } from '../../types.ts'

import { Config } from '../../shared/Config.ts'
import { Chunk } from '../../shared/entities/Chunk.ts'
import { HashMap } from '../../shared/HashMap.ts'
import { pipe } from '../../shared/Pipe.ts'
import { getBlockKeyFromVector } from '../../shared/util.ts'
import { createSystemFactory } from './createSystem.ts'

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

interface ChunkMeshData {
  mesh: Mesh
  needsRebuild: boolean
}

// Face vertices for a cube (each face has 4 vertices)
const CUBE_FACES = {
  back: {
    normal: [0, 0, -1],
    vertices: [
      [1, 0, 0],
      [1, 1, 0],
      [0, 1, 0],
      [0, 0, 0],
    ],
  },
  bottom: {
    normal: [0, -1, 0],
    vertices: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 0, 0],
      [0, 0, 0],
    ],
  },
  front: {
    normal: [0, 0, 1],
    vertices: [
      [0, 0, 1],
      [0, 1, 1],
      [1, 1, 1],
      [1, 0, 1],
    ],
  },
  left: {
    normal: [-1, 0, 0],
    vertices: [
      [0, 0, 0],
      [0, 1, 0],
      [0, 1, 1],
      [0, 0, 1],
    ],
  },
  right: {
    normal: [1, 0, 0],
    vertices: [
      [1, 0, 1],
      [1, 1, 1],
      [1, 1, 0],
      [1, 0, 0],
    ],
  },
  // Each face: [normal, vertices]
  top: {
    normal: [0, 1, 0],
    vertices: [
      [0, 1, 0],
      [1, 1, 0],
      [1, 1, 1],
      [0, 1, 1],
    ],
  },
}

const mapUVFromAtlas = (
  tile: RawVector2, // top-left corner of tile in atlas
  tilesPerRow: number,
  vertexIndex: number,
): RawVector2 => {
  const tileUV = 1 / tilesPerRow
  // Cube face vertices order: [0,1,2,3]
  // We'll map vertex 0 = (0,0), 1 = (0,1), 2 = (1,1), 3 = (1,0)
  const offsets = [
    { x: 0, y: 0 }, // bottom-left
    { x: 0, y: 1 }, // top-left
    { x: 1, y: 1 }, // top-right
    { x: 1, y: 0 }, // bottom-right
  ]
  const offset = offsets[vertexIndex]
  return {
    x: tile.x + offset.x * tileUV,
    y: tile.y + offset.y * tileUV,
  }
}

// Face indices (two triangles per face)
const FACE_INDICES = [0, 1, 2, 0, 2, 3]

export const chunkRenderingSystemFactory = createSystemFactory((ctx) => {
  const chunkMeshes = new HashMap<Chunk, ChunkMeshData>()
  const chunksNeedingRender = new Set<Chunk>()
  const chunkBlocksNeedingUpdate = new HashMap<Chunk, Set<string>>()

  // Check if a block is solid (exists and is not air)
  const isBlockSolid = (chunk: Chunk, x: number, y: number, z: number): boolean => {
    const block = chunk.getBlock(x, y, z)
    return block.isSome() && block.value() !== 0
  }

  // Check if a neighbor block exists and is solid
  // Check if a neighbor block exists and is solid
  const hasNeighbor = (chunk: Chunk, x: number, y: number, z: number): boolean => {
    // Check height bounds
    if (y < 0 || y >= Config.WORLD_HEIGHT) {
      return false
    }

    // If within current chunk bounds, check directly
    if (x >= 0 && x < Config.CHUNK_SIZE && z >= 0 && z < Config.CHUNK_SIZE) {
      return isBlockSolid(chunk, x, y, z)
    }

    // Calculate world position for neighbor check
    const chunkWorldPos = chunk.getWorldCoordinates()
    const worldX = chunkWorldPos.x + x
    const worldZ = chunkWorldPos.z + z

    // Get neighboring chunk coordinates
    const neighborChunkCoord = Chunk.mapToChunkCoordinates(worldX, worldZ)

    // Get neighboring chunk
    const neighborChunk = ctx.world.getEntity(Chunk.getWorldID(neighborChunkCoord), Chunk)

    if (neighborChunk.isNone()) return false

    // Convert to local coordinates in neighboring chunk
    const localCoords = Chunk.mapToLocalCoordinates(worldX, worldZ)
    return isBlockSolid(neighborChunk.value(), localCoords.x, y, localCoords.z)
  }

  // Build mesh geometry for a chunk
  const buildChunkMesh = (chunk: Chunk): BufferGeometry => {
    const now = performance.now()
    const positions: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    const indices: number[] = []

    let vertexCount = 0

    // Get chunk world position for offsetting vertices
    const chunkWorldPos = chunk.getWorldCoordinates()

    // Iterate through all blocks in the chunk
    for (const { blockID, x, y, z } of chunk.iterateBlocks()) {
      if (blockID === 0) continue // Skip air blocks

      // Get block material for color
      // const blockTexture = ctx..getBlock(blockID).unwrap()

      // Check each face and only add if not occluded
      const faces = [
        { check: () => !hasNeighbor(chunk, x, y + 1, z), face: CUBE_FACES.top, type: 'top' },
        { check: () => !hasNeighbor(chunk, x, y - 1, z), face: CUBE_FACES.bottom, type: 'bottom' },
        { check: () => !hasNeighbor(chunk, x, y, z + 1), face: CUBE_FACES.front, type: 'front' },
        { check: () => !hasNeighbor(chunk, x, y, z - 1), face: CUBE_FACES.back, type: 'back' },
        { check: () => !hasNeighbor(chunk, x + 1, y, z), face: CUBE_FACES.right, type: 'right' },
        { check: () => !hasNeighbor(chunk, x - 1, y, z), face: CUBE_FACES.left, type: 'left' },
      ] as const

      for (const { check, face, type } of faces) {
        if (!check()) continue // Face is occluded

        const startVertex = vertexCount
        const tile = ctx.texturesRegistry.getUVForBlockSide(blockID, type)

        let i = 0
        // Add vertices for this face
        for (const [vx, vy, vz] of face.vertices) {
          positions.push(chunkWorldPos.x + x + vx, y + vy, chunkWorldPos.z + z + vz)
          normals.push(...face.normal)
          const mappedTile = mapUVFromAtlas(tile, ctx.texturesRegistry.tilesPerRow, i++)
          uvs.push(mappedTile.x, mappedTile.y)
        }

        // Add indices for this face
        for (const idx of FACE_INDICES) {
          indices.push(startVertex + idx)
        }

        vertexCount += 4
      }
    }

    const geometry = new BufferGeometry()

    if (positions.length > 0) {
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
      geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
      geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
      // geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
      geometry.setIndex(new Uint16BufferAttribute(indices, 1))

      geometry.computeBoundingBox()
      geometry.computeBoundingSphere()
    }

    console.log(
      `Built mesh for chunk at`,
      chunk.getWorldCoordinates(),
      `in ${(performance.now() - now).toFixed(2)} ms`,
    )

    return geometry
  }

  // Create or update a chunk mesh
  const updateChunkMesh = (chunk: Chunk): void => {
    const existingData = chunkMeshes.get(chunk)

    const geometry = buildChunkMesh(chunk)

    if (existingData.isSome()) {
      // Update existing mesh
      const data = existingData.value()
      data.mesh.geometry.dispose()
      data.mesh.geometry = geometry
      data.needsRebuild = false
      console.log(`Updated mesh for chunk at`, chunk.getWorldCoordinates())
    } else {
      // Create new mesh
      const mesh = new Mesh(
        geometry,
        new MeshBasicMaterial({
          map: ctx.texturesRegistry.atlas,
          side: DoubleSide,
          // vertexColors: true,
        }),
      )
      // mesh.frustumCulled = false
      ctx.scene.add(mesh)

      chunkMeshes.set(chunk, {
        mesh,
        needsRebuild: false,
      })

      console.log(`Created mesh for chunk at`, chunk.getWorldCoordinates())
    }
  }

  const renderChunks = (chunks: Chunk[]): void => {
    for (const chunk of chunks) {
      chunksNeedingRender.add(chunk)
    }
  }

  const renderBlockAt = (worldPos: RawVector3): void => {
    pipe(Chunk.mapToChunkCoordinates(worldPos.x, worldPos.z))
      .map((chunkCoord) => ctx.world.getEntity(Chunk.getWorldID(chunkCoord), Chunk))
      .mapSome((chunk) => chunkBlocksNeedingUpdate.getOrSet(chunk, () => new Set()))
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
    // For chunk meshing, unrendering a block means rebuilding the chunk mesh
    renderBlockAt(worldPos)
  }

  const unrenderChunks = (chunks: Chunk[]): void => {
    for (const chunk of chunks) {
      const meshData = chunkMeshes.get(chunk)

      if (meshData.isSome()) {
        const data = meshData.value()
        ctx.scene.remove(data.mesh)
        data.mesh.geometry.dispose()
        chunkMeshes.delete(chunk)
      }

      chunksNeedingRender.delete(chunk)
      chunkBlocksNeedingUpdate.delete(chunk)
    }

    console.log(`Unrendered ${chunks.length} chunks`)
  }

  ctx.onRenderBatch(Chunk, (chunks) => {
    // Handle individual block updates
    for (const [chunk] of chunkBlocksNeedingUpdate) {
      chunksNeedingRender.add(chunk)
      chunkBlocksNeedingUpdate.delete(chunk)
    }

    // Rebuild chunks that need rendering
    const chunksToRender = ctx.isFirstFrame() ? chunks : Array.from(chunksNeedingRender)

    for (const chunk of chunksToRender) {
      updateChunkMesh(chunk)
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
