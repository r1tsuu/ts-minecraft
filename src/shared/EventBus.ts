import type { UUID } from '../types.ts'
/**
 * Event Bus system for publishing and subscribing to events.
 * Supports event metadata and pre-publish hooks.
 */
import type { ClassConstructor } from './util.ts'

import { Event, type EventMetadata } from './Event.ts'
import { Maybe } from './Maybe.ts'

const EVENT_HANDLERS_KEY = Symbol('EVENT_HANDLERS')
const WILDCARD = '*'

export interface EventConstructor<T extends Event<any>> extends ClassConstructor<T> {
  deserialize(obj: any): T
  readonly type: string
}

const getEventConstructor = <T extends Event<any>>(event: T): EventConstructor<T> => {
  return event.constructor as EventConstructor<T>
}

export type WildcardKey = typeof WILDCARD

type EventHandler<E extends Event<any>> = (event: E) => Promise<void> | void

interface EventHandlerMetadata {
  Constructor: EventConstructor<any>
  methodName: string
}

/**
 * EventBus class for managing event publishing and subscription.
 * @example
 * ```ts
 * const eventBus = new EventBus()
 * eventBus.registerEventType(JoinWorld)
 * eventBus.subscribe(JoinWorld, (event) => {
 *   console.log('Player joined world with UUID:', event.worldUUID)
 * })
 * eventBus.publish(new JoinWorld('some-uuid'))
 * ```
 * Note: Event types _must_ be registered using `registerEventType` before publishing or subscribing.
 */
export class EventBus<E extends Event<EventMetadata>> {
  private beforeEmitHooks: ((event: E) => void)[] = []
  private eventTypesRegistry = new Map<string, EventConstructor<any>>()
  private registry = new Map<string | WildcardKey, { listeners: ((event: any) => void)[] }>()

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
  static Handler<T extends EventConstructor<any>>(Constructor: T | WildcardKey) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      console.log(
        `Registering event handler for ${typeof Constructor === 'string' ? Constructor : Constructor.type} on ${target.constructor.name}.${propertyKey}`,
      )
      // Store metadata about this event handler
      if (!target.constructor[EVENT_HANDLERS_KEY]) {
        target.constructor[EVENT_HANDLERS_KEY] = []
      }

