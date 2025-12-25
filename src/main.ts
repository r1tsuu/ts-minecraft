import * as THREE from 'three'

import type { MinecraftClient } from './types.ts'

import { initBlocks } from './client.ts'
import { createEventQueue } from './clientEventQueue.ts'
import { createGameInstance } from './createGameInstance.ts'
import { createUI } from './ui/createUI.ts'
import { requestWorker } from './worker/workerClient.ts'

initBlocks()

const minecraft: MinecraftClient = {
  eventQueue: createEventQueue(),
  gameContext: null,
  getGameContext: () => {
    if (!minecraft.gameContext) {
      throw new Error('Game instance is not initialized')
    }

    return minecraft.gameContext
  },
  getUIContext: () => {
    if (!minecraft.uiContext) {
      throw new Error('UI instance is not initialized')
    }

    return minecraft.uiContext
  },
  uiContext: null,
}

const ui = createUI({
  minecraft,
  onCreateWorld: async (name: string, seed: string) => {
    const response = await requestWorker(
      {
        payload: {
          name,
          seed,
        },
        type: 'createWorld',
      },
      'worldCreated',
    )

    return response.payload
  },
  onDeleteWorld: async (worldID: number) => {
    await requestWorker(
      {
        payload: {
          worldID,
        },
        type: 'deleteWorld',
      },
      'worldDeleted',
    )
  },
  onExitWorld: async () => {
    if (minecraft.gameContext) {
      minecraft.gameContext.dispose()
      minecraft.gameContext = null
    }
  },
  onWorldPlay: async (worldID: number) => {
    const { payload: activeWorld } = await requestWorker(
      {
        payload: {
          worldID,
        },
        type: 'initializeWorld',
      },
      'worldInitialized',
    )

    minecraft.gameContext = await createGameInstance({
      activeWorld,
      minecraft,
    })

    const clock = new THREE.Clock()
    let requestingPointerLock = false
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

      minecraft.gameContext.renderer.render(
        minecraft.gameContext.scene,
        minecraft.gameContext.camera,
      )

      if (!document.pointerLockElement && !requestingPointerLock) {
        requestingPointerLock = true
        await minecraft.gameContext.renderer.domElement.requestPointerLock()
      }

      minecraft.gameContext.controls.update(delta)
      minecraft.gameContext.world.update()
      minecraft.gameContext.raycaster.update()

      requestAnimationFrame(loop)
    }

    loop()
  },
})

minecraft.uiContext = ui
