import { SimplexNoise } from 'three/examples/jsm/Addons.js'

import type { BlocksRegistry } from '../blocks/registry.ts'
import type { SharedConfig } from '../config/createConfig.ts'
import type { DatabaseChunkData } from './worldDatabase.ts'

export type TerrainGenerator = ReturnType<typeof createTerrainGenerator>

export const createTerrainGenerator = ({
  blocksRegistry,
  config,
}: {
  blocksRegistry: BlocksRegistry
  config: SharedConfig
}) => {
  const noise = new SimplexNoise()

  const generateChunk = (chunkX: number, chunkZ: number): DatabaseChunkData => {
    const chunk: DatabaseChunkData = {
      chunkX,
      chunkZ,
      data: {
        blocks: [],
      },
      uuid: crypto.randomUUID(),
    }

    for (let x = 0; x < config.chunkSize; x++) {
      for (let z = 0; z < config.chunkSize; z++) {
        const worldX = chunkX * config.chunkSize + x
        const worldZ = chunkZ * config.chunkSize + z

        const baseY = 30
        const heightVariation = 12
        const amplitude = heightVariation / 2
        const frequency = 0.005

        const yOffset = Math.floor(
          (noise.noise(worldX * frequency, worldZ * frequency) + 1) * amplitude,
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

  return {
    generateChunk,
  }
}
