import * as THREE from 'three'

import type { MinecraftClient } from '../types.ts'

export const initGameLoop = (minecraft: MinecraftClient) => {
  const clock = new THREE.Clock()
  let clockStopped = false

  const loop = () => {
    if (!minecraft.gameContext) return

    if (minecraft.getGUI().state.isPaused) {
      clock.stop()
      clockStopped = true
      requestAnimationFrame(loop)
      return
    } else if (clockStopped) {
      clock.start()
      clockStopped = false
    }

    const delta = clock.getDelta()
    minecraft.gameContext.frameCounter.lastTime += delta
    minecraft.gameContext.frameCounter.totalTime += delta
    minecraft.gameContext.frameCounter.lastFrames++
    minecraft.gameContext.frameCounter.totalFrames++

    if (minecraft.gameContext.frameCounter.lastTime >= 1) {
      minecraft.gameContext.frameCounter.fps = minecraft.gameContext.frameCounter.lastFrames
      minecraft.gameContext.frameCounter.lastFrames = 0
      minecraft.gameContext.frameCounter.lastTime = 0
    }

    minecraft.gameContext.renderer.render(minecraft.gameContext.scene, minecraft.gameContext.camera)

    minecraft.gameContext.controls.update(delta)
    minecraft.gameContext.world.update()
    minecraft.gameContext.raycaster.update()

    requestAnimationFrame(loop)
  }

  loop()
}
