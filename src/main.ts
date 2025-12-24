import * as THREE from "three";
import { createGameInstance } from "./createGameInstance.ts";
import { requestWorker } from "./worker/workerClient.ts";
import { createUIInstance } from "./ui/createUIInstance.ts";
import type { MinecraftInstance } from "./types.ts";
import { initBlocks } from "./client.ts";

initBlocks();

const minecraft: MinecraftInstance = {
  game: null,
  ui: null,
  getGame: () => {
    if (!minecraft.game) {
      throw new Error("Game instance is not initialized");
    }

    return minecraft.game;
  },
  getUI: () => {
    if (!minecraft.ui) {
      throw new Error("UI instance is not initialized");
    }

    return minecraft.ui;
  },
};

const ui = createUIInstance({
  onCreateWorld: async (name: string, seed: string) => {
    const response = await requestWorker(
      {
        type: "createWorld",
        payload: {
          name,
          seed,
        },
      },
      "worldCreated"
    );

    return response.payload;
  },
  onDeleteWorld: async (worldID: number) => {
    await requestWorker(
      {
        type: "deleteWorld",
        payload: {
          worldID,
        },
      },
      "worldDeleted"
    );
  },
  onWorldPlay: async (worldID: number) => {
    const { payload: activeWorld } = await requestWorker(
      {
        type: "initializeWorld",
        payload: {
          worldID,
        },
      },
      "worldInitialized"
    );

    minecraft.game = await createGameInstance({
      activeWorld,
      minecraft,
    });

    const clock = new THREE.Clock();
    let requestingPointerLock = false;
    let clockStopped = false;

    const loop = async () => {
      if (!minecraft.game) return;

      if (minecraft.getUI().state.isPaused) {
        clock.stop();
        clockStopped = true;
        requestAnimationFrame(loop);
        return;
      } else if (clockStopped) {
        clock.start();
        clockStopped = false;
      }

      const delta = clock.getDelta();
      minecraft.game.frameCounter.lastTime += delta;
      minecraft.game.frameCounter.frames++;

      if (minecraft.game.frameCounter.lastTime >= 1) {
        minecraft.game.frameCounter.fps = minecraft.game.frameCounter.frames;
        minecraft.game.frameCounter.frames = 0;
        minecraft.game.frameCounter.lastTime = 0;
      }

      minecraft.game.renderer.render(
        minecraft.game.scene,
        minecraft.game.camera
      );

      if (!document.pointerLockElement && !requestingPointerLock) {
        requestingPointerLock = true;
        await minecraft.game.renderer.domElement.requestPointerLock();
      }

      minecraft.game.controls.update(delta);
      minecraft.game.world.update();
      minecraft.game.raycaster.update();

      requestAnimationFrame(loop);
    };

    loop();
  },
  minecraft,
  onExitWorld: async () => {
    if (minecraft.game) {
      minecraft.game.dispose();
      minecraft.game = null;
    }
  },
});

minecraft.ui = ui;
