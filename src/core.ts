import * as THREE from "three";
import type { MinecraftInstance } from "./types.ts";
import { createWorld } from "./world.ts";
import { FPSControls } from "./FPSControls.ts";
import { listenToWorkerEvents } from "./workerClient.ts";

export const createMinecraftInstance = async (): Promise<MinecraftInstance> => {
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

  const world = createWorld(scene);

  const player = {
    width: 0.6,
    height: 1.8,
  };

  const unsubscribeFromWorkerEvents = listenToWorkerEvents((event) => {
    console.log("Received event from worker:", event);

    switch (event.type) {
      case "chunksGenerated": {
        const { chunks } = event.payload;
        for (const [key, chunk] of chunks) {
          world.chunks.set(key, chunk);
        }
        world.requestingChunksState = "received";
        break;
      }
    }
  });

  const dispose = () => {
    unsubscribeFromWorkerEvents();
    renderer.dispose();
  };

  return {
    camera,
    controls: FPSControls.controls(camera, renderer, world, player),
    renderer,
    scene,
    paused: false,
    world,
    player,
    dispose,
  };
};
