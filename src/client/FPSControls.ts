import * as THREE from 'three'

import type { GameSession } from './GameSession.ts'
import type { GUI } from './gui/GUI.ts'

import { GRAVITY_ACCELERATION } from '../util.ts'

export class FPSControls {
  blockBox = new THREE.Box3()

  onDisposeCallbacks: (() => void)[] = []

  // Reusable Box3 instances
  playerBox = new THREE.Box3()

  constructor(
    private readonly ui: GUI,
    private readonly gameSession: GameSession,
  ) {
    this.initPointerLock()
    this.initKeyboard()
    this.initMouse()
  }

  dispose(): void {
    for (const cb of this.onDisposeCallbacks) {
      cb()
    }
  }

  update() {
    const delta = this.gameSession.getDelta()

    const player = this.gameSession.player

    // Apply gravity
    player.velocity.y -= GRAVITY_ACCELERATION * delta

    // Calculate movement direction
    player.direction.set(0, 0, 0)
    if (player.isMovingForward) player.direction.z += 1
    if (player.isMovingBackward) player.direction.z -= 1
    if (player.isMovingLeft) player.direction.x -= 1
    if (player.isMovingRight) player.direction.x += 1

    if (player.direction.lengthSq() > 0) {
      player.direction.normalize()
    }

    // Convert direction to world space
    const forward = new THREE.Vector3()
    const camera = this.gameSession.camera
    camera.getWorldDirection(forward)
    forward.y = 0
    forward.normalize()

    const right = new THREE.Vector3()
    right.crossVectors(forward, camera.up).normalize()

    const move = new THREE.Vector3()
    move.addScaledVector(forward, player.direction.z)
    move.addScaledVector(right, player.direction.x)
    // Handle horizontal movement with collision
    const horizontalVelocity = move.multiplyScalar(player.speed * delta)

    // Test X movement
    const testPosX = player.position.clone()
    testPosX.x += horizontalVelocity.x
    if (!this.checkCollisionAtPosition(testPosX)) {
      player.position.x = testPosX.x
    }

    // Test Z movement
    const testPosZ = player.position.clone()
    testPosZ.z += horizontalVelocity.z
    if (!this.checkCollisionAtPosition(testPosZ)) {
      player.position.z = testPosZ.z
    }

    // Handle vertical movement with collision
    const testPosY = player.position.clone()
    testPosY.y += player.velocity.y * delta

    // Check if new position would collide
    if (this.checkCollisionAtPosition(testPosY)) {
      // Hit something (ceiling or ground)
      if (player.velocity.y > 0) {
        // Hit ceiling
        player.velocity.y = 0
        player.position.y = Math.floor(player.position.y)
      } else {
        // Hit ground while falling
        player.canJump = true
        player.velocity.y = 0
        const feetY = testPosY.y - player.height
        player.position.y = Math.ceil(feetY) + player.height
      }
    } else {
      // Free movement in air
      player.position.y = testPosY.y
      // Check if we're on ground (slightly below current feet position)
      const groundCheck = camera.position.clone()
      groundCheck.y -= 0.05

      if (this.checkCollisionAtPosition(groundCheck)) {
        player.canJump = true
      } else {
        player.canJump = false
      }
    }

    // Sync camera position with player
    camera.position.copy(player.position)
  }

  private checkCollisionAtPosition(position: THREE.Vector3): boolean {
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
          if (this.gameSession.world.getBlock(x, y, z)) {
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

  private getPlayerBox(position: THREE.Vector3): THREE.Box3 {
    const player = this.gameSession.player

    const min = new THREE.Vector3(
      position.x - player.width / 2,
      position.y - player.height,
      position.z - player.width / 2,
    )
    const max = new THREE.Vector3(
      position.x + player.width / 2,
      position.y,
      position.z + player.width / 2,
    )
    this.playerBox.set(min, max)
    return this.playerBox
  }

  private initKeyboard() {
    const player = this.gameSession.player
    const onKeyDown = (e: KeyboardEvent) => {
      if (this.ui.state.isPaused) return
      switch (e.code) {
        case 'KeyA':
          player.isMovingLeft = true
          break
        case 'KeyD':
          player.isMovingRight = true
          break
        case 'KeyS':
          player.isMovingBackward = true
          break
        case 'KeyW':
          player.isMovingForward = true
          break
        case 'Space':
          if (player.canJump) {
            player.velocity.y = player.jumpStrength
            player.canJump = false
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
      const player = this.gameSession.player
      switch (e.code) {
        case 'KeyA':
          player.isMovingLeft = false
          break
        case 'KeyD':
          player.isMovingRight = false
          break
        case 'KeyS':
          player.isMovingBackward = false
          break
        case 'KeyW':
          player.isMovingForward = false
          break
      }
    }
    document.addEventListener('keyup', onKeyUp)
    this.onDisposeCallbacks.push(() => {
      document.removeEventListener('keyup', onKeyUp)
    })
  }

  private initMouse() {
    const camera = this.gameSession.camera
    const player = this.gameSession.player

    const onMouseMove = (e: MouseEvent) => {
      if (this.ui.state.isPaused) return
      // if (document.pointerLockElement !== this.domElement) return;

      const sensitivity = 0.002
      player.yaw -= e.movementX * sensitivity
      player.pitch -= e.movementY * sensitivity

      player.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, player.pitch))

      camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ')
    }
    document.addEventListener('mousemove', onMouseMove)
    this.onDisposeCallbacks.push(() => {
      document.removeEventListener('mousemove', onMouseMove)
    })
  }

  private initPointerLock() {
    const domElement = this.ui.getCanvas()
    const onClick = () => {
      domElement.requestPointerLock()
    }
    domElement.addEventListener('click', onClick)
    this.onDisposeCallbacks.push(() => {
      domElement.removeEventListener('click', onClick)
    })
  }
}
