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

  const generateChunkAt = (chunkCoords: ChunkCoordinates): Chunk => {
    const chunk = new Chunk(chunkCoords.x, chunkCoords.z)

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

    return chunk
  }

  return {
    generateChunkAt,
  }
}
