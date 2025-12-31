import type { EntityConstructor } from './entities/Entity.ts'

import { HashMap } from './HashMap.ts'
import { Maybe, None, Some } from './Maybe.ts'
import { pipe } from './Pipe.ts'
import { type ClassConstructor, getObjectConstructor } from './util.ts'

const updateSystemsMap = new Set<{
  method: string | symbol
  SystemConstructor: ClassConstructor<System>
}>()

const renderSystemMAp = new Set<{
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

// class SystemContext {
//   private entitiesCache = new HashMap<EntityConstructor, Entity[]>()
//   constructor(
//     readonly gameLoop: gameLoop,
//     readonly world: World,
//     readonly delta: number,
//     readonly input: InputManager,
//   ) {}

//   fetchWithCache<T extends Entity>(EntityConstructor: EntityConstructor<T>): T[] {
//     if (!this.entitiesCache.has(EntityConstructor)) {
//       const entities = pipe(this.world.query().select(EntityConstructor).execute())
//         .mapIter((e) => e.entity)
//         .collectArray()
//         .value()

//       this.entitiesCache.set(EntityConstructor, entities)
//     }

//     return this.entitiesCache.get(EntityConstructor).unwrap() as T[]
//   }
// }

export abstract class System {
  static Render(): MethodDecorator {
    return function (system: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
      const SystemConstructor = getObjectConstructor(system) as ClassConstructor<System>
      renderSystemMAp.add({
        method: propertyKey as string,
        SystemConstructor,
      })

      return descriptor
    }
  }
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
  static RenderAll(EntityConstructor: EntityConstructor): MethodDecorator {
    return function (system: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
      const SystemConstructor = getObjectConstructor(system) as ClassConstructor<System>
      const maybeSystems = entityRenderSystemsMap.get(EntityConstructor)

      if (maybeSystems.isNone()) {
        entityRenderSystemsMap.set(EntityConstructor, new Set())
      }

      const systems = entityRenderSystemsMap.get(EntityConstructor).unwrap()

      systems.add({
        method: propertyKey as string,
        SystemConstructor,
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
  static Update(): MethodDecorator {
    return function (system: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
      console.log('Applying Update decorator to', getObjectConstructor(system).name)
      const SystemConstructor = getObjectConstructor(system) as ClassConstructor<System>
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
  static UpdateAll(EntityConstructor: EntityConstructor): MethodDecorator {
    return function (system: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
      const SystemConstructor = getObjectConstructor(system) as ClassConstructor<System>

      const maybeSystems = entityUpdateSystemsMap.get(EntityConstructor)

      if (maybeSystems.isNone()) {
        entityUpdateSystemsMap.set(EntityConstructor, new Set())
      }

      const systems = entityUpdateSystemsMap.get(EntityConstructor).unwrap()

      systems.add({
        method: propertyKey as string,
        SystemConstructor,
      })

      console.log(entityUpdateSystemsMap)

      return descriptor
    }
  }

  dispose(): void {}
}

export class SystemRegistry {
  private instances: HashMap<ClassConstructor<System>, System> = new HashMap()

  constructor() {}

  getRenderSystems(): IterableIterator<{
    method: string | symbol
    system: System
  }> {
    return pipe(renderSystemMAp)
      .mapIter(({ method, SystemConstructor }) => {
        const system = this.getSystem(SystemConstructor).expect(
          `System ${SystemConstructor.name} is not registered.`,
        )
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
      return None()
    }

    const instance = maybeInstance.value()

    // if (instance instanceof SystemConstructor) {
    return Some(instance)
    // }

    console.error(`System instance is not of type ${SystemConstructor.name}.`)
    return None()
  }

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
  iterRenderSystemsForEntity(
    EntityConstructor: EntityConstructor,
  ): IterableIterator<{ method: string | symbol; system: System }> {
    return pipe(entityRenderSystemsMap.get(EntityConstructor).unwrapOrDefault(new Set()))
      .mapIter(({ method, SystemConstructor }) => {
        const system = this.getSystem(SystemConstructor).expect(
          `System ${SystemConstructor.name} is not registered.`,
        )
        return {
          method,
          system,
        }
      })
      .value()
  }

  iterUpdateSystems(): IterableIterator<{
    method: string | symbol
    system: System
  }> {
    return pipe(updateSystemsMap)
      .mapIter(({ method, SystemConstructor }) => {
        const system = this.getSystem(SystemConstructor).expect(
          `System ${SystemConstructor.name} is not registered.`,
        )
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
  iterUpdateSystemsForEntity(
    EntityConstructor: EntityConstructor,
  ): IterableIterator<{ method: string | symbol; system: System }> {
    console.log(entityUpdateSystemsMap)
    return pipe(entityUpdateSystemsMap.get(EntityConstructor).unwrapOrDefault(new Set()))
      .mapIter(({ method, SystemConstructor }) => {
        const system = this.getSystem(SystemConstructor).expect(
          `System ${SystemConstructor} is not registered.`,
        )
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
  registerSystem<T extends System>(system: T): T {
    const SystemConstructor = getObjectConstructor(system)

    if (this.instances.has(SystemConstructor)) {
      throw new Error(`System ${SystemConstructor.name} is already registered.`)
    }

    this.instances.set(SystemConstructor, system)

    return system
  }

  unregisterAllSystems() {
    for (const system of this.instances.values()) {
      system.dispose()
    }

    this.instances.clear()
  }

  unregisterSystem<T extends System>(SystemConstructor: ClassConstructor<T>) {
    this.instances
      .get(SystemConstructor)
      .tap((sys) => sys.dispose())
      .tap(() => this.instances.delete(SystemConstructor))
      .expect(`System ${SystemConstructor.name} is not registered.`)
  }
}
