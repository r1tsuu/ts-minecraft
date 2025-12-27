/* eslint-disable @typescript-eslint/no-namespace */
import { MinecraftEventQueue } from '../queue/MinecraftQueue.ts'
import { Container } from '../shared/Container.ts'
import { Scheduler } from '../shared/Scheduler.ts'

export const ClientContainer = new Container()

Scheduler.ClientSchedulable = function (): ClassDecorator {
  return Scheduler.Schedulable(ClientContainer)
}

MinecraftEventQueue.ClientListener = function (): ClassDecorator {
  return MinecraftEventQueue.Listener(ClientContainer)
}

declare module '../shared/Scheduler.ts' {
  namespace Scheduler {
    /**
     * Decorator to mark a class as a client
     * Helper function that uses the ClientContainer to register the schedulable.
     */
    export function ClientSchedulable(): ClassDecorator
  }
}

declare module '../queue/MinecraftQueue.ts' {
  namespace MinecraftEventQueue {
    /**
     * Decorator to mark a class as a Minecraft client event listener.
     * Helper function that uses the ClientContainer to register the listener.
     */
    export function ClientListener(): ClassDecorator
  }
}
