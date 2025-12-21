import * as THREE from "three";
import type { ControlsHandler, World } from "./types.js";
import { FreeControls } from "./FreeControls.js";
import { FPSControls } from "./FPSControls.js";

export const initUI = ({
  renderer,
  camera,
  controls,
  world,
}: {
  camera: THREE.PerspectiveCamera;
  world: World;
  controls: { handler: ControlsHandler; type: "free" | "fps" };
  renderer: THREE.WebGLRenderer;
}) => {
  // FPS Counter
  const fpsDisplay = document.createElement("div");
  fpsDisplay.classList.add("fps_display");
  document.body.appendChild(fpsDisplay);

  // Position display
  const positionDisplay = document.createElement("div");
  positionDisplay.classList.add("position_display");
  document.body.appendChild(positionDisplay);

  const toggleControlsButton = document.createElement("button");
  toggleControlsButton.classList.add("controls_toggle_button");
  toggleControlsButton.textContent = "Switch to Free Controls";
  document.body.appendChild(toggleControlsButton);

  const toggleControls = () => {
    controls.handler.dispose();
    if (controls.type === "fps") {
      controls.type = "free";
      controls.handler = new FreeControls(camera, renderer.domElement);
      toggleControlsButton.textContent = "Switch to FPS Controls";
    } else {
      controls.type = "fps";
      controls.handler = new FPSControls(camera, renderer.domElement, world);
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

  let frameCount = 0;
  let lastTime = performance.now();
  let fps = 0;

  const updateUI = () => {
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
    const pos = camera.position;

    let displayY = pos.y;
    if (
      "playerHeight" in controls.handler &&
      typeof controls.handler.playerHeight === "number"
    ) {
      displayY -= controls.handler.playerHeight;
    }

    positionDisplay.textContent = `Position: X: ${pos.x.toFixed(
      2
    )} Y: ${displayY.toFixed(2)} Z: ${pos.z.toFixed(2)}`;
  };

  return {
    fpsDisplay,
    positionDisplay,
    toggleControlsButton,
    updateUI,
  };
};
