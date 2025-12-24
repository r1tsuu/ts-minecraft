import * as THREE from "three";
import { updateWorld } from "./world.js";
import { createGameInstance } from "./createGameInstance.ts";
import { requestWorker } from "./worker/workerClient.ts";
import { createUIInstance } from "./ui/createUIInstance.ts";
import type { MinecraftInstance } from "./types.ts";
import { initBlocks } from "./client.ts";
import { createRaycaster } from "./raycast.ts";

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

    const game = await createGameInstance({
      activeWorld,
      minecraft,
    });

    minecraft.game = game;

    const raycaster = createRaycaster({
      camera: game.camera,
      world: game.world,
      scene: game.scene,
      player: game.player,
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
      game.frameCounter.lastTime += delta;
      game.frameCounter.frames++;

      if (game.frameCounter.lastTime >= 1) {
        game.frameCounter.fps = game.frameCounter.frames;
        game.frameCounter.frames = 0;
        game.frameCounter.lastTime = 0;
      }

      game.renderer.render(game.scene, game.camera);

      if (!document.pointerLockElement && !requestingPointerLock) {
        requestingPointerLock = true;
        await game.renderer.domElement.requestPointerLock();
      }

      game.controls.update(delta);

      updateWorld(game.world, game.camera.position);
      raycaster.update();
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
