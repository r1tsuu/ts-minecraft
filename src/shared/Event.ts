import type { UUID } from '../types.ts'
import type { EventBus } from './EventBus.ts'

import { Maybe, None } from './Maybe.ts'

const isCanceledSymbol = Symbol('isCanceled')

export interface EventMetadata {
  timestamp: number
  uuid: Maybe<UUID>
}

export abstract class Event<Meta extends object> {
  static readonly type: string
  metadata: EventMetadata & Meta = {
    timestamp: Date.now(),
    uuid: None(),
  } as EventMetadata & Meta
  private [isCanceledSymbol] = false

  cancel() {
    this[isCanceledSymbol] = true
  }

  getType(): string {
    return (this.constructor as typeof Event).type
  }

  isCanceled(): boolean {
    return this[isCanceledSymbol]
  }

  abstract serialize(): any
}

export const serializeEvent = (event: Event<EventMetadata>) => {
  return {
    metadata: {
      timestamp: event.metadata.timestamp,
      uuid: event.metadata.uuid.valueOrNull(),
    },
    payload: event.serialize(),
    type: (event.constructor as typeof Event).type,
  }
}

export const deserializeEvent = <T extends Event<any>>(eventBus: EventBus<T>, obj: any): T => {
  const EventConstructor = eventBus.getEventConstructor(obj.type).unwrap()

  const event = EventConstructor.deserialize(obj.payload) as Event<EventMetadata>

  event.metadata.timestamp = obj.metadata.timestamp // preserve timestamp
  event.metadata.uuid = Maybe.from<UUID>(obj.metadata.uuid) // preserve UUID

  return event as T
}
