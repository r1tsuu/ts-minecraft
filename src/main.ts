import * as THREE from "three";

import "./style.css";
import { initBlocks } from "./block.js";
import { updateWorld } from "./world.js";
import { initMenu, initUI } from "./initUI.js";
import { createMinecraftInstance } from "./core.ts";
import { createRaycaster } from "./raycast.ts";
import { min } from "three/tsl";
import { FPSControls } from "./FPSControls.ts";
import { FreeControls } from "./FreeControls.ts";

await initBlocks();

const startGame = async () => {
  let stopped = false;

  const clock = new THREE.Clock();

  const minecraft = await createMinecraftInstance();

  const { updateUI } = initUI({
    minecraft,
    onExitToMainMenu: () => {
      stopped = true;
    },
  });

  const raycaster = createRaycaster({
    camera: minecraft.camera,
    world: minecraft.world,
    scene: minecraft.scene,
    player: minecraft.player,
  });

  let updatePromise: Promise<void> | null = null;
  let lastUpdated: null | number = null;

  let lastPaused = false;

  const loop = async () => {
    requestAnimationFrame(loop);
    updateUI();

    if (minecraft.paused) {
      console.log("Game paused, skipping frame");
      clock.stop();
      lastPaused = true;
      // Dispose controls to free up event listeners
      minecraft.controls.handler.dispose();
      return;
    }

    if (lastPaused) {
      clock.start();
      minecraft.controls =
        minecraft.controls.type === "fps"
          ? FPSControls.controls(
              minecraft.camera,
              minecraft.renderer,
              minecraft.world,
              minecraft.player
            )
          : FreeControls.controls(
              minecraft.camera,
              minecraft.renderer.domElement
            );
      lastPaused = false;
    }

    const delta = clock.getDelta();

    minecraft.renderer.render(minecraft.scene, minecraft.camera);

    if (!document.pointerLockElement) {
      await minecraft.renderer.domElement.requestPointerLock();
    }

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
  };

  if (!stopped) loop();
};

initMenu({
  onStartGame: startGame,
});
