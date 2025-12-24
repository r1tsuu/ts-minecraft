/* ===========================================================
 * Core event types
 * =========================================================== */

type Event<K extends string, D extends Record<string, unknown> = {}> = {
  cancel: () => void
  from: 'CLIENT' | 'SERVER'
  id: string
  payload: D
  type: K
}

type EventHandler<K extends string, D extends Record<string, unknown> = {}> = (
  event: Event<K, D>,
) => Promise<void> | void

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
    [K in EventKey]: Event<K, Events[K]>
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
      : EventHandler<EventKey & K, Events[EventKey & K]>,
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

  const waitUntilOn = <K extends EventKey>(type: K, id?: string): Promise<Event<K, Events[K]>> => {
    return new Promise((resolve) => {
      // @ts-expect-error
      const unsub = on(type, (event) => {
        if (id && event.id !== id) return
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
  ) => {
    let canceled = false

    const event: Event<K, Events[K]> = {
      cancel: () => {
        canceled = true
      },
      from: environment,
      id,
      payload,
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
    uuid: string = crypto.randomUUID(),
  ): Promise<Event<UntilK, Events[UntilK]>> => {
    await emit(type, payload, uuid)
    return waitUntilOn(typeUntil, uuid)
  }

  return {
    emit,
    emitAndWaitResponse,
    on,
    waitUntilOn,
  }
}
