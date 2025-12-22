import * as THREE from "three";
import background from "./static/images (1).jpeg";
import type { MinecraftInstance } from "./types.js";
import { FreeControls } from "./FreeControls.js";
import { FPSControls } from "./FPSControls.js";
import { requestWorker } from "./worker/workerClient.ts";

type CustomElement<T extends keyof HTMLElementTagNameMap = "div"> = {
  element: HTMLElementTagNameMap[T];
  setText: (text: string) => void;
  _isCustomElement: true;
};

const isCustomElement = (el: any): el is CustomElement => {
  return "_isCustomElement" in el && el._isCustomElement;
};

const customElement = <T extends keyof HTMLElementTagNameMap>(args: {
  tag: T;
  className?: string | string[];
  text?: string;
  parent?: HTMLElement | CustomElement;
  attributes?: Record<string, string>;
}): CustomElement<T> => {
  const el = document.createElement(args.tag);
  if (args.className) {
    if (Array.isArray(args.className)) {
      el.classList.add(...args.className);
    } else {
      el.classList.add(args.className);
    }
  }
  if (args.text) {
    el.textContent = args.text;
  }

  const setText = (text: string) => {
    el.textContent = text;
  };

  if (args.parent) {
    if (isCustomElement(args.parent)) {
      args.parent.element.appendChild(el);
    } else {
      args.parent.appendChild(el);
    }
  }

  if (args.attributes) {
    for (const [key, value] of Object.entries(args.attributes)) {
      el.setAttribute(key, value);
    }
  }

  return {
    element: el,
    setText,
    _isCustomElement: true,
  };
};

const createMenuOverlay = () => {
  const existing = document.querySelector(".menu_overlay");
  if (existing) {
    existing.remove();
  }

  const menuOverlay = customElement({
    tag: "div",
    className: "menu_overlay",
    parent: document.body,
  });

  menuOverlay.element.style.backgroundImage = `url("${background}")`;
  return menuOverlay;
};

const worldsMenu = async ({
  onSelectWorld,
}: {
  onSelectWorld: (worldID: number) => void;
}) => {
  const menuOverlay = createMenuOverlay();

  const title = customElement({
    tag: "h1",
    className: "menu_title",
    text: "Select World",
    parent: menuOverlay,
  });

  const worldsList = customElement({
    tag: "div",
    className: "worlds_list",
    parent: menuOverlay,
  });

  const {
    payload: { worlds },
  } = await requestWorker(
    { type: "requestListWorlds", payload: {} },
    "listWorldsResponse"
  );

  for (const world of worlds) {
    const worldItem = customElement({
      tag: "div",
      className: "world_item_wrapper",
      parent: worldsList,
    });

    customElement({
      tag: "div",
      className: "world_item_inner",
      text: `World: ${world.name}`,
      parent: worldItem,
    });

    customElement({
      tag: "div",
      className: "world_item_inner",
      text: `Seed: ${world.seed}`,
      parent: worldItem,
    });

    customElement({
      tag: "div",
      className: "world_item_inner",
      text: `Created At: ${new Date(world.createdAt).toLocaleString()}`,
      parent: worldItem,
    });

    const playButton = customElement({
      tag: "button",
      className: "game_button",
      text: "Play",
      parent: worldItem,
    });

    const deleteButton = customElement({
      tag: "button",
      className: "game_button",
      text: "Delete",
      parent: worldItem,
    });

    playButton.element.onclick = () => {
      onSelectWorld(world.id);
      menuOverlay.element.remove();
    };

    deleteButton.element.onclick = async () => {
      await requestWorker(
        { type: "deleteWorld", payload: { worldID: world.id } },
        "worldDeleted"
      );

      await worldsMenu({ onSelectWorld });
    };
  }

  if (!worlds.length) {
    customElement({
      tag: "div",
      className: "no_worlds_text",
      text: "No worlds found.",
      parent: menuOverlay,
    });

    customElement({
      tag: "div",
      className: "no_worlds_text",
      text: "Create a new world to get started!",
      parent: menuOverlay,
    });
  }

  const createWorldWrapper = customElement({
    tag: "div",
    className: "create_world_wrapper",
    parent: menuOverlay,
  });

  const createWorldNameInput = customElement({
    tag: "input",
    className: "game_input",
    parent: createWorldWrapper,
    attributes: {
      placeholder: "World Name",
      name: "worldName",
    },
  });

  const createWorldSeedInput = customElement({
    tag: "input",
    className: "game_input",
    parent: createWorldWrapper,
    attributes: {
      placeholder: "World Seed (optional)",
      name: "worldSeed",
    },
  });

  const createWorldButton = customElement({
    tag: "button",
    className: "game_button",
    text: "Create New World",
    parent: createWorldWrapper,
  });

  createWorldButton.element.onclick = async () => {
    const name = createWorldNameInput.element.value || "New World";
    const seed = createWorldSeedInput.element.value || crypto.randomUUID();

    await requestWorker(
      { type: "createWorld", payload: { name, seed } },
      "worldCreated"
    );

    await worldsMenu({ onSelectWorld });
  };

  const backButton = customElement({
    tag: "button",
    className: "game_button",
    text: "Back",
    parent: menuOverlay,
  });

  backButton.element.onclick = () => {
    initMenu({ onSelectWorld });
  };
};

