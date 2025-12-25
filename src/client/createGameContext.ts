import * as THREE from 'three'

import type { DatabaseChunkData, DatabasePlayerData } from '../server/worldDatabase.ts'
import type { ClientPlayerData, GameContext, MinecraftClient } from '../types.ts'

import { rawVector3ToThreeVector3, threeVector3ToRawVector3 } from '../client.ts'
import { createRaycaster } from './createRaycaster.ts'
import { createWorld } from './createWorld.ts'
import { FPSControls } from './FPSControls.ts'

export const createGameContext = async ({
  initialChunksFromServer,
  minecraft,
  player,
}: {
  initialChunksFromServer: DatabaseChunkData[]
  minecraft: MinecraftClient
  player: DatabasePlayerData
}): Promise<GameContext> => {
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

  const clientPlayer: ClientPlayerData = {
    canJump: true,
    direction: rawVector3ToThreeVector3(player.direction),
    height: minecraft.config.playerHeight,
    isMovingBackward: false,
    isMovingForward: false,
    isMovingLeft: false,
    isMovingRight: false,
    jumpStrength: minecraft.config.defaultPlayerJumpStrength,
    pitch: player.pitch,
    position: rawVector3ToThreeVector3(player.position),
    speed: minecraft.config.defaultPlayerSpeed,
    velocity: rawVector3ToThreeVector3(player.velocity),
    width: minecraft.config.playerWidth,
    yaw: player.yaw,
  }

  camera.position.copy(player.position)
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ')
  let disposed = false
  let syncying = false

  const world = createWorld({
    clientPlayer,
    eventQueue: minecraft.eventQueue,
    initialChunksFromServer,
    scene,
  })

  let lastTimeout: null | number = null

  const syncPlayer = async () => {
    if (minecraft.getUIContext().state.isPaused) {
      lastTimeout = setTimeout(syncPlayer, 1000)
      return
    }

    if (disposed || syncying) {
      console.log('Skipping syncPlayer because disposed or syncying')
      return
    }

    try {
      syncying = true
      await minecraft.eventQueue.emitAndWaitResponse(
        'REQUEST_SYNC_PLAYER',
        {
          playerData: {
            canJump: clientPlayer.canJump,
            direction: threeVector3ToRawVector3(clientPlayer.direction),
            jumpStrength: clientPlayer.jumpStrength,
            pitch: clientPlayer.pitch,
            position: threeVector3ToRawVector3(clientPlayer.position),
            uuid: player.uuid,
            velocity: threeVector3ToRawVector3(clientPlayer.velocity),
            yaw: clientPlayer.yaw,
          },
        },
        'RESPONSE_SYNC_PLAYER',
      )
    } finally {
      syncying = false
      lastTimeout = setTimeout(syncPlayer, 1000)
    }
  }

  lastTimeout = setTimeout(syncPlayer, 1000)

  const dispose = () => {
    window.removeEventListener('resize', onResize)
    world.dispose()
    renderer.dispose()
    scene.clear()

    if (lastTimeout) {
      clearTimeout(lastTimeout)
    }

    disposed = true
  }

  const game: GameContext = {
    camera,
    controls: new FPSControls(
      camera,
      renderer.domElement,
      world,
      clientPlayer,
      minecraft.getUIContext(),
    ),
    dispose,
    frameCounter: {
      fps: 0,
      lastFrames: 0,
      lastTime: 0,
      totalFrames: 0,
      totalTime: 0,
    },
    paused: false,
    player: clientPlayer,
    raycaster: createRaycaster({
      camera,
      player: clientPlayer,
      scene,
      world,
    }),
    renderer,
    scene,
    world,
  }

  return game
}
