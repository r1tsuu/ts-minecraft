import { SimplexNoise } from 'three/examples/jsm/Addons.js'

import type { DatabaseChunkData } from './WorldDatabase.ts'

import { BlocksRegistry } from '../shared/BlocksRegistry.ts'
import { Config } from '../shared/Config.ts'
import { ServerContainer } from './ServerContainer.ts'

export class TerrainGenerator {
  private noise = new SimplexNoise()

  constructor() {}

  generateChunk = (chunkX: number, chunkZ: number): DatabaseChunkData => {
    const blocksRegistry = ServerContainer.resolve(BlocksRegistry).unwrap()
    const chunk: DatabaseChunkData = {
      chunkX,
      chunkZ,
      data: {
        blocks: [],
      },
      uuid: crypto.randomUUID(),
    }

    for (let x = 0; x < Config.CHUNK_SIZE; x++) {
      for (let z = 0; z < Config.CHUNK_SIZE; z++) {
        const worldX = chunkX * Config.CHUNK_SIZE + x
        const worldZ = chunkZ * Config.CHUNK_SIZE + z

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

          chunk.data.blocks.push({
            typeID: blocksRegistry.getBlockIdByName(block),
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
