import { SimplexNoise } from 'three/examples/jsm/Addons.js'

import type { SharedConfig } from '../config/createConfig.ts'

export const createTerrainGenerator = ({
  chunkX,
  chunkZ,
  config,
}: {
  chunkX: number
  chunkZ: number
  config: SharedConfig
}) => {
  const noise = new SimplexNoise()
}
