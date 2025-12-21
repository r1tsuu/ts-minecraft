import { getBlockIdByName, initBlocksWorker } from "./block.js";
// @ts-expect-error
import { SimplexNoise } from "three/examples/jsm/math/SimplexNoise";
import type { SimplexNoise as SimplexNoiseType } from "three/examples/jsm/math/SimplexNoise.js";

import type { Chunk } from "./types.js";
import { CHUNK_SIZE, getBlockIndex, WORLD_HEIGHT } from "./util.js";

initBlocksWorker();

const simplex = new SimplexNoise() as SimplexNoiseType;

const generateChunk = (chunkX: number, chunkZ: number): Chunk => {
  const chunk: Chunk = {
    blocks: new Uint8Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE),
    x: chunkX,
    z: chunkZ,
  };

  // Generate terrain
  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      const worldX = chunkX + x;
      const worldZ = chunkZ + z;
      const baseY = 15;
      const heightVariation = 12;
      const amplitude = heightVariation / 2;
      const frequency = 0.005;
      const yOffset = Math.floor(
        (simplex.noise(worldX * frequency, worldZ * frequency) + 1) * amplitude
      );

      const height = baseY + yOffset;

      for (let y = 0; y <= height; y++) {
        const block = y === height ? "grass" : "dirt";
        chunk.blocks[getBlockIndex(x, y, z)] = getBlockIdByName(block);
      }
    }
  }

  return chunk;
};

onmessage = (
  msg: MessageEvent<{
    chunkKeys: string[];
  }>
) => {
  const { chunkKeys } = msg.data;
  const chunks = new Map<string, Chunk>();

  for (const key of chunkKeys) {
    const [chunkXStr, chunkZStr] = key.split(",");
    const chunkX = parseInt(chunkXStr, 10);
    const chunkZ = parseInt(chunkZStr, 10);
    const chunk = generateChunk(chunkX, chunkZ);
    chunks.set(key, chunk);
  }

  postMessage({ chunks });
};
