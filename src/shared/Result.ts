export type Result<T, E = unknown> = ResultErr<E> | ResultOk<T>

// @ts-expect-error
class ResultImpl<T, E = unknown> implements Result<T, E> {
  protected constructor(
    readonly _type: 'err' | 'ok',
    protected readonly _value?: T,
    protected readonly _error?: E,
  ) {}

  static Err<E = unknown>(error: E): ResultErr<E> {
    // @ts-expect-error
    return new ResultImpl<T, E>('err', undefined, error)
  }

  static Ok<T>(value: T): ResultOk<T> {
    // @ts-expect-error
    return new ResultImpl<T, E>('ok', value, undefined)
  }

  static Unwrap<T, E = unknown>(result: Result<T, E>): T {
    return result.unwrap()
  }

  isErr(): this is ResultErr<E> {
    return this._type === 'err'
  }

  isOk(): this is ResultOk<T> {
    return this._type === 'ok'
  }

  map<U>(fn: (value: T) => U): Result<U, E> {
    if (this.isOk()) {
      return ResultImpl.Ok<U>(fn(this._value as T))
    } else {
      return ResultImpl.Err<E>(this._error as E)
    }
  }

  mapErr<F>(fn: (error: E) => F): Result<T, F> {
    if (this.isErr()) {
      return ResultImpl.Err<F>(fn(this._error as E))
    } else {
      return ResultImpl.Ok<T>(this._value as T)
    }
  }

  tap(fn: (value: T) => void): Result<T, E> {
    if (this.isOk()) {
      fn(this._value as T)
    }
    // @ts-expect-error
    return this
  }

  tapErr(fn: (error: E) => void): Result<T, E> {
    if (this.isErr()) {
      fn(this._error as E)
    }
    // @ts-expect-error
    return this
  }

  unwrap(): T {
    if (this.isOk()) {
      return this._value as T
    } else {
      throw new Error(`Tried to unwrap an Err value: ${this._error}`)
    }
  }

  unwrapErr(): E {
    if (this.isErr()) {
      return this._error as E
    } else {
      throw new Error(`Tried to unwrapErr an Ok value: ${this._value}`)
    }
  }
}

class ResultErr<E> extends ResultImpl<never, E> {
  constructor(error: E) {
    super('err', undefined, error)
  }

  error(): E {
    return this._error as E
  }
}

class ResultOk<T> extends ResultImpl<T, never> {
  constructor(value: T) {
    super('ok', value, undefined)
  }

  value(): T {
    return this._value as T
  }
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Result {
  export const Err = ResultImpl.Err
  export const Ok = ResultImpl.Ok
  export const Unwrap = ResultImpl.Unwrap
}
