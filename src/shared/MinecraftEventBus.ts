import { type AnyEvent, Event } from './Event.ts'
import { EventBus } from './EventBus.ts'
import { ExitWorldPayload } from './events/client/ExitWorldPayload.ts'
import { JoinedWorldPayload } from './events/client/JoinedWorldPayload.ts'
import { JoinWorldPayload } from './events/client/JoinWorldPayload.ts'
import { PauseTogglePayload } from './events/client/PauseTogglePayload.ts'
import { RequestChunksLoadPayload } from './events/client/RequestChunksLoadPayload.ts'
import { RequestPlayerJoinPayload } from './events/client/RequestPlayerJoinPayload.ts'
import { RequestSyncPlayerPayload } from './events/client/RequestSyncPlayerPayload.ts'
import { RequestSyncUpdatedBlocksPayload } from './events/client/RequestSyncUpdatedBlocksPayload.ts'
import { StartLocalServerPayload } from './events/client/StartLocalServerPayload.ts'
import { ResponseChunksLoadPayload } from './events/server/ResponseChunksLoadPayload.ts'
import { ResponsePlayerJoinPayload } from './events/server/ResponsePlayerJoinPayload.ts'
import { ResponseSyncPlayerPayload } from './events/server/ResponseSyncPlayerPayload.ts'
import { ResponseSyncUpdatedBlocksPayload } from './events/server/ResponseSyncUpdatedBlocksPayload.ts'
import { ServerTickPayload } from './events/server/ServerTickPayload.ts'
import { SinglePlayerWorkerServerStartPayload } from './events/single-player-worker/SinglePlayerWorkerServerStartPayload.ts'
import { WorkerReadyPayload } from './events/single-player-worker/WorkerReadyPayload.ts'

export type AnyMinecraftEvent = AnyEvent<MinecraftEventsData, MinecraftEventMetadata>

export type MinecraftEventType = keyof MinecraftEventsData

type MinecraftEventMetadata = {
  environment: 'Client' | 'Server'
  isForwarded: boolean
}

// EVENT TYPE DEFINITION START

const eventTypes = [
  ExitWorldPayload,
  JoinedWorldPayload,
  JoinWorldPayload,
  RequestChunksLoadPayload,
  RequestPlayerJoinPayload,
  RequestSyncPlayerPayload,
  RequestSyncUpdatedBlocksPayload,
  StartLocalServerPayload,
  ResponseChunksLoadPayload,
  ResponsePlayerJoinPayload,
  ResponseSyncUpdatedBlocksPayload,
  ResponseSyncPlayerPayload,
  ServerTickPayload,
  SinglePlayerWorkerServerStartPayload,
  WorkerReadyPayload,
  PauseTogglePayload,
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
  MinecraftEventMetadata,
  MinecraftEventTypeMeta
> {
  constructor(environment: 'Client' | 'Server') {
    super()

    for (const eventType of eventTypes) {
      this.registerEventType(eventType.type, {
        // @ts-expect-error
        decode: eventType.deserialize,
        encode: (obj: any) => obj.serialize(),
      })
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
