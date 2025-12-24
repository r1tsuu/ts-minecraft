import * as THREE from 'three'

import type { MinecraftInstance } from './types.ts'

import { initBlocks } from './client.ts'
import { createEventQueue } from './clientEventQueue.ts'
import { createGameInstance } from './createGameInstance.ts'
import { createUI } from './ui/createUI.ts'
import { requestWorker } from './worker/workerClient.ts'

initBlocks()

const minecraft: MinecraftInstance = {
  eventQueue: createEventQueue(),
  game: null,
  getGame: () => {
    if (!minecraft.game) {
      throw new Error('Game instance is not initialized')
    }

    return minecraft.game
  },
  getUI: () => {
    if (!minecraft.ui) {
      throw new Error('UI instance is not initialized')
    }

    return minecraft.ui
  },
  ui: null,
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
    if (minecraft.game) {
      minecraft.game.dispose()
      minecraft.game = null
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

    minecraft.game = await createGameInstance({
      activeWorld,
      minecraft,
    })

    const clock = new THREE.Clock()
    let requestingPointerLock = false
    let clockStopped = false

    const loop = async () => {
      if (!minecraft.game) return

      if (minecraft.getUI().state.isPaused) {
        clock.stop()
        clockStopped = true
        requestAnimationFrame(loop)
        return
      } else if (clockStopped) {
        clock.start()
        clockStopped = false
      }

      const delta = clock.getDelta()
      minecraft.game.frameCounter.lastTime += delta
      minecraft.game.frameCounter.totalTime += delta
      minecraft.game.frameCounter.lastFrames++
      minecraft.game.frameCounter.totalFrames++

      if (minecraft.game.frameCounter.lastTime >= 1) {
        minecraft.game.frameCounter.fps = minecraft.game.frameCounter.lastFrames
        minecraft.game.frameCounter.lastFrames = 0
        minecraft.game.frameCounter.lastTime = 0
      }

      minecraft.game.renderer.render(minecraft.game.scene, minecraft.game.camera)

      if (!document.pointerLockElement && !requestingPointerLock) {
        requestingPointerLock = true
        await minecraft.game.renderer.domElement.requestPointerLock()
      }

      minecraft.game.controls.update(delta)
      minecraft.game.world.update()
      minecraft.game.raycaster.update()

      requestAnimationFrame(loop)
    }

    loop()
  },
})

minecraft.ui = ui
