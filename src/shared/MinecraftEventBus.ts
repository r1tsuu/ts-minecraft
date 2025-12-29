import { type AnyEvent, Event } from './Event.ts'
import { EventBus } from './EventBus.ts'
import { ClientEvent } from './events/client/index.ts'
import { ServerEvent } from './events/server/index.ts'
import { SinglePlayerWorkerEvent } from './events/single-player-worker/index.ts'

export type AnyMinecraftEvent = AnyEvent<MinecraftEventsData, MinecraftEventMetadata>

export type MinecraftEventType = keyof MinecraftEventsData

type MinecraftEventMetadata = {
  environment: 'Client' | 'Server'
  isForwarded: boolean
}

// EVENT TYPE DEFINITION START

const eventTypes = [
  ...Object.values(ClientEvent),
  ...Object.values(ServerEvent),
  ...Object.values(SinglePlayerWorkerEvent),
]
// EVENT TYPE DEFINITION END

export type MinecraftEventPayload<T extends MinecraftEventType> = MinecraftEventsData[T]

type MinecraftEventsData = {
  [K in (typeof eventTypes)[number] as K['type']]: InstanceType<K>
}

type MinecraftEventTypeMeta = {
  codec: {
    decode?(obj: any): any
    encode?(obj: any): any
  }
}

export class MinecraftEvent<T extends ({} & string) | MinecraftEventType> extends Event<
  T,
  T extends keyof MinecraftEventsData ? MinecraftEventsData[T] : any,
  MinecraftEventMetadata
> {}

export class MinecraftEventBus extends EventBus<
  // @ts-expect-error
  MinecraftEventsData,
  MinecraftEventMetadata
> {
  constructor(environment: 'Client' | 'Server') {
    super()

    for (const eventType of eventTypes) {
      this.registerEventType(eventType)
    }

    this.addPrePublishHook((event) => {
      event.metadata.environment = event.metadata.environment ?? environment
      event.metadata.isForwarded = event.metadata.isForwarded ?? false
    })
  }

  /**
   * Decorator to mark a method as an event handler for Minecraft events.
   * @example
   * ```ts
   * class MyClass {
   *   @MinecraftEventBus.Handler('Client.JoinWorld')
   *   onJoinWorld(event: MinecraftEvent<'Client.JoinWorld'>) {
   *     console.log('Player joined world with UUID:', event.payload.worldUUID)
   *   }
   * }
   * ```
   */
  static Handler<T extends '*' | ({} & string) | MinecraftEventType>(eventType: T) {
    return EventBus.Handler<T>(eventType)
  }
}
