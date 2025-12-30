import * as THREE from 'three'

import type { ContainerScope } from '../shared/Container.ts'

import { isComponent } from '../shared/Component.ts'
import { Entity, type EntityConstructor } from '../shared/entities/Entity.ts'
import { Player } from '../shared/entities/Player.ts'
import { PauseToggle } from '../shared/events/client/PauseToggle.ts'
import { HashMap } from '../shared/HashMap.ts'
import { Maybe } from '../shared/Maybe.ts'
import { MinecraftEventBus } from '../shared/MinecraftEventBus.ts'
import { pipe } from '../shared/Pipe.ts'
import { Scheduler } from '../shared/Scheduler.ts'
import { SystemRegistry } from '../shared/System.ts'
import { World } from '../shared/World.ts'
import { ClientContainer } from './ClientContainer.ts'
import { GUI } from './gui/GUI.ts'
import { InputManager } from './InputManager.ts'
import { LocalStorageManager } from './LocalStorageManager.ts'
import { PlayerUpdateSystem } from './systems/PlayerUpdateSystem.ts'
import { RaycastingSystem } from './systems/RaycastingSystem.ts'
import { SessionPlayerControlSystem } from './systems/SessionPlayerControlSystem.ts'

@MinecraftEventBus.ClientListener()
@Scheduler.ClientSchedulable()
export class GameSession {
  readonly frameCounter = {
    fps: 0,
    lastFrames: 0,
    lastTime: 0,
    totalFrames: 0,
    totalTime: 0,
  }

  paused = false

  readonly scope: ContainerScope = pipe(ClientContainer.createScope())
    .tap((scope) => {
      const renderer = scope.registerSingleton(
        new THREE.WebGLRenderer({
          antialias: false,
          canvas: scope.resolve(GUI).unwrap().getCanvas(),
          powerPreference: 'high-performance',
        }),
      )

      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.0
      renderer.shadowMap.enabled = false // Disable shadows for performance
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)) // Cap pixel ratio

      scope.registerSingleton(
        new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000),
      )

      scope.registerSingleton(new THREE.Scene())
      scope.registerSingleton(new SystemRegistry(scope))
      scope.registerSingleton(new InputManager())
    })
    .value()

  private readonly camera = ClientContainer.resolve(THREE.PerspectiveCamera).unwrap()
  private delta: number = 0
  private disposed = false
  private gameLoopClock = new THREE.Clock()
  private readonly inputManager = ClientContainer.resolve(InputManager).unwrap()
  private isGameLoopClockStopped = false
  private lastTimeout: null | number = null
  private readonly renderer = ClientContainer.resolve(THREE.WebGLRenderer).unwrap()

  private readonly scene = ClientContainer.resolve(THREE.Scene).unwrap()
  private sessionPlayer: Player

  private readonly systemRegistry = pipe(ClientContainer.resolve(SystemRegistry))
    .map(Maybe.Unwrap)
    .tap((registry) => {
      registry.registerSystem(new PlayerUpdateSystem())
      registry.registerSystem(new RaycastingSystem())
      registry.registerSystem(new SessionPlayerControlSystem())
    })
    .value()

  private readonly world: World

  constructor(initialWorldFromServer: World) {
    this.world = this.scope.registerSingleton(initialWorldFromServer)

    const localStorageManager = ClientContainer.resolve(LocalStorageManager).unwrap()

    this.sessionPlayer = pipe(localStorageManager.getPlayerUUID())
      .map((playerUUID) => this.world.getEntity(playerUUID, Player))
      .value()
      .unwrap()
  }

  dispose(): void {
    for (const child of this.scope.iterateInstances()) {
      if (isComponent(child) || child instanceof THREE.WebGLRenderer) {
        child.dispose()
      }

      if (child instanceof THREE.Scene) {
        console.log('Disposing scene and its children')
        child.clear()
      }
    }

    if (this.lastTimeout) {
      clearTimeout(this.lastTimeout)
    }

    this.scope.destroyScope()

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

  getSessionPlayer(): Player {
    return this.sessionPlayer
  }

  isFirstFrame(): boolean {
    return this.frameCounter.totalFrames === 1
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

    this.camera.position.copy(this.sessionPlayer.position)
    this.camera.rotation.copy(this.sessionPlayer.rotation)

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
