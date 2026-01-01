import seedrandom from 'seedrandom'
import { SimplexNoise } from 'three/examples/jsm/Addons.js'

import { type BlockID, Blocks } from '../shared/BlocksRegistry.ts'
import { Config } from '../shared/Config.ts'
import { Chunk, type ChunkCoordinates } from '../shared/entities/Chunk.ts'
import { range } from '../shared/util.ts'

export interface TerrainGenerator {
  generateChunkAt(chunkCoords: ChunkCoordinates): Chunk
}

// Terrain generation configuration
const TERRAIN_CONFIG = {
  baseY: 32,
  caveOpeningChance: 0.3, // 30% chance cave extends to surface
  caveThreshold1: 0.1, //
  caveThreshold2: 0.5, //
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

export const createTerrainGenerator = (seed: string): TerrainGenerator => {
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
          const baseCave =
            cave1 > TERRAIN_CONFIG.caveThreshold1 && cave2 > TERRAIN_CONFIG.caveThreshold2

          // Allow caves to extend to surface occasionally
          const surfaceOpeningNoise = caveNoise.noise(worldX * 0.1, worldZ * 0.1)
          const hasSurfaceOpening = surfaceOpeningNoise > 0.7 && baseCave

          const minCaveY = hasSurfaceOpening ? Math.max(1, height - 10) : 1
          const isCave = baseCave && y > minCaveY && y < height - 3

          if (!isCave) {
            // Check for gravel pockets in stone
            const gravelChance = seedrandom(`${seed}:gravel:${worldX}:${y}:${worldZ}`)()
            const isGravelPocket =
              gravelChance < TERRAIN_CONFIG.gravelChance && y < height - 4 && y > 5

            let blockID: BlockID

            if (y === 0) {
              blockID = Blocks.Bedrock.id
            } else if (
              y === height &&
              TERRAIN_CONFIG.sandBelowSeaLevel &&
              height < TERRAIN_CONFIG.baseY - 2
            ) {
              blockID = Blocks.Sand.id // Sand below sea level
            } else if (y === height) {
              blockID = Blocks.Grass.id
            } else if (y > height - 4) {
              blockID = Blocks.Dirt.id // Top 4 blocks are dirt
            } else if (isGravelPocket) {
              blockID = Blocks.Gravel.id // Gravel pockets
            } else {
              blockID = Blocks.Stone.id // Everything else is stone
            }

            chunk.setBlock(x, y, z, blockID)
          }
        }
      }
    }

    // Second pass: generate ores in veins
    for (const oreConfig of ORE_CONFIGS) {
      for (const x of range(Config.CHUNK_SIZE)) {
        for (const z of range(Config.CHUNK_SIZE)) {
          const { x: worldX, z: worldZ } = Chunk.mapToWorldCoordinates(chunkCoords, { x, z })

          for (let y = oreConfig.minY; y <= oreConfig.maxY; y++) {
            const oreChance = seedrandom(
              `${seed}:ore:${oreConfig.block}:${worldX}:${y}:${worldZ}`,
            )()
            if (oreChance < oreConfig.chance) {
              // Generate ore vein
              const veinCenterX = x
              const veinCenterY = y
              const veinCenterZ = z

              // Place ore blocks in a cluster around the center
              for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                  for (let dz = -1; dz <= 1; dz++) {
                    const veinRandom = seedrandom(
                      `${seed}:vein:${oreConfig.block}:${worldX + dx}:${y + dy}:${worldZ + dz}`,
                    )()
                    // Use distance to create irregular vein shapes
                    if (veinRandom < 0.6) {
                      const veinX = veinCenterX + dx
                      const veinY = veinCenterY + dy
                      const veinZ = veinCenterZ + dz

                      // Check bounds
                      if (
                        veinX >= 0 &&
                        veinX < Config.CHUNK_SIZE &&
                        veinZ >= 0 &&
                        veinZ < Config.CHUNK_SIZE &&
                        veinY >= oreConfig.minY &&
                        veinY <= oreConfig.maxY
                      ) {
                        const current = chunk.getBlock(veinX, veinY, veinZ)
                        if (current.isSome() && current.value() === Blocks.Stone.id) {
                          chunk.setBlock(veinX, veinY, veinZ, oreConfig.block)
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
