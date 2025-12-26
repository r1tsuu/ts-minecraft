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

const createEventType = <Payload>() => {
  return <EventType extends string>(t: EventType) => {
    return {
      payload: {} as Payload,
      type: t,
    }
  }
}

const eventTypes = [
  createEventType<{}>()('Client.ExitWorld'),
  createEventType<{}>()('Client.JoinedWorld'),
  createEventType<{ worldUUID: UUID }>()('Client.JoinWorld'),
  createEventType<{ chunks: ChunkCoordinates[] }>()('Client.RequestChunksLoad'),
  createEventType<{ playerUUID: UUID }>()('Client.RequestPlayerJoin'),
  createEventType<{ playerData: DatabasePlayerData }>()('Client.RequestSyncPlayer'),
  createEventType<{ worldDatabaseName: string }>()('Client.StartLocalServer'),
  createEventType<{ chunks: DatabaseChunkData[] }>()('Server.ResponseChunksLoad'),
  createEventType<{ playerData: DatabasePlayerData }>()('Server.ResponsePlayerJoin'),
  createEventType<{}>()('Server.ResponseSyncPlayer'),
  createEventType<{ currentTick: number }>()('Server.ServerTick'),
  createEventType<{ loadedChunks: DatabaseChunkData[] }>()('SinglePlayerWorker.ServerStarted'),
  createEventType<{}>()('SinglePlayerWorker.WorkerReady'),
  createEventType<{ keyCode: KeyboardKey }>()('Client.Input.KeyDown'),
  createEventType<{ keyCode: KeyboardKey }>()('Client.Input.KeyUp'),
  createEventType<{ deltaX: number; deltaY: number }>()('Client.Input.MouseMove'),
  createEventType<{}>()('Client.Input.MouseLeftDown'),
  createEventType<{}>()('Client.Input.MouseLeftUp'),
  createEventType<{}>()('Client.Input.MouseRightDown'),
  createEventType<{}>()('Client.Input.MouseRightUp'),
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
