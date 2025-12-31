import {
  ACESFilmicToneMapping,
  Clock,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three'

import type { EventConstructor } from '../shared/EventBus.ts'
import type { MinecraftEvent } from '../shared/MinecraftEvent.ts'
import type { Callback } from '../shared/util.ts'
import type { MinecraftClientContext } from './MinecraftClient.ts'

import { Entity, type EntityConstructor } from '../shared/entities/Entity.ts'
import { Player } from '../shared/entities/Player.ts'
import { PauseToggle } from '../shared/events/client/PauseToggle.ts'
import { HashMap } from '../shared/HashMap.ts'
import { Maybe } from '../shared/Maybe.ts'
import { pipe } from '../shared/Pipe.ts'
import { World } from '../shared/World.ts'
import { createInputManager } from './InputManager.ts'
import { chunkRenderingSystemFactory } from './systems/ChunkRenderingSystem.ts'
import { createClientPlayerControlSystemFactory } from './systems/ClientPlayerControlSystem.ts'
import {
  type System,
  type SystemFactory,
  type SystemFactoryContext,
} from './systems/createSystem.ts'
import { playerUpdateSystemFactory } from './systems/PlayerUpdateSystem.ts'
import { raycastingSystemFactory } from './systems/RaycastingSystem.ts'

export type FrameCounter = {
  fps: number
  lastFrames: number
  lastTime: number
  totalFrames: number
  totalTime: number
}

export interface GameLoop {
  dispose(): void
  execute(): void
  getClientPlayer(): Player
  getFrameCounter(): Readonly<FrameCounter>
  setRendererSize(width: number, height: number): void
}

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

export const createGameLoop = (ctx: MinecraftClientContext, world: World): GameLoop => {
  const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)

  const frameCounter = {
    fps: 0,
    lastFrames: 0,
    lastTime: 0,
    totalFrames: 0,
    totalTime: 0,
  }

  const scene = new Scene()

  let delta = 0
  let disposed = false
  const gameLoopClock = new Clock()
  let isGameLoopClockStopped = false
  let paused = false

  const systems: HashMap<string, SystemInRegistry> = new HashMap()
  const systemsUnsubscriptions: Callback[] = []

  // SETUP RENDERER HERE
  const renderer = new WebGLRenderer({
    antialias: false,
    canvas: ctx.gui.getCanvas(),
    powerPreference: 'high-performance',
  })
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  renderer.shadowMap.enabled = false // Disable shadows for performance
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)) // Cap pixel ratio

  // FETCH CLIENT PLAYER ENTITY
  const clientPlayer = pipe(ctx.localStorageManager.getPlayerUUID())
    .map((uuid) => world.getEntity(uuid, Player))
    .value()
    .unwrap()

  const inputManager = createInputManager(() => paused)

  const handleGameFrame = () => {
    if (paused) {
      gameLoopClock.stop()
      isGameLoopClockStopped = true
      return
    }

    if (isGameLoopClockStopped) {
      gameLoopClock.start()
      isGameLoopClockStopped = false
    }

    delta = gameLoopClock.getDelta()

    frameCounter.lastTime += delta
    frameCounter.totalTime += delta
    frameCounter.lastFrames++
    frameCounter.totalFrames++

    if (frameCounter.lastTime >= 1) {
      frameCounter.fps = frameCounter.lastFrames
      frameCounter.lastFrames = 0
      frameCounter.lastTime = 0
    }

    const collectedEntities = new HashMap<EntityConstructor, Entity[]>()

    const fetchEntities = (EntityConstructor: EntityConstructor): Entity[] => {
      if (!collectedEntities.has(EntityConstructor)) {
        const entities = pipe(world.query().select(EntityConstructor).execute())
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
      for (const updateBatch of Iterator.from(systems.values())
        .map(({ factoryData }) => factoryData.updateBatch.get(EntityConstructor))
        .filter(Maybe.IsSome)
        .map((maybe) => maybe.value())) {
        updateBatch(entities)
      }

      for (const updateEach of Iterator.from(systems.values())
        .map(({ factoryData }) => factoryData.updateEach.get(EntityConstructor))
        .filter(Maybe.IsSome)
        .map((maybe) => maybe.value())) {
        for (const entity of entities) {
          updateEach(entity)
        }
      }
    }

    // UPDATE SYSTEMS WITHOUT ENTITY ARGUMENTS, FOR EXAMPLE: INPUT, CAMERA CONTROLS, ETC.
    for (const update of Iterator.from(systems.values()).flatMap(
      ({ factoryData }) => factoryData.updates,
    )) {
      update()
    }

    // Sync camera with player
    camera.position.copy(clientPlayer.position)
    camera.rotation.copy(clientPlayer.rotation)

    // Reset mouse delta each frame
    inputManager.resetMouseDelta()

    // RENDER SYSTEMS WITH ENTITY ARGUMENTS, FOR EXAMPLE: RENDERABLE ENTITIES
    for (const { Constructor: EntityConstructor } of Entity.iterEntityConstructors()) {
      for (const renderBatch of Iterator.from(systems.values())
        .map(({ factoryData }) => factoryData.renderBatch.get(EntityConstructor))
        .filter(Maybe.IsSome)
        .map((maybe) => maybe.value())) {
        const entities = fetchEntities(EntityConstructor)
        renderBatch(entities)
      }

      for (const renderEach of Iterator.from(systems.values())
        .map(({ factoryData }) => factoryData.renderEach.get(EntityConstructor))
        .filter(Maybe.IsSome)
        .map((maybe) => maybe.value())) {
        const entities = fetchEntities(EntityConstructor)
        for (const entity of entities) {
          renderEach(entity)
        }
      }
    }

    for (const render of Iterator.from(systems.values()).flatMap(
      ({ factoryData }) => factoryData.render,
    )) {
      render()
    }

    // FINAL RENDER CALL TO RENDER THE SCENE
    renderer.render(scene, camera)
  }

  const subscriptions: Callback[] = []
  subscriptions.push(ctx.eventBus.subscribe(PauseToggle, () => (paused = !paused)))

  const dispose = () => {
    // DISPOSE NON SYSTEM COMPONENTS
    inputManager.dispose()
    renderer.dispose()
    scene.clear()

    // UNSUBSCRIBE EVENT LISTENERS
    for (const unsubscribe of systemsUnsubscriptions) {
      unsubscribe()
    }

    // DISPOSE SYSTEMS
    for (const dispose of Iterator.from(systems.values()).flatMap(
      ({ factoryData }) => factoryData.dispose,
    )) {
      dispose()
    }

    for (const unsubscribe of subscriptions) {
      unsubscribe()
    }

    disposed = true
  }

  const execute = () => {
    const frame = () => {
      if (disposed) {
        return
      }

      handleGameFrame()

      requestAnimationFrame(frame)
    }

    requestAnimationFrame(frame)
  }

  const getClientPlayer = () => clientPlayer

  const registerSystem = <T extends Record<string, unknown>>(
    factory: SystemFactory<string, T>,
  ): T => {
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
      blocksRegistry: ctx.blocksRegistry,
      camera,
      clientBlocksRegistry: ctx.clientBlocksRegistry,
      eventBus: ctx.eventBus,
      getClientPlayer: () => clientPlayer,
      getDelta: () => delta,
      gui: ctx.gui,
      inputManager,
      isFirstFrame: () => frameCounter.totalFrames === 1,
      localStorageManager: ctx.localStorageManager,
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
      renderer,
      scene,
      singlePlayerWorker: ctx.singlePlayerWorker,
      world,
    }

    const system = factory(factoryCtx)

    if (systems.has(system.name)) {
      throw new Error(`System with name "${system.name}" is already registered.`)
    }

    systems.set(system.name, {
      factoryData: systemData,
      system,
    })

    console.log(`Registered system: ${system.name}`)

    return system as unknown as T
  }

  // REGISTER SYSTEMS HERE
  registerSystem(chunkRenderingSystemFactory)
  const raycastingSystem = registerSystem(raycastingSystemFactory)
  const playerUpdateSystem = registerSystem(playerUpdateSystemFactory)
  registerSystem(createClientPlayerControlSystemFactory({ playerUpdateSystem, raycastingSystem }))

  // INIT SYSTEMS
  for (const init of Iterator.from(systems.values()).flatMap(
    ({ factoryData }) => factoryData.init,
  )) {
    init()
  }

  // SETUP EVENT LISTENERS
  for (const { EventConstructor, handler } of Iterator.from(systems.values())
    .flatMap(({ factoryData }) => factoryData.eventHandlers.values())
    .map((handler) => handler)) {
    const unsubscribe = ctx.eventBus.subscribe(EventConstructor, handler)
    systemsUnsubscriptions.push(unsubscribe)
  }

  return {
    dispose,
    execute,
    getClientPlayer,
    getFrameCounter: () => frameCounter,
    setRendererSize: (width, height) => {
      renderer.setSize(width, height)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    },
  }
}
