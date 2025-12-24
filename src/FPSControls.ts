import * as THREE from 'three'

import type { PlayerData, UIInstance, World } from './types.js'

import { GRAVITY_ACCELERATION } from './util.ts'

export class FPSControls {
  blockBox = new THREE.Box3()
  camera: THREE.PerspectiveCamera

  domElement: HTMLElement
  onDisposeCallbacks: (() => void)[] = []
  player: PlayerData

  // Reusable Box3 instances
  playerBox = new THREE.Box3()
  ui: UIInstance

  world: World

  constructor(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    world: World,
    player: PlayerData,
    ui: UIInstance,
  ) {
    this.camera = camera
    this.domElement = domElement
    this.world = world
    this.player = player
    this.ui = ui

    this.initPointerLock()
    this.initKeyboard()
    this.initMouse()
  }

  checkCollisionAtPosition(position: THREE.Vector3): boolean {
    const playerBox = this.getPlayerBox(position)

    const minX = Math.floor(playerBox.min.x)
    const maxX = Math.floor(playerBox.max.x)
    const minY = Math.floor(playerBox.min.y)
    const maxY = Math.floor(playerBox.max.y)
    const minZ = Math.floor(playerBox.min.z)
    const maxZ = Math.floor(playerBox.max.z)

    // Check all blocks that could intersect with player
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          if (this.world.getBlock(x, y, z)) {
            // Block exists, create its bounding box
            this.blockBox.setFromCenterAndSize(
              new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5),
              new THREE.Vector3(1, 1, 1),
            )

            // Check intersection
            if (playerBox.intersectsBox(this.blockBox)) {
              return true
            }
          }
        }
      }
    }

    return false
  }

  dispose(): void {
    for (const cb of this.onDisposeCallbacks) {
      cb()
    }
  }

  getPlayerBox(position: THREE.Vector3): THREE.Box3 {
    const min = new THREE.Vector3(
      position.x - this.player.width / 2,
      position.y - this.player.height,
      position.z - this.player.width / 2,
    )
    const max = new THREE.Vector3(
      position.x + this.player.width / 2,
      position.y,
      position.z + this.player.width / 2,
    )
    this.playerBox.set(min, max)
    return this.playerBox
  }

  initKeyboard() {
    const onKeyDown = (e: KeyboardEvent) => {
      if (this.ui.state.isPaused) return
      switch (e.code) {
        case 'KeyA':
          this.player.isMovingLeft = true
          break
        case 'KeyD':
          this.player.isMovingRight = true
          break
        case 'KeyS':
          this.player.isMovingBackward = true
          break
        case 'KeyW':
          this.player.isMovingForward = true
          break
        case 'Space':
          if (this.player.canJump) {
            this.player.velocity.y = this.player.jumpStrength
            this.player.canJump = false
          }
          break
      }
    }
    document.addEventListener('keydown', onKeyDown)
    this.onDisposeCallbacks.push(() => {
      document.removeEventListener('keydown', onKeyDown)
    })

    const onKeyUp = (e: KeyboardEvent) => {
      if (this.ui.state.isPaused) return
      switch (e.code) {
        case 'KeyA':
          this.player.isMovingLeft = false
          break
        case 'KeyD':
          this.player.isMovingRight = false
          break
        case 'KeyS':
          this.player.isMovingBackward = false
          break
        case 'KeyW':
          this.player.isMovingForward = false
          break
      }
    }
    document.addEventListener('keyup', onKeyUp)
    this.onDisposeCallbacks.push(() => {
      document.removeEventListener('keyup', onKeyUp)
    })
  }

  initMouse() {
    const onMouseMove = (e: MouseEvent) => {
      if (this.ui.state.isPaused) return
      // if (document.pointerLockElement !== this.domElement) return;

      const sensitivity = 0.002
      this.player.yaw -= e.movementX * sensitivity
      this.player.pitch -= e.movementY * sensitivity

      this.player.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.player.pitch))

      this.camera.rotation.set(this.player.pitch, this.player.yaw, 0, 'YXZ')
    }
    document.addEventListener('mousemove', onMouseMove)
    this.onDisposeCallbacks.push(() => {
      document.removeEventListener('mousemove', onMouseMove)
    })
  }

  initPointerLock() {
    const onClick = () => {
      this.domElement.requestPointerLock()
    }
    this.domElement.addEventListener('click', onClick)
    this.onDisposeCallbacks.push(() => {
      this.domElement.removeEventListener('click', onClick)
    })
  }

  update(delta: number) {
    if (this.world.chunks.size === 0) {
      return
    }

    // Apply gravity
    this.player.velocity.y -= GRAVITY_ACCELERATION * delta

    // Calculate movement direction
    this.player.direction.set(0, 0, 0)
    if (this.player.isMovingForward) this.player.direction.z += 1
    if (this.player.isMovingBackward) this.player.direction.z -= 1
    if (this.player.isMovingLeft) this.player.direction.x -= 1
    if (this.player.isMovingRight) this.player.direction.x += 1

    if (this.player.direction.lengthSq() > 0) {
      this.player.direction.normalize()
    }

    // Convert direction to world space
    const forward = new THREE.Vector3()
    this.camera.getWorldDirection(forward)
    forward.y = 0
    forward.normalize()

    const right = new THREE.Vector3()
    right.crossVectors(forward, this.camera.up).normalize()

    const move = new THREE.Vector3()
    move.addScaledVector(forward, this.player.direction.z)
    move.addScaledVector(right, this.player.direction.x)

    // Handle horizontal movement with collision
    const horizontalVelocity = move.multiplyScalar(this.player.speed * delta)

    // Test X movement
    const testPosX = this.player.position.clone()
    testPosX.x += horizontalVelocity.x
    if (!this.checkCollisionAtPosition(testPosX)) {
      this.player.position.x = testPosX.x
    }

    // Test Z movement
    const testPosZ = this.player.position.clone()
    testPosZ.z += horizontalVelocity.z
    if (!this.checkCollisionAtPosition(testPosZ)) {
      this.player.position.z = testPosZ.z
    }

    // Handle vertical movement with collision
    const testPosY = this.player.position.clone()
    testPosY.y += this.player.velocity.y * delta

    // Check if new position would collide
    if (this.checkCollisionAtPosition(testPosY)) {
      // Hit something (ceiling or ground)
      if (this.player.velocity.y > 0) {
        // Hit ceiling
        this.player.velocity.y = 0
        this.player.position.y = Math.floor(this.player.position.y)
      } else {
        // Hit ground while falling
        this.player.canJump = true
        this.player.velocity.y = 0
        const feetY = testPosY.y - this.player.height
        this.player.position.y = Math.ceil(feetY) + this.player.height
      }
    } else {
      // Free movement in air
      this.player.position.y = testPosY.y
      // Check if we're on ground (slightly below current feet position)
      const groundCheck = this.camera.position.clone()
      groundCheck.y -= 0.05

      if (this.checkCollisionAtPosition(groundCheck)) {
        this.player.canJump = true
      } else {
        this.player.canJump = false
      }
    }

    // Sync camera position with player
    this.camera.position.copy(this.player.position)
  }
}
