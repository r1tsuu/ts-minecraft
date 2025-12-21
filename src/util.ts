export const CHUNK_SIZE = 16;

export const RENDER_DISTANCE = 2;

export const WORLD_HEIGHT = 256;

export const getBlockIndex = (x: number, y: number, z: number): number => {
  return x + CHUNK_SIZE * (z + CHUNK_SIZE * y);
};
