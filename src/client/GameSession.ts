import * as THREE from 'three'

import type { DatabaseChunkData, DatabasePlayerData } from '../server/WorldDatabase.ts'
import type { UUID } from '../types.ts'
import type { MinecraftClient } from './MinecraftClient.ts'

import { Config } from '../shared/Config.ts'
import { Scheduler } from '../shared/Scheduler.ts'
import { ClientPlayerManager } from './ClientPlayerManager.ts'
import { InputManager } from './InputManager.ts'
import { Player } from './Player.ts'
import { Raycaster } from './Raycaster.ts'
import { rawVector3ToThreeVector3, threeVector3ToRawVector3 } from './utils.ts'
import { World } from './World.ts'

export class GameSession {
  camera: THREE.PerspectiveCamera
  clientPlayerManager: ClientPlayerManager
  frameCounter = {
    fps: 0,
    lastFrames: 0,
    lastTime: 0,
    totalFrames: 0,
    totalTime: 0,
  }
  inputManager: InputManager
  paused = false
  player: Player
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

    this.player = new Player(
      player.uuid,
      rawVector3ToThreeVector3(player.position),
      new THREE.Vector3(0, 0, 0),
      rawVector3ToThreeVector3(player.velocity),
      new THREE.Euler(player.rotation.x, player.rotation.y, 0, Config.EULER_ORDER),
      minecraft,
    )

    this.world = new World(this.player, minecraft.eventQueue, this.scene, {
      blockRegistry: minecraft.blocksRegistry,
      initialChunksFromServer,
    })

    this.clientPlayerManager = new ClientPlayerManager(minecraft)
    this.inputManager = new InputManager(minecraft)

    this.raycaster = new Raycaster(this.camera, this.player, this.scene, this.world)
    minecraft.scheduler.registerInstance(this)
  }

  addOnDisposeCallback(callback: () => void): void {
    this.additionalOnDisposeCallbacks.push(callback)
  }

  dispose(): void {
    window.removeEventListener('resize', this.onResize)
    this.world.dispose()
    this.renderer.dispose()
    this.scene.clear()
    this.clientPlayerManager.dispose()
    this.inputManager.dispose()

    if (this.lastTimeout) {
      clearTimeout(this.lastTimeout)
    }

    for (const callback of this.additionalOnDisposeCallbacks) {
      callback()
    }

    this.minecraft.scheduler.unregisterInstance(this)

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

  @Scheduler.Every(1000)
  protected async syncPlayer(): Promise<void> {
    if (this.minecraft.getGUI().state.isPaused) {
      return
    }

    await this.minecraft.eventQueue.emitAndWaitResponse(
      'Client.RequestSyncPlayer',
      {
        playerData: {
          direction: threeVector3ToRawVector3(this.player.direction),
          position: threeVector3ToRawVector3(this.player.position),
          rotation: {
            x: this.player.rotation.x,
            y: this.player.rotation.y,
          },
          uuid: this.playerUUID,
          velocity: threeVector3ToRawVector3(this.player.velocity),
        },
      },
      'Server.ResponseSyncPlayer',
    )
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
    this.player.update()
    this.world.update()
    this.raycaster.update()

    this.camera.position.copy(this.player.position)
    this.camera.rotation.copy(this.player.rotation)

    /**
     * RENDERING CODE HERE
     */
    this.renderer.render(this.scene, this.camera)
  }
}
