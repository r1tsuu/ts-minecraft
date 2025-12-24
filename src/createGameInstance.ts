import * as THREE from 'three'

import type { GameInstance, MinecraftInstance, PlayerData } from './types.ts'
import type { ActiveWorld } from './worker/types.ts'

import { rawVector3ToThreeVector3, threeVector3ToRawVector3 } from './client.ts'
import { createRaycaster } from './createRaycaster.ts'
import { createWorld } from './createWorld.ts'
import { FPSControls } from './FPSControls.ts'
import { requestWorker, sendEventToWorker } from './worker/workerClient.ts'

export const createGameInstance = async ({
  activeWorld,
  minecraft,
}: {
  activeWorld: ActiveWorld
  minecraft: MinecraftInstance
}): Promise<GameInstance> => {
  const scene = new THREE.Scene()
  const canvas = document.querySelector('#game_canvas') as HTMLCanvasElement
  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    canvas,
    powerPreference: 'high-performance',
  })
  renderer.setSize(window.innerWidth, window.innerHeight)

  const onResize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight)
  }
  window.addEventListener('resize', onResize)

  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)

  camera.position.set(0, 40, 0)
  camera.lookAt(30, 35, 30)

  const player: PlayerData = {
    ...activeWorld.world.playerData,
    direction: rawVector3ToThreeVector3(activeWorld.world.playerData.direction),
    position: rawVector3ToThreeVector3(activeWorld.world.playerData.position),
    velocity: rawVector3ToThreeVector3(activeWorld.world.playerData.velocity),
  }

  camera.position.copy(player.position)
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ')
  let disposed = false
  let syncying = false

  const world = createWorld({ activeWorld, player, scene })

  let lastTimeout: null | number = null

  const syncPlayer = async () => {
    if (minecraft.getUI().state.isPaused) {
      lastTimeout = setTimeout(syncPlayer, 1000)
      return
    }

    if (disposed || syncying) {
      console.log('Skipping syncPlayer because disposed or syncying')
      return
    }

    try {
      syncying = true
      await requestWorker(
        {
          payload: {
            playerData: {
              ...player,
              direction: threeVector3ToRawVector3(player.direction),
              position: threeVector3ToRawVector3(player.position),
              velocity: threeVector3ToRawVector3(player.velocity),
            },
          },
          type: 'syncPlayer',
        },
        'playerSynced',
      )
    } finally {
      syncying = false
      lastTimeout = setTimeout(syncPlayer, 1000)
    }
  }

  lastTimeout = setTimeout(syncPlayer, 1000)

  const dispose = () => {
    sendEventToWorker({ payload: {}, type: 'stopActiveWorld' })
    window.removeEventListener('resize', onResize)
    world.dispose()
    renderer.dispose()
    scene.clear()

    if (lastTimeout) {
      clearTimeout(lastTimeout)
    }

    disposed = true
  }

  const game: GameInstance = {
    camera,
    controls: new FPSControls(camera, renderer.domElement, world, player, minecraft.getUI()),
    dispose,
    frameCounter: {
      fps: 0,
      lastFrames: 0,
      lastTime: 0,
      totalFrames: 0,
      totalTime: 0,
    },
    paused: false,
    player,
    raycaster: createRaycaster({
      camera,
      player,
      scene,
      world,
    }),
    renderer,
    scene,
    world,
  }

  return game
}
