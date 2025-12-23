import type { BlockInWorld, Chunk, RawVector3, World } from "./types.ts";

export const CHUNK_SIZE = 16;

export const RENDER_DISTANCE = 2;

export const WORLD_HEIGHT = 256;

export const GRAVITY_ACCELERATION = 9.81;

export const getBlockKey = (x: number, y: number, z: number): string => {
  return `${x},${y},${z}`;
};

export const getBlockIndex = (x: number, y: number, z: number): number => {
  return x + CHUNK_SIZE * (z + CHUNK_SIZE * y);
};

export const getChunksCoordinatesInRadius = ({
  centerChunkX,
  centerChunkZ,
  chunkRadius,
}: {
  centerChunkX: number;
  centerChunkZ: number;
  chunkRadius: number;
}): {
  chunkX: number;
  chunkZ: number;
}[] => {
  const chunks: { chunkX: number; chunkZ: number }[] = [];

  for (let dx = -chunkRadius; dx <= chunkRadius; dx++) {
    for (let dz = -chunkRadius; dz <= chunkRadius; dz++) {
      const distanceSquared = dx * dx + dz * dz;
      if (distanceSquared <= chunkRadius * chunkRadius) {
        chunks.push({
          chunkX: centerChunkX + dx,
          chunkZ: centerChunkZ + dz,
        });
      }
    }
  }

  console.log("Chunks in radius:", chunks);

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

export const findChunkByXZ = <T extends { chunkX: number; chunkZ: number }>(
  array: T[],
  chunkX: number,
  chunkZ: number
): T | null => {
  for (const item of array) {
    if (item.chunkX === chunkX && item.chunkZ === chunkZ) {
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

export const syncServerChunksOnClient = (
  chunks: {
    chunkX: number;
    chunkZ: number;
    id: number;
    blocks: BlockInWorld[];
  }[],
  world: World
) => {
  for (const chunk of chunks) {
    const key = `${chunk.chunkX},${chunk.chunkZ}`;

    const blocks: Map<string, BlockInWorld> = new Map();
    const blocksUint = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT);

    for (const block of chunk.blocks) {
      const blockKey = `${block.x},${block.y},${block.z}`;
      blocks.set(blockKey, block);
      blocksUint[getBlockIndex(block.x, block.y, block.z)] = block.typeID;
    }

    world.chunks.set(key, {
      blocks,
      blocksUint,
      id: chunk.id,
      chunkX: chunk.chunkX,
      chunkZ: chunk.chunkZ,
    });
  }
};

export const rawVector3 = (x: number, y: number, z: number): RawVector3 => {
  return { x, y, z };
};

export const zeroRawVector3 = (): RawVector3 => {
  return { x: 0, y: 0, z: 0 };
};
