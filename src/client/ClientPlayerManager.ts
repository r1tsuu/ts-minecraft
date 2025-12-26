import type { MinecraftClient } from './MinecraftClient.ts'

import { MinecraftEvent, MinecraftEventQueue } from '../queue/MinecraftQueue.ts'
import { Config } from '../shared/Config.ts'

export class ClientPlayerManager {
  constructor(private readonly minecraft: MinecraftClient) {
    this.minecraft.eventQueue.registerHandlers(this)
  }

  dispose(): void {
    MinecraftEventQueue.unregisterHandlers(this)
  }

  @MinecraftEventQueue.Handler('Client.Input.KeyDown')
  protected onKeyDown(event: MinecraftEvent<'Client.Input.KeyDown'>): void {
    const gameSession = this.minecraft.getGameSession()
    if (gameSession.paused) return

    const player = gameSession.player

    switch (event.payload.keyCode) {
      case 'KeyA': {
        player.moving.left = true
        break
      }
      case 'KeyD': {
        player.moving.right = true
        break
      }
      case 'KeyS': {
        player.moving.backward = true
        break
      }
      case 'KeyW': {
        player.moving.forward = true
        break
      }
      case 'Space': {
        player.tryJump()
        break
      }
    }
  }

  @MinecraftEventQueue.Handler('Client.Input.KeyUp')
  protected onKeyUp(event: MinecraftEvent<'Client.Input.KeyUp'>): void {
    const gameSession = this.minecraft.getGameSession()
    const player = gameSession.player

    // do not check for paused to avoid moving stuck when unpausing
    switch (event.payload.keyCode) {
      case 'KeyA': {
        player.moving.left = false
        break
      }
      case 'KeyD': {
        player.moving.right = false
        break
      }
      case 'KeyS': {
        player.moving.backward = false
        break
      }
      case 'KeyW': {
        player.moving.forward = false
        break
      }
    }
  }

  @MinecraftEventQueue.Handler('Client.Input.MouseMove')
  protected onMouseMove(event: MinecraftEvent<'Client.Input.MouseMove'>): void {
    const gameSession = this.minecraft.getGameSession()
    if (gameSession.paused) return

    const player = gameSession.player

    player.rotation.y -= event.payload.deltaX * Config.MOUSE_SENSITIVITY
    player.rotation.x -= event.payload.deltaY * Config.MOUSE_SENSITIVITY
  }
}
