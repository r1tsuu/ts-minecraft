import { BlocksRegistry } from '../shared/BlocksRegistry.ts'
import { Component } from '../shared/Component.ts'
import { Config } from '../shared/Config.ts'
import { MinecraftEventBus } from '../shared/MinecraftEventBus.ts'
import { Throttle } from '../shared/util.ts'
import { ClientContainer } from './ClientContainer.ts'
import { GameSession } from './GameSession.ts'
import { InputManager } from './InputManager.ts'
import { Raycaster } from './Raycaster.ts'
import { World } from './World.ts'

@Component()
@MinecraftEventBus.ClientListener()
export class ClientPlayerManager implements Component {
  private static THROTTLE_DELAY_MS = 500

  update(): void {
    const gameSession = ClientContainer.resolve(GameSession).unwrap()
    const inputManager = ClientContainer.resolve(InputManager).unwrap()

    const mouseMove = inputManager.getMouseDelta()

    const player = gameSession.getCurrentPlayer()

    player.rotation.y -= mouseMove.deltaX * Config.MOUSE_SENSITIVITY
    player.rotation.x -= mouseMove.deltaY * Config.MOUSE_SENSITIVITY

    player.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, player.rotation.x)) // Clamp the pitch between -90 and 90 degrees
    // clamp Y value
    if (player.rotation.y < 0) {
      player.rotation.y += Math.PI * 2
    } else if (player.rotation.y >= Math.PI * 2) {
      player.rotation.y -= Math.PI * 2
    }

    if (inputManager.isKeyPressed('KeyA')) {
      player.moving.left = true
    } else {
      player.moving.left = false
    }

    if (inputManager.isKeyPressed('KeyD')) {
      player.moving.right = true
    } else {
      player.moving.right = false
    }

    if (inputManager.isKeyPressed('KeyS')) {
      player.moving.backward = true
    } else {
      player.moving.backward = false
    }

    if (inputManager.isKeyPressed('KeyW')) {
      player.moving.forward = true
    } else {
      player.moving.forward = false
    }

    if (inputManager.isKeyPressed('Space')) {
      player.tryJump()
    }

    if (inputManager.isPressedLeftMouse()) {
      this.handleBlockRemove()
    }

    if (inputManager.isPressedRightMouse()) {
      this.handleBlockPlace()
    }
  }

  @MinecraftEventBus.Handler('Client.PauseToggle')
  protected onPauseToggle(): void {
    const player = ClientContainer.resolve(GameSession).unwrap().getCurrentPlayer()

    player.moving.left = false
    player.moving.right = false
    player.moving.backward = false
    player.moving.forward = false
  }

  @Throttle(ClientPlayerManager.THROTTLE_DELAY_MS)
  private handleBlockPlace(): void {
    const world = ClientContainer.resolve(World).unwrap()
    const raycaster = ClientContainer.resolve(Raycaster).unwrap()
    const blocksRegistry = ClientContainer.resolve(BlocksRegistry).unwrap()

    if (raycaster.lookingAtBlock && raycaster.lookingAtNormal) {
      const blockToPlace = blocksRegistry.getBlockIdByName('grass')

      world.addBlock(
        raycaster.lookingAtBlock.x + raycaster.lookingAtNormal.x,
        raycaster.lookingAtBlock.y + raycaster.lookingAtNormal.y,
        raycaster.lookingAtBlock.z + raycaster.lookingAtNormal.z,
        blockToPlace,
      )
    }
  }

  @Throttle(ClientPlayerManager.THROTTLE_DELAY_MS)
  private handleBlockRemove(): void {
    const world = ClientContainer.resolve(World).unwrap()
    const raycaster = ClientContainer.resolve(Raycaster).unwrap()

    if (raycaster.lookingAtBlock) {
      world.removeBlock(
        raycaster.lookingAtBlock.x,
        raycaster.lookingAtBlock.y,
        raycaster.lookingAtBlock.z,
      )
    }
  }
}
