import type { MinecraftClient } from './MinecraftClient.ts'

import { MinecraftEventQueue } from '../queue/MinecraftQueue.ts'
import { Config } from '../shared/Config.ts'

export class ClientPlayerManager {
  constructor(private readonly minecraft: MinecraftClient) {
    this.minecraft.eventQueue.registerHandlers(this)
  }

  dispose(): void {
    MinecraftEventQueue.unregisterHandlers(this)
  }

  update(): void {
    const gameSession = this.minecraft.getGameSession()
    const inputManager = this.minecraft.getGameSession().inputManager

    const mouseMove = inputManager.getMouseDelta()

    const player = gameSession.player

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
    const gameSession = this.minecraft.getGameSession()

    gameSession.player.moving.left = false
    gameSession.player.moving.right = false
    gameSession.player.moving.backward = false
    gameSession.player.moving.forward = false
  }
}
