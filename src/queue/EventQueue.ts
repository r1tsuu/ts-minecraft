/* ===========================================================
 * Core event types
 * =========================================================== */

import type { UUID } from '../types.ts'

import { type AnyEvent, Event } from './Event.ts'

const WILDCARD = '*'

type EventHandler<
  K extends string,
  D extends Record<string, unknown> = {},
  Meta extends Record<string, unknown> = {},
> = (event: Event<Exclude<K, WildcardKey>, D, Meta>) => Promise<void> | void

type EventKey<Events extends Record<string, unknown>> = keyof Events & string

type RegistryKey<Events extends Record<string, unknown>> = EventKey<Events> | WildcardKey
type WildcardKey = typeof WILDCARD

export class EventQueue<
  Events extends Record<string, Record<string, unknown>>,
  Meta extends Record<string, unknown> = {},
> {
  private beforeEmitHooks: ((event: AnyEvent<Events, Meta>) => Promise<void> | void)[] = []

  private registry = new Map<
    RegistryKey<Events>,
    {
      listeners: ((event: any) => Promise<void> | void)[]
    }
  >()

  addBeforeEmitHook(hook: (event: AnyEvent<Events, Meta>) => Promise<void> | void): void {
    this.beforeEmitHooks.push(hook)
  }

  async emit<K extends EventKey<Events>>(
    type: K,
    payload: Events[K],
    eventUUID?: UUID,
    metadata?: Meta,
  ): Promise<boolean> {
    const event = new Event(type, payload, eventUUID, metadata)

    for (const hook of this.beforeEmitHooks) {
      await hook(event)
    }

    // console.log(`Event`, event, `emitted from`, environment, isForwarded ? `(forwarded)` : ``)

    const listeners = [
      ...(this.registry.get(type)?.listeners ?? []),
      ...(this.registry.get(WILDCARD)?.listeners ?? []),
    ]

    for (const handler of listeners) {
      await handler(event)
      if (event.isCanceled) {
        break
      }
    }

    return !event.isCanceled
  }

  async emitAndWaitResponse<K extends EventKey<Events>, UntilK extends EventKey<Events>>(
    type: K,
    payload: Events[K],
    typeUntil: UntilK,
    eventUUID?: UUID,
    metadata?: Meta,
  ): Promise<Event<UntilK, Events[UntilK]>> {
    if (!eventUUID) {
      eventUUID = crypto.randomUUID()
    }
    this.emit(type, payload, eventUUID, metadata)
    return this.waitUntilOn(typeUntil, eventUUID)
  }

  on<K extends RegistryKey<Events>>(
    type: K,
    handler: K extends '*'
      ? (event: AnyEvent<Events, Meta>) => Promise<void> | void
      : EventHandler<K, Events[K], Meta>,
  ): () => void {
    let entry = this.registry.get(type)

    if (!entry) {
      entry = { listeners: [] }
      this.registry.set(type, entry)
    }

    entry.listeners.push(handler as any)

    return () => {
      entry!.listeners = entry!.listeners.filter((l) => l !== handler)
    }
  }

  removeBeforeEmitHook(hook: (event: AnyEvent<Events, Meta>) => Promise<void> | void): void {
    this.beforeEmitHooks = this.beforeEmitHooks.filter((h) => h !== hook)
  }

  async respond<OriginalK extends EventKey<Events>, K extends EventKey<Events>>(
    originalEvent: Event<OriginalK, Events[OriginalK], Meta>,
    type: K,
    payload: Events[K],
  ): Promise<void> {
    this.emit(type, payload, originalEvent.eventUUID)
    await this.waitUntilOn(type, originalEvent.eventUUID)
  }

  waitUntilOn<K extends EventKey<Events>>(
    type: K,
    eventUUID?: string,
  ): Promise<Event<K, Events[K], Meta>> {
    return new Promise((resolve) => {
      // @ts-expect-error
      const unsub = this.on(type, (event) => {
        // console.log('waitUntilOn received event:', event, eventUUID) // DEBUG
        if (eventUUID && event.eventUUID !== eventUUID) return
        resolve(event)
        unsub()
      })
    })
  }
}
