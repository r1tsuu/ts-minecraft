/* ===========================================================
 * Core event types
 * =========================================================== */

type Event<
  EventKeys extends string,
  Events extends Record<string, unknown>,
  K extends string,
  D extends Record<string, unknown> = {},
> = {
  cancel: () => void
  eventUUID: string
  from: 'CLIENT' | 'SERVER'
  payload: D
  /**
   * Respond to this event with another event.
   */
  respond: <T extends EventKeys, P extends Events[T]>(type: T, payload: P) => Promise<void>
  timestamp: number
  type: K
}

type EventHandler<
  EventKeys extends string,
  Events extends Record<string, unknown>,
  K extends string,
  D extends Record<string, unknown> = {},
> = (event: Event<EventKeys, Events, K, D>) => Promise<void> | void

/* ===========================================================
 * Event queue
 * =========================================================== */

export const createEventQueue = <Events extends Record<string, Record<string, unknown>>>({
  environment,
}: {
  environment: 'CLIENT' | 'SERVER'
}) => {
  /* -------------------------------------------
   * Event keys
   * ------------------------------------------- */

  type EventKey = keyof Events & string
  type WildcardKey = '*'
  type RegistryKey = EventKey | WildcardKey

  /* -------------------------------------------
   * Discriminated union for wildcard
   * ------------------------------------------- */

  type AnyEvent = {
    [K in EventKey]: Event<EventKey, Events, K, Events[K]>
  }[EventKey]

  /* -------------------------------------------
   * Listener registry
   * ------------------------------------------- */

  const registry = new Map<
    RegistryKey,
    {
      listeners: ((event: any) => Promise<void> | void)[]
    }
  >()

  /* -------------------------------------------
   * on()
   * ------------------------------------------- */

  const on = <K extends RegistryKey>(
    type: K,
    handler: K extends '*'
      ? (event: AnyEvent) => Promise<void> | void
      : EventHandler<EventKey, Events, EventKey & K, Events[EventKey & K]>,
  ) => {
    let entry = registry.get(type)

    if (!entry) {
      entry = { listeners: [] }
      registry.set(type, entry)
    }

    entry.listeners.push(handler as any)

    return () => {
      entry!.listeners = entry!.listeners.filter((l) => l !== handler)
    }
  }

  /* -------------------------------------------
   * waitUntilOn()
   * ------------------------------------------- */

  const waitUntilOn = <K extends EventKey>(
    type: K,
    eventUUID?: string,
  ): Promise<Event<EventKey, Events, K, Events[K]>> => {
    return new Promise((resolve) => {
      // @ts-expect-error
      const unsub = on(type, (event) => {
        if (eventUUID && event.eventUUID !== eventUUID) return
        // @ts-expect-error
        resolve(event)
        unsub()
      })
    })
  }

  /* -------------------------------------------
   * emit()
   * ------------------------------------------- */

  const emit = async <K extends EventKey>(
    type: K,
    payload: Events[K],
    id: string = crypto.randomUUID(),
    timestamp: number = Date.now(),
  ) => {
    let canceled = false

    const event: Event<EventKey, Events, K, Events[K]> = {
      cancel: () => {
        canceled = true
      },
      eventUUID: id,
      from: environment,
      payload,
      respond: async (responseType, responsePayload) => {
        await emit(responseType as EventKey, responsePayload as Events[EventKey], id)
      },
      timestamp,
      type,
    }

    const listeners = [
      ...(registry.get(type)?.listeners ?? []),
      ...(registry.get('*')?.listeners ?? []),
    ]

    for (const handler of listeners) {
      await handler(event)
      if (canceled) break
    }

    return !canceled
  }

  /* -------------------------------------------
   * emitAndWaitResponse()
   * ------------------------------------------- */

  const emitAndWaitResponse = async <K extends EventKey, UntilK extends EventKey>(
    type: K,
    payload: Events[K],
    typeUntil: UntilK,
    eventUUID: string = crypto.randomUUID(),
  ): Promise<Event<EventKey, Events, UntilK, Events[UntilK]>> => {
    await emit(type, payload, eventUUID)
    return waitUntilOn(typeUntil, eventUUID)
  }

  return {
    emit,
    emitAndWaitResponse,
    on,
    waitUntilOn,
  }
}
