import * as THREE from "three";
import type { MinecraftInstance, PlayerData } from "./types.ts";
import { createWorld } from "./world.ts";
import { FPSControls } from "./FPSControls.ts";
import { listenToWorkerEvents, requestWorker } from "./worker/workerClient.js";
import type { ActiveWorld } from "./worker/types.ts";
import {
  rawVector3ToThreeVector3,
  syncServerChunksOnClient,
  threeVector3ToRawVector3,
} from "./client.ts";

export const createMinecraftInstance = async ({
  activeWorld,
}: {
  activeWorld: ActiveWorld;
}): Promise<{
  minecraft: MinecraftInstance;
  disposeMinecraft: () => void;
}> => {
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );

  camera.position.set(0, 40, 0);
  camera.lookAt(30, 35, 30);

  const world = createWorld({ scene, activeWorld });

  const player: PlayerData = {
    ...activeWorld.world.playerData,
    position: rawVector3ToThreeVector3(activeWorld.world.playerData.position),
    velocity: rawVector3ToThreeVector3(activeWorld.world.playerData.velocity),
    direction: rawVector3ToThreeVector3(activeWorld.world.playerData.direction),
  };

  camera.position.copy(player.position);
  camera.rotation.set(player.pitch, player.yaw, 0, "YXZ");
  let disposed = false;
  let syncying = false;

  const syncPlayer = async () => {
    if (disposed || syncying) {
      console.log("Skipping syncPlayer because disposed or syncying");
      return;
    }
    try {
      syncying = true;
      await requestWorker(
        {
          type: "syncPlayer",
          payload: {
            playerData: {
              ...player,
              position: threeVector3ToRawVector3(player.position),
              velocity: threeVector3ToRawVector3(player.velocity),
              direction: threeVector3ToRawVector3(player.direction),
            },
          },
        },
        "playerSynced"
      );
    } finally {
      syncying = false;
      setTimeout(syncPlayer, 1000);
    }
  };

  setTimeout(syncPlayer, 1000);

  const unsubscribeFromWorkerEvents = listenToWorkerEvents((event) => {
    console.log("Received event from worker:", event);

    switch (event.type) {
      case "chunksGenerated": {
        const { chunks } = event.payload;
        const now = Date.now();
        syncServerChunksOnClient(chunks, world, scene);
        console.log("Processing chunks took", Date.now() - now, "ms");
        world.requestingChunksState = "received";
        break;
      }
    }
  });

  const disposeMinecraft = () => {
    unsubscribeFromWorkerEvents();
    renderer.dispose();
    scene.clear();
    renderer.domElement.remove();
    disposed = true;
  };

  const minecraft: MinecraftInstance = {
    camera,
    controls: new FPSControls(camera, renderer.domElement, world, player),
    renderer,
    scene,
    paused: false,
    world,
    player,
  };

  return {
    minecraft,
    disposeMinecraft,
  };
};
