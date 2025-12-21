import * as THREE from "three";
import { FreeControls } from "./FreeControls.js";

import "./style.css";
import { initBlocks } from "./block.js";
import { createWorld, updateWorld } from "./world.js";
import type { Controls } from "./types.js";
import { FPSControls } from "./FPSControls.js";

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

// FPS Counter
const fpsDisplay = document.createElement("div");
fpsDisplay.classList.add("fps_display");
document.body.appendChild(fpsDisplay);

// Position display
const positionDisplay = document.createElement("div");
positionDisplay.classList.add("position_display");
document.body.appendChild(positionDisplay);

let frameCount = 0;
let lastTime = performance.now();
let fps = 0;

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
});

renderer.domElement.style.outline = "none"; // remove default outline

camera.position.set(0, 40, 0);

camera.lookAt(30, 35, 30);

const clock = new THREE.Clock();

const toggleControlsButton = document.createElement("button");
toggleControlsButton.classList.add("controls_toggle_button");
toggleControlsButton.textContent = "Switch to Free Controls";
document.body.appendChild(toggleControlsButton);

await initBlocks();

const world = createWorld(scene);

let controls: Controls = new FPSControls(camera, renderer.domElement, world);
let controlsType: "free" | "fps" = "fps";

const toggleControls = () => {
  controls.dispose();
  if (controlsType === "fps") {
    controlsType = "free";
    controls = new FreeControls(camera, renderer.domElement);
    toggleControlsButton.textContent = "Switch to FPS Controls";
  } else {
    controlsType = "fps";
    controls = new FPSControls(camera, renderer.domElement, world);
    toggleControlsButton.textContent = "Switch to Free Controls";
  }
};

toggleControlsButton.addEventListener("click", () => {
  toggleControls();
});

window.addEventListener("keydown", (e) => {
  if (e.code === "KeyC") {
    toggleControls();
  }
});

let updateWorldPromise: Promise<void> | null = null;

const loop = () => {
  requestAnimationFrame(loop);
  const delta = clock.getDelta();

  renderer.render(scene, camera);

  controls.update(delta);

  if (!updateWorldPromise) {
    updateWorldPromise = updateWorld(world, camera.position).then(() => {
      updateWorldPromise = null;
    });
  }

  // Update FPS counter
  frameCount++;
  const currentTime = performance.now();
  if (currentTime >= lastTime + 1000) {
    fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
    fpsDisplay.textContent = `FPS: ${fps}`;
    frameCount = 0;
    lastTime = currentTime;
  }

  // Update position display
  positionDisplay.textContent = `Position: x=${camera.position.x.toFixed(
    2
  )}, y=${camera.position.y.toFixed(2)}, z=${camera.position.z.toFixed(2)}`;
};

loop();
