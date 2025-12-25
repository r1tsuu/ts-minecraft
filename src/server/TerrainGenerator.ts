import { SimplexNoise } from 'three/examples/jsm/Addons.js'

import type { BlocksRegistry } from '../blocks/BlocksRegistry.ts'
import type { SharedConfig } from '../config.ts'
import type { DatabaseChunkData } from './WorldDatabase.ts'

export class TerrainGenerator {
  private noise = new SimplexNoise()

  constructor(
    private readonly blocksRegistry: BlocksRegistry,
    private readonly config: SharedConfig,
  ) {}

  generateChunk = (chunkX: number, chunkZ: number): DatabaseChunkData => {
    const chunk: DatabaseChunkData = {
      chunkX,
      chunkZ,
      data: {
        blocks: [],
      },
      uuid: crypto.randomUUID(),
    }

    for (let x = 0; x < this.config.chunkSize; x++) {
      for (let z = 0; z < this.config.chunkSize; z++) {
        const worldX = chunkX * this.config.chunkSize + x
        const worldZ = chunkZ * this.config.chunkSize + z

        const baseY = 30
        const heightVariation = 12
        const amplitude = heightVariation / 2
        const frequency = 0.005

        const yOffset = Math.floor(
          (this.noise.noise(worldX * frequency, worldZ * frequency) + 1) * amplitude,
        )

        const height = baseY + yOffset

        for (let y = 0; y <= height; y++) {
          const block = y === height ? 'grass' : 'dirt'

          chunk.data.blocks.push({
            typeID: this.blocksRegistry.getBlockIdByName(block),
            x,
            y,
            z,
          })
        }
      }
    }

    return chunk
  }
}
