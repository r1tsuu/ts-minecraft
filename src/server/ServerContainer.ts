/**
 * ServerContainer.ts
 * This file defines the ServerContainer, which is a specialized container for managing
 * server-specific components.
 *
 * It also extends the Scheduler and MinecraftEventBus namespaces to include
 * decorators for registering server schedulables and event listeners.
 */
/* eslint-disable @typescript-eslint/no-namespace */
import { Container } from '../shared/Container.ts'
import { MinecraftEventBus } from '../shared/MinecraftEventBus.ts'
import { Scheduler } from '../shared/Scheduler.ts'

export const ServerContainer = new Container()

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
