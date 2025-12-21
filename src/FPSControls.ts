import * as THREE from "three";
import type {
  Controls,
  ControlsHandler,
  MinecraftInstance,
  World,
} from "./types.js";
import { getBlockInWorld } from "./world.js";

export class FPSControls implements ControlsHandler {
  camera: THREE.PerspectiveCamera;
  domElement: HTMLElement;

  velocity = new THREE.Vector3();
  direction = new THREE.Vector3();

  world: World;

  yaw = 0;
  pitch = 0;

  moveForward = false;
  moveBackward = false;
  moveLeft = false;
  moveRight = false;
  canJump = false;

  speed = 6;
  jumpStrength = 5;
  gravity = 9.8;

  player: MinecraftInstance["player"];

  // Reusable Box3 instances
  playerBox = new THREE.Box3();
  blockBox = new THREE.Box3();

  onDisposeCallbacks: (() => void)[] = [];

  constructor(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    world: World,
    player: MinecraftInstance["player"]
  ) {
    this.camera = camera;
    this.domElement = domElement;
    this.world = world;
    this.player = player;

    this.initPointerLock();
    this.initKeyboard();
    this.initMouse();
  }

  static controls(
    camera: THREE.PerspectiveCamera,
    renderer: THREE.WebGLRenderer,
    world: World,
    player: MinecraftInstance["player"]
  ): Controls {
    return {
      handler: new FPSControls(camera, renderer.domElement, world, player),
      type: "fps",
    };
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

  dispose(): void {
    for (const cb of this.onDisposeCallbacks) {
      cb();
    }
  }

  initMouse() {
    const onMouseMove = (e: MouseEvent) => {
      // if (document.pointerLockElement !== this.domElement) return;

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
          if (this.canJump) {
            this.velocity.y = this.jumpStrength;
            this.canJump = false;
          }
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
      }
    };
    document.addEventListener("keyup", onKeyUp);
    this.onDisposeCallbacks.push(() => {
      document.removeEventListener("keyup", onKeyUp);
    });
  }

  getPlayerBox(position: THREE.Vector3): THREE.Box3 {
    const min = new THREE.Vector3(
      position.x - this.player.width / 2,
      position.y - this.player.height,
      position.z - this.player.width / 2
    );
    const max = new THREE.Vector3(
      position.x + this.player.width / 2,
      position.y,
      position.z + this.player.width / 2
    );
    this.playerBox.set(min, max);
    return this.playerBox;
  }

  checkCollisionAtPosition(position: THREE.Vector3): boolean {
    const playerBox = this.getPlayerBox(position);

    const minX = Math.floor(playerBox.min.x);
    const maxX = Math.floor(playerBox.max.x);
    const minY = Math.floor(playerBox.min.y);
    const maxY = Math.floor(playerBox.max.y);
    const minZ = Math.floor(playerBox.min.z);
    const maxZ = Math.floor(playerBox.max.z);

    // Check all blocks that could intersect with player
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          if (getBlockInWorld(x, y, z, this.world)) {
            // Block exists, create its bounding box
            this.blockBox.setFromCenterAndSize(
              new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5),
              new THREE.Vector3(1, 1, 1)
            );

            // Check intersection
            if (playerBox.intersectsBox(this.blockBox)) {
              return true;
            }
          }
        }
      }
    }

    return false;
  }

  update(delta: number) {
    // Apply gravity
    this.velocity.y -= this.gravity * delta;

    // Calculate movement direction
    this.direction.set(0, 0, 0);
    if (this.moveForward) this.direction.z += 1;
    if (this.moveBackward) this.direction.z -= 1;
    if (this.moveLeft) this.direction.x -= 1;
    if (this.moveRight) this.direction.x += 1;

    if (this.direction.lengthSq() > 0) {
      this.direction.normalize();
    }

    // Convert direction to world space
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, this.camera.up).normalize();

    const move = new THREE.Vector3();
    move.addScaledVector(forward, this.direction.z);
    move.addScaledVector(right, this.direction.x);

    // Handle horizontal movement with collision
    const horizontalVelocity = move.multiplyScalar(this.speed * delta);

    // Test X movement
    const testPosX = this.camera.position.clone();
    testPosX.x += horizontalVelocity.x;
    if (!this.checkCollisionAtPosition(testPosX)) {
      this.camera.position.x = testPosX.x;
    }

    // Test Z movement
    const testPosZ = this.camera.position.clone();
    testPosZ.z += horizontalVelocity.z;
    if (!this.checkCollisionAtPosition(testPosZ)) {
      this.camera.position.z = testPosZ.z;
    }

    // Handle vertical movement with collision
    const testPosY = this.camera.position.clone();
    testPosY.y += this.velocity.y * delta;

    // Check if new position would collide
    if (this.checkCollisionAtPosition(testPosY)) {
      // Hit something (ceiling or ground)
      if (this.velocity.y > 0) {
        // Hit ceiling
        this.velocity.y = 0;
        this.camera.position.y = Math.floor(this.camera.position.y);
      } else {
        // Hit ground while falling
        this.canJump = true;
        this.velocity.y = 0;
        const feetY = testPosY.y - this.player.height;
        this.camera.position.y = Math.ceil(feetY) + this.player.height;
      }
    } else {
      // Free movement in air
      this.camera.position.y = testPosY.y;

      // Check if we're on ground (slightly below current feet position)
      const groundCheck = this.camera.position.clone();
      groundCheck.y -= 0.05;

      if (this.checkCollisionAtPosition(groundCheck)) {
        this.canJump = true;
      } else {
        this.canJump = false;
      }
    }
  }
}
