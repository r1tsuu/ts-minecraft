import * as THREE from "three";
import type { Controls } from "./types.js";

export class FreeControls implements Controls {
  camera: THREE.PerspectiveCamera;
  velocity = new THREE.Vector3();
  speed = 10;

  moveForward = false;
  moveBackward = false;
  moveLeft = false;
  moveRight = false;
  moveUp = false;
  moveDown = false;

  yaw = 0;
  pitch = 0;
  domElement: HTMLElement;

  onDisposeCallbacks: (() => void)[] = [];

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;

    this.domElement = domElement;

    this.initPointerLock();
    this.initKeyboard();
    this.initMouse();
  }

  initPointerLock() {
    const onClick = () => {
      this.domElement.requestPointerLock();
    };

    this.domElement.addEventListener("click", onClick);
    this.onDisposeCallbacks.push(() => {
      this.domElement.removeEventListener("click", onClick);
    });
  }

  dispose() {
    for (const cb of this.onDisposeCallbacks) {
      cb();
    }
  }

  initMouse() {
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== this.domElement) return;
      const sensitivity = 0.002;
      this.yaw -= e.movementX * sensitivity;
      this.pitch -= e.movementY * sensitivity;
      this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch));
      this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
    };

    document.addEventListener("mousemove", onMouseMove);
    this.onDisposeCallbacks.push(() => {
      document.removeEventListener("mousemove", onMouseMove);
    });
  }

  initKeyboard() {
    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case "KeyW":
          this.moveForward = true;
          break;
        case "KeyS":
          this.moveBackward = true;
          break;
        case "KeyA":
          this.moveLeft = true;
          break;
        case "KeyD":
          this.moveRight = true;
          break;
        case "Space":
          this.moveUp = true;
          break;
        case "ShiftLeft":
          this.moveDown = true;
          break;
      }
    };

    document.addEventListener("keydown", onKeyDown);
    this.onDisposeCallbacks.push(() => {
      document.removeEventListener("keydown", onKeyDown);
    });

    const onKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case "KeyW":
          this.moveForward = false;
          break;
        case "KeyS":
          this.moveBackward = false;
          break;
        case "KeyA":
          this.moveLeft = false;
          break;
        case "KeyD":
          this.moveRight = false;
          break;
        case "Space":
          this.moveUp = false;
          break;
        case "ShiftLeft":
          this.moveDown = false;
          break;
      }
    };
    document.addEventListener("keyup", onKeyUp);
    this.onDisposeCallbacks.push(() => {
      document.removeEventListener("keyup", onKeyUp);
    });
  }

  update(delta: number) {
    const dir = new THREE.Vector3();

    if (this.moveForward) dir.z += 1;
    if (this.moveBackward) dir.z -= 1;
    if (this.moveLeft) dir.x -= 1;
    if (this.moveRight) dir.x += 1;
    if (this.moveUp) dir.y += 1;
    if (this.moveDown) dir.y -= 1;

    dir.normalize();

    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, this.camera.up).normalize();

    const move = new THREE.Vector3();
    move.addScaledVector(forward, dir.z);
    move.addScaledVector(right, dir.x);
    move.y += dir.y;

    this.camera.position.addScaledVector(move, this.speed * delta);
  }
}