      target.constructor[EVENT_HANDLERS_KEY].push({
        methodName: propertyKey,
        type: typeof Constructor === 'string' ? Constructor : Constructor.type,
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
    resolveEventBus: () => Pick<EventBus<Event<any>>, 'registerHandlers' | 'unregisterHandlers'>,
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
  addPrePublishHook(hook: (event: E) => void): void {
    this.beforeEmitHooks.push(hook)
  }

  getEventConstructor<T extends E>(type: string): Maybe<EventConstructor<T>> {
    return Maybe.from(this.eventTypesRegistry.get(type))
  }

  getEventType<T extends E>(type: string): Maybe<EventConstructor<T>> {
    return Maybe.from(this.eventTypesRegistry.get(type))
  }

  /**
   * Publishes an event.
   * @param event The event instance to publish.
   * @example
   * ```ts
   * eventBus.publish(new JoinWorld('some-uuid'))
   * ```
   */
  publish<T extends E>(event: T, uuid?: UUID): void {
    const type = getEventConstructor(event).type

    if (uuid) {
      event.metadata.uuid = Maybe.Some(uuid)
    }

    if (!type) {
      throw new Error('Event must have a type property')
    }

    this.validateEventType(type)

    for (const hook of this.beforeEmitHooks) {
      hook(event)
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
   * @param EventConstructor - The event constructor to register
   * @example
   * ```ts
   * eventBus.registerEventType(JoinWorld)
   * ```
   */
  registerEventType<T extends Event<any>>(EventConstructor: EventConstructor<T>): void {
    this.eventTypesRegistry.set(EventConstructor.name, EventConstructor)
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
      const unsubscribe = this.subscribe(handler.Constructor, boundMethod)
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
  removePrePublishHook(hook: (event: Event<any>) => void): void {
    this.beforeEmitHooks = this.beforeEmitHooks.filter((h) => h !== hook)
  }

  /**
   * Publishes a response event to an original event and waits for confirmation.
   * @param originalEvent The original event to reply to.
   * @param responseEvent The response event instance.
   * @example
   * ```ts
   * await eventBus.reply(
   *   originalEvent,
   *   new ResponsePlayerJoin(player)
   * )
   * ```
   */
  async reply<T extends E, R extends E>(originalEvent: T, responseEvent: R): Promise<void> {
    const Constructor = getEventConstructor(responseEvent)
    responseEvent.metadata.uuid = originalEvent.metadata.uuid.clone()
    this.publish(responseEvent)
    await this.waitFor(Constructor, originalEvent.metadata.uuid.unwrap())
  }

  /**
   * Sends a request event and waits for a response event.
   * @param requestEvent The request event instance.
   * @param ResponseEventConstructor The constructor of the response event to wait for.
   * @returns A promise that resolves with the response event.
   * @example
   * ```ts
   * const responseEvent = await eventBus.request(
   *   new RequestPlayerJoin('player-uuid'),
   *   ResponsePlayerJoin
   * )
   * console.log('Join response:', responseEvent)
   * ```
   */
  async request<T extends E, R extends E>(
    requestEvent: T,
    ResponseEventConstructor: EventConstructor<R>,
  ): Promise<R> {
    if (requestEvent.metadata.uuid.isNone()) {
      requestEvent.metadata.uuid = Maybe.Some(crypto.randomUUID())
    }

    this.publish(requestEvent)

    return this.waitFor(ResponseEventConstructor, requestEvent.metadata.uuid.unwrap())
  }

  /**
   * Subscribes to an event type with a handler function.
   * @param wildcardOrEventConstructor The type (string, Constructor, or '*') of the event to subscribe to.
   * @param handler The handler function to call when the event is published.
   * @returns A function to unsubscribe the handler.
   * @example
   * ```ts
   * // Subscribe by string type
   * const unsubscribe = eventBus.subscribe('Client.JoinWorld', (event) => {
   *   console.log('Player joined world with UUID:', event.worldUUID)
   * })
   *
   * // Subscribe by Constructor
   * const unsubscribe2 = eventBus.subscribe(JoinWorld, (event) => {
   *   console.log('Player joined world with UUID:', event.worldUUID)
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
  subscribe<T extends E>(
    EventConstructor: EventConstructor<T>,
    handler: EventHandler<T>,
  ): () => void
  subscribe(type: ({} & string) | WildcardKey, handler: EventHandler<E>): () => void
  subscribe<T extends Event<any>>(
    wildcardOrEventConstructor: EventConstructor<T> | string,
    handler: EventHandler<T>,
  ): () => void {
    this.validateEventType(wildcardOrEventConstructor)

    const typeStr =
      typeof wildcardOrEventConstructor === 'string'
        ? wildcardOrEventConstructor
        : wildcardOrEventConstructor.type

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
   * const event = await eventBus.waitFor(ResponsePlayerJoin, {
   *   eventUUID: 'some-uuid'
   * })
   * ```
   */
  waitFor<T extends E>(Constructor: EventConstructor<T>, eventUUID?: UUID): Promise<T> {
    return new Promise((resolve) => {
      const unsub = this.subscribe(Constructor, (event) => {
        const uuid = event.metadata.uuid
        if (eventUUID && uuid.isSome() && uuid.unwrap() !== eventUUID) return
        resolve(event)
        unsub()
      })
    })
  }

  private validateEventType(type: '*' | EventConstructor<any> | string): void {
    const typeStr = typeof type === 'string' ? type : type.type
    if (!this.eventTypesRegistry.has(typeStr) && type !== WILDCARD) {
      throw new Error(`Event type "${typeStr}" is not registered in the EventBus.`)
    }
  }
}
