/**
 * Event Bus system for publishing and subscribing to events.
 * Supports event metadata and pre-publish hooks.
 */
import type { UUID } from '../types.ts'

import { type AnyEvent, Event } from './Event.ts'

const EVENT_HANDLERS_KEY = Symbol('EVENT_HANDLERS')

const WILDCARD = '*'

type EventHandler<
  K extends string,
  Events extends Record<string, Record<string, unknown>>,
  Meta extends Record<string, unknown> = {},
> = (event: Event<Exclude<K, WildcardKey>, K extends keyof Events ? Events[K] : any, Meta>) => void

interface EventHandlerMetadata {
  eventType: string
  methodName: string
}

type EventKey<Events extends Record<string, unknown>> = keyof Events & string

type RegistryKey<Events extends Record<string, unknown>> = EventKey<Events> | WildcardKey
type WildcardKey = typeof WILDCARD

export class EventBus<
  Events extends Record<string, Record<string, unknown>>,
  Meta extends Record<string, unknown> = {},
> {
  private beforeEmitHooks: ((event: AnyEvent<Events, Meta>) => void)[] = []
  private eventTypesRegistry = new Set<string>()

  private registry = new Map<
    RegistryKey<Events>,
    {
      listeners: ((event: any) => void)[]
    }
  >()

  /**
   * Decorator to mark a method as an event handler.
   * @example
   * ```ts
   * class MyClass {
   *  @EventBus.Handler('Client.JoinWorld')
   *  onJoinWorld(event: MinecraftEvent<'Client.JoinWorld'>) {
   *    console.log('Player joined world with UUID:', event.payload.worldUUID)
   *  }
   * }
   * ```
   */
  static Handler<T extends string>(eventType: T) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      console.log(
        `Registering event handler for ${eventType} on ${target.constructor.name}.${propertyKey}`,
      )
      // Store metadata about this event handler
      if (!target.constructor[EVENT_HANDLERS_KEY]) {
        target.constructor[EVENT_HANDLERS_KEY] = []
      }

      target.constructor[EVENT_HANDLERS_KEY].push({
        eventType,
        methodName: propertyKey,
      })

      // Return the original method (binding happens at initialization)
      return descriptor
    }
  }

  /**
   * Decorator to mark a class as a EventBus listener.
   * Ensures automatic registration and unregistration of event handlers.
   * @example
   * ```ts
   * @EventBus.Listener(() => ClientContainer.resolve(MinecraftEventBus).unwrap())
   * class MyClass {
   *  @EventBus.Handler('Client.JoinWorld')
   *  onJoinWorld(event: MinecraftEvent<'Client.JoinWorld'>) {
   *    console.log('Player joined world with UUID:', event.payload.worldUUID)
   *  }
   * }
   */
  static Listener(
    resolveEventBus: () => Pick<EventBus<any, any>, 'registerHandlers' | 'unregisterHandlers'>,
  ): ClassDecorator {
    // @ts-expect-error
    return function <T extends new (...args: any[]) => any>(Target: T): T {
      return class extends Target {
        constructor(...args: any[]) {
          super(...args)

          const eventBus = resolveEventBus()
          eventBus.registerHandlers(this)
          const originalDispose = this.dispose?.bind(this)

          this.dispose = () => {
            originalDispose?.()
            eventBus.unregisterHandlers(this)
            console.log(`Unregistered Minecraft client event handlers for ${Target.name}`)
          }

          console.log(`Registered Minecraft client event handlers for ${Target.name}`)
        }
      }
    }
  }

  /**
   * Adds a hook that is called before an event is published.
   * @param hook The hook function to add.
   * @example
   * ```ts
   * eventBus.addPrePublishHook((event) => {
   *   console.log('About to publish event:', event)
   * })
   * ```
   */
  addPrePublishHook(hook: (event: AnyEvent<Events, Meta>) => void): void {
    this.beforeEmitHooks.push(hook)
  }

  /**
   * Publishes an event to all subscribed listeners.
   * @param type The type of the event to publish.
   * @param payload The payload of the event.
   * @param eventUUID Optional UUID for the event. If not provided, a new UUID will be generated.
   * @param metadata Optional metadata for the event.
   * @example
   * ```ts
   * eventBus.publish('Client.JoinWorld', { worldUUID: 'some-uuid' })
   * ```
   */
  publish<K extends ({} & string) | EventKey<Events>>(
    type: K,
    payload: K extends keyof Events ? Events[K] : any,
    eventUUID?: UUID,
    metadata?: Meta,
  ): void {
    this.validateEventType(type)

    const event = new Event(type, payload, eventUUID, metadata)

    for (const hook of this.beforeEmitHooks) {
      hook(event)
    }

    // console.log(`Event`, event, `emitted from`, environment, isForwarded ? `(forwarded)` : ``)

    const listeners = [
      ...(this.registry.get(type)?.listeners ?? []),
      ...(this.registry.get(WILDCARD)?.listeners ?? []),
    ]

    for (const handler of listeners) {
      handler(event)
      if (event.isCanceled()) {
        break
      }
    }
  }

  /**
   * Registers an event type in the EventBus.
   * Must be called before publishing or subscribing to the event type.
   *
   * @param type - The event type to register
   * @example
   * ```ts
   * eventBus.registerEventType('Client.JoinWorld')
   * ```
   */
  registerEventType(type: string): void {
    this.eventTypesRegistry.add(type)
  }

  /**
   * Registers all event handlers decorated with @EventBus.Handler
   * Call this in the constructor after initializing the eventBus instance
   *
   * @param instance - The class instance to register handlers for
   * @returns Array of unsubscribe functions
   */
  registerHandlers(instance: Record<string, any>): Array<() => void> {
    const constructor = instance.constructor as any
    const handlers: EventHandlerMetadata[] = constructor[EVENT_HANDLERS_KEY] || []
    const unsubscribers: Array<() => void> = []

    for (const handler of handlers) {
      const method = (instance as any)[handler.methodName]

      if (typeof method !== 'function') {
        console.warn(`Event handler ${handler.methodName} is not a function on ${constructor.name}`)
        continue
      }

      // Bind the method and register it
      const boundMethod = method.bind(instance)
      const unsubscribe = this.subscribe(handler.eventType, boundMethod)
      unsubscribers.push(unsubscribe)
    }

    // Store unsubscribers for disposal
    ;(instance as any)[EVENT_HANDLERS_KEY] = unsubscribers

    return unsubscribers
  }

  /**
   * Removes a pre-publish hook.
   * @param hook The hook function to remove.
   * @example
   * ```ts
   * const myHook = (event) => { ... }
   * eventBus.addPrePublishHook(myHook)
   * ...
   * eventBus.removePrePublishHook(myHook)
   * ```
   */
  removePrePublishHook(hook: (event: AnyEvent<Events, Meta>) => void): void {
    this.beforeEmitHooks = this.beforeEmitHooks.filter((h) => h !== hook)
  }

  /**
   * Publishes an event and waits for a response event.
   * @param originalEvent The original event to reply to.
   * @param type The type of the response event.
   * @param payload The payload of the response event.
   * @example
   * ```ts
   * await eventBus.reply(
   *   originalEvent,
   *   'Server.ResponseJoinWorld',
   *   { success: true }
   * )
   * ```
   */
  async reply<
    OriginalK extends ({} & string) | EventKey<Events>,
    K extends ({} & string) | EventKey<Events>,
  >(
    originalEvent: Event<OriginalK, OriginalK extends keyof Events ? Events[OriginalK] : any, Meta>,
    type: K,
    payload: K extends keyof Events ? Events[K] : any,
  ): Promise<void> {
    this.publish(type, payload, originalEvent.eventUUID)
    await this.waitFor(type, {
      eventUUID: originalEvent.eventUUID,
    })
  }

  /**
   * Publishes an event and waits for a specific response event.
   * @param type The type of the event to publish.
   * @param payload The payload of the event.
   * @param typeUntil The type of the response event to wait for.
   * @param options Additional options including eventUUID and metadata.
   * @example
   * ```ts
   * const responseEvent = await eventBus.request(
   *   'Client.RequestJoinWorld',
   *   { worldUUID: 'some-uuid' },
   *   'Server.ResponseJoinWorld'
   * )
   * ```
   */
  async request<
    K extends ({} & string) | EventKey<Events>,
    UntilK extends ({} & string) | EventKey<Events>,
  >(
    type: K,
    payload: K extends keyof Events ? Events[K] : any,
    typeUntil: UntilK,
    options: {
      eventUUID?: UUID
      metadata?: Meta
      /**
       * TODO: AbortSignal to cancel waiting for response
       */
      signal?: AbortSignal
    } = {},
  ): Promise<Event<UntilK, UntilK extends keyof Events ? Events[UntilK] : any>> {
    if (!options.eventUUID) {
      options.eventUUID = crypto.randomUUID()
    }
    this.publish(type, payload, options.eventUUID, options.metadata)
    return this.waitFor(typeUntil, {
      eventUUID: options.eventUUID,
    })
  }

  /**
   * Subscribes to an event type with a handler function.
   * @param type The type of the event to subscribe to.
   * @param handler The handler function to call when the event is published.
   * @returns A function to unsubscribe the handler.
   * @example
   * ```ts
   * const unsubscribe = eventBus.subscribe('Client.JoinWorld', (event) => {
   *   console.log('Player joined world with UUID:', event.payload.worldUUID)
   * })
   *
   * // To unsubscribe later:
   * unsubscribe()
   *
   * // subscribe to all events:
   * const unsubscribeAll = eventBus.subscribe('*', (event) => {
   *   console.log('Event occurred:', event)
   * })
   * ```
   */
  subscribe<K extends ({} & string) | RegistryKey<Events>>(
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

  /**
   * Unregisters all event handlers for an instance
   * Call this in the dispose() method
   *
   * @param instance - The class instance to unregister handlers for
   */
  unregisterHandlers<T extends Record<string, any>>(instance: T): void {
    const unsubscribers = (instance as any)[EVENT_HANDLERS_KEY] || []

    for (const unsubscribe of unsubscribers) {
      unsubscribe()
    }

    ;(instance as any)[EVENT_HANDLERS_KEY] = []
  }

  /**
   * Waits for a specific event to be published.
   * @param type The type of the event to wait for.
   * @param options Additional options including eventUUID.
   * @returns A promise that resolves with the event when it is published.
   * @example
   * ```ts
   * const event = await eventBus.waitFor('Server.ResponseJoinWorld', {
   *   eventUUID: 'some-uuid'
   * })
   * ```
   */
  waitFor<K extends ({} & string) | EventKey<Events>>(
    type: K,
    options: {
      eventUUID?: UUID
    } = {},
  ): Promise<Event<K, K extends keyof Events ? Events[K] : any, Meta>> {
    return new Promise((resolve) => {
      // @ts-expect-error
      const unsub = this.subscribe(type, (event) => {
        if (options.eventUUID && event.eventUUID !== options.eventUUID) return
        resolve(event)
        unsub()
      })
    })
  }

  private validateEventType(type: string): void {
    if (!this.eventTypesRegistry.has(type) && type !== WILDCARD) {
      throw new Error(`Event type "${type}" is not registered in the EventBus.`)
    }
  }
}
