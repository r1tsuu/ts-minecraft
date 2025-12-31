/* eslint-disable perfectionist/sort-modules */
/* eslint-disable perfectionist/sort-interfaces */
import type { Camera, Scene, WebGLRenderer } from 'three'

import type { Player } from '../../shared/entities/Player.ts'
import type { EventConstructor } from '../../shared/EventBus.ts'
import type { MinecraftEvent } from '../../shared/MinecraftEvent.ts'
import type { MinecraftEventBus } from '../../shared/MinecraftEventBus.ts'
import type { Callback } from '../../shared/util.ts'
import type { World } from '../../shared/World.ts'
import type { InputManager } from '../InputManager.ts'
import type { MinecraftClientContext } from '../MinecraftClient.ts'

import { type Entity, type EntityConstructor } from '../../shared/entities/Entity.ts'

export interface System<Name extends string, API extends object = {}> {
  readonly name: Name
  readonly api?: API
}

export interface SystemFactory<Name extends string, API extends object = {}> {
  (ctx: SystemFactoryContext): System<Name, API>
}

/**
 * Creates a system factory for defining game systems.
 * @example
 * ```ts
 * const mySystemFactory = createSystemFactory((ctx) => {
 *  // System initialization logic here
 * return {
 *   name: 'MySystem',
 *  // Additional system properties and methods here
 * }
 * })
 */
export const createSystemFactory = <Name extends string, API extends object = {}>(
  /**
   * The factory function that creates the system instance
   * @example
   * ```ts
   * createSystemFactory((ctx) => {
   *   // System initialization logic here
   *   return {
   *     name: 'MySystem',
   *     // Additional system properties and methods here
   *   }
   * })
   * ```
   */
  factory: SystemFactory<Name, API>,
): SystemFactory<Name, API> => {
  return factory
}

/**
 * Context provided to the system factory function for creating systems.
 */
export interface SystemFactoryContext extends EngineContext {
  /**
   * Registers a callback to be called after every system is initialized
   * Here you are sure that all systems are initialized and can safely reference each other
   * @example
   * ```ts
   * ctx.onInit(() => {
   *   // Initialization logic here
   * })
   * ```
   */
  onInit(initFn: Callback): void
  /**
   * Registers a callback to be called when the system is disposed
   * @example
   * ```ts
   * ctx.onDispose(() => {
   *   // Cleanup logic here
   * })
   * ```
   */
  onDispose(disposeFn: Callback): void
  /**
   * Registers a callback to be called on each render or update cycle
   * depending on the method used
   * @example
   * ```ts
   * ctx.onUpdate(() => {
   *   // Logic to run on each update cycle
   * })
   * ```
   */
  onRender(renderFn: Callback): void
  /**
   * Registers a callback to be called on each render or update cycle for specific entity types
   * depending on the method used
   * @example
   * ```ts
   * ctx.onRenderEach(Player, (player) => {
   *   // Logic to run on each render cycle for Player entities
   * })
   * ```
   */
  onRenderEach<T extends Entity>(
    EntityConstructor: EntityConstructor<T>,
    renderFn: (entity: T) => void,
  ): void
  /**
   * Registers a callback to be called on each render or update cycle for batches of entities
   * depending on the method used
   * @example
   * ```ts
   * ctx.onRenderBatch(Chunk, (chunks) => {
   *   // Logic to run on each render cycle for batches of Chunk entities
   * })
   * ```
   */
  onRenderBatch<T extends Entity>(
    EntityConstructor: EntityConstructor<T>,
    renderFn: (entities: T[]) => void,
  ): void
  /**
   * Registers a callback to be called on each update cycle
   * @example
   * ```ts
   * ctx.onUpdate(() => {
   *   // Logic to run on each update cycle
   * })
   * ```
   */
  onUpdate(updateFn: Callback): void
  /**
   * Registers a callback to be called on each update cycle for specific entity types
   * @example
   * ```ts
   * ctx.onUpdateEach(Player, (player) => {
   *   // Logic to run on each update cycle for Player entities
   * })
   * ```
   */
  onUpdateEach<T extends Entity>(
    EntityConstructor: EntityConstructor<T>,
    updateFn: (entity: T) => void,
  ): void
  /**
   * Registers a callback to be called on each update cycle for batches of entities
   * @example
   * ```ts
   * ctx.onUpdateBatch(Chunk, (chunks) => {
   *   // Logic to run on each update cycle for batches of Chunk entities
   * })
   * ```
   */
  onUpdateBatch<T extends Entity>(
    EntityConstructor: EntityConstructor<T>,
    updateFn: (entities: T[]) => void,
  ): void
  /**
   * Registers a callback to be called when a specific event is emitted
   * @example
   * ```ts
   * ctx.onEvent(PauseToggle, (event) => {
   *   // Logic to run when PauseToggle event is emitted
   * })
   * ```
   */
  onEvent<E extends MinecraftEvent>(Event: EventConstructor<E>, handler: (event: E) => void): void
  /**
   * Registers a callback to be called at specified intervals
   * @example
   * ```ts
   * ctx.intervalTask(() => {
   *   // Logic to run at specified intervals
   * }, 1000) // Runs every 1000 milliseconds
   * ```
   * Automatically cleans up the interval when the system is disposed.
   */
  onInterval(taskFn: Callback, intervalMs: number): void
}

/**
 * Game Loop level context available to all systems.
 *
 */
export interface EngineContext extends Omit<MinecraftClientContext, 'getGameLoop'> {
  /**
   * The world instance the system operates on
   */
  readonly world: World
  /**
   * The event bus for emitting and listening to events.
   * For listening to events, prefer using `ctx.onEvent` method in the SystemFactoryContext since it automatically
   * handles unsubscription when the system is disposed.
   * Otherwise you must manually unsubscribe from events to prevent memory leaks in onDispose lifecycle method.
   */
  readonly eventBus: MinecraftEventBus
  /**
   * The THREE.js renderer used for rendering the game world
   */
  readonly renderer: WebGLRenderer
  /**
   * The THREE.js scene used for rendering the game world
   */
  readonly scene: Scene
  /**
   * The THREE.js camera used for rendering the game world
   */
  readonly camera: Camera
  /**
   * Gets the client player entity
   */
  getClientPlayer(): Player
  /**
   * Gets the time delta (in seconds) since the last frame
   */
  getDelta(): number
  /**
   * Returns true if it's the first frame of the game loop
   */
  isFirstFrame(): boolean
  /**
   * The input manager for handling player inputs
   */
  readonly inputManager: InputManager
}
