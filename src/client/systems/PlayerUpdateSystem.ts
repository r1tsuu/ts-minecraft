import * as THREE from 'three'

import { Config } from '../../shared/Config.ts'
import { Player } from '../../shared/entities/Player.ts'
import { HashMap } from '../../shared/HashMap.ts'
import { pipe } from '../../shared/Pipe.ts'
import { System } from '../../shared/System.ts'
import { boxIntersectsWorldBlocks, UP_VECTOR } from '../../shared/util.ts'
import { World } from '../../shared/World.ts'
import { ClientContainer } from '../ClientContainer.ts'
import { GameSession } from '../GameSession.ts'

class PlayerMovementState {
  canJump: boolean = false
  movingBackward: boolean = false
  movingForward: boolean = false
  movingLeft: boolean = false
  movingRight: boolean = false
}

/**
 * System responsible for updating player entities, including movement and jumping.
 * @extends EntitySystem<Player>
 *
 */

export class PlayerUpdateSystem extends System {
  private movementStates: HashMap<string, PlayerMovementState> = new HashMap()
  private readonly world = ClientContainer.resolve(World).unwrap()

  canJump(player: Player): boolean {
    return this.getMovementState(player).canJump
  }

  getMovementState(player: Player): PlayerMovementState {
    return pipe(this.movementStates.get(player.uuid))
      .map((maybePlayer) =>
        maybePlayer.unwrapOr(() => {
          const newState = new PlayerMovementState()
          this.movementStates.set(player.uuid, newState)
          return newState
        }),
      )
      .value()
  }

  isMovingBackward(player: Player): boolean {
    return this.getMovementState(player).movingBackward
  }

  isMovingForward(player: Player): boolean {
    return this.getMovementState(player).movingForward
  }

  isMovingLeft(player: Player): boolean {
    return this.getMovementState(player).movingLeft
  }

  isMovingRight(player: Player): boolean {
    return this.getMovementState(player).movingRight
  }

  setCanJump(player: Player, canJump: boolean): void {
    this.getMovementState(player).canJump = canJump
  }

  setMovingBackward(player: Player, moving: boolean): void {
    this.getMovementState(player).movingBackward = moving
  }

  setMovingForward(player: Player, moving: boolean): void {
    this.getMovementState(player).movingForward = moving
  }

  setMovingLeft(player: Player, moving: boolean): void {
    this.getMovementState(player).movingLeft = moving
  }

  setMovingRight(player: Player, moving: boolean): void {
    this.getMovementState(player).movingRight = moving
  }

  tryJump(player: Player): boolean {
    if (!this.canJump(player)) return false

    return pipe(this.getMovementState(player))
      .tap((state) => (state.canJump = false))
      .tap(() => (player.velocity.y = Config.PLAYER_JUMP_STRENGTH))
      .map(() => true)
      .value()
  }

  @System.UpdateAll(Player)
  protected updatePlayers(players: Player[]): void {
    for (const player of players) {
      this.update(player)
    }
  }

  private update(player: Player): void {
    const gameSession = ClientContainer.resolve(GameSession).unwrap()
    const delta = gameSession.getDelta()
    player.velocity.y -= Config.GRAVITY * delta
    const direction = new THREE.Vector3()

    if (this.isMovingForward(player)) direction.z += 1
    if (this.isMovingBackward(player)) direction.z -= 1
    if (this.isMovingLeft(player)) direction.x -= 1
    if (this.isMovingRight(player)) direction.x += 1

    if (direction.lengthSq() > 0) {
      direction.normalize()
    }

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
      new THREE.Quaternion().setFromEuler(player.rotation),
    )

    forward.y = 0
    forward.normalize()

    const right = new THREE.Vector3()
    right.crossVectors(forward, UP_VECTOR).normalize()

    const move = new THREE.Vector3()
    move.addScaledVector(forward, direction.z)
    move.addScaledVector(right, direction.x)

    const horizontalVelocity = move.multiplyScalar(Config.PLAYER_WALK_SPEED * delta)

    if (horizontalVelocity.x !== 0) {
      const attemptedPosition = player.position.clone()
      attemptedPosition.x += horizontalVelocity.x

      if (boxIntersectsWorldBlocks(this.world, Player.boundingBox(attemptedPosition))) {
        player.position.x = attemptedPosition.x
      }
    }

    if (horizontalVelocity.z !== 0) {
      const attemptedPosition = player.position.clone()
      attemptedPosition.z += horizontalVelocity.z

      if (!boxIntersectsWorldBlocks(this.world, Player.boundingBox(attemptedPosition))) {
        player.position.z = attemptedPosition.z
      }
    }

    {
      const attemptedPosition = player.position.clone()
      attemptedPosition.y += player.velocity.y * delta

      if (boxIntersectsWorldBlocks(this.world, Player.boundingBox(attemptedPosition))) {
        if (player.velocity.y > 0) {
          // Hitting ceiling
          player.velocity.y = 0
          player.position.y = Math.floor(player.position.y)
        } else {
          // Hitting ground
          this.setCanJump(player, true)
          player.velocity.y = 0
          const feetY = attemptedPosition.y - Config.PLAYER_HEIGHT
          player.position.y = Math.ceil(feetY) + Config.PLAYER_HEIGHT
        }
      } else {
        // No collision, apply Y movement
        player.position.y = attemptedPosition.y
        // Check if on ground
        const groundCheck = player.position.clone()
        groundCheck.y -= 0.05

        if (boxIntersectsWorldBlocks(this.world, Player.boundingBox(groundCheck))) {
          this.setCanJump(player, true)
        } else {
          this.setCanJump(player, false)
        }
      }
    }
  }
}
