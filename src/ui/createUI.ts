import type { MinecraftInstance, UIInstance } from "../types.ts";
import {
  listenToWorkerEvents,
  sendEventToWorker,
} from "../worker/workerClient.ts";
import { synchronize } from "./synchronize.ts";
import type { UIActions, UICondition, UIState } from "./state.ts";
import { MathUtils } from "three";

export const createUI = ({
  onWorldPlay,
  onDeleteWorld,
  onCreateWorld,
  minecraft,
  onExitWorld,
}: {
  minecraft: MinecraftInstance;
  onCreateWorld: (
    name: string,
    seed: string
  ) => Promise<{
    id: number;
    name: string;
    seed: string;
    createdAt: Date;
  }>;
  onDeleteWorld: (id: number) => Promise<void>;
  onWorldPlay: (id: number) => Promise<void>;
  onExitWorld: () => Promise<void>;
}): UIInstance => {
  const state: UIState = {
    initializedGameUI: false,
    fps: "Loading...",
    position: "Loading...",
    rotation: "Loading...",
    pauseText: "Press Escape to Pause",
    isInitialized: false,
    activePage: "start",
    isPaused: false,
    worldList: [],
    loadingWorldName: "",
  };

  const setState = (
    newState: Partial<UIState>,
    affectedQuerySelectors?: string[] | string
  ) => {
    Object.assign(state, newState);
    synchronize(state, actions, conditions, affectedQuerySelectors);
  };

  const getButtonFromEvent = (event: MouseEvent): HTMLButtonElement => {
    return event.currentTarget as HTMLButtonElement;
  };

  const getIndexFromEvent = (event: MouseEvent): number => {
    const button = getButtonFromEvent(event);
    const indexAttr = button.getAttribute("data-index");
    const index = indexAttr ? parseInt(indexAttr, 10) : null;

    if (index !== null && !isNaN(index)) {
      return index;
    }

    throw new Error("Invalid index attribute");
  };

  const worldNameInput = document.querySelector(
    'input[name="worldName"]'
  ) as HTMLInputElement;
  const worldSeedInput = document.querySelector(
    'input[name="worldSeed"]'
  ) as HTMLInputElement;

  const subscriptions: (() => void)[] = [];

  subscriptions.push(
    listenToWorkerEvents((event) => {
      switch (event.type) {
        case "workerInitialized": {
          sendEventToWorker({ type: "requestListWorlds", payload: {} });
          break;
        }
        case "listWorldsResponse": {
          setState({
            worldList: event.payload.worlds.map((world) => ({
              id: world.id,
              name: world.name,
              seed: world.seed,
              createdAt: new Date(world.createdAt).toLocaleString(),
            })),
            isInitialized: true,
          });
          break;
        }
      }
    })
  );

  const resumeButton = document.querySelector(
    '[data-action="resumeGame"]'
  ) as HTMLButtonElement;

  const onPointerLockChange = () => {
    if (!minecraft.game) return;

    const isLocked =
      document.pointerLockElement === minecraft.game.renderer.domElement;

    if (!isLocked && !state.isPaused && minecraft.game) {
      resumeButton.disabled = true;
      setTimeout(() => {
        resumeButton.disabled = false;
      }, 1000); // prevent immediate re-clicking

      minecraft.game.player.isMovingBackward = false;
      minecraft.game.player.isMovingForward = false;
      minecraft.game.player.isMovingLeft = false;
      minecraft.game.player.isMovingRight = false;

      setState({
        isPaused: true,
        pauseText: "Click to Resume",
      });
      return;
    }
  };

  const resumeGame = async () => {
    if (!minecraft.game) return;
    if (!state.isPaused) return;

    try {
      await minecraft.game.renderer.domElement.requestPointerLock();
      setState({
        isPaused: false,
        pauseText: "Press Escape to Pause",
      });
    } catch (e) {
      console.warn("Pointer lock request failed", e);
    }
  };

  document.addEventListener("pointerlockchange", onPointerLockChange);

  subscriptions.push(() => {
    document.removeEventListener("pointerlockchange", onPointerLockChange);
  });

  const gameInterval = setInterval(() => {
    if (minecraft.game && !state.isPaused) {
      setState(
        {
          fps: minecraft.game.frameCounter.fps.toFixed(2),
          position: `X: ${minecraft.game.player.position.x.toFixed(
            0
          )}, Y: ${minecraft.game.player.position.y.toFixed(
            0
          )}, Z: ${minecraft.game.player.position.z.toFixed(0)}`,
          rotation: `Yaw: ${MathUtils.radToDeg(
            minecraft.game.player.yaw
          ).toFixed(0)}°, Pitch: ${MathUtils.radToDeg(
            minecraft.game.player.pitch
          ).toFixed(0)}°`,
          initializedGameUI: true,
        },
        state.initializedGameUI ? ["#fps", "#position", "#rotation"] : undefined
      );

      let performance: "bad" | "average" | "good";

      if (minecraft.game.frameCounter.fps < 30) {
        performance = "bad";
      } else if (minecraft.game.frameCounter.fps < 60) {
        performance = "average";
      } else {
        performance = "good";
      }

      document
        .getElementById("fps_value")!
        .setAttribute("data-performance", performance);
    }
  }, 300);

  const actions: UIActions = {
    startGame: () => {
      worldNameInput.value = "New World";
      worldSeedInput.value = crypto.randomUUID().slice(0, 8);
      setState({ activePage: "menuWorlds" });
    },
    playWorld: async ({ event }) => {
      const index = getIndexFromEvent(event);
      const world = state.worldList[index];
      setState({
        activePage: "worldLoading",
        loadingWorldName: world.name,
      });
      await onWorldPlay(world.id);
      setState({
        activePage: "game",
        loadingWorldName: " ",
      });
    },
    deleteWorld: async ({ event }) => {
      const index = getIndexFromEvent(event);
      const world = state.worldList[index];
      onDeleteWorld(world.id);
      setState({
        worldList: state.worldList.filter((w) => w.id !== world.id),
      });
    },
    createWorld: async ({ event }) => {
      const button = getButtonFromEvent(event);

      const name = worldNameInput.value.trim() || "New World";
      const seed = worldSeedInput.value.trim() || crypto.randomUUID();
      button.disabled = true;
      const world = await onCreateWorld(name, seed);
      setState({
        worldList: [
          ...state.worldList,
          {
            id: world.id,
            name: world.name,
            seed: world.seed,
            createdAt: new Date(world.createdAt).toLocaleString(),
          },
        ],
      });
      button.disabled = false;
      worldNameInput.value = "New World";
      worldSeedInput.value = crypto.randomUUID().slice(0, 8);
    },
    backToStart: () => {
      setState({ activePage: "start" });
    },
    backToMenu: async () => {
      console.log("Exiting world...");
      await onExitWorld();
      setState({
        activePage: "start",
        position: "Loading...",
        rotation: "Loading...",
        fps: "Loading...",
        isPaused: false,
        initializedGameUI: false,
      });
    },
    resumeGame: async () => {
      await resumeGame();
    },
  };

  const conditions: UICondition = {
    showOverlay: () =>
      ["start", "menuWorlds", "worldLoading"].includes(state.activePage),
    showWorldsNotFound: () => state.worldList.length === 0,
    showLoadingButton: () => state.isInitialized === false,
    showStartGameButton: () => state.isInitialized === true,
    showGameUI: () => minecraft.game !== null,
    showPauseMenu: () => state.isPaused,
    showCrosshair: () => minecraft.game !== null && !state.isPaused,
  };

  synchronize(state, actions, conditions);

  return {
    setState,
    state,
    destroy: () => {
      for (const unsubscribe of subscriptions) {
        unsubscribe();
      }

      clearInterval(gameInterval);
    },
  };
};
