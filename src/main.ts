import * as THREE from "three";

import "./style.css";
import { initBlocks } from "./block.js";
import { updateWorld } from "./world.js";
import { initUI } from "./initUI.js";
import { createMinecraftInstance } from "./core.ts";
import { createRaycaster } from "./raycast.ts";

await initBlocks();

const clock = new THREE.Clock();

const minecraft = createMinecraftInstance();

const { updateUI } = initUI({
  minecraft,
});

const raycaster = createRaycaster({
  camera: minecraft.camera,
  world: minecraft.world,
  scene: minecraft.scene,
  player: minecraft.player,
});

let updatePromise: Promise<void> | null = null;
let lastUpdated: null | number = null;

const loop = async () => {
  requestAnimationFrame(loop);
  const delta = clock.getDelta();

  minecraft.renderer.render(minecraft.scene, minecraft.camera);
  minecraft.controls.handler.update(delta);

  if (!updatePromise) {
    updatePromise = updateWorld(
      minecraft.world,
      minecraft.camera.position
    ).then(() => {
      lastUpdated = Date.now();
      raycaster.update();
      updatePromise = null;
    });
  }

  updateUI();
};

loop();
