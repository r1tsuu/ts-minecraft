import type { EntityConstructor } from '../shared/entities/Entity.ts'

import { HashMap } from '../shared/HashMap.ts'
import { Maybe, Some } from '../shared/Maybe.ts'
import { pipe } from '../shared/Pipe.ts'
import { type ClassConstructor, getObjectConstructor } from '../shared/util.ts'

const updateSystemsMap = new Set<{
  method: string | symbol
  SystemConstructor: ClassConstructor<System>
}>()
const entityUpdateSystemsMap = new HashMap<
  EntityConstructor,
  Set<{ method: string | symbol; SystemConstructor: ClassConstructor<System> }>
>()
const entityRenderSystemsMap = new HashMap<
  EntityConstructor,
  Set<{ method: string | symbol; SystemConstructor: ClassConstructor<System> }>
>()

export abstract class System {
  /**
   * Decorator to mark a method as a render method for a specific entity type.
   * @example
   * ```ts
   * class MySystem extends System {
   *   @System.RenderAll(Player)
   *   renderAllPlayers(players: Player[]) {
   *     // Render logic for all players here
   *   }
   */
  static RenderAll(EntityConstructor: EntityConstructor) {
    return function (
      Constructor: ClassConstructor<System>,
      propertyKey: string | symbol,
      descriptor: PropertyDescriptor,
    ) {
      const maybeSystems = entityRenderSystemsMap.get(EntityConstructor)

      if (maybeSystems.isNone()) {
        entityRenderSystemsMap.set(EntityConstructor, new Set())
      }

      const systems = entityRenderSystemsMap.get(EntityConstructor).unwrap()

      systems.add({
        method: propertyKey as string,
        SystemConstructor: Constructor,
      })

      return descriptor
    }
  }

  /**
   * Decorator to mark a method as an update method for the system that runs every tick on a server or every frame on a client.
   * @example
   * ```ts
   * class MySystem extends System {
   *   @System.Update()
   *   update() {
   *     // Update logic here
   *   }
   * }
   * ```
   */
  static Update() {
    return function (
      SystemConstructor: ClassConstructor<System>,
      propertyKey: string | symbol,
      descriptor: PropertyDescriptor,
    ) {
      updateSystemsMap.add({
        method: propertyKey as string,
        SystemConstructor,
      })

      return descriptor
    }
  }

  /**
   * Decorator to mark a method as an update method for a specific entity type.
   * @example
   * ```ts
   * class MySystem extends System {
   *   @System.UpdateAll(Player)
   *   updateAllPlayers(players: Player[]) {
   *     // Update logic for all players here
   *   }
   * }
   * ```
   */
  static UpdateAll(EntityConstructor: EntityConstructor) {
    return function (
      SystemConstructor: ClassConstructor<System>,
      propertyKey: string | symbol,
      descriptor: PropertyDescriptor,
    ) {
      const maybeSystems = entityUpdateSystemsMap.get(EntityConstructor)

      if (maybeSystems.isNone()) {
        entityUpdateSystemsMap.set(EntityConstructor, new Set())
      }

      const systems = entityUpdateSystemsMap.get(EntityConstructor).unwrap()

      systems.add({
        method: propertyKey as string,
        SystemConstructor,
      })

      return descriptor
    }
  }
}

export class SystemRegistry {
  private instances: HashMap<ClassConstructor<System>, System> = new HashMap()

  constructor() {}

  /**
   * Get registered entity render systems for a specific entity type.
   * @example
   * ```ts
   * const playerRenderSystems = systemRegistry.getEntityRenderSystems(Player)
   * for (const { method, system } of playerRenderSystems) {
   *   system[method](players)
   * }
   * ```
   */
  getEntityRenderSystems(
    EntityConstructor: EntityConstructor,
  ): Iterable<{ method: string | symbol; system: System }> {
    return pipe(entityRenderSystemsMap.get(EntityConstructor))
      .map(Maybe.Unwrap)
      .mapIter(({ method, SystemConstructor }) => {
        const system = this.getSystem(SystemConstructor)
        return {
          method,
          system,
        }
      })
      .value()
  }

  /**
   * Get registered entity update systems for a specific entity type.
   * @example
   * ```ts
   * const playerUpdateSystems = systemRegistry.getEntityUpdateSystems(Player)
   * for (const { method, system } of playerUpdateSystems) {
   *   system[method](players)
   * }
   * ```
   */
  getEntityUpdateSystems(
    EntityConstructor: EntityConstructor,
  ): Iterable<{ method: string | symbol; system: System }> {
    return pipe(entityUpdateSystemsMap.get(EntityConstructor))
      .map(Maybe.Unwrap)
      .mapIter(({ method, SystemConstructor }) => {
        const system = this.getSystem(SystemConstructor)
        return {
          method,
          system,
        }
      })
      .value()
  }

  /**
   * Get a registered system instance by its constructor.
   * @throws If the system is not registered or the instance type does not match.
   * @example
   * ```ts
   * const mySystem = systemRegistry.getSystem(MySystem).unwrap()
   * ```
   */
  getSystem<T extends System>(SystemConstructor: ClassConstructor<T>): Maybe<T> {
    const maybeInstance = this.instances.get(SystemConstructor)

    if (maybeInstance.isNone()) {
      throw new Error(`System ${SystemConstructor.name} is not registered.`)
    }

    const instance = maybeInstance.value()

    if (instance instanceof SystemConstructor) {
      return Some(instance)
    }

    throw new Error(`System instance is not of type ${SystemConstructor.name}.`)
  }

  getUpdateSystems(): Iterable<{
    method: string | symbol
    system: System
  }> {
    return pipe(updateSystemsMap)
      .mapIter(({ method, SystemConstructor }) => {
        const system = this.getSystem(SystemConstructor)
        return {
          method,
          system,
        }
      })
      .value()
  }

  /**
   * Register a system instance.
   * @throws If a system of the same type is already registered.
   * @example
   * ```ts
   * const mySystem = new MySystem()
   * systemRegistry.registerSystem(mySystem)
   * ```
   */
  registerSystem(system: System) {
    const SystemConstructor = getObjectConstructor(system)

    if (this.instances.has(SystemConstructor)) {
      throw new Error(`System ${SystemConstructor.name} is already registered.`)
    }

    this.instances.set(SystemConstructor, system)
  }
}
