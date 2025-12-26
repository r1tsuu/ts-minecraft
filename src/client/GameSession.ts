import * as THREE from 'three'

import type { DatabaseChunkData, DatabasePlayerData } from '../server/WorldDatabase.ts'
import type { UUID } from '../types.ts'
import type { MinecraftClient } from './MinecraftClient.ts'

import { MinecraftEventQueue } from '../queue/MinecraftQueue.ts'
import { Config } from '../shared/Config.ts'
import { Scheduler } from '../shared/Scheduler.ts'
import { ClientPlayerManager } from './ClientPlayerManager.ts'
import { InputManager } from './InputManager.ts'
import { Player } from './Player.ts'
import { Raycaster } from './Raycaster.ts'
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
      initialPlayerFromServer,
    }: {
      initialChunksFromServer: DatabaseChunkData[]
      initialPlayerFromServer: DatabasePlayerData
    },
  ) {
    this.playerUUID = initialPlayerFromServer.uuid
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
      initialPlayerFromServer.uuid,
      THREE.Vector3.fromRaw(initialPlayerFromServer.position),
      THREE.Vector3.fromRaw(initialPlayerFromServer.velocity),
      new THREE.Euler(
        initialPlayerFromServer.rotation.x,
        initialPlayerFromServer.rotation.y,
        0,
        Config.EULER_ORDER,
      ),
      minecraft,
    )

    this.world = new World(this.player, minecraft.eventQueue, this.scene, {
      blockRegistry: minecraft.blocksRegistry,
      initialChunksFromServer,
    })

    this.clientPlayerManager = new ClientPlayerManager(minecraft)
    this.inputManager = new InputManager(this)

    this.raycaster = new Raycaster(this.camera, this.player, this.scene, this.world)
    minecraft.scheduler.registerInstance(this)
    minecraft.eventQueue.registerHandlers(this)
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
    MinecraftEventQueue.unregisterHandlers(this)

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

  @MinecraftEventQueue.Handler('Client.PauseToggle')
  protected onPauseToggle(): void {
    this.paused = !this.paused
  }

  @Scheduler.Every(1000)
  protected async syncPlayer(): Promise<void> {
    if (this.paused) {
      return
    }

    await this.minecraft.eventQueue.emitAndWaitResponse(
      'Client.RequestSyncPlayer',
      {
        playerData: {
          position: this.player.position.toRaw(),
          rotation: {
            x: this.player.rotation.x,
            y: this.player.rotation.y,
          },
          uuid: this.playerUUID,
          velocity: this.player.velocity.toRaw(),
        },
      },
      'Server.ResponseSyncPlayer',
    )
  }

  private handleGameFrame() {
    if (this.paused) {
      this.gameLoopClock.stop()
      this.isGameLoopClockStopped = true
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
    this.clientPlayerManager.update()
    this.player.update()
    this.world.update()
    this.raycaster.update()

    this.camera.position.copy(this.player.position)
    this.camera.rotation.copy(this.player.rotation)

    /**
     * RENDERING CODE HERE
     */
    this.renderer.render(this.scene, this.camera)

    this.inputManager.resetMouseDelta()
  }
}
