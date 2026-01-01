import seedrandom from 'seedrandom'
import { SimplexNoise } from 'three/examples/jsm/Addons.js'
import { match } from 'ts-pattern'

import { type BlockID, Blocks } from '../shared/BlocksRegistry.ts'
import { Config } from '../shared/Config.ts'
import { Chunk, type ChunkCoordinates } from '../shared/entities/Chunk.ts'
import { pipe } from '../shared/Pipe.ts'
import { range } from '../shared/util.ts'

export type TerrainGenerator = ReturnType<typeof createTerrainGenerator>

const createRandomSplitter = (seed: string) => (salt: string) => ({
  random: seedrandom(`${seed}:${salt}`),
})

export const createTerrainGenerator = (seed: string) => {
  const splitter = createRandomSplitter(seed)

  const heightNoise = new SimplexNoise(splitter('terrain_height'))

  const detailNoise = new SimplexNoise(splitter('terrain_detail'))

  const treeRandom = seedrandom(`${seed}:trees`)

  const generateChunkAt = (chunkCoords: ChunkCoordinates): Chunk => {
    const chunk = new Chunk(chunkCoords.x, chunkCoords.z)

    // First pass: generate terrain
    for (const x of range(Config.CHUNK_SIZE)) {
      for (const z of range(Config.CHUNK_SIZE)) {
        const { x: worldX, z: worldZ } = Chunk.mapToWorldCoordinates(chunkCoords, { x, z })

        const baseY = 5

        const height =
          baseY +
          Math.floor(
            (heightNoise.noise(worldX * 0.005, worldZ * 0.005) + 1) * 3 +
              detailNoise.noise(worldX * 0.02, worldZ * 0.02) * 2,
          )

        for (let y = 0; y <= height; y++) {
          pipe(
            match<number, BlockID>(y)
              .when(
                (y) => y === 0,
                () => Blocks.Bedrock.id,
              )
              .when(
                (y) => y === height,
                () => Blocks.Grass.id,
              )
              .otherwise(() => Blocks.Dirt.id),
          ).tap((blockID) => chunk.setBlock(x, y, z, blockID))
        }
      }
    }

    // Second pass: generate trees
    for (const x of range(Config.CHUNK_SIZE)) {
      for (const z of range(Config.CHUNK_SIZE)) {
        const { x: worldX, z: worldZ } = Chunk.mapToWorldCoordinates(chunkCoords, { x, z })

        // Use world coordinates for consistent tree placement across chunks
        const treeChance = seedrandom(`${seed}:tree:${worldX}:${worldZ}`)()
        if (treeChance < 0.02) {
          // 2% chance of tree
          // Find ground level
          let groundY = -1
          for (let y = Config.WORLD_HEIGHT - 1; y >= 0; y--) {
            const block = chunk.getBlock(x, y, z)
            if (block.isSome() && block.value() === Blocks.Grass.id) {
              groundY = y
              break
            }
          }

          if (groundY > 0 && groundY < Config.WORLD_HEIGHT - 10) {
            const treeHeight = 5 + Math.floor(treeRandom() * 2) // 5-6 blocks tall

            // Place trunk
            for (let y = groundY + 1; y <= groundY + treeHeight; y++) {
              chunk.setBlock(x, y, z, Blocks.OakLog.id)
            }

            // Place leaves (simple sphere-ish shape)
            const leavesY = groundY + treeHeight - 1
            for (let dx = -2; dx <= 2; dx++) {
              for (let dy = -2; dy <= 2; dy++) {
                for (let dz = -2; dz <= 2; dz++) {
                  // Skip corners and center (trunk)
                  if (
                    Math.abs(dx) + Math.abs(dy) + Math.abs(dz) <= 3 &&
                    !(dx === 0 && dz === 0 && dy <= 0)
                  ) {
                    const leafX = x + dx
                    const leafY = leavesY + dy
                    const leafZ = z + dz

                    // Only place leaves within chunk bounds
                    if (
                      leafX >= 0 &&
                      leafX < Config.CHUNK_SIZE &&
                      leafZ >= 0 &&
                      leafZ < Config.CHUNK_SIZE &&
                      leafY > 0 &&
                      leafY < Config.WORLD_HEIGHT
                    ) {
                      const existing = chunk.getBlock(leafX, leafY, leafZ)
                      if (existing.isNone() || existing.value() === 0) {
                        chunk.setBlock(leafX, leafY, leafZ, Blocks.OakLeaves.id)
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    return chunk
  }

  return {
    generateChunkAt,
  }
}
