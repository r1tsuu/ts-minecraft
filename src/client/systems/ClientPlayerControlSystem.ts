import type { Euler, Vector3 } from 'three'

import type { RawVector3 } from '../../types.ts'
import type { ChunkRenderingSystem } from './ChunkRenderingSystem.ts'
import type { PlayerUpdateSystem } from './PlayerUpdateSystem.ts'
import type { RaycastingSystem } from './RaycastingSystem.ts'

import { Blocks } from '../../shared/BlocksRegistry.ts'
import { Config } from '../../shared/Config.ts'
import { PauseToggle } from '../../shared/events/client/PauseToggle.ts'
import {
  type BlockUpdateAction,
  RequestBlocksUpdate,
} from '../../shared/events/client/RequestBlocksUpdate.ts'
import { RequestPlayerUpdate } from '../../shared/events/client/RequestPlayerUpdate.ts'
import { throttle } from '../../shared/util.ts'
import { createSystemFactory } from './createSystem.ts'

const THROTTLE_DELAY_MS = 500

export const createClientPlayerControlSystemFactory = ({
  chunkRenderingSystem,
  playerUpdateSystem,
  raycastingSystem,
}: {
  chunkRenderingSystem: ChunkRenderingSystem
  playerUpdateSystem: PlayerUpdateSystem
  raycastingSystem: RaycastingSystem
}) =>
  createSystemFactory((ctx) => {
    let queuedActionsToSend: BlockUpdateAction[] = []

    const handleBlockPlace = throttle(() => {
      const maybeLookingAtBlock = raycastingSystem.getLookingAtBlock()
      const maybeLookingAtNormal = raycastingSystem.getLookingAtNormal()
      if (maybeLookingAtBlock.isSome() && maybeLookingAtNormal.isSome()) {
        const lookingAtBlock = maybeLookingAtBlock.value()
        const lookingAtNormal = maybeLookingAtNormal.value()

        const position: RawVector3 = {
          x: lookingAtBlock.x + lookingAtNormal.x,
          y: lookingAtBlock.y + lookingAtNormal.y,
          z: lookingAtBlock.z + lookingAtNormal.z,
        }

        const blockToPlace = Blocks.Grass.id
        ctx.world.addBlock(position.x, position.y, position.z, blockToPlace)
        chunkRenderingSystem.renderBlockAt(position)
        queuedActionsToSend.push({ blockID: blockToPlace, position, type: 'SET' })
      }
    }, THROTTLE_DELAY_MS)

    const handleBlockRemove = throttle(() => {
      const maybeLookingAtBlock = raycastingSystem.getLookingAtBlock()
      if (maybeLookingAtBlock.isSome()) {
        const lookingAtBlock = maybeLookingAtBlock.value()
        const block = ctx.world.getBlockAt(lookingAtBlock.x, lookingAtBlock.y, lookingAtBlock.z)
        if (block.isNone() || block.value() === Blocks.Bedrock.id) return

        chunkRenderingSystem.unrenderBlockAt(lookingAtBlock)
        ctx.world.removeBlockAt(lookingAtBlock.x, lookingAtBlock.y, lookingAtBlock.z)
        queuedActionsToSend.push({ position: lookingAtBlock, type: 'REMOVE' })
      }
    }, THROTTLE_DELAY_MS)

    ctx.onUpdate(() => {
      const inputManager = ctx.inputManager
      const mouseMove = inputManager.getMouseDelta()

      const player = ctx.getClientPlayer()

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
      const player = ctx.getClientPlayer()

      const state = playerUpdateSystem.getMovementState(player)

      state.movingLeft = false
      state.movingRight = false
      state.movingBackward = false
      state.movingForward = false
    })

    const lastPlayerState: {
      position: Vector3
      rotation: Euler
      velocity: Vector3
    } = {
      position: ctx.getClientPlayer().position.clone(),
      rotation: ctx.getClientPlayer().rotation.clone(),
      velocity: ctx.getClientPlayer().velocity.clone(),
    }

    ctx.onInterval(() => {
      const player = ctx.getClientPlayer()

      const positionChanged = !player.position.equals(lastPlayerState.position)
      const rotationChanged = !player.rotation.equals(lastPlayerState.rotation)
      const velocityChanged = !player.velocity.equals(lastPlayerState.velocity)

      if (positionChanged || rotationChanged || velocityChanged) {
        ctx.eventBus.publish(
          new RequestPlayerUpdate(player.uuid, player.position, player.rotation, player.velocity),
        )
      }

      if (queuedActionsToSend.length > 0) {
        ctx.eventBus.publish(new RequestBlocksUpdate(queuedActionsToSend))
        queuedActionsToSend = []
      }
    }, 350) // Send player and block updates every 350ms

    return {
      name: 'ClientPlayerControlSystem',
    }
  })
