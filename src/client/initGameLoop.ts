import * as THREE from 'three'

import type { MinecraftClient } from '../types.ts'

export const initGameLoop = (minecraft: MinecraftClient) => {
  const clock = new THREE.Clock()
  let requestedPointerLock = false
  let clockStopped = false

  const loop = async () => {
    if (!minecraft.gameContext) return

    if (minecraft.getUIContext().state.isPaused) {
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

    if (!document.pointerLockElement && !requestedPointerLock) {
      requestedPointerLock = true
      await minecraft.gameContext.renderer.domElement.requestPointerLock()
    }

    minecraft.gameContext.controls.update(delta)
    minecraft.gameContext.world.update()
    minecraft.gameContext.raycaster.update()

    requestAnimationFrame(loop)
  }

  loop()
}
