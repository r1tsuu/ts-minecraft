import * as THREE from "three";
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

export const initUI = ({
  minecraft: { camera, controls, renderer, player, world },
}: {
  minecraft: MinecraftInstance;
}) => {
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

  const toggleControlsButton = customElement({
    tag: "button",
    className: "ui_element",
    text: "Switch to Free Controls (C)",
    parent: wrapper,
  });

  const toggleControls = () => {
    controls.handler.dispose();
    if (controls.type === "fps") {
      controls.type = "free";
      controls.handler = new FreeControls(camera, renderer.domElement);
      toggleControlsButton.setText("Switch to FPS Controls (C)");
    } else {
      controls.type = "fps";
      controls.handler = new FPSControls(
        camera,
        renderer.domElement,
        world,
        player
      );
      toggleControlsButton.setText("Switch to Free Controls (C)");
    }
  };

  toggleControlsButton.element.addEventListener("click", () => {
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
    toggleControlsButton,
    updateUI,
  };
};
