export type SharedConfig = {
  chunkSize: number
  renderDistance: number
  spawnChunkRadius: number
  worldHeight: number
}

export const createConfig = () => {
  const config: SharedConfig = {
    chunkSize: 16,
    renderDistance: 8,
    spawnChunkRadius: 3,
    worldHeight: 256,
  }

  return config
}
