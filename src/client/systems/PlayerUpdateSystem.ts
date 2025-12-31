import * as THREE from 'three'

import { Config } from '../../shared/Config.ts'
import { Player } from '../../shared/entities/Player.ts'
import { HashMap } from '../../shared/HashMap.ts'
import { UP_VECTOR } from '../../shared/util.ts'
import { createSystemFactory } from './createSystem.ts'

export type PlayerUpdateSystem = ReturnType<typeof playerUpdateSystemFactory>

class PlayerMovementState {
  canJump: boolean = false
  movingBackward: boolean = false
  movingForward: boolean = false
  movingLeft: boolean = false
  movingRight: boolean = false
}

export const playerUpdateSystemFactory = createSystemFactory((ctx) => {
  const playerMovementStates = new HashMap<string, PlayerMovementState>()

  const getMovementState = (player: Player): PlayerMovementState =>
    playerMovementStates.getOrSet(player.uuid, () => new PlayerMovementState())

  const canJump = (player: Player) => getMovementState(player).canJump

  const setCanJump = (player: Player, canJump: boolean): void => {
    getMovementState(player).canJump = canJump
  }

  const isMovingBackward = (player: Player): boolean => getMovementState(player).movingBackward

  const isMovingForward = (player: Player): boolean => getMovementState(player).movingForward

  const isMovingLeft = (player: Player): boolean => getMovementState(player).movingLeft

  const isMovingRight = (player: Player): boolean => getMovementState(player).movingRight

  const setMovingBackward = (player: Player, moving: boolean): void => {
    getMovementState(player).movingBackward = moving
  }

  const setMovingForward = (player: Player, moving: boolean): void => {
    getMovementState(player).movingForward = moving
  }

  const setMovingLeft = (player: Player, moving: boolean): void => {
    getMovementState(player).movingLeft = moving
  }

  const setMovingRight = (player: Player, moving: boolean): void => {
    getMovementState(player).movingRight = moving
  }

  const tryJump = (player: Player): boolean => {
    if (!canJump(player)) return false

    setCanJump(player, false)
    player.velocity.y = Config.PLAYER_JUMP_STRENGTH
    return true
  }

  ctx.onUpdateBatch(Player, (players) => {
    const delta = ctx.getDelta()

    for (const player of players) {
      // Apply gravity
      player.velocity.y -= Config.GRAVITY * delta

      const direction = new THREE.Vector3()

      if (isMovingForward(player)) direction.z += 1
      if (isMovingBackward(player)) direction.z -= 1
      if (isMovingLeft(player)) direction.x -= 1
      if (isMovingRight(player)) direction.x += 1

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

        if (!ctx.world.boxIntersectsWorldBlocks(Player.boundingBox(attemptedPosition))) {
          player.position.x = attemptedPosition.x
        }
      }

      if (horizontalVelocity.z !== 0) {
        const attemptedPosition = player.position.clone()
        attemptedPosition.z += horizontalVelocity.z

        if (!ctx.world.boxIntersectsWorldBlocks(Player.boundingBox(attemptedPosition))) {
          player.position.z = attemptedPosition.z
        }
      }

      {
        const attemptedPosition = player.position.clone()
        attemptedPosition.y += player.velocity.y * delta

        if (ctx.world.boxIntersectsWorldBlocks(Player.boundingBox(attemptedPosition))) {
          if (player.velocity.y > 0) {
            // Hitting ceiling
            player.velocity.y = 0
            player.position.y = Math.floor(player.position.y)
          } else {
            // Hitting ground
            setCanJump(player, true)
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

          if (ctx.world.boxIntersectsWorldBlocks(Player.boundingBox(groundCheck))) {
            setCanJump(player, true)
          } else {
            setCanJump(player, false)
          }
        }
      }
    }
  })

  return {
    getMovementState,
    name: 'ClientPlayerControlSystem',
    setMovingBackward,
    setMovingForward,
    setMovingLeft,
    setMovingRight,
    tryJump,
  }
})
