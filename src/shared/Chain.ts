/**
 * A type-safe Chain class for functional method chaining
 */
class Chain<T> {
  constructor(private readonly _value: T) {}

  /**
   * Provide a default value if current value is null or undefined
   */
  default<U>(defaultValue: U): Chain<NonNullable<T> | U> {
    return new Chain((this._value ?? defaultValue) as NonNullable<T> | U)
  }

  /**
   * Filter the value - if predicate fails, returns Chain with undefined
   */
  filter(predicate: (value: T) => boolean): Chain<T | undefined> {
    return new Chain(predicate(this._value) ? this._value : undefined)
  }

  /**
   * Flat map - useful for chaining operations that return Chain
   */
  flatMap<U>(fn: (value: T) => Chain<U>): Chain<U> {
    return fn(this._value)
  }

  flattenArray(): Chain<T extends Array<infer U> ? U : never> {
    if (!Array.isArray(this._value)) {
      throw new Error('flattenArray can only be called on Chain wrapping an array')
    }
    const result = (this._value as Array<any>).flat()
    return new Chain(result) as Chain<T extends Array<infer U> ? U : never>
  }

  from<T>(value: T): Chain<T> {
    return new Chain(value)
  }

  /**
   * Transform the current value using a mapping function
   */
  map<U>(fn: (value: T) => U): Chain<U> {
    return new Chain(fn(this._value))
  }

  mapArray<U>(fn: (value: T extends Array<infer R> ? R : never) => U): Chain<U[]> {
    if (!Array.isArray(this._value)) {
      throw new Error('mapArray can only be called on Chain wrapping an array')
    }
    const result = (this._value as Array<any>).map(fn)
    return new Chain(result)
  }

  mapIter<U>(fn: (value: T extends Iterable<infer R> ? R : never) => U): Chain<Iterable<U>> {
    if (!(Symbol.iterator in Object(this._value))) {
      throw new Error('mapIter can only be called on Chain wrapping an iterable')
    }

    function* generator(this: Chain<T>) {
      for (const item of this._value as Iterable<any>) {
        yield fn(item)
      }
    }

    return new Chain(generator.call(this))
  }

  /**
   * Apply a side effect without changing the value
   */
  tap(fn: (value: T) => void): Chain<T> {
    fn(this._value)
    return this
  }

  tapIter(fn: (value: T extends Iterable<infer R> ? R : never) => void): Chain<T> {
    if (!(Symbol.iterator in Object(this._value))) {
      throw new Error('tapIter can only be called on Chain wrapping an iterable')
    }

    for (const item of this._value as Iterable<any>) {
      fn(item)
    }

    return this
  }

  /**
   * Alias for value()
   */
  unwrap(): T {
    return this._value
  }

  /**
   * Get the final value
   */
  value(): T {
    return this._value
  }

  /**
   * Execute a function if the value matches a condition
   */
  when<R>(predicate: (value: T) => boolean, fn: (value: T) => R): Chain<R | T> {
    return new Chain(predicate(this._value) ? fn(this._value) : this._value)
  }
}

/**
 * Factory function to create a new Chain
 */
export function chain<T>(value: T): Chain<T> {
  return new Chain(value)
}
