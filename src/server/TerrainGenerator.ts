import seedrandom from 'seedrandom'
import { SimplexNoise } from 'three/examples/jsm/Addons.js'
import { match } from 'ts-pattern'

import { type BlockID, Blocks } from '../shared/BlocksRegistry.ts'
import { Config } from '../shared/Config.ts'
import { Chunk, type ChunkCoordinates } from '../shared/entities/Chunk.ts'
import { pipe } from '../shared/Pipe.ts'
import { range } from '../shared/util.ts'

export type TerrainGenerator = ReturnType<typeof createTerrainGenerator>
// Terrain generation configuration
const TERRAIN_CONFIG = {
  baseY: 32,
  caveThreshold1: 0.6,
  caveThreshold2: 0.5,
  detailScale: 0.02,
  gravelChance: 0.05, // 5% chance in stone layers
  heightScale: 0.005,
  sandBelowSeaLevel: true,
  treeChance: 0.02, // 2% chance
}
// Ore configuration
interface OreConfig {
  block: BlockID
  chance: number
  maxY: number
  minY: number
  veinSize: number
}

const ORE_CONFIGS: OreConfig[] = [
  { block: Blocks.CoalOre.id, chance: 0.01, maxY: 50, minY: 5, veinSize: 8 },
  { block: Blocks.IronOre.id, chance: 0.008, maxY: 40, minY: 5, veinSize: 6 },
  { block: Blocks.DiamondOre.id, chance: 0.002, maxY: 16, minY: 1, veinSize: 4 },
]

const createRandomSplitter = (seed: string) => (salt: string) => ({
  random: seedrandom(`${seed}:${salt}`),
})

export const createTerrainGenerator = (seed: string) => {
  const splitter = createRandomSplitter(seed)

  const heightNoise = new SimplexNoise(splitter('terrain_height'))
  const detailNoise = new SimplexNoise(splitter('terrain_detail'))
  const caveNoise = new SimplexNoise(splitter('caves'))
  const caveNoise2 = new SimplexNoise(splitter('caves2'))

  const generateChunkAt = (chunkCoords: ChunkCoordinates): Chunk => {
    const chunk = new Chunk(chunkCoords.x, chunkCoords.z)

    // First pass: generate terrain
    for (const x of range(Config.CHUNK_SIZE)) {
      for (const z of range(Config.CHUNK_SIZE)) {
        const { x: worldX, z: worldZ } = Chunk.mapToWorldCoordinates(chunkCoords, { x, z })

        const height =
          TERRAIN_CONFIG.baseY +
          Math.floor(
            (heightNoise.noise(
              worldX * TERRAIN_CONFIG.heightScale,
              worldZ * TERRAIN_CONFIG.heightScale,
            ) +
              1) *
              8 +
              detailNoise.noise(
                worldX * TERRAIN_CONFIG.detailScale,
                worldZ * TERRAIN_CONFIG.detailScale,
              ) *
                4,
          )

        for (let y = 0; y <= height; y++) {
          // Check for caves
          const cave1 = caveNoise.noise3d(worldX * 0.05, y * 0.05, worldZ * 0.05)
          const cave2 = caveNoise2.noise3d(worldX * 0.05, y * 0.05, worldZ * 0.05)
          const isCave =
            cave1 > TERRAIN_CONFIG.caveThreshold1 &&
            cave2 > TERRAIN_CONFIG.caveThreshold2 &&
            y > 1 &&
            y < height - 3

          if (!isCave) {
            // Check for gravel pockets in stone
            const gravelChance = seedrandom(`${seed}:gravel:${worldX}:${y}:${worldZ}`)()
            const isGravelPocket =
              gravelChance < TERRAIN_CONFIG.gravelChance && y < height - 4 && y > 5

            pipe(
              match<number, BlockID>(y)
                .when(
                  (y) => y === 0,
                  () => Blocks.Bedrock.id,
                )
                .when(
                  (y) =>
                    y === height &&
                    TERRAIN_CONFIG.sandBelowSeaLevel &&
                    height < TERRAIN_CONFIG.baseY - 2,
                  () => Blocks.Sand.id, // Sand below sea level
                )
                .when(
                  (y) => y === height,
                  () => Blocks.Grass.id,
                )
                .when(
                  (y) => y > height - 4,
                  () => Blocks.Dirt.id, // Top 4 blocks are dirt
                )
                .when(
                  () => isGravelPocket,
                  () => Blocks.Gravel.id, // Gravel pockets
                )
                .otherwise(() => Blocks.Stone.id), // Everything else is stone
            ).tap((blockID) => chunk.setBlock(x, y, z, blockID))
          }
        }
      }
    }

    // Second pass: generate ores
    for (const oreConfig of ORE_CONFIGS) {
      for (const x of range(Config.CHUNK_SIZE)) {
        for (const z of range(Config.CHUNK_SIZE)) {
          const { x: worldX, z: worldZ } = Chunk.mapToWorldCoordinates(chunkCoords, { x, z })

          for (let y = oreConfig.minY; y <= oreConfig.maxY; y++) {
            const oreChance = seedrandom(
              `${seed}:ore:${oreConfig.block}:${worldX}:${y}:${worldZ}`,
            )()
            if (oreChance < oreConfig.chance) {
              // Check if current block is stone
              const current = chunk.getBlock(x, y, z)
              if (current.isSome() && current.value() === Blocks.Stone.id) {
                chunk.setBlock(x, y, z, oreConfig.block)
              }
            }
          }
        }
      }
    }

    // Third pass: generate trees
    for (const x of range(Config.CHUNK_SIZE)) {
      for (const z of range(Config.CHUNK_SIZE)) {
        const { x: worldX, z: worldZ } = Chunk.mapToWorldCoordinates(chunkCoords, { x, z })

        // Use world coordinates for consistent tree placement across chunks
        const treeChance = seedrandom(`${seed}:tree:${worldX}:${worldZ}`)()
        if (treeChance < TERRAIN_CONFIG.treeChance) {
          // 0.5% chance of tree
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
            const treeRandom = seedrandom(`${seed}:tree_height:${worldX}:${worldZ}`)
            const treeHeight = 5 + Math.floor(treeRandom() * 2) // 5-6 blocks tall

            // Place trunk
            for (let y = groundY + 1; y <= groundY + treeHeight; y++) {
              chunk.setBlock(x, y, z, Blocks.OakLog.id)
            }

            // Place leaves (spherical shape with better coverage)
            const leavesBaseY = groundY + treeHeight
            for (let dx = -2; dx <= 2; dx++) {
              for (let dy = -2; dy <= 2; dy++) {
                for (let dz = -2; dz <= 2; dz++) {
                  // Calculate distance from center for spherical shape
                  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)

                  // Create sphere with radius ~2.5, excluding the trunk
                  if (distance <= 2.5 && !(dx === 0 && dz === 0 && dy <= 0)) {
                    const leafX = x + dx
                    const leafY = leavesBaseY + dy
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
