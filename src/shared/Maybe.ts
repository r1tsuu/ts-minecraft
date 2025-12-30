export type Maybe<T> = MaybeNone<T> | MaybeSome<T>

class MaybeImpl<T> {
  protected constructor(
    readonly _type: 'none' | 'some',
    protected readonly _value: null | T,
  ) {}

  static from<T>(value: null | T | undefined): Maybe<T> {
    if (value === null || value === undefined) {
      return MaybeImpl.None()
    }

    return MaybeImpl.Some(value)
  }

  /**
   * Creates a Maybe from a Promise that may resolve to null or undefined.
   * If the promise rejects, it returns None.
   * @param promise - The promise to resolve.
   * @param onErr - Optional error handler called if the promise rejects.
   * @returns A Promise that resolves to a Maybe.
   * @example
   * ```typescript
   * const maybe = await Maybe.fromPromise(fetchData())
   * ```
   */
  static async fromPromise<T>(
    promise: Promise<null | T | undefined>,
    onErr?: (error: unknown) => void,
  ): Promise<Maybe<T>> {
    try {
      const value = await promise
      return MaybeImpl.from(value)
    } catch (error) {
      if (onErr) {
        onErr(error)
      }
      return MaybeImpl.None()
    }
  }

  static None<T>(): Maybe<T> {
    return new MaybeNone()
  }

  static Some<T>(value: T): Maybe<T> {
    return new MaybeSome(value)
  }

  static Unwrap<T>(maybe: Maybe<T>): T {
    return maybe.unwrap()
  }

  static When<T>(condition: boolean, value: () => T): Maybe<T> {
    if (condition) {
      return MaybeImpl.Some(value())
    }
    return MaybeImpl.None()
  }

  /**
   * Chains a Maybe-producing function if the Maybe is Some.
   * @param fn - The function to apply if the Maybe is Some.
   * @returns A new Maybe.
   * @example
   * ```typescript
   * const result = maybe.andThen(value => Maybe.Some(value + 1))
   * ```
   */
  andThen<U>(fn: (value: T) => Maybe<U>): Maybe<U> {
    if (this.isSome()) {
      return fn(this._value as T)
    }
    return MaybeImpl.None()
  }

  clone(): Maybe<T> {
    if (this.isSome()) {
      return MaybeImpl.Some(this._value as T)
    }
    return MaybeImpl.None()
  }
  expect(message: string): T {
    if (this._type === 'none') {
      throw new Error(message)
    }

    // @ts-expect-error type guard
    return this._value
  }
  flatMap<U>(fn: (value: T) => Maybe<U>): Maybe<U> {
    if (this.isSome()) {
      return fn(this._value as T)
    }

    return MaybeImpl.None()
  }

  isNone(): this is MaybeNone<T> {
    return this._type === 'none'
  }

  isSome(): this is MaybeSome<T> {
    return this._type === 'some'
  }

  map<U>(fn: (value: T) => U): Maybe<U> {
    if (this.isSome()) {
      return MaybeImpl.Some(fn(this._value as T))
    }

    return MaybeImpl.None()
  }

  /**
   * Maps a function over the Maybe if it is None.
   * @param fn - The function to produce a value if the Maybe is None.
   * @returns A new Maybe.
   * @example
   * ```typescript
   * const result = maybe.mapNone(() => 42)
   * ```
   */
  mapNone(fn: () => T): Maybe<T> {
    if (this.isNone()) {
      return MaybeImpl.Some(fn())
    }

    // @ts-expect-error
    return this
  }

  orElse(resolveFallback: () => Maybe<T>): Maybe<T> {
    if (this._type === 'none') {
      return resolveFallback()
    }

    // @ts-expect-error type guard
    return this
  }

  /**
   * Executes a side-effect function if the Maybe is Some.
   * @param fn - The function to execute with the unwrapped value.
   * @returns The original Maybe for chaining.
   * @example
   * ```typescript
   * maybe.tap(value => console.log(value))
   * ```
   */
  tap(fn: (value: T) => void): Maybe<T> {
    if (this.isSome()) {
      fn(this._value as T)
    }

    // @ts-expect-error
    return this
  }

  tapNone(fn: () => void): Maybe<T> {
    if (this.isNone()) {
      fn()
    }

    // @ts-expect-error
    return this
  }

  unwrap(): T {
    if (this._type === 'none') {
      throw new Error('Called unwrap on Maybe.None')
    }

    // @ts-expect-error type guard
    return this._value
  }

  unwrapOr(resolveFallback: () => T): T {
    if (this._type === 'none') {
      return resolveFallback()
    }

    // @ts-expect-error type guard
    return this._value
  }

  unwrapOrDefault(defaultValue: T): T {
    if (this._type === 'none') {
      return defaultValue
    }

    // @ts-expect-error type guard
    return this._value
  }

  valueOrNull(): null | T {
    return this._value
  }

  valueOrUndefined(): T | undefined {
    return this._value === null ? undefined : this._value
  }
}

class MaybeNone<T> extends MaybeImpl<T> {
  constructor() {
    super('none', null)
  }

  value(): null {
    return null
  }
}

class MaybeSome<T> extends MaybeImpl<T> {
  constructor(value: T) {
    super('some', value)
  }

  value(): T {
    return this._value as T
  }
}

export const None = MaybeImpl.None
export const Some = MaybeImpl.Some

export const isMaybe = <T>(value: unknown): value is Maybe<T> => {
  return value instanceof MaybeImpl
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Maybe {
  export const from = MaybeImpl.from
  export const fromPromise = MaybeImpl.fromPromise
  export const Unwrap = MaybeImpl.Unwrap
  export const When = MaybeImpl.When
}
