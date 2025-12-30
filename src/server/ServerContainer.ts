/**
 * ServerContainer.ts
 * This file defines the ServerContainer, which is a specialized container for managing
 * server-specific components.
 *
 * It also extends the Scheduler and MinecraftEventBus namespaces to include
 * decorators for registering server schedulables and event listeners.
 */
/* eslint-disable @typescript-eslint/no-namespace */
import { Container, type ContainerInstanceKey } from '../shared/Container.ts'
import { MinecraftEventBus } from '../shared/MinecraftEventBus.ts'
import { Scheduler } from '../shared/Scheduler.ts'

export function Inject(key: ContainerInstanceKey): PropertyDecorator {
  return function (target: any, propertyKey: string | symbol) {
    target[propertyKey] = ServerContainer.resolve(key as any).unwrap()
  }
}

// @ts-expect-error
export const ServerContainer: {
  Inject: (key: ContainerInstanceKey) => PropertyDecorator
} & Container = new Container()

ServerContainer.Inject = Inject

Scheduler.ServerSchedulable = () =>
  Scheduler.Schedulable(() => ServerContainer.resolve(Scheduler).unwrap())

MinecraftEventBus.ServerListener = () =>
  MinecraftEventBus.Listener(() => ServerContainer.resolve(MinecraftEventBus).unwrap())

declare module '../shared/Scheduler.ts' {
  namespace Scheduler {
    /**
     * Decorator to mark a class as a server
     * Helper function that uses the ServerContainer to register the schedulable.
     */
    export function ServerSchedulable(): ClassDecorator
  }
}

declare module '../shared/MinecraftEventBus.ts' {
  namespace MinecraftEventBus {
    /**
     * Decorator to mark a class as a Minecraft server event listener.
     * Helper function that uses the ServerContainer to register the listener.
     */
    export function ServerListener(): ClassDecorator
  }
}
