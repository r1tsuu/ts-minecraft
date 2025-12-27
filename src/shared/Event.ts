import type { UUID } from '../types.ts'

export type AnyEvent<
  Events extends Record<string, Record<string, unknown>>,
  Meta extends Record<string, unknown> = {},
> = {
  // @ts-expect-error
  [K in keyof Events]: Event<K, Events[K], Meta>
}[keyof Events]

/**
 * Serializable representation of an event.
 * Used for transferring events between different environments.
 */
export class RawEvent<
  K extends string,
  D extends Record<string, unknown> = {},
  Meta extends Record<string, unknown> = {},
> {
  eventUUID: UUID
  metadata: Meta
  payload: D
  type: K

  constructor(
    type: K,
    payload: D,
    eventUUID: UUID = crypto.randomUUID(),
    metadata: Meta = {} as Meta,
  ) {
    this.type = type
    this.payload = payload
    this.eventUUID = eventUUID
    this.metadata = metadata
  }
}

export class Event<
  K extends string,
  D extends Record<string, unknown> = {},
  Meta extends Record<string, unknown> = {},
> extends RawEvent<K, D, Meta> {
  private _isCanceled = false

  constructor(type: K, payload: D, eventUUID?: UUID, metadata?: Meta) {
    super(type, payload, eventUUID, metadata)
  }

  static fromRaw<
    K extends string,
    D extends Record<string, unknown> = {},
    Meta extends Record<string, unknown> = {},
  >(rawEvent: RawEvent<K, D, Meta>): Event<K, D, Meta> {
    return new Event<K, D, Meta>(
      rawEvent.type,
      rawEvent.payload,
      rawEvent.eventUUID,
      rawEvent.metadata,
    )
  }

  cancel(): void {
    this._isCanceled = true
  }

  intoRaw(): RawEvent<K, D, Meta> {
    return new RawEvent<K, D, Meta>(this.type, this.payload, this.eventUUID, this.metadata)
  }

  isCanceled(): boolean {
    return this._isCanceled
  }
}