export const initMenu = ({
  onSelectWorld,
}: {
  onSelectWorld: (worldID: number) => void;
}) => {
  const menuOverlay = createMenuOverlay();

  const menuWrapper = customElement({
    tag: "div",
    className: "menu_wrapper",
    parent: menuOverlay,
  });

  customElement({
    tag: "h1",
    className: "menu_title",
    text: "Minecraft TS",
    parent: menuWrapper,
  });

  const playButton = customElement({
    tag: "button",
    className: "game_button",
    text: "Play",
    parent: menuWrapper,
  });

  customElement({
    tag: "a",
    className: "game_button",
    text: "GitHub Repository",
    parent: menuWrapper,
    attributes: {
      href: "https://github.com/r1tsuu/ts-minecraft",
    },
  });

  playButton.element.onclick = async () => {
    await worldsMenu({ onSelectWorld });
  };
};

const initPauseMenu = ({
  onExitToMainMenu,
  onResume,
  minecraft,
}: {
  onResume: () => void;
  onExitToMainMenu: () => void;
  minecraft: MinecraftInstance;
}): CustomElement => {
  const overlay = customElement({
    tag: "div",
    className: "pause_menu_overlay",
    parent: document.body,
  });

  customElement({
    tag: "h1",
    className: "pause_menu_title",
    text: "Paused",
    parent: overlay,
  });

  const resumeButton = customElement({
    tag: "button",
    className: "game_button",
    text: "Resume",
    parent: overlay,
  });

  const resume = () => {
    onResume();
  };

  overlay.element.focus();

  const exitButton = customElement({
    tag: "button",
    className: "game_button",
    text: "Exit to Main Menu",
    parent: overlay,
  });

  const exitToMainMenu = () => {
    document.body.removeChild(overlay.element);
    onExitToMainMenu();
  };

  resumeButton.element.onclick = resume;
  exitButton.element.onclick = exitToMainMenu;

  minecraft.renderer.domElement.style.cursor = "default";
  if (document.pointerLockElement === minecraft.renderer.domElement) {
    document.exitPointerLock();
  }

  return overlay;
};

export const initUI = ({
  minecraft,
  onExitToMainMenu,
}: {
  minecraft: MinecraftInstance;
  onExitToMainMenu: () => void;
}) => {
  const { camera, renderer, world, controls, player } = minecraft;
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  window.addEventListener("resize", () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  renderer.domElement.style.outline = "none"; // remove default outline

  const wrapper = customElement({
    tag: "div",
    className: "ui_wrapper",
    parent: document.body,
  });

  const crosshair = customElement({
    tag: "div",
    className: "crosshair",
    parent: document.body,
  });

  // FPS Counter
  const fpsDisplay = customElement({
    tag: "div",
    className: "ui_element",
    text: `FPS: Loading...`,
    parent: wrapper,
  });

  // Position display
  const positionDisplay = customElement({
    tag: "div",
    className: "ui_element",
    parent: wrapper,
  });

  const rotationDisplay = customElement({
    tag: "div",
    className: "ui_element",
    parent: wrapper,
  });

  const controlsDisplay = customElement({
    tag: "div",
    className: "ui_element",
    parent: wrapper,
  });

  const updateControlText = () => {
    let text: string;

    if (controls.type === "fps") {
      text = "Press C to Toggle Controls (FPS)";
    } else {
      text = "Press C to Toggle Controls (Free)";
    }

    controlsDisplay.setText(text);
  };

  updateControlText();

  const pauseDisplay = customElement({
    tag: "div",
    className: "ui_element",
    parent: wrapper,
  });

  const updatePauseText = () => {
    let text: string;

    if (minecraft.paused) {
      text = "Press P to Resume";
    } else {
      text = "Press P to Pause";
    }

    pauseDisplay.setText(text);
  };

  updatePauseText();

  const toggleControls = () => {
    controls.handler.dispose();
    if (controls.type === "fps") {
      controls.type = "free";
      controls.handler = new FreeControls(camera, renderer.domElement);
      updateControlText();
    } else {
      controls.type = "fps";
      controls.handler = new FPSControls(
        camera,
        renderer.domElement,
        world,
        player
      );
      updateControlText();
    }
  };

  let pauseOverlay: CustomElement | null = null;

  const resumeFromPause = () => {
    if (pauseOverlay) {
      document.body.removeChild(pauseOverlay.element);
      pauseOverlay = null;
    }
    minecraft.paused = false;
    updatePauseText();
    if (document.pointerLockElement !== renderer.domElement) {
      renderer.domElement.requestPointerLock();
    }
    minecraft.renderer.domElement.style.cursor = "none";
  };

  window.addEventListener("keyup", (e) => {
    e.preventDefault();
    if (e.code === "KeyC") {
      toggleControls();
    }

    if (e.code === "KeyP") {
      if (minecraft.paused) {
        resumeFromPause();
        return;
      }

      minecraft.paused = true;
      updatePauseText();

      pauseOverlay = initPauseMenu({
        onExitToMainMenu: () => {
          minecraft.paused = false;
          onExitToMainMenu();
        },
        minecraft,
        onResume: resumeFromPause,
      });
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
      fpsDisplay.setText(`FPS: ${fps}`);
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

    positionDisplay.setText(
      `Position: X: ${pos.x.toFixed(2)} Y: ${displayY.toFixed(
        2
      )} Z: ${pos.z.toFixed(2)}`
    );

    rotationDisplay.setText(
      `Rotation: Pitch: ${THREE.MathUtils.radToDeg(camera.rotation.x).toFixed(
        2
      )}° Yaw: ${THREE.MathUtils.radToDeg(camera.rotation.y).toFixed(2)}°`
    );
  };

  return {
    fpsDisplay,
    positionDisplay,
    toggleControlsButton: controlsDisplay,
    updateUI,
    destroyUI: () => {
      document.body.removeChild(wrapper.element);
      document.body.removeChild(crosshair.element);
      if (pauseOverlay) {
        pauseOverlay.element.remove();
      }
    },
  };
};
