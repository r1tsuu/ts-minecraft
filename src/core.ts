import * as THREE from "three";
import type { MinecraftInstance } from "./types.ts";
import { createWorld } from "./world.ts";
import { FPSControls } from "./FPSControls.ts";

export const createMinecraftInstance = (): MinecraftInstance => {
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ antialias: true });
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

  return {
    camera,
    controls: FPSControls.controls(camera, renderer, world, player),
    renderer,
    scene,
    world,
    player,
  };
};
