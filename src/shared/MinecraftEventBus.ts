import type { MinecraftEvent } from './MinecraftEvent.ts'

import { EventBus, type EventConstructor, type WildcardKey } from './EventBus.ts'
import { ClientEvent } from './events/client/index.ts'
import { ServerEvent } from './events/server/index.ts'
import { SinglePlayerWorkerEvent } from './events/single-player-worker/index.ts'

// EVENT TYPE DEFINITION START

// EVENT TYPE DEFINITION END

export class MinecraftEventBus extends EventBus<MinecraftEvent> {
  constructor(environment: 'Client' | 'Server') {
    super()

    const eventConstructors = [
      ...Object.values(ClientEvent),
      ...Object.values(ServerEvent),
      ...Object.values(SinglePlayerWorkerEvent),
    ]

    for (const EventConstructor of eventConstructors) {
      this.registerEventType(EventConstructor)
    }

    this.addPrePublishHook((event) => {
      const metadata = event.metadata
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
  static Handler<T extends EventConstructor<any>>(Constructor: T | WildcardKey) {
    return EventBus.Handler<T>(Constructor)
  }
}
