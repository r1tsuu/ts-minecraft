/* ===========================================================
 * Minecraft-specific queue
 * =========================================================== */

import type { KeyboardKey } from '../client/InputManager.ts'
import type { DatabaseChunkData, DatabasePlayerData } from '../server/WorldDatabase.ts'
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
  e<{ keyCode: KeyboardKey }>()('Client.Input.KeyDown'),
  e<{ keyCode: KeyboardKey }>()('Client.Input.KeyUp'),
  e<{ deltaX: number; deltaY: number }>()('Client.Input.MouseMove'),
  e<{}>()('Client.Input.MouseLeftDown'),
  e<{}>()('Client.Input.MouseLeftUp'),
  e<{}>()('Client.Input.MouseRightDown'),
  e<{}>()('Client.Input.MouseRightUp'),
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

      if (event.metadata.environment === 'Server')
        console.log(`[${event.metadata.environment}] Emitting Minecraft event:`, event)
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
}
