import type { UUID } from '../types.ts'

import { option, type OptionType } from './util.ts'

type AnyClassConstructor = new (...args: any[]) => any

export class Container {
  private idCounter = 0
  private instances = new Map<number | UUID, any>()
  private instanceToIdMap = new WeakMap<any, number | UUID>()
  private singletonInstances = new WeakMap<AnyClassConstructor, any>()

  register<T>(instance: T, uuid?: UUID): { id: number | UUID; instance: T } {
    const id = uuid ?? this.idCounter++
    this.instances.set(id, instance)
    this.instanceToIdMap.set(instance, id)

    return {
      id,
      instance,
    }
  }

  registerSingleton<T>(instance: T): T {
    const constructor = this.getConstructor(instance)

    if (this.singletonInstances.has(constructor)) {
      throw new Error(`Singleton instance already registered for ${constructor.name}`)
    }

    this.singletonInstances.set(constructor, instance)

    return instance
  }

  resolve<T>(id: number | UUID): OptionType<T>
  resolve<T>(singletonConstructor: new (...args: any[]) => T): OptionType<T>
  resolve<T>(idOrSingletonConstructor: any): OptionType<T> {
    if (
      typeof idOrSingletonConstructor === 'number' ||
      typeof idOrSingletonConstructor === 'string'
    ) {
      return option(this.instances.get(idOrSingletonConstructor as number | UUID))
    }

    return option(
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
