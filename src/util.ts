export const CHUNK_SIZE = 16;

export const RENDER_DISTANCE = 2;

export const WORLD_HEIGHT = 256;

export const getBlockKey = (x: number, y: number, z: number): string => {
  return `${x},${y},${z}`;
};
