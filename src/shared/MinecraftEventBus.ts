import { Event } from './Event.ts'
import { EventBus } from './EventBus.ts'
import { ClientEvent } from './events/client/index.ts'
import { ServerEvent } from './events/server/index.ts'
import { SinglePlayerWorkerEvent } from './events/single-player-worker/index.ts'

// EVENT TYPE DEFINITION START

const eventTypes = [
  ...Object.values(ClientEvent),
  ...Object.values(ServerEvent),
  ...Object.values(SinglePlayerWorkerEvent),
]
// EVENT TYPE DEFINITION END

export class MinecraftEventBus extends EventBus {
  constructor(environment: 'Client' | 'Server') {
    super()

    for (const eventType of eventTypes) {
      this.registerEventType(eventType)
    }

    this.addPrePublishHook((event) => {
      const metadata = event.eventMetadata as MinecraftEventMetadata
      metadata.environment = metadata.environment ?? environment
      metadata.isForwarded = metadata.isForwarded ?? false
    })
  }

  /**
   * Decorator to mark a method as an event handler for Minecraft events.
   * @example
   * ```ts
   * class MyClass {
   *   @MinecraftEventBus.Handler(JoinWorld)
   *   onJoinWorld(event: JoinWorld) {
   *     console.log('Player joined world with UUID:', event.worldUUID)
   *   }
   * }
   * ```
   */
  static Handler<T extends MinecraftEvent>(eventType: '*' | { new (): T; type: string } | string) {
    return EventBus.Handler<T>(eventType)
  }
}
