import type { Component } from '../types.ts'

import { Config } from '../shared/Config.ts'
import { MinecraftEventQueue } from '../shared/MinecraftEventQueue.ts'
import { ClientContainer } from './ClientContainer.ts'
import { GameSession } from './GameSession.ts'
import { InputManager } from './InputManager.ts'

@MinecraftEventQueue.ClientListener()
export class ClientPlayerManager implements Component {
  dispose(): void {}

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
  }

  @MinecraftEventQueue.Handler('Client.PauseToggle')
  protected onPauseToggle(): void {
    const player = ClientContainer.resolve(GameSession).unwrap().getCurrentPlayer()

    player.moving.left = false
    player.moving.right = false
    player.moving.backward = false
    player.moving.forward = false
  }
}
