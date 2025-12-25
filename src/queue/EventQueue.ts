/* ===========================================================
 * Core event types
 * =========================================================== */

import type { UUID } from '../types.ts'

import { type AnyEvent, Event } from './Event.ts'

const WILDCARD = '*'

type EventHandler<
  K extends string,
  Events extends Record<string, Record<string, unknown>>,
  Meta extends Record<string, unknown> = {},
> = (
  event: Event<Exclude<K, WildcardKey>, K extends keyof Events ? Events[K] : any, Meta>,
) => Promise<void> | void

type EventKey<Events extends Record<string, unknown>> = keyof Events & string

type RegistryKey<Events extends Record<string, unknown>> = EventKey<Events> | WildcardKey
type WildcardKey = typeof WILDCARD

export class EventQueue<
  Events extends Record<string, Record<string, unknown>>,
  Meta extends Record<string, unknown> = {},
> {
  private beforeEmitHooks: ((event: AnyEvent<Events, Meta>) => Promise<void> | void)[] = []
  private eventTypesRegistry = new Map<string, {}>()

  private registry = new Map<
    RegistryKey<Events>,
    {
      listeners: ((event: any) => Promise<void> | void)[]
    }
  >()

  addBeforeEmitHook(hook: (event: AnyEvent<Events, Meta>) => Promise<void> | void): void {
    this.beforeEmitHooks.push(hook)
  }

  async emit<K extends ({} & string) | EventKey<Events>>(
    type: K,
    payload: K extends keyof Events ? Events[K] : any,
    eventUUID?: UUID,
    metadata?: Meta,
  ): Promise<boolean> {
    this.validateEventType(type)

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

  async emitAndWaitResponse<
    K extends ({} & string) | EventKey<Events>,
    UntilK extends ({} & string) | EventKey<Events>,
  >(
    type: K,
    payload: K extends keyof Events ? Events[K] : any,
    typeUntil: UntilK,
    eventUUID?: UUID,
    metadata?: Meta,
  ): Promise<Event<UntilK, UntilK extends keyof Events ? Events[UntilK] : any>> {
    if (!eventUUID) {
      eventUUID = crypto.randomUUID()
    }
    this.emit(type, payload, eventUUID, metadata)
    return this.waitUntilOn(typeUntil, eventUUID)
  }

  on<K extends ({} & string) | RegistryKey<Events>>(
    type: K,
    handler: K extends '*'
      ? (event: AnyEvent<Events, Meta>) => Promise<void> | void
      : EventHandler<K, Events, Meta>,
  ): () => void {
    this.validateEventType(type)

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

  registerEventType(type: string): void {
    this.eventTypesRegistry.set(type, {})
  }

  removeBeforeEmitHook(hook: (event: AnyEvent<Events, Meta>) => Promise<void> | void): void {
    this.beforeEmitHooks = this.beforeEmitHooks.filter((h) => h !== hook)
  }

  async respond<
    OriginalK extends ({} & string) | EventKey<Events>,
    K extends ({} & string) | EventKey<Events>,
  >(
    originalEvent: Event<OriginalK, OriginalK extends keyof Events ? Events[OriginalK] : any, Meta>,
    type: K,
    payload: K extends keyof Events ? Events[K] : any,
  ): Promise<void> {
    this.emit(type, payload, originalEvent.eventUUID)
    await this.waitUntilOn(type, originalEvent.eventUUID)
  }

  waitUntilOn<K extends ({} & string) | EventKey<Events>>(
    type: K,
    eventUUID?: string,
  ): Promise<Event<K, K extends keyof Events ? Events[K] : any, Meta>> {
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

  private validateEventType(type: string): void {
    if (!this.eventTypesRegistry.has(type) && type !== WILDCARD) {
      throw new Error(`Event type "${type}" is not registered in the EventQueue.`)
    }
  }
}
