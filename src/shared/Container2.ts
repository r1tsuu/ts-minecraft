import { Option } from './Option.ts'
import { type ClassConstructor, getObjectConstructor } from './util.ts'

type InstanceKey = ClassConstructor<any> | number | string | symbol

export class Container<I extends object = object> {
  private instanceMap = new Map<InstanceKey, I>()
  private scopes: Set<Container> = new Set()

  /**
   * Creates a scoped container where registrations are associated with the given parent.
   */
  createScope(): Container {
    const scope = new Container()

    this.scopes.add(scope)

    return scope
  }

  iterateInstances(): IterableIterator<I> {
    return this.instanceMap.values()
  }

  register<T extends object>(instance: T, key: InstanceKey): T {
    this.instanceMap.set(key, instance as unknown as I)
    return instance
  }

  /**
   * Register a singleton instance in the container.
   * Throws an error if an instance of the same constructor is already registered.
   */
  registerSingleton<T extends object>(instance: T, key?: InstanceKey): T {
    let keyToUse: InstanceKey

    if (key) {
      keyToUse = key
    } else {
      keyToUse = getObjectConstructor(instance)
    }

    if (this.instanceMap.has(keyToUse)) {
      throw new Error(`Singleton instance already registered for ${this.keyToString(keyToUse)}`)
    }

    this.instanceMap.set(keyToUse, instance as unknown as I) // Dont use WeakMap for constructors since

    return instance
  }

  removeScope(scope: Container): void {
    this.scopes.delete(scope)
  }

  resolve<T extends object>(key: ClassConstructor<T>): Option<T>
  resolve<T extends object>(key: number | string | symbol): Option<T>
  resolve<T extends object>(key: InstanceKey): Option<T> {
    const maybeInstance = Option.from(this.instanceMap.get(key))

    if (maybeInstance.isSome()) {
      return maybeInstance as unknown as Option<T>
    }

    for (const scope of this.scopes) {
      // @ts-expect-error
      const scopedInstance = scope.resolve<T>(key)

      if (scopedInstance.isSome()) {
        return scopedInstance
      }
    }

    return Option.None()
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
