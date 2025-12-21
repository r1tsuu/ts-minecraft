import * as THREE from "three";
import type { Block, Chunk, World } from "./types.js";
import { blockRegistry, getBlockById } from "./block.js";
import {
  CHUNK_SIZE,
  RENDER_DISTANCE,
  WORLD_HEIGHT,
  getBlockIndex as getIndex,
} from "./util.js";

const TerrainGeneratorWorker = new Worker(
  new URL("./worker.ts", import.meta.url),
  {
    type: "module",
  }
);

const generateTerrain = async (
  chunkKeys: string[]
): Promise<Map<string, Chunk>> => {
  return new Promise((resolve) => {
    TerrainGeneratorWorker.onmessage = (
      msg: MessageEvent<{ chunks: Map<string, Chunk> }>
    ) => {
      console.log("Received generated chunks from worker", msg.data.chunks);
      resolve(msg.data.chunks);
    };
    TerrainGeneratorWorker.postMessage({ chunkKeys });
  });
};

export const createWorld = (scene: THREE.Scene): World => {
  const backgroundColor = 0x87ceeb;
  scene.fog = new THREE.Fog(backgroundColor, 1, 96);
  scene.background = new THREE.Color(backgroundColor);

  const sunLight = new THREE.PointLight(0xffffff, 0.5);
  sunLight.position.set(500, 500, 500);
  scene.add(sunLight);
  const sunLight2 = new THREE.PointLight(0xffffff, 0.2);
  sunLight2.position.set(-500, 500, -500);
  scene.add(sunLight2);

  const reflectionLight = new THREE.AmbientLight(0x404040);
  scene.add(reflectionLight);

  const blockMeshes = new Map<number, THREE.InstancedMesh>();
  const blockMeshesCount = new Map<number, number>();

  const MAX_COUNT =
    (RENDER_DISTANCE *
      RENDER_DISTANCE *
      CHUNK_SIZE *
      CHUNK_SIZE *
      WORLD_HEIGHT) /
    2;

  const geometry = new THREE.BoxGeometry();

  for (const [id, block] of blockRegistry) {
    const mesh = new THREE.InstancedMesh(geometry, block.material, MAX_COUNT);
    scene.add(mesh);
    blockMeshes.set(id, mesh);
    blockMeshesCount.set(id, 0);
    mesh.frustumCulled = false;
  }

  return {
    chunks: new Map<string, Chunk>(),
    blockMeshes: blockMeshes,
    blockMeshesCount,
  };
};

export const getBlockInWorld = (
  x: number,
  y: number,
  z: number,
  world: World
): Block | null => {
  const chunkX = Math.floor(x / CHUNK_SIZE) * CHUNK_SIZE;
  const chunkZ = Math.floor(z / CHUNK_SIZE) * CHUNK_SIZE;
  const key = chunkKey(chunkX, chunkZ);
  const chunk = world.chunks.get(key);
  if (!chunk) {
    return null;
  }
  const localX = x - chunkX;
  const localZ = z - chunkZ;

  if (y < 0 || y >= WORLD_HEIGHT) {
    return null;
  }

  const blockId = chunk.blocks[getIndex(localX, y, localZ)];

  if (blockId === 0) {
    return null;
  }

  return getBlockById(blockId);
};

const chunkKey = (x: number, z: number) => `${x},${z}`;

export const updateWorld = async (
  world: World,
  cameraPosition: THREE.Vector3
) => {
  const playerChunkX = Math.floor(cameraPosition.x / CHUNK_SIZE) * CHUNK_SIZE;
  const playerChunkZ = Math.floor(cameraPosition.z / CHUNK_SIZE) * CHUNK_SIZE;

  const needed = new Set<string>();
  let chunksToLoad: string[] = [];

  let needsBlockMeshesUpdate = false;

  // Load required chunks
  for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
    for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
      const cx = playerChunkX + dx * CHUNK_SIZE;
      const cz = playerChunkZ + dz * CHUNK_SIZE;
      const key = chunkKey(cx, cz);

      needed.add(key);

      if (!world.chunks.has(key)) {
        chunksToLoad.push(key);
        needsBlockMeshesUpdate = true;
      }
    }
  }

  if (chunksToLoad.length) {
    let current = Date.now();
    const chunks = await generateTerrain(chunksToLoad);
    console.log(`Generated new chunks in ${Date.now() - current} ms`);
    for (const [key, chunk] of chunks) {
      world.chunks.set(key, chunk);
    }

    needsBlockMeshesUpdate = true;
  }

  // Unload chunks outside render distance
  for (const key of world.chunks.keys()) {
    if (!needed.has(key)) {
      world.chunks.delete(key);
      needsBlockMeshesUpdate = true;
    }
  }

  if (!needsBlockMeshesUpdate) {
    return;
  }

  const matrix = new THREE.Matrix4();

  for (const block of world.blockMeshesCount.keys()) {
    world.blockMeshesCount.set(block, 0);
  }

  for (const chunk of world.chunks.values()) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let y = 0; y < WORLD_HEIGHT; y++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          const blockId = chunk.blocks[getIndex(x, y, z)];
          if (blockId === 0) continue; // Air block, skip rendering

          const block = getBlockById(blockId);

          if (!block) continue;

          const mesh = world.blockMeshes.get(blockId);

          if (!mesh) {
            throw new Error(`Mesh for block ID ${blockId} not found`);
          }

          matrix.setPosition(chunk.x + x, y, chunk.z + z);
          const index = world.blockMeshesCount.get(blockId);

          if (index === undefined) {
            throw new Error(`Mesh count for block ID ${blockId} not found`);
          }

          mesh.setMatrixAt(index, matrix);
          world.blockMeshesCount.set(blockId, index + 1);
        }
      }
    }
  }

  for (const mesh of world.blockMeshes.values()) {
    mesh.instanceMatrix.needsUpdate = true;
  }
};
