import * as THREE from 'three'

import type { DatabaseChunkData, DatabasePlayerData } from '../server/WorldDatabase.ts'
import type { ClientPlayerData, UUID } from '../types.ts'
import type { MinecraftClient } from './MinecraftClient.ts'

import { Config } from '../shared/Config.ts'
import { FPSControls } from './FPSControls.ts'
import { Raycaster } from './Raycaster.ts'
import { rawVector3ToThreeVector3, threeVector3ToRawVector3 } from './utils.ts'
import { World } from './World.ts'

export class GameSession {
  camera: THREE.PerspectiveCamera
  controls: FPSControls
  frameCounter = {
    fps: 0,
    lastFrames: 0,
    lastTime: 0,
    totalFrames: 0,
    totalTime: 0,
  }
  paused = false
  player: ClientPlayerData
  raycaster: Raycaster
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene = new THREE.Scene()
  world: World

  private additionalOnDisposeCallbacks: Array<() => void> = []
  private delta: number = 0
  private disposed = false
  private gameLoopClock = new THREE.Clock()
  private isGameLoopClockStopped = false
  private lastTimeout: null | number = null
  private onResize: () => void

  private playerUUID: UUID

  private syncying = false

  constructor(
    private readonly minecraft: MinecraftClient,
    {
      initialChunksFromServer,
      player,
    }: {
      initialChunksFromServer: DatabaseChunkData[]
      player: DatabasePlayerData
    },
  ) {
    this.playerUUID = player.uuid
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      canvas: minecraft.getGUI().getCanvas(),
      powerPreference: 'high-performance',
    })
    this.renderer.setSize(window.innerWidth, window.innerHeight)

    this.onResize = () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight)
    }

    window.addEventListener('resize', this.onResize)
    this.additionalOnDisposeCallbacks.push(() => {
      window.removeEventListener('resize', this.onResize)
    })

    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.0
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)

    this.camera.position.set(0, 40, 0)
    this.camera.lookAt(30, 35, 30)

    this.player = {
      canJump: true,
      direction: rawVector3ToThreeVector3(player.direction),
      height: Config.PLAYER_HEIGHT,
      isMovingBackward: false,
      isMovingForward: false,
      isMovingLeft: false,
      isMovingRight: false,
      jumpStrength: player.jumpStrength,
      pitch: player.pitch,
      position: rawVector3ToThreeVector3(player.position),
      speed: Config.DEFAULT_PLAYER_SPEED,
      velocity: rawVector3ToThreeVector3(player.velocity),
      width: Config.PLAYER_WIDTH,
      yaw: player.yaw,
    }

    this.camera.position.copy(player.position)
    this.camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ')

    this.world = new World(this.player, minecraft.eventQueue, this.scene, {
      blockRegistry: minecraft.blocksRegistry,
      initialChunksFromServer,
    })

    this.controls = new FPSControls(minecraft.getGUI(), this)

    this.raycaster = new Raycaster(this.camera, this.player, this.scene, this.world)

    this.startPlayerSync()
  }

  addOnDisposeCallback(callback: () => void): void {
    this.additionalOnDisposeCallbacks.push(callback)
  }

  dispose(): void {
    window.removeEventListener('resize', this.onResize)
    this.world.dispose()
    this.renderer.dispose()
    this.scene.clear()

    if (this.lastTimeout) {
      clearTimeout(this.lastTimeout)
    }

    for (const callback of this.additionalOnDisposeCallbacks) {
      callback()
    }

    this.disposed = true
  }

  enterGameLoop() {
    const frame = () => {
      if (this.disposed) {
        return
      }

      this.handleGameFrame()

      requestAnimationFrame(frame)
    }

    requestAnimationFrame(frame)
  }

  getDelta(): number {
    return this.delta
  }

  private handleGameFrame() {
    if (this.minecraft.getGUI().state.isPaused) {
      return
    }

    if (this.isGameLoopClockStopped) {
      this.gameLoopClock.start()
      this.isGameLoopClockStopped = false
    }

    this.delta = this.gameLoopClock.getDelta()

    this.frameCounter.lastTime += this.delta
    this.frameCounter.totalTime += this.delta
    this.frameCounter.lastFrames++
    this.frameCounter.totalFrames++

    if (this.frameCounter.lastTime >= 1) {
      this.frameCounter.fps = this.frameCounter.lastFrames
      this.frameCounter.lastFrames = 0
      this.frameCounter.lastTime = 0
    }

    /**
     * UPDATE GAME STATE HERE
     */
    this.controls.update()
    this.world.update()
    this.raycaster.update()

    /**
     * RENDERING CODE HERE
     */
    this.renderer.render(this.scene, this.camera)
  }

  private startPlayerSync(): void {
    this.lastTimeout = setTimeout(() => this.syncPlayer(), 1000)
  }

  private async syncPlayer(): Promise<void> {
    if (this.minecraft.getGUI().state.isPaused) {
      this.startPlayerSync()
      return
    }

    if (this.disposed || this.syncying) {
      console.log('Skipping syncPlayer because disposed or syncying')
      return
    }

    try {
      this.syncying = true
      await this.minecraft.eventQueue.emitAndWaitResponse(
        'Client.RequestSyncPlayer',
        {
          playerData: {
            canJump: this.player.canJump,
            direction: threeVector3ToRawVector3(this.player.direction),
            jumpStrength: this.player.jumpStrength,
            pitch: this.player.pitch,
            position: threeVector3ToRawVector3(this.player.position),
            uuid: this.playerUUID,
            velocity: threeVector3ToRawVector3(this.player.velocity),
            yaw: this.player.yaw,
          },
        },
        'Server.ResponseSyncPlayer',
      )
    } finally {
      this.syncying = false
      this.startPlayerSync()
    }
  }
}
