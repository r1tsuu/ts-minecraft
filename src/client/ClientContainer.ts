/**
 * ClientContainer.ts
 * This file defines the ClientContainer, which is a specialized container for managing
 * client-specific components.
 *
 * It also extends the Scheduler and MinecraftEventBus namespaces to include
 * decorators for registering client schedulables and event listeners.
 */
/* eslint-disable @typescript-eslint/no-namespace */
import { Container, type ContainerInstanceKey } from '../shared/Container.ts'
import { MinecraftEventBus } from '../shared/MinecraftEventBus.ts'
import { Scheduler } from '../shared/Scheduler.ts'

const PARAM_INJECT = Symbol('client:param_inject')

export function Inject(key: ContainerInstanceKey): ParameterDecorator {
  return (target, _propertyKey, parameterIndex) => {
    const ctor = target as Constructor

    const existing: ParamInjectMeta = (ctor as any)[PARAM_INJECT] ?? new Map()

    existing.set(parameterIndex, key)
    ;(ctor as any)[PARAM_INJECT] = existing
  }
}

// @ts-expect-error
export const ClientContainer: {
  /**
   * Decorator to inject a dependency from the ClientContainer.
   * @param key The key of the dependency to inject.
   * @returns A property decorator.
   * @example
   * ```typescript
   * class MyClass {
   *   @ClientContainer.Inject(MyDependency)
   *   private myDependency!: MyDependency
   * }
   *
   * class Other {
   *  constructor(@ClientContainer.Inject(MyDependency) private readonly myDependency: MyDependency) {
   *    // Use myDependency
   *  }
   * }
   * `
   */
  Inject: (key: ContainerInstanceKey) => PropertyDecorator
} & Container = new Container()

ClientContainer.Inject = Inject

Scheduler.ClientSchedulable = () =>
  Scheduler.Schedulable(() => ClientContainer.resolve(Scheduler).unwrap())

MinecraftEventBus.ClientListener = () =>
  MinecraftEventBus.Listener(() => ClientContainer.resolve(MinecraftEventBus).unwrap())

declare module '../shared/Scheduler.ts' {
  namespace Scheduler {
    /**
     * Decorator to mark a class as a client
     * Helper function that uses the ClientContainer to register the schedulable.
     */
    export function ClientSchedulable(): ClassDecorator
  }
}

declare module '../shared/MinecraftEventBus.ts' {
  namespace MinecraftEventBus {
    /**
     * Decorator to mark a class as a Minecraft client event listener.
     * Helper function that uses the ClientContainer to register the listener.
     */
    export function ClientListener(): ClassDecorator
  }
}
