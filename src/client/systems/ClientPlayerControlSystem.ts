import type { PlayerUpdateSystem } from './PlayerUpdateSystem.ts'
import type { RaycastingSystem } from './RaycastingSystem.ts'

import { Config } from '../../shared/Config.ts'
import { PauseToggle } from '../../shared/events/client/PauseToggle.ts'
import { throttle } from '../../shared/util.ts'
import { createSystemFactory } from './createSystem.ts'

const THROTTLE_DELAY_MS = 500

export const createClientPlayerControlSystemFactory = ({
  playerUpdateSystem,
  raycastingSystem,
}: {
  playerUpdateSystem: PlayerUpdateSystem
  raycastingSystem: RaycastingSystem
}) =>
  createSystemFactory((ctx) => {
    const handleBlockPlace = throttle(() => {
      const maybeLookingAtBlock = raycastingSystem.getLookingAtBlock()
      const maybeLookingAtNormal = raycastingSystem.getLookingAtNormal()
      if (maybeLookingAtBlock.isSome() && maybeLookingAtNormal.isSome()) {
        const lookingAtBlock = maybeLookingAtBlock.value()
        const lookingAtNormal = maybeLookingAtNormal.value()
        const blockToPlace = ctx.client.blocksRegistry.getBlockIdByName('grass')

        ctx.gameLoop.world.addBlock(
          lookingAtBlock.x + lookingAtNormal.x,
          lookingAtBlock.y + lookingAtNormal.y,
          lookingAtBlock.z + lookingAtNormal.z,
          blockToPlace,
        )
      }
    }, THROTTLE_DELAY_MS)

    const handleBlockRemove = throttle(() => {
      const maybeLookingAtBlock = raycastingSystem.getLookingAtBlock()
      if (maybeLookingAtBlock.isSome()) {
        const lookingAtBlock = maybeLookingAtBlock.value()
        ctx.gameLoop.world.removeBlock(lookingAtBlock.x, lookingAtBlock.y, lookingAtBlock.z)
      }
    }, THROTTLE_DELAY_MS)

    ctx.onUpdate(() => {
      const inputManager = ctx.gameLoop.inputManager
      const mouseMove = inputManager.getMouseDelta()

      const player = ctx.gameLoop.getClientPlayer()

      player.rotation.y -= mouseMove.deltaX * Config.MOUSE_SENSITIVITY
      player.rotation.x -= mouseMove.deltaY * Config.MOUSE_SENSITIVITY

      player.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, player.rotation.x)) // Clamp the pitch between -90 and 90 degrees
      // clamp Y value
      if (player.rotation.y < 0) {
        player.rotation.y += Math.PI * 2
      } else if (player.rotation.y >= Math.PI * 2) {
        player.rotation.y -= Math.PI * 2
      }

      playerUpdateSystem.setMovingLeft(player, inputManager.isKeyPressed('KeyA'))
      playerUpdateSystem.setMovingRight(player, inputManager.isKeyPressed('KeyD'))
      playerUpdateSystem.setMovingBackward(player, inputManager.isKeyPressed('KeyS'))
      playerUpdateSystem.setMovingForward(player, inputManager.isKeyPressed('KeyW'))

      if (inputManager.isKeyPressed('Space')) {
        playerUpdateSystem.tryJump(player)
      }

      if (inputManager.isPressedLeftMouse()) {
        handleBlockRemove()
      }

      if (inputManager.isPressedRightMouse()) {
        handleBlockPlace()
      }
    })

    ctx.onEvent(PauseToggle, () => {
      const player = ctx.gameLoop.getClientPlayer()

      const state = playerUpdateSystem.getMovementState(player)

      state.movingLeft = false
      state.movingRight = false
      state.movingBackward = false
      state.movingForward = false
    })

    return {
      name: 'ClientPlayerControlSystem',
    }
  })
