import * as THREE from "three";
import type { ControlsHandler, Minecraft } from "./types.ts";
import { createWorld } from "./world.ts";
import { FPSControls } from "./FPSControls.ts";

export const createMinecraftInstance = (): Minecraft => {
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

  const controls: {
    handler: ControlsHandler;
    type: "free" | "fps";
  } = {
    handler: new FPSControls(camera, renderer.domElement, world),
    type: "fps",
  };

  return {
    camera,
    controls,
    renderer,
    scene,
    world,
  };
};
