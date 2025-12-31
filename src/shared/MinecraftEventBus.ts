import type { EnvironmentType } from './util.ts'

import { EventBus } from './EventBus.ts'
import { ClientEvent } from './events/client/index.ts'
import { ServerEvent } from './events/server/index.ts'
import { SinglePlayerWorkerEvent } from './events/single-player-worker/index.ts'
import { MinecraftEvent } from './MinecraftEvent.ts'

const eventConstructors = [
  ...Object.values(ClientEvent),
  ...Object.values(ServerEvent),
  ...Object.values(SinglePlayerWorkerEvent),
] as const

export type MinecraftEventByType<T extends MinecraftEventType> = InstanceType<
  Extract<(typeof eventConstructors)[number], { type: T }>
>

export type MinecraftEventType = (typeof eventConstructors)[number]['type']

/**
 * MinecraftEventBus class for managing Minecraft-specific event publishing and subscription.
 */
export class MinecraftEventBus extends EventBus<MinecraftEvent> {
  constructor(environment: EnvironmentType) {
    super()

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
