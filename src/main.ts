import * as THREE from "three";

import "./style.css";
import { initBlocks } from "./block.js";
import { updateWorld } from "./world.js";
import { initMenu, initUI } from "./initUI.js";
import { createMinecraftInstance } from "./core.ts";
import { createRaycaster } from "./raycast.ts";
import { FPSControls } from "./FPSControls.ts";
import { FreeControls } from "./FreeControls.ts";
import { waitUntilWorkerEvent } from "./worker/workerClient.ts";

initMenu({ onSelectWorld: async () => {}, isLoading: true });

await initBlocks();
await waitUntilWorkerEvent("workerInitialized");

const startGame = async (worldID: number) => {
  let stopped = false;

  const clock = new THREE.Clock();

  const { minecraft, disposeMinecraft } = await createMinecraftInstance({
    worldID,
  });

  const { updateUI, destroyUI } = initUI({
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

  let lastPaused = false;

  const loop = async () => {
    if (stopped) {
      disposeMinecraft();
      destroyUI();

      initMenu({
        isLoading: false,
        onSelectWorld: startGame,
      });

      return;
    }

    requestAnimationFrame(loop);

    updateUI();

    if (minecraft.paused) {
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
        raycaster.update();
        updatePromise = null;
      });
    }
  };

  loop();
};

initMenu({
  isLoading: false,
  onSelectWorld: startGame,
});
