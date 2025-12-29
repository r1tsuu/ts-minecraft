import { Maybe, None } from './Maybe.ts'
import { type ClassConstructor, getObjectConstructor } from './util.ts'

type InstanceKey = ClassConstructor<any> | number | string | symbol

export class Container<I extends object = object> {
  private instanceMap = new Map<InstanceKey, I>()
  private scopes: Set<ContainerScope<I>> = new Set()

  /**
   * Creates a scoped container where registrations are associated with the given parent.
   */
  createScope(): ContainerScope<I> {
    const scope = new ContainerScope(this)

    this.scopes.add(scope)

    return scope
  }

  /**
   * Iterate over all registered instances in the container.
   * @example
   * for (const instance of container.iterateInstances()) {
   *   // do something with instance
   * }
   */
  iterateInstances(): IterableIterator<I> {
    return this.instanceMap.values()
  }

  /**
   * Register an instance in the container with a specific key.
   * @example
   * container.register(new MyClass(), MyClass)
   * container.register(new MyClass(), 'my-key')
   * @returns The registered instance.
   */
  register<T extends object>(instance: T, key: InstanceKey): T {
    this.instanceMap.set(key, instance as unknown as I)
    return instance
  }

  /**
   * Register a singleton instance in the container.
   * Throws an error if an instance of the same constructor is already registered.
   * @example
   * container.registerSingleton(new MyClass()) // uses MyClass as the key
   * container.registerSingleton(new MyClass(), 'my-key')
   */
  registerSingleton<T extends object>(instance: T, key?: InstanceKey): T {
    const keyToUse = key ?? getObjectConstructor(instance)

    if (this.instanceMap.has(keyToUse)) {
      throw new Error(`Singleton instance already registered for ${this.keyToString(keyToUse)}`)
    }

    this.instanceMap.set(keyToUse, instance as unknown as I) // Dont use WeakMap for constructors since

    return instance
  }

  removeScope(scope: ContainerScope<I>): void {
    this.scopes.delete(scope)
  }

  /**
   * Resolve an instance from the container.
   * If the instance is not found in the current container, it will
   * recursively check parent scopes.
   * Returns an Option wrapping the instance if found, or None if not found.
   * @example
   * const myInstance = container.resolve(MyClass).unwrap()
   * const maybeInstance = container.resolve(MyClass)
   * if (maybeInstance.isSome()) {
   *   const instance = maybeInstance.unwrap()
   * }
   * const anotherInstance = container.resolve('my-key').unwrap()
   */
  resolve<T extends object>(key: ClassConstructor<T>): Maybe<T>
  resolve<T extends object>(key: number | string | symbol): Maybe<T>
  resolve<T extends object>(key: InstanceKey): Maybe<T> {
    const maybeInstance = Maybe.from(this.instanceMap.get(key))

    if (maybeInstance.isSome()) {
      return maybeInstance as unknown as Maybe<T>
    }

    for (const scope of this.scopes) {
      // @ts-expect-error
      const scopedInstance = scope.resolve<T>(key)

      if (scopedInstance.isSome()) {
        return scopedInstance
      }
    }

    return None()
  }

  unregister(key: InstanceKey): void {
    if (!this.instanceMap.has(key)) {
      throw new Error(`No instance registered for key: ${this.keyToString(key)}`)
    }

    this.instanceMap.delete(key)
  }

  /**
   * Unregister all instances from the container.
   * Useful for disposing a scope.
   */
  unregisterAll(): void {
    this.instanceMap.clear()
  }

  private keyToString(key: InstanceKey): string {
    if (typeof key === 'function') {
      return key.name
    }

    return String(key)
  }
}

export class ContainerScope<I extends object = object> extends Container<I> {
  constructor(private parent: Container<I>) {
    super()
  }

  /**
   * Destroys the scope and unregisters all instances associated with it.
   * Also removes the scope from its parent container.
   * @example
   * const scope = parentContainer.createScope()
   * // ... use the scope
   * scope.destroyScope()
   *
   * Use it when you want to clean up all instances in the scope and
   * remove the scope from the parent container.
   */
  destroyScope(): void {
    this.unregisterAll()
    this.parent.removeScope(this)
  }
}
