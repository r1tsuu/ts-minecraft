import * as THREE from "three";
import type { BlockType, World } from "./types.js";
import { blockRegistry, getBlockById } from "./block.js";
import {
  CHUNK_SIZE,
  RENDER_DISTANCE,
  WORLD_HEIGHT,
  getBlockIndex,
} from "./util.js";
import { sendEventToWorker } from "./worker/workerClient.js";
import type { ActiveWorld } from "./worker/types.ts";
import { syncServerChunksOnClient } from "./client.ts";

export const createWorld = ({
  scene,
  activeWorld,
}: {
  scene: THREE.Scene;
  activeWorld: ActiveWorld;
}): World => {
  const backgroundColor = 0x87ceeb;
  scene.fog = new THREE.Fog(backgroundColor, 1, 96);
  scene.background = new THREE.Color(backgroundColor);

  const sunLight = new THREE.DirectionalLight(0xffffff, 3);
  sunLight.position.set(500, 500, 500);
  scene.add(sunLight);
  const sunLight2 = new THREE.DirectionalLight(0xffffff, 3);
  sunLight2.position.set(-500, 500, -500);
  scene.add(sunLight2);

  const reflectionLight = new THREE.AmbientLight(0x404040, 0.5);
  scene.add(reflectionLight);

  const world: World = {
    requestingChunksState: "idle",
    id: activeWorld.world.id,
    chunks: new Map(),
  };

  syncServerChunksOnClient(activeWorld.loadedChunks, world, scene);

  return world;
};

export const getBlockInWorld = (
  x: number,
  y: number,
  z: number,
  world: World
): BlockType | null => {
  const chunkX = Math.floor(x / CHUNK_SIZE);
  const chunkZ = Math.floor(z / CHUNK_SIZE);
  const key = chunkKey(chunkX, chunkZ);
  const chunk = world.chunks.get(key);

  if (!chunk) {
    return null;
  }
  const localX = x - chunkX * CHUNK_SIZE;
  const localZ = z - chunkZ * CHUNK_SIZE;

  if (y < 0 || y >= WORLD_HEIGHT) {
    return null;
  }

  const block = chunk.blocksUint[getBlockIndex(localX, y, localZ)];

  if (!block) {
    return null;
  }

  return getBlockById(block);
};

const chunkKey = (x: number, z: number) => `${x},${z}`;

export const updateWorld = async (
  world: World,
  cameraPosition: THREE.Vector3
) => {
  const playerChunkX = Math.floor(cameraPosition.x / CHUNK_SIZE);
  const playerChunkZ = Math.floor(cameraPosition.z / CHUNK_SIZE);

  const needed = new Set<string>();
  let chunksToLoad: string[] = [];

  for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
    for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
      const cx = playerChunkX + dx;
      const cz = playerChunkZ + dz;
      const key = chunkKey(cx, cz);

      needed.add(key);

      if (!world.chunks.has(key)) {
        chunksToLoad.push(key);
      }
    }
  }

  if (chunksToLoad.length) {
    if (world.requestingChunksState === "idle") {
      sendEventToWorker({
        type: "requestChunks",
        payload: {
          worldID: world.id,
          chunksCoordinates: chunksToLoad.map((key) => {
            const [chunkX, chunkZ] = key.split(",").map(Number);
            return { chunkX, chunkZ };
          }),
        },
      });
      world.requestingChunksState = "requesting";
    }
  }

  if (world.requestingChunksState === "received") {
    world.requestingChunksState = "idle";
  }

  // Unload chunks outside render distance
  for (const key of world.chunks.keys()) {
    if (!needed.has(key)) {
      world.chunks.get(key)!.mesh.removeFromParent();
      world.chunks.delete(key);
    }
  }
};
