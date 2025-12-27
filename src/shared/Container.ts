import type { UUID } from '../types.ts'

import { Option } from './Option.ts'

export type ContainerScope = {
  /**
   * Lists all child instances registered under the given parent.
   * @returns An array of child instances.
   * @example
   * const gameSessionScope = Container.createScope(gameSession)
   * const playerManager = gameSessionScope.registerSingleton(new PlayerManager())
   * const children = gameSessionScope.listChildren()
   * console.log(children) // [playerManager]
   */
  listChildren(): any[]
} & Container

type AnyClassConstructor = new (...args: any[]) => any

/**
 * A simple dependency injection container for managing instances and singletons.
 * It supports scoped containers associated with parent instances.
 * @example
 * const container = new Container()
 * const instance = container.register(new MyClass())
 * const singleton = container.registerSingleton(new MySingletonClass())
 * const resolvedInstance = container.resolve(MyClass).unwrap()
 * const resolvedSingleton = container.resolve(MySingletonClass).unwrap()
 * const scopedContainer = container.createScope(parentInstance)
 * const scopedSingleton = scopedContainer.registerSingleton(new ScopedSingletonClass())
 * const children = scopedContainer.listChildren()
 * console.log(children) // [scopedSingleton]
 */
export class Container {
  private idCounter = 0
  private instances = new Map<number | UUID, any>()
  private instanceToIdMap = new WeakMap<any, number | UUID>()
  private singletonChildrenMap = new WeakMap<
    AnyClassConstructor,
    (AnyClassConstructor | number | UUID)[]
  >()
  private singletonInstances = new WeakMap<AnyClassConstructor, any>()

  /**
   * Creates a scoped container where registrations are associated with the given parent.
   * @param parent The parent instance to associate registrations with.
   * @returns A new ContainerScope instance.
   */
  createScope(parent: any): ContainerScope {
    // @ts-expect-error
    return new Proxy(this, {
      get: (target, prop, receiver) => {
        // Handle scope-specific methods
        if (prop === 'listChildren') {
          return () => {
            const children = this.singletonChildrenMap.get(this.getConstructor(parent)) ?? []

            // @ts-expect-error
            return children.map((child) => this.resolve(child).unwrap())
          }
        }

        // Override registerSingleton to include parent
        if (prop === 'registerSingleton') {
          return (instance: any) => {
            return (target as any)[prop](instance, parent)
          }
        }

        // Override register to include parent
        if (prop === 'register') {
          return (instance: any, options: any = {}) => {
            return (target as any)[prop](instance, { parent, ...options })
          }
        }

        return Reflect.get(target, prop, receiver)
      },
    })
  }

  /**
   * Registers an instance in the container.
   * @param instance The instance to register.
   * @param options Optional parameters including parent and uuid.
   * @returns An object containing the assigned ID and the instance.
   * @example
   * const container = new Container()
   * const { id, instance } = container.register(new MyClass(), { uuid: 'custom-uuid' })
   * console.log(id) // 'custom-uuid'
   */
  register<T>(
    instance: T,
    {
      parent,
      uuid,
    }: {
      parent?: any
      uuid?: UUID
    },
  ): { id: number | UUID; instance: T } {
    const id = uuid ?? this.idCounter++
    this.instances.set(id, instance)
    this.instanceToIdMap.set(instance, id)

    if (parent) {
      const parentConstructor = this.getConstructor(parent)
      if (!this.singletonChildrenMap.has(parentConstructor)) {
        this.singletonChildrenMap.set(parentConstructor, [])
      }

      this.singletonChildrenMap.get(parentConstructor)!.push(id)
    }

    return {
      id,
      instance,
    }
  }

  /**
   * Registers a singleton instance in the container.
   * @param instance The singleton instance to register.
   * @param parent Optional parent instance to associate with the singleton.
   * @returns The registered singleton instance.
   * @throws Error if a singleton of the same type is already registered.
   * @example
   * const container = new Container()
   * const singleton = container.registerSingleton(new MySingletonClass())
   * console.log(singleton) // MySingletonClass instance
   */
  registerSingleton<T>(instance: T, parent?: any): T {
    const constructor = this.getConstructor(instance)

    if (this.singletonInstances.has(constructor)) {
      throw new Error(`Singleton instance already registered for ${constructor.name}`)
    }

    this.singletonInstances.set(constructor, instance)

    if (parent) {
      const parentConstructor = this.getConstructor(parent)
      if (!this.singletonChildrenMap.has(parentConstructor)) {
        this.singletonChildrenMap.set(parentConstructor, [])
      }

      this.singletonChildrenMap.get(parentConstructor)!.push(constructor)
    }

    return instance
  }
  /**
   * Resolves an instance or singleton from the container.
   * @param idOrSingletonConstructor The ID or constructor of the instance/singleton to resolve.
   * @returns An OptionType containing the resolved instance or undefined if not found.
   * @example
   * const container = new Container()
   * const { id, instance } = container.register(new MyClass())
   * const resolvedInstance = container.resolve(id).unwrap()
   * console.log(resolvedInstance === instance) // true
   * const singleton = container.registerSingleton(new MySingletonClass())
   * const resolvedSingleton = container.resolve(MySingletonClass).unwrap()
   * console.log(resolvedSingleton === singleton) // true
   */
  resolve<T>(id: number | UUID): Option<T>
  resolve<T>(singletonConstructor: new (...args: any[]) => T): Option<T>
  resolve<T>(idOrSingletonConstructor: any): Option<T> {
    if (
      typeof idOrSingletonConstructor === 'number' ||
      typeof idOrSingletonConstructor === 'string'
    ) {
      return Option.from(this.instances.get(idOrSingletonConstructor as number | UUID))
    }

    return Option.from(
      this.singletonInstances.get(idOrSingletonConstructor as new (...args: any[]) => T),
    )
  }

  unregister(instanceOrSingletonConstructor: any): void
  unregister(id: number | UUID): void
  unregister(instanceOrSingletonConstructor: any): void {
    // Unregister singleton
    if (typeof instanceOrSingletonConstructor === 'function') {
      const constructor = instanceOrSingletonConstructor as new (...args: any[]) => any
      const instance = this.singletonInstances.get(constructor)

      if (instance) {
        this.singletonInstances.delete(constructor)

        const children = this.singletonChildrenMap.get(constructor) || []

        for (const child of children) {
          this.unregister(child)
        }

        this.singletonChildrenMap.delete(constructor)
      } else {
        throw new Error(`No singleton instance registered for ${constructor.name}`)
      }

      return
    }

    // Unregister instance by ID
    if (
      typeof instanceOrSingletonConstructor === 'number' ||
      typeof instanceOrSingletonConstructor === 'string'
    ) {
      this.instances.delete(instanceOrSingletonConstructor as number | UUID)
      return
    }

    // Unregister instance by reference
    const id = this.instanceToIdMap.get(instanceOrSingletonConstructor)

    if (id !== undefined) {
      this.instances.delete(id)
      this.instanceToIdMap.delete(instanceOrSingletonConstructor)
    } else {
      throw new Error(`Instance not registered in the container`)
    }
  }

  private getConstructor(object: any): new (...args: any[]) => any {
    return object.constructor as new (...args: any[]) => any
  }
}
