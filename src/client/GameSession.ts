import * as THREE from 'three'

import type { DatabaseChunkData, DatabasePlayerData } from '../server/WorldDatabase.ts'
import type { ContainerScope } from '../shared/Container.ts'

import { Config } from '../shared/Config.ts'
import { MinecraftEventBus } from '../shared/MinecraftEventBus.ts'
import { Scheduler } from '../shared/Scheduler.ts'
import { isComponent, type UUID } from '../types.ts'
import { ClientContainer } from './ClientContainer.ts'
import { ClientPlayerManager } from './ClientPlayerManager.ts'
import { GUI } from './gui/GUI.ts'
import { InputManager } from './InputManager.ts'
import { Player } from './Player.ts'
import { Raycaster } from './Raycaster.ts'
import { World } from './World.ts'

@MinecraftEventBus.ClientListener()
@Scheduler.ClientSchedulable()
export class GameSession {
  frameCounter = {
    fps: 0,
    lastFrames: 0,
    lastTime: 0,
    totalFrames: 0,
    totalTime: 0,
  }

  paused = false
  playerUUID: UUID

  scope: ContainerScope
  private additionalOnDisposeCallbacks: Array<() => void> = []
  private delta: number = 0
  private disposed = false
  private gameLoopClock = new THREE.Clock()
  private isGameLoopClockStopped = false
  private lastTimeout: null | number = null

  constructor(
    initialChunksFromServer: DatabaseChunkData[],
    initialPlayerFromServer: DatabasePlayerData,
  ) {
    this.playerUUID = initialPlayerFromServer.uuid

    const scope = ClientContainer.createScope(this)
    this.scope = scope

    scope.registerSingleton(new THREE.Scene())

    const renderer = scope.registerSingleton(
      new THREE.WebGLRenderer({
        antialias: false,
        canvas: ClientContainer.resolve(GUI).unwrap().getCanvas(),
        powerPreference: 'high-performance',
      }),
    )

    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.0

    const camera = scope.registerSingleton(
      new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000),
    )

    camera.position.set(0, 40, 0)
    camera.lookAt(30, 35, 30)

    scope.register(
      new Player(
        initialPlayerFromServer.uuid,
        THREE.Vector3.fromRaw(initialPlayerFromServer.position),
        THREE.Vector3.fromRaw(initialPlayerFromServer.velocity),
        new THREE.Euler(
          initialPlayerFromServer.rotation.x,
          initialPlayerFromServer.rotation.y,
          0,
          Config.EULER_ORDER,
        ),
      ),
      {
        uuid: initialPlayerFromServer.uuid,
      },
    )

    scope.registerSingleton(new World(initialChunksFromServer))
    scope.registerSingleton(new ClientPlayerManager())
    scope.registerSingleton(new InputManager())
    scope.registerSingleton(new Raycaster())
  }

  addOnDisposeCallback(callback: () => void): void {
    this.additionalOnDisposeCallbacks.push(callback)
  }

  dispose(): void {
    for (const child of this.scope.listChildren()) {
      if (isComponent(child)) {
        child.dispose()
      }
    }

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

  getCurrentPlayer(): Player {
    return ClientContainer.resolve<Player>(this.playerUUID).unwrap()
  }

  getDelta(): number {
    return this.delta
  }

  @MinecraftEventBus.Handler('Client.PauseToggle')
  protected onPauseToggle(): void {
    this.paused = !this.paused
  }

  @Scheduler.Every(1000)
  protected async syncPlayer(): Promise<void> {
    if (this.paused) {
      return
    }

    const player = this.getCurrentPlayer()
    await ClientContainer.resolve(MinecraftEventBus)
      .unwrap()
      .request(
        'Client.RequestSyncPlayer',
        {
          playerData: {
            position: player.position.toRaw(),
            rotation: {
              x: player.rotation.x,
              y: player.rotation.y,
            },
            uuid: this.playerUUID,
            velocity: player.velocity.toRaw(),
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
    for (const child of this.scope.listChildren()) {
      if (typeof child.update === 'function') {
        child.update()
      }
    }

    // Sync camera with player
    const camera = ClientContainer.resolve(THREE.PerspectiveCamera).unwrap()
    const player = this.getCurrentPlayer()
    camera.position.copy(player.position)
    camera.rotation.copy(player.rotation)

    /**
     * RENDERING CODE HERE
     */
    ClientContainer.resolve(THREE.WebGLRenderer)
      .unwrap()
      .render(ClientContainer.resolve(THREE.Scene).unwrap(), camera)

    ClientContainer.resolve(InputManager).unwrap().resetMouseDelta()
  }
}
