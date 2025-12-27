export class Option<T> {
  protected constructor(protected readonly _value: null | T) {}

  static from<T>(value: null | T | undefined): Option<T> {
    if (value === null || value === undefined) {
      return Option.None()
    }

    return Option.Some(value)
  }

  /**
   * Creates an Option from a Promise that may resolve to null or undefined.
   * If the promise rejects, it returns None.
   * @param promise - The promise to resolve.
   * @param onErr - Optional error handler called if the promise rejects.
   * @returns A Promise that resolves to an Option.
   * @example
   * ```typescript
   * const option = await Option.fromPromise(fetchData())
   * ```
   */
  static async fromPromise<T>(
    promise: Promise<null | T | undefined>,
    onErr?: (error: unknown) => void,
  ): Promise<Option<T>> {
    try {
      const value = await promise
      return Option.from(value)
    } catch (error) {
      if (onErr) {
        onErr(error)
      }
      return Option.None()
    }
  }

  static None<T>(): Option<T> {
    return new OptionNone()
  }

  static Some<T>(value: T): Option<T> {
    return new OptionSome(value)
  }

  flatMap<U>(fn: (value: T) => Option<U>): Option<U> {
    if (this.isSome()) {
      return fn(this._value as T)
    }

    return Option.None()
  }

  isNone(): this is OptionNone<T> {
    return this._value === null
  }

  isSome(): this is OptionSome<T> {
    return this._value !== null
  }

  map<U>(fn: (value: T) => U): Option<U> {
    if (this.isSome()) {
      return Option.Some(fn(this._value as T))
    }

    return Option.None()
  }

  unwrap(): T {
    if (this._value === null) {
      throw new Error('Called unwrap on None option')
    }

    return this._value
  }

  unwrapOr(resolveFallback: () => T): T {
    if (this._value === null) {
      return resolveFallback()
    }

    return this._value
  }

  valueOrNull(): null | T {
    return this._value
  }
}

class OptionNone<T> extends Option<T> {
  constructor() {
    super(null)
  }

  value(): null {
    return null
  }
}

class OptionSome<T> extends Option<T> {
  constructor(value: T) {
    super(value)
  }

  value(): T {
    return this._value as T
  }
}
