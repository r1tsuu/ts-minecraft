import * as THREE from 'three'

import type { MinecraftClient } from './MinecraftClient.ts'

import { Config } from '../shared/Config.ts'
import { UP_VECTOR } from './utils.ts'

export class Player {
  moving: {
    backward: boolean
    forward: boolean
    left: boolean
    right: boolean
  } = {
    backward: false,
    forward: false,
    left: false,
    right: false,
  }

  private canJump = false

  constructor(
    readonly uuid: string,
    readonly position: THREE.Vector3,
    readonly direction: THREE.Vector3,
    readonly velocity: THREE.Vector3,
    readonly rotation: THREE.Euler,
    private readonly minecraft: MinecraftClient,
  ) {}

  /**
   * Makes the player jump if possible.
   * @returns `true` if the jump was successful, `false` otherwise.
   */
  tryJump(): boolean {
    if (!this.canJump) return false

    this.velocity.y = Config.PLAYER_JUMP_STRENGTH
    this.canJump = false
    return true
  }

  update(): void {
    const gameSession = this.minecraft.getGameSession()
    const delta = gameSession.getDelta()
    this.velocity.y -= Config.GRAVITY * delta
    this.direction.set(0, 0, 0)

    if (this.moving.forward) this.direction.z += 1
    if (this.moving.backward) this.direction.z -= 1
    if (this.moving.left) this.direction.x -= 1
    if (this.moving.right) this.direction.x += 1

    if (this.direction.lengthSq() > 0) {
      this.direction.normalize()
    }

    const forward = new THREE.Vector3()
    forward.applyEuler(this.rotation).normalize()
    forward.y = 0

    const right = new THREE.Vector3()
    right.crossVectors(forward, UP_VECTOR).normalize()

    const move = new THREE.Vector3()
    move.addScaledVector(forward, this.direction.z)
    move.addScaledVector(right, this.direction.x)

    const horizontalVelocity = move.multiplyScalar(Config.PLAYER_WALK_SPEED * delta)

    if (horizontalVelocity.x !== 0) {
      const attemptedPosition = this.position.clone()
      attemptedPosition.x += horizontalVelocity.x

      if (
        !gameSession.world.checkCollisionWithBox(this.getPlayerBoxAtPosition(attemptedPosition))
      ) {
        this.position.x = attemptedPosition.x
      }
    }

    if (horizontalVelocity.z !== 0) {
      const attemptedPosition = this.position.clone()
      attemptedPosition.z += horizontalVelocity.z

      if (
        !gameSession.world.checkCollisionWithBox(this.getPlayerBoxAtPosition(attemptedPosition))
      ) {
        this.position.z = attemptedPosition.z
      }
    }

    {
      const attemptedPosition = this.position.clone()
      attemptedPosition.y += this.velocity.y * delta

      if (gameSession.world.checkCollisionWithBox(this.getPlayerBoxAtPosition(attemptedPosition))) {
        if (this.velocity.y > 0) {
          // Hitting ceiling
          this.velocity.y = 0
          this.position.y = Math.floor(this.position.y)
        } else {
          // Hitting ground
          this.canJump = true
          this.velocity.y = 0
          const feetY = attemptedPosition.y - Config.PLAYER_HEIGHT
          this.position.y = Math.ceil(feetY) + Config.PLAYER_HEIGHT
        }
      } else {
        // No collision, apply Y movement
        this.position.y = attemptedPosition.y
        // Check if on ground
        const groundCheck = this.position.clone()
        groundCheck.y -= 0.05

        if (gameSession.world.checkCollisionWithBox(this.getPlayerBoxAtPosition(groundCheck))) {
          this.canJump = true
        } else {
          this.canJump = false
        }
      }
    }
  }

  private getPlayerBoxAtPosition(position: THREE.Vector3): THREE.Box3 {
    return new THREE.Box3(
      new THREE.Vector3(
        position.x - Config.PLAYER_WIDTH / 2,
        position.y,
        position.z - Config.PLAYER_WIDTH / 2,
      ),
      new THREE.Vector3(
        position.x + Config.PLAYER_WIDTH / 2,
        position.y + Config.PLAYER_HEIGHT,
        position.z + Config.PLAYER_WIDTH / 2,
      ),
    )
  }
}
