import * as THREE from 'three'

import type { EventConstructor } from '../shared/EventBus.ts'
import type { MinecraftEvent } from '../shared/MinecraftEvent.ts'
import type { Callback } from '../shared/util.ts'
import type { MinecraftClient } from './MinecraftClient.ts'

import { Entity, type EntityConstructor } from '../shared/entities/Entity.ts'
import { Player } from '../shared/entities/Player.ts'
import { PauseToggle } from '../shared/events/client/PauseToggle.ts'
import { HashMap } from '../shared/HashMap.ts'
import { Maybe } from '../shared/Maybe.ts'
import { pipe } from '../shared/Pipe.ts'
import { World } from '../shared/World.ts'
import { InputManager } from './InputManager.ts'
import { chunkRenderingSystemFactory } from './systems/ChunkRenderingSystem.ts'
import { createClientPlayerControlSystemFactory } from './systems/ClientPlayerControlSystem.ts'
import {
  type System,
  type SystemFactory,
  type SystemFactoryContext,
} from './systems/createSystem.ts'
import { playerUpdateSystemFactory } from './systems/PlayerUpdateSystem.ts'
import { raycastingSystemFactory } from './systems/RaycastingSystem.ts'

export type OnEvent<E extends MinecraftEvent> = {
  EventConstructor: EventConstructor<E>
  handler: (event: E) => void
}

export type OnRenderBatch<T extends Entity> = (entities: T[]) => void

export type OnRenderEach<T extends Entity> = (entity: T) => void

export type OnUpdateBatch<T extends Entity> = (entities: T[]) => void

export type OnUpdateEach<T extends Entity> = (entity: T) => void

export interface SystemFactoryContextData {
  dispose: Set<Callback>
  eventHandlers: HashMap<EventConstructor<MinecraftEvent>, OnEvent<MinecraftEvent>>
  init: Set<Callback>
  render: Set<Callback>
  renderBatch: HashMap<EntityConstructor, OnRenderBatch<Entity>>
  renderEach: HashMap<EntityConstructor, OnRenderEach<Entity>>
  updateBatch: HashMap<EntityConstructor, OnUpdateBatch<Entity>>
  updateEach: HashMap<EntityConstructor, OnUpdateEach<Entity>>
  updates: Set<Callback>
}

