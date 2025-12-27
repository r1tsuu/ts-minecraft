/* ===========================================================
 * Minecraft-specific queue
 * =========================================================== */

import type { DatabaseChunkData, DatabasePlayerData } from '../server/WorldDatabase.ts'
import type { Container } from '../shared/Container.ts'
import type { ChunkCoordinates, UUID } from '../types.ts'

import { type AnyEvent, Event } from './Event.ts'
import { EventQueue } from './EventQueue.ts'

export type AnyMinecraftEvent = AnyEvent<MinecraftEventsData, MinecraftEventMetadata>

export type MinecraftEventType = keyof MinecraftEventsData

type MinecraftEventMetadata = {
  environment: 'Client' | 'Server'
  isForwarded: boolean
}

const e = <Payload>() => {
  return <EventType extends string>(t: EventType) => {
    return {
      payload: {} as Payload,
      type: t,
    }
  }
}

const eventTypes = [
  e<{}>()('Client.ExitWorld'),
  e<{}>()('Client.JoinedWorld'),
  e<{ worldUUID: UUID }>()('Client.JoinWorld'),
  e<{ chunks: ChunkCoordinates[] }>()('Client.RequestChunksLoad'),
  e<{ playerUUID: UUID }>()('Client.RequestPlayerJoin'),
  e<{ playerData: DatabasePlayerData }>()('Client.RequestSyncPlayer'),
  e<{ worldDatabaseName: string }>()('Client.StartLocalServer'),
  e<{ chunks: DatabaseChunkData[] }>()('Server.ResponseChunksLoad'),
  e<{ playerData: DatabasePlayerData }>()('Server.ResponsePlayerJoin'),
  e<{}>()('Server.ResponseSyncPlayer'),
  e<{ currentTick: number }>()('Server.ServerTick'),
  e<{ loadedChunks: DatabaseChunkData[] }>()('SinglePlayerWorker.ServerStarted'),
  e<{}>()('SinglePlayerWorker.WorkerReady'),
  e<{}>()('Client.PauseToggle'),
]

type MinecraftEventsData = {
  [K in (typeof eventTypes)[number] as K['type']]: K['payload']
}

export class MinecraftEvent<T extends ({} & string) | MinecraftEventType> extends Event<
  T,
  T extends keyof MinecraftEventsData ? MinecraftEventsData[T] : any,
  MinecraftEventMetadata
> {}

export class MinecraftEventQueue extends EventQueue<MinecraftEventsData, MinecraftEventMetadata> {
  constructor(environment: 'Client' | 'Server') {
    super()

    for (const eventType of eventTypes) {
      this.registerEventType(eventType.type)
    }

    this.addBeforeEmitHook((event) => {
      event.metadata.environment = event.metadata.environment ?? environment
      event.metadata.isForwarded = event.metadata.isForwarded ?? false
    })
  }

  /**
   * Decorator to mark a method as an event handler for Minecraft events.
   * @example
   * ```ts
   * class MyClass {
   *   @MinecraftEventQueue.Handler('Client.JoinWorld')
   *   onJoinWorld(event: MinecraftEvent<'Client.JoinWorld'>) {
   *     console.log('Player joined world with UUID:', event.payload.worldUUID)
   *   }
   * }
   * ```
   */
  static Handler<T extends '*' | ({} & string) | MinecraftEventType>(eventType: T) {
    return EventQueue.Handler<T>(eventType)
  }

  /**
   * Decorator to mark a class as a Minecraft event listener.
   * Automatically registers and unregisters event handlers.
   * @example
   * ```ts
   * @MinecraftEventQueue.Listener(ClientContainer)
   * class MyClass {
   *   @MinecraftEventQueue.Handler('Client.JoinWorld')
   *   onJoinWorld(event: MinecraftEvent<'Client.JoinWorld'>) {
   *     console.log('Player joined world with UUID:', event.payload.worldUUID)
   *   }
   * }
   * ```
   */
  static Listener(container: Container): ClassDecorator {
    // @ts-expect-error
    return function <T extends new (...args: any[]) => any>(Target: T): T {
      return class extends Target {
        constructor(...args: any[]) {
          super(...args)

          container.resolve(MinecraftEventQueue).unwrap().registerHandlers(this)
          const originalDispose = this.dispose?.bind(this)

          this.dispose = () => {
            originalDispose?.()
            MinecraftEventQueue.unregisterHandlers(this)
            console.log(`Unregistered Minecraft client event handlers for ${Target.name}`)
          }

          console.log(`Registered Minecraft client event handlers for ${Target.name}`)
        }
      }
    }
  }

  static ServerListener(): ClassDecorator {
    return function () {
      // ServerContainer.resolve(MinecraftEventQueue).unwrap().registerHandlers(target) --- IGNORE ---
    }
  }
}
