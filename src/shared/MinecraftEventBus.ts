import type { EnvironmentType } from './util.ts'

import { getCurrentEnvironment } from './env.ts'
import { EventBus } from './EventBus.ts'
import { ClientEvent } from './events/client/index.ts'
import { ServerEvent } from './events/server/index.ts'
import { SinglePlayerWorkerEvent } from './events/single-player-worker/index.ts'
import { MinecraftEvent } from './MinecraftEvent.ts'

/**
 * MinecraftEventBus class for managing Minecraft-specific event publishing and subscription.
 */
export class MinecraftEventBus extends EventBus<MinecraftEvent> {
  constructor(environment: EnvironmentType) {
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
}

export const Handler = EventBus.Handler
export const Listener = () => EventBus.Listener(() => eventBus)

/**
 * The global Minecraft event bus instance.
 */
export const eventBus = new MinecraftEventBus(getCurrentEnvironment())
