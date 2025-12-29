import { SimplexNoise } from 'three/examples/jsm/Addons.js'

import { BlocksRegistry } from '../shared/BlocksRegistry.ts'
import { Config } from '../shared/Config.ts'
import { Chunk, type ChunkCoordinates } from '../shared/entities/Chunk.ts'
import { range } from '../shared/util.ts'
import { ServerContainer } from './ServerContainer.ts'

export class TerrainGenerator {
  private noise = new SimplexNoise()

  constructor() {}

  generateChunkAt(coords: ChunkCoordinates): Chunk {
    const blocksRegistry = ServerContainer.resolve(BlocksRegistry).unwrap()
    const chunk = new Chunk(coords.x, coords.z)

    for (const x of range(Config.CHUNK_SIZE)) {
      for (const z of range(Config.CHUNK_SIZE)) {
        const worldX = coords.x * Config.CHUNK_SIZE + x
        const worldZ = coords.z * Config.CHUNK_SIZE + z

        const baseY = 10
        const heightVariation = 5
        const amplitude = heightVariation / 2
        const frequency = 0.005

        const yOffset = Math.floor(
          (this.noise.noise(worldX * frequency, worldZ * frequency) + 1) * amplitude,
        )

        const height = baseY + yOffset

        for (let y = 0; y <= height; y++) {
          const block = y === height ? 'grass' : 'dirt'
          chunk.setBlock(x, y, z, blocksRegistry.getBlockIdByName(block))
        }
      }
    }

    return chunk
  }
}
