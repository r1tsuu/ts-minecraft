import * as THREE from "three";

import "./style.css";
import { updateWorld } from "./world.js";
import { initMenu, initUI } from "./initUI.js";
import { createMinecraftInstance } from "./core.ts";
import { createRaycaster } from "./raycast.ts";
import { requestWorker, waitUntilWorkerEvent } from "./worker/workerClient.ts";
import type { ActiveWorld } from "./worker/types.ts";
import { initBlocks } from "./client.ts";

initMenu({ onSelectWorld: async () => {}, isLoading: true });

await initBlocks();
await waitUntilWorkerEvent("workerInitialized");

const startGame = async (activeWorld: ActiveWorld) => {
  let stopped = false;

  const clock = new THREE.Clock();

  const { minecraft, disposeMinecraft } = await createMinecraftInstance({
    activeWorld,
  });

  const { updateUI, destroyUI } = initUI({
    minecraft,
    onExitToMainMenu: async () => {
      stopped = true;
      await requestWorker(
        {
          type: "stopActiveWorld",
          payload: {},
        },
        "activeWorldStopped"
      );
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
      minecraft.controls.dispose();
      return;
    }

    if (lastPaused) {
      clock.start();
      lastPaused = false;
    }

    const delta = clock.getDelta();

    minecraft.renderer.render(minecraft.scene, minecraft.camera);

    if (!document.pointerLockElement) {
      await minecraft.renderer.domElement.requestPointerLock();
    }

    minecraft.controls.update(delta);

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
