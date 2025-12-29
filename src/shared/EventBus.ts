/**
 * Event Bus system for publishing and subscribing to events.
 * Supports event metadata and pre-publish hooks.
 */
import type { UUID } from '../types.ts'
import type { ClassConstructor } from './util.ts'

import { type AnyEvent, Event } from './Event.ts'
import { Maybe } from './Maybe.ts'

const EVENT_HANDLERS_KEY = Symbol('EVENT_HANDLERS')

const WILDCARD = '*'

export interface EventConstructor<
  T extends string = string,
  P extends object = object,
> extends ClassConstructor<P> {
  deserialize(obj: any): P
  readonly type: T
}

const getEventConstructor = (payloadObj: object): EventConstructor<string, object> => {
  return payloadObj.constructor as unknown as EventConstructor<string, object>
}

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

/**
 * EventBus class for managing event publishing and subscription.
 * Supports event metadata and pre-publish hooks.
 * @example
 * ```ts
 * const eventBus = new EventBus<MinecraftEventsData, MinecraftEventMetadata>()
 * eventBus.registerEventType('Client.JoinWorld')
 * eventBus.subscribe('Client.JoinWorld', (event) => {
 *   console.log('Player joined world with UUID:', event.payload.worldUUID)
 * })
 * eventBus.publish(new JoinWorld('some-uuid'))
 * ```
 * Note: Event types _must_ be registered using `registerEventType` before publishing or subscribing.
 */
export class EventBus<
  Events extends Record<string, Record<string, unknown>>,
  Meta extends Record<string, unknown> = {},
> {
  private beforeEmitHooks: ((event: AnyEvent<Events, Meta>) => void)[] = []
  private eventTypesRegistry = new Map<string, EventConstructor<any, any>>()

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

  getEventType(type: string): Maybe<EventConstructor<any, any>> {
    return Maybe.from(this.eventTypesRegistry.get(type))
  }

  /**
   * Publishes an event by passing a payload instance.
   * @param payloadInstance The payload instance to publish (must have static type property).
   * @param eventUUID Optional UUID for the event.
   * @param metadata Optional metadata for the event.
   * @example
   * ```ts
   * eventBus.publish(new JoinWorld('some-uuid'))
   * ```
   */
  publish(payloadInstance: object, eventUUID?: UUID, metadata?: Meta): void {
    const type = getEventConstructor(payloadInstance).type

    if (!type) {
      throw new Error('Payload instance must have a static type property')
    }

    this.validateEventType(type)

    const event = new Event(type, payloadInstance as Record<string, any>, eventUUID, metadata)

    for (const hook of this.beforeEmitHooks) {
      hook(event as AnyEvent<Events, Meta>)
    }

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
  registerEventType(constructor: EventConstructor<any, any>): void {
    this.eventTypesRegistry.set(constructor.type, constructor)
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
   * Publishes a response event to an original event and waits for confirmation.
   * @param originalEvent The original event to reply to.
   * @param payloadInstance The response payload instance.
   * @example
   * ```ts
   * await eventBus.reply(
   *   originalEvent,
   *   new ResponsePlayerJoin(player)
   * )
   * ```
   */
  async reply<OriginalK extends ({} & string) | EventKey<Events>>(
    originalEvent: Event<OriginalK, OriginalK extends keyof Events ? Events[OriginalK] : any, Meta>,
    payloadInstance: object,
  ): Promise<void> {
    const Constructor = getEventConstructor(payloadInstance)
    this.publish(payloadInstance, originalEvent.eventUUID)
    await this.waitFor(Constructor, {
      eventUUID: originalEvent.eventUUID,
    })
  }

  /**
   * Sends a request event and waits for a response event.
   * @param payloadInstance The request payload instance.
   * @param typeUntil The type of the response event to wait for.
   * @param options Additional options including eventUUID and metadata.
   * @returns A promise that resolves with the response event.
   * @example
   * ```ts
   * const responseEvent = await eventBus.request(
   *   new RequestPlayerJoin('player-uuid'),
   *   'Server.ResponsePlayerJoin'
   * )
   * console.log('Join response:', responseEvent.payload)
   * ```
   */
  async request<UntilK extends ({} & string) | EventKey<Events>>(
    payloadInstance: object,
    ConstructorUntil: EventConstructor<UntilK, any>,
    options?: {
      eventUUID?: UUID
      metadata?: Meta
      signal?: AbortSignal
    },
  ): Promise<Event<UntilK, UntilK extends keyof Events ? Events[UntilK] : any, Meta>> {
    const optionsFinal = options || {}

    if (!optionsFinal.eventUUID) {
      optionsFinal.eventUUID = crypto.randomUUID()
    }

    this.publish(payloadInstance, optionsFinal.eventUUID, optionsFinal.metadata)

    return this.waitFor(ConstructorUntil, {
      eventUUID: optionsFinal.eventUUID,
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
  subscribe<K extends ({} & string) | EventConstructor<string, object> | RegistryKey<Events>>(
    type: K,
    handler: K extends '*'
      ? (event: AnyEvent<Events, Meta>) => Promise<void> | void
      : EventHandler<K extends EventConstructor<string, object> ? K['type'] : K, Events, Meta>,
  ): () => void {
    this.validateEventType(type)

    const typeStr = typeof type === 'string' ? type : type.type
    let entry = this.registry.get(typeStr)

    if (!entry) {
      entry = { listeners: [] }
      this.registry.set(typeStr, entry)
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
   * @param Constructor The constructor of the event to wait for.
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
    Constructor: EventConstructor<K, any>,
    options: {
      eventUUID?: UUID
    } = {},
  ): Promise<Event<K, K extends keyof Events ? Events[K] : any, Meta>> {
    return new Promise((resolve) => {
      // @ts-expect-error
      const unsub = this.subscribe(Constructor.type, (event) => {
        if (options.eventUUID && event.eventUUID !== options.eventUUID) return
        resolve(event)
        unsub()
      })
    })
  }

  private validateEventType(type: EventConstructor<string, object> | string): void {
    const typeStr = typeof type === 'string' ? type : type.type
    if (!this.eventTypesRegistry.has(typeStr) && type !== WILDCARD) {
      throw new Error(`Event type "${type}" is not registered in the EventBus.`)
    }
  }
}
