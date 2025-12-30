import * as THREE from 'three'

import type { MinecraftClient } from './MinecraftClient.ts'

import { Entity, type EntityConstructor } from '../shared/entities/Entity.ts'
import { Player } from '../shared/entities/Player.ts'
import { PauseToggle } from '../shared/events/client/PauseToggle.ts'
import { HashMap } from '../shared/HashMap.ts'
import { Listener, MinecraftEventBus } from '../shared/MinecraftEventBus.ts'
import { pipe } from '../shared/Pipe.ts'
import { Schedulable } from '../shared/Scheduler.ts'
import { SystemRegistry } from '../shared/System.ts'
import { World } from '../shared/World.ts'
import { InputManager } from './InputManager.ts'
import { ClientPlayerControlSystem } from './systems/ClientPlayerControlSystem.ts'
import { PlayerUpdateSystem } from './systems/PlayerUpdateSystem.ts'
import { RaycastingSystem } from './systems/RaycastingSystem.ts'

@Listener()
@Schedulable()
export class GameLoop {
  readonly camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  )

  readonly frameCounter = {
    fps: 0,
    lastFrames: 0,
    lastTime: 0,
    totalFrames: 0,
    totalTime: 0,
  }

  readonly inputManager = new InputManager(this)

  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly systemRegistry = new SystemRegistry()
  private clientPlayer: Player
  private delta: number = 0
  private disposed = false
  private gameLoopClock = new THREE.Clock()

  private isGameLoopClockStopped = false
  private lastTimeout: null | number = null

  private paused = false

  constructor(
    private readonly client: MinecraftClient,
    readonly world: World,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      canvas: this.client.gui.getCanvas(),
      powerPreference: 'high-performance',
    })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.0
    this.renderer.shadowMap.enabled = false // Disable shadows for performance
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)) // Cap pixel ratio

    this.clientPlayer = pipe(this.client.localStorageManager.getPlayerUUID())
      .map((uuid) => this.world.getEntity(uuid, Player))
      .value()
      .unwrap()

    const playerUpdate = this.systemRegistry.registerSystem(new PlayerUpdateSystem(this))
    const raycastingSystem = this.systemRegistry.registerSystem(new RaycastingSystem(this))

    this.systemRegistry.registerSystem(
      new ClientPlayerControlSystem(
        this,
        this.client.blocksRegistry,
        playerUpdate,
        raycastingSystem,
      ),
    )
  }

  dispose(): void {
    this.inputManager.dispose()
    this.renderer.dispose()
    this.scene.clear()
    this.systemRegistry.unregisterAllSystems()

    if (this.lastTimeout) {
      clearTimeout(this.lastTimeout)
    }

    this.disposed = true
  }

  execute() {
    const frame = () => {
      if (this.disposed) {
        return
      }

      this.handleGameFrame()

      requestAnimationFrame(frame)
    }

    requestAnimationFrame(frame)
  }

  getClientPlayer(): Player {
    return this.clientPlayer
  }

  getDelta(): number {
    return this.delta
  }

  isFirstFrame(): boolean {
    return this.frameCounter.totalFrames === 1
  }

  isPaused(): boolean {
    return this.paused
  }

  @MinecraftEventBus.Handler(PauseToggle)
  protected onPauseToggle(): void {
    this.paused = !this.paused
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

    const collectedEntities = new HashMap<EntityConstructor, Entity[]>()

    const fetchEntities = (EntityConstructor: EntityConstructor): Entity[] => {
      if (!collectedEntities.has(EntityConstructor)) {
        const entities = pipe(this.world.query().select(EntityConstructor).execute())
          .mapIter((each) => each.entity)
          .collectArray()
          .value()

        collectedEntities.set(EntityConstructor, entities)
      }

      return collectedEntities.get(EntityConstructor).unwrap()
    }

    // UPDATE SYSTEMS WITH ENTITY ARGUMENTS, FOR EXAMPLE: PLAYER MOVEMENT, PHYSICS, ETC.
    for (const { Constructor: EntityConstructor } of Entity.iterEntityConstructors()) {
      const systems = this.systemRegistry.iterUpdateSystemsForEntity(EntityConstructor)

      for (const { method, system } of systems) {
        const entities = fetchEntities(EntityConstructor)

        // @ts-expect-error
        if (method in system && typeof system[method] === 'function') {
          // @ts-expect-error
          system[method](entities)
        } else {
          throw new Error(`Method ${String(method)} not found in system ${system.constructor.name}`)
        }
      }
    }

    // UPDATE SYSTEMS WITHOUT ENTITY ARGUMENTS, FOR EXAMPLE: INPUT, CAMERA CONTROLS, ETC.
    for (const { method, system } of this.systemRegistry.iterUpdateSystems()) {
      // @ts-expect-error
      if (method in system && typeof system[method] === 'function') {
        // @ts-expect-error
        system[method]()
      } else {
        throw new Error(`Method ${String(method)} not found in system ${system.constructor.name}`)
      }
    }

    // Sync camera with player

    this.camera.position.copy(this.clientPlayer.position)
    this.camera.rotation.copy(this.clientPlayer.rotation)

    // Reset mouse delta each frame
    this.inputManager.resetMouseDelta()

    // RENDER SYSTEMS WITH ENTITY ARGUMENTS, FOR EXAMPLE: RENDERABLE ENTITIES
    for (const { Constructor: EntityConstructor } of Entity.iterEntityConstructors()) {
      const systems = this.systemRegistry.iterRenderSystemsForEntity(EntityConstructor)

      for (const { method, system } of systems) {
        const entities = fetchEntities(EntityConstructor)

        // @ts-expect-error
        if (method in system && typeof system[method] === 'function') {
          // @ts-expect-error
          system[method](entities)
        } else {
          throw new Error(`Method ${String(method)} not found in system ${system.constructor.name}`)
        }
      }
    }

    // RENDER SYSTEMS WITHOUT ENTITY ARGUMENTS, FOR EXAMPLE: POST-PROCESSING, ETC.
    for (const { method, system } of this.systemRegistry.getRenderSystems()) {
      // @ts-expect-error
      if (method in system && typeof system[method] === 'function') {
        // @ts-expect-error
        system[method]()
      } else {
        throw new Error(`Method ${String(method)} not found in system ${system.constructor.name}`)
      }
    }

    // FINAL RENDER CALL
    this.renderer.render(this.scene, this.camera)
  }
}