export interface SystemInRegistry {
  factoryData: SystemFactoryContextData
  system: System<string>
}

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
  private clientPlayer: Player
  private delta: number = 0
  private disposed = false
  private gameLoopClock = new THREE.Clock()
  private isGameLoopClockStopped = false

  private lastTimeout: null | number = null
  private paused = false

  private systems: HashMap<string, SystemInRegistry> = new HashMap()
  private systemsUnsubscriptions: Callback[] = []

  constructor(
    private client: MinecraftClient,
    readonly world: World,
  ) {
    // SETUP RENDERER HERE
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

    client.eventBus.subscribe(PauseToggle, () => (this.paused = !this.paused))

    // FETCH CLIENT PLAYER ENTITY
    this.clientPlayer = pipe(this.client.localStorageManager.getPlayerUUID())
      .map((uuid) => this.world.getEntity(uuid, Player))
      .value()
      .unwrap()

    // REGISTER SYSTEMS HERE
    this.registerSystem(chunkRenderingSystemFactory)
    const raycastingSystem = this.registerSystem(raycastingSystemFactory)
    const playerUpdateSystem = this.registerSystem(playerUpdateSystemFactory)
    this.registerSystem(
      createClientPlayerControlSystemFactory({ playerUpdateSystem, raycastingSystem }),
    )

    // INIT SYSTEMS
    for (const init of this.iterInitFunctions()) {
      init()
    }

    // SETUP EVENT LISTENERS
    for (const { EventConstructor, handler } of this.iterEventHandlers()) {
      const unsubscribe = client.eventBus.subscribe(EventConstructor, handler)
      this.systemsUnsubscriptions.push(unsubscribe)
    }
  }

  dispose(): void {
    // DISPOSE NON SYSTEM COMPONENTS
    this.inputManager.dispose()
    this.renderer.dispose()
    this.scene.clear()

    // UNSUBSCRIBE EVENT LISTENERS
    for (const unsubscribe of this.systemsUnsubscriptions) {
      unsubscribe()
    }

    // DISPOSE SYSTEMS
    for (const dispose of this.iterDisposeFunctions()) {
      dispose()
    }

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

  /**
   * Registers a new system in the game loop.
   * @param factory The system factory function.
   * @returns The created system instance.
   * @example
   * ```typescript
   * const mySystem = gameLoop.registerSystem((ctx) => {
   *   ctx.onUpdate(() => {
   *     // Update logic here
   *   })
   *
   *   return {
   *     name: 'MySystem',
   *   }
   * })
   * ```
   */
  registerSystem<T extends Record<string, unknown>>(factory: SystemFactory<string, T>): T {
    const systemData: SystemFactoryContextData = {
      dispose: new Set<Callback>(),
      eventHandlers: new HashMap<EventConstructor<MinecraftEvent>, OnEvent<MinecraftEvent>>(),
      init: new Set<Callback>(),
      render: new Set<Callback>(),
      renderBatch: new HashMap<EntityConstructor, OnRenderBatch<Entity>>(),
      renderEach: new HashMap<EntityConstructor, OnRenderEach<Entity>>(),
      updateBatch: new HashMap<EntityConstructor, OnUpdateBatch<Entity>>(),
      updateEach: new HashMap<EntityConstructor, OnUpdateEach<Entity>>(),
      updates: new Set<Callback>(),
    }

    const factoryCtx: SystemFactoryContext = {
      client: this.client,
      eventBus: this.client.eventBus,
      gameLoop: this,
      onDispose(disposeFn) {
        systemData.dispose.add(disposeFn)
      },
      onEvent(Event, handler) {
        systemData.eventHandlers.set(Event, {
          EventConstructor: Event,
          handler: handler as (event: MinecraftEvent) => void,
        })
      },
      onInit(initFn) {
        systemData.init.add(initFn)
      },
      onRender(renderFn) {
        systemData.render.add(renderFn)
      },
      onRenderBatch(EntityConstructor, renderFn) {
        systemData.renderBatch.set(EntityConstructor, renderFn as OnRenderBatch<Entity>)
      },
      onRenderEach(EntityConstructor, renderFn) {
        systemData.renderEach.set(EntityConstructor, renderFn as OnRenderEach<Entity>)
      },
      onUpdate(updateFn) {
        systemData.updates.add(updateFn)
      },
      onUpdateBatch(EntityConstructor, updateFn) {
        systemData.updateBatch.set(EntityConstructor, updateFn as OnUpdateBatch<Entity>)
      },
      onUpdateEach(EntityConstructor, updateFn) {
        systemData.updateEach.set(EntityConstructor, updateFn as OnUpdateEach<Entity>)
      },
      world: this.world,
    }

    const system = factory(factoryCtx)

    if (this.systems.has(system.name)) {
      throw new Error(`System with name "${system.name}" is already registered.`)
    }

    this.systems.set(system.name, {
      factoryData: systemData,
      system,
    })

    console.log(`Registered system: ${system.name}`)

    return system as unknown as T
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
      const entities = fetchEntities(EntityConstructor)
      for (const updateBatch of this.iterUpdateBatchFunctions(EntityConstructor)) {
        updateBatch(entities)
      }

      for (const updateEach of this.iterUpdateEachFunctions(EntityConstructor)) {
        for (const entity of entities) {
          updateEach(entity)
        }
      }
    }

    for (const update of this.iterUpdateFunctions()) {
      update()
    }

    // UPDATE SYSTEMS WITHOUT ENTITY ARGUMENTS, FOR EXAMPLE: INPUT, CAMERA CONTROLS, ETC.
    for (const update of this.iterUpdateFunctions()) {
      update()
    }

    // Sync camera with player
    this.camera.position.copy(this.clientPlayer.position)
    this.camera.rotation.copy(this.clientPlayer.rotation)

    // Reset mouse delta each frame
    this.inputManager.resetMouseDelta()

    // RENDER SYSTEMS WITH ENTITY ARGUMENTS, FOR EXAMPLE: RENDERABLE ENTITIES
    for (const { Constructor: EntityConstructor } of Entity.iterEntityConstructors()) {
      for (const renderBatch of this.iterRenderBatchFunctions(EntityConstructor)) {
        const entities = fetchEntities(EntityConstructor)
        renderBatch(entities)
      }

      for (const renderEach of this.iterRenderEachFunctions(EntityConstructor)) {
        const entities = fetchEntities(EntityConstructor)
        for (const entity of entities) {
          renderEach(entity)
        }
      }
    }

    for (const render of this.iterRenderFunctions()) {
      render()
    }

    // FINAL RENDER CALL TO RENDER THE SCENE
    this.renderer.render(this.scene, this.camera)
  }

  private iterDisposeFunctions(): Iterable<Callback> {
    return Iterator.from(this.systems.values()).flatMap(({ factoryData }) => factoryData.dispose)
  }

  private iterEventHandlers(): Iterable<OnEvent<MinecraftEvent>> {
    return Iterator.from(this.systems.values())
      .flatMap(({ factoryData }) => factoryData.eventHandlers.values())
      .map((handler) => handler)
  }

  private iterInitFunctions(): Iterable<Callback> {
    return Iterator.from(this.systems.values()).flatMap(({ factoryData }) => factoryData.init)
  }

  private iterRenderBatchFunctions(
    EntityConstructor: EntityConstructor<any>,
  ): Iterable<OnRenderBatch<any>> {
    return Iterator.from(this.systems.values())
      .map(({ factoryData }) => factoryData.renderBatch.get(EntityConstructor))
      .filter(Maybe.IsSome)
      .map((maybe) => maybe.value())
  }

  private iterRenderEachFunctions(
    EntityConstructor: EntityConstructor<any>,
  ): Iterable<OnRenderEach<any>> {
    return Iterator.from(this.systems.values())
      .map(({ factoryData }) => factoryData.renderEach.get(EntityConstructor))
      .filter(Maybe.IsSome)
      .map((maybe) => maybe.value())
  }

  private iterRenderFunctions(): Iterable<Callback> {
    return Iterator.from(this.systems.values()).flatMap(({ factoryData }) => factoryData.render)
  }

  private iterUpdateBatchFunctions(
    EntityConstructor: EntityConstructor<any>,
  ): Iterable<OnUpdateBatch<any>> {
    return Iterator.from(this.systems.values())
      .map(({ factoryData }) => factoryData.updateBatch.get(EntityConstructor))
      .filter(Maybe.IsSome)
      .map((maybe) => maybe.value())
  }

  private iterUpdateEachFunctions(
    EntityConstructor: EntityConstructor<any>,
  ): Iterable<OnUpdateEach<any>> {
    return Iterator.from(this.systems.values())
      .map(({ factoryData }) => factoryData.updateEach.get(EntityConstructor))
      .filter(Maybe.IsSome)
      .map((maybe) => maybe.value())
  }

  private iterUpdateFunctions(): Iterable<Callback> {
    return Iterator.from(this.systems.values()).flatMap(({ factoryData }) => factoryData.updates)
  }
}
