/* eslint-disable perfectionist/sort-modules */
/* eslint-disable perfectionist/sort-interfaces */
import type { EventConstructor } from '../../shared/EventBus.ts'
import type { MinecraftEvent } from '../../shared/MinecraftEvent.ts'
import type { Callback } from '../../shared/util.ts'
import type { World } from '../../shared/World.ts'
import type { GameLoop } from '../GameLoop.ts'
import type { MinecraftClient } from '../MinecraftClient.ts'

import { type Entity, type EntityConstructor } from '../../shared/entities/Entity.ts'

export type System<Name extends string, Extra extends Record<string, unknown> = {}> = {
  readonly name: Name
} & Extra

export interface SystemFactory<K extends string, Extra extends Record<string, unknown>> {
  (ctx: SystemFactoryContext): System<K, Extra>
}

export const createSystemFactory = <Name extends string, Extra extends Record<string, unknown>>(
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
  factory: SystemFactory<Name, Extra>,
): SystemFactory<Name, Extra> => {
  return factory
}

export interface SystemFactoryContext extends EngineContext {
  /**
   * Registers a callback to be called on specific lifecycle events of the system
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
}

export interface EngineContext {
  /**
   * The Minecraft client instance
   */
  readonly client: MinecraftClient
  /**
   * The world instance the system operates on
   */
  readonly world: World
  /**
   * The main game loop instance
   */
  readonly gameLoop: GameLoop
}
