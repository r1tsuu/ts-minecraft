export const CHUNK_SIZE = 16;

export const RENDER_DISTANCE = 2;

export const WORLD_HEIGHT = 256;

export const getBlockKey = (x: number, y: number, z: number): string => {
  return `${x},${y},${z}`;
};

export const getBlockIndex = (x: number, y: number, z: number): number => {
  return x + CHUNK_SIZE * (z + CHUNK_SIZE * y);
};

export const getChunksCoordinatesInRadius = ({
  centerX,
  centerZ,
  chunkRadius,
}: {
  centerX: number;
  centerZ: number;
  chunkRadius: number;
}): {
  x: number;
  z: number;
}[] => {
  const chunks: { x: number; z: number }[] = [];

  for (let dx = -chunkRadius; dx <= chunkRadius; dx++) {
    for (let dz = -chunkRadius; dz <= chunkRadius; dz++) {
      const distanceSquared = dx * dx + dz * dz;
      if (distanceSquared <= chunkRadius * chunkRadius) {
        chunks.push({
          x: centerX + dx * CHUNK_SIZE,
          z: centerZ + dz * CHUNK_SIZE,
        });
      }
    }
  }

  return chunks;
};

export const findByXZ = <T extends { x: number; z: number }>(
  array: T[],
  x: number,
  z: number
): T | null => {
  for (const item of array) {
    if (item.x === x && item.z === z) {
      return item;
    }
  }
  return null;
};

export const findByXYZ = <T extends { x: number; y: number; z: number }>(
  array: T[],
  x: number,
  y: number,
  z: number
): T | null => {
  for (const item of array) {
    if (item.x === x && item.y === y && item.z === z) {
      return item;
    }
  }

  return null;
};
