/**
 * ClientContainer.ts
 * This file defines the ClientContainer, which is a specialized container for managing
 * client-specific components.
 *
 * It also extends the Scheduler and MinecraftEventBus namespaces to include
 * decorators for registering client schedulables and event listeners.
 */
/* eslint-disable @typescript-eslint/no-namespace */
import { Container } from '../shared/Container.ts'
import { MinecraftEventBus } from '../shared/MinecraftEventBus.ts'
import { Scheduler } from '../shared/Scheduler.ts'

export const ClientContainer = new Container()

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
