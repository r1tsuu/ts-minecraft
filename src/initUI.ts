import * as THREE from "three";
import background from "./static/background.jpeg";
import type { MinecraftInstance } from "./types.js";
import { FreeControls } from "./FreeControls.js";
import { FPSControls } from "./FPSControls.js";

type CustomElement = {
  element: HTMLElement;
  setText: (text: string) => void;
  _isCustomElement: true;
};

const isCustomElement = (el: any): el is CustomElement => {
  return "_isCustomElement" in el && el._isCustomElement;
};

const customElement = (args: {
  tag: keyof HTMLElementTagNameMap;
  className?: string | string[];
  text?: string;
  parent?: HTMLElement | CustomElement;
}): CustomElement => {
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

  return {
    element: el,
    setText,
    _isCustomElement: true,
  };
};

export const initMenu = ({ onStartGame }: { onStartGame: () => void }) => {
  const menuOverlay = customElement({
    tag: "div",
    className: "menu_overlay",
    parent: document.body,
  });

  menuOverlay.element.style.backgroundImage = `url("${background}")`;

  customElement({
    tag: "h1",
    className: "menu_title",
    text: "Minecraft TS",
    parent: menuOverlay,
  });

  const startButton = customElement({
    tag: "button",
    className: "menu_button",
    text: "Start Game",
    parent: menuOverlay,
  });

  const startGame = () => {
    document.body.removeChild(menuOverlay.element);

    onStartGame();
  };

  startButton.element.onclick = startGame;
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
    className: "pause_menu_button",
    text: "Resume",
    parent: overlay,
  });

  const resume = () => {
    document.body.removeChild(overlay.element);
    onResume();
  };

  overlay.element.focus();

  const exitButton = customElement({
    tag: "button",
    className: "pause_menu_button",
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

  customElement({
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
    text: "Press C to Toggle Controls (FPS)",
    parent: wrapper,
  });

  const pauseDisplay = customElement({
    tag: "div",
    className: "ui_element",
    text: "Press P to Pause",
    parent: wrapper,
  });

  const toggleControls = () => {
    controls.handler.dispose();
    if (controls.type === "fps") {
      controls.type = "free";
      controls.handler = new FreeControls(camera, renderer.domElement);
      controlsDisplay.setText("Press C to Toggle Controls (Free)");
    } else {
      controls.type = "fps";
      controls.handler = new FPSControls(
        camera,
        renderer.domElement,
        world,
        player
      );
      controlsDisplay.setText("Press C to Toggle Controls (FPS)");
    }
  };

  controlsDisplay.element.onclick = toggleControls;

  let pauseOverlay: CustomElement | null = null;

  const resumeFromPause = () => {
    if (pauseOverlay) {
      document.body.removeChild(pauseOverlay.element);
      pauseOverlay = null;
    }
    minecraft.paused = false;
    pauseDisplay.setText("Press P to Pause");
    if (document.pointerLockElement !== renderer.domElement) {
      renderer.domElement.requestPointerLock();
    }
    minecraft.renderer.domElement.style.cursor = "none";
  };

  window.addEventListener("keydown", (e) => {
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

      pauseDisplay.setText("Press P to Resume");

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
  };
};
