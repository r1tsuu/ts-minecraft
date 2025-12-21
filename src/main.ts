import * as THREE from "three";

import "./style.css";
import { initBlocks } from "./block.js";
import { createWorld, updateWorld } from "./world.js";
import type { ControlsHandler } from "./types.js";
import { FPSControls } from "./FPSControls.js";
import { initUI } from "./initUI.js";

const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ antialias: true });
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
});

renderer.domElement.style.outline = "none"; // remove default outline

camera.position.set(0, 40, 0);

camera.lookAt(30, 35, 30);

const clock = new THREE.Clock();

await initBlocks();

const world = createWorld(scene);

const controls: {
  handler: ControlsHandler;
  type: "free" | "fps";
} = {
  handler: new FPSControls(camera, renderer.domElement, world),
  type: "fps",
};

const { updateUI } = initUI({
  camera,
  controls,
  renderer,
  world,
});

const loop = async () => {
  requestAnimationFrame(loop);
  const delta = clock.getDelta();

  renderer.render(scene, camera);

  controls.handler.update(delta);
  await updateWorld(world, camera.position);

  updateUI();
};

loop();
