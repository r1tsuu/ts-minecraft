import * as THREE from "three";
import type { BlockInWorld, MinecraftInstance } from "./types.ts";
import { createWorld } from "./world.ts";
import { FPSControls } from "./FPSControls.ts";
import { listenToWorkerEvents } from "./worker/workerClient.js";

export const createMinecraftInstance = async ({
  worldID,
}: {
  worldID: number;
}): Promise<{
  minecraft: MinecraftInstance;
  disposeMinecraft: () => void;
}> => {
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  // renderer.outputColorSpace = THREE.SRGBColorSpace;
  // renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // renderer.toneMappingExposure = 1.0;
  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );

  camera.position.set(0, 40, 0);
  camera.lookAt(30, 35, 30);

  const world = createWorld({ scene, id: worldID });

  const player = {
    width: 0.6,
    height: 1.8,
  };

  const unsubscribeFromWorkerEvents = listenToWorkerEvents((event) => {
    console.log("Received event from worker:", event);

    switch (event.type) {
      case "chunksGenerated": {
        const { chunks } = event.payload;
        for (const chunk of chunks) {
          const key = `${chunk.x},${chunk.z}`;
          const blocks: Map<string, BlockInWorld> = new Map();

          for (const block of chunk.blocks) {
            const blockKey = `${block.x},${block.y},${block.z}`;
            blocks.set(blockKey, block);
          }

          world.chunks.set(key, {
            blocks,
            id: chunk.id,
            x: chunk.x,
            z: chunk.z,
          });
        }
        world.requestingChunksState = "received";
        break;
      }
    }
  });

  const disposeMinecraft = () => {
    unsubscribeFromWorkerEvents();
    renderer.dispose();
  };

  const minecraft: MinecraftInstance = {
    camera,
    controls: FPSControls.controls(camera, renderer, world, player),
    renderer,
    scene,
    paused: false,
    world,
    player,
  };

  return {
    minecraft,
    disposeMinecraft,
  };
};
