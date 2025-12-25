export type SharedConfig = ReturnType<typeof createConfig>

export const createConfig = () => {
  const config = {
    chunkSize: 16,
    defaultPlayerJumpStrength: 8,
    defaultPlayerSpeed: 5,
    renderDistance: 8,
    spawnChunkRadius: 3,
    tickDurationMs: 50, // 20 ticks per second
    worldHeight: 256,
  }

  return config
}
