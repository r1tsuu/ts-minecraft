import { HashMap } from './HashMap.ts'
import { isMaybe, Maybe, None, Some } from './Maybe.ts'

/**
 * A type-safe Pipeline class for functional method chaining
 */
class Pipeline<T> {
  constructor(private readonly _value: T) {}

  collectArray(): Pipeline<Array<T extends Iterable<infer R> ? R : never>> {
    if (!(Symbol.iterator in Object(this._value))) {
      throw new Error('collectArray can only be called on Chain wrapping an iterable')
    }

    const result = Array.from(this._value as Iterable<any>)
    return new Pipeline(result)
  }

  /**
   * Provide a default value if current value is null or undefined
   */
  default<U>(defaultValue: U): Pipeline<NonNullable<T> | U> {
    return new Pipeline((this._value ?? defaultValue) as NonNullable<T> | U)
  }

  /**
   * Filter the value - if predicate fails, returns Chain with undefined
   */
  filter(predicate: (value: T) => boolean): Pipeline<T | undefined> {
    return new Pipeline(predicate(this._value) ? this._value : undefined)
  }

  filterIter(
    predicate: (value: T extends Iterable<infer R> ? R : never) => boolean,
  ): Pipeline<Iterable<T extends Iterable<infer R> ? R : never>> {
    if (!(Symbol.iterator in Object(this._value))) {
      throw new Error('filterIter can only be called on Chain wrapping an iterable')
    }

    function* generator(this: Pipeline<T>) {
      for (const item of this._value as Iterable<any>) {
        if (predicate(item)) {
          yield item
        }
      }
    }

    return new Pipeline(generator.call(this))
  }

  /**
   * Flat map - useful for chaining operations that return Chain
   */
  flatMap<U>(fn: (value: T) => Pipeline<U>): Pipeline<U> {
    return fn(this._value)
  }

  flattenArray(): Pipeline<T extends Array<infer U> ? U : never> {
    if (!Array.isArray(this._value)) {
      throw new Error('flattenArray can only be called on Chain wrapping an array')
    }
    const result = (this._value as Array<any>).flat()
    return new Pipeline(result) as Pipeline<T extends Array<infer U> ? U : never>
  }

  from<T>(value: T): Pipeline<T> {
    return new Pipeline(value)
  }

  iterLast(): Pipeline<T extends Iterable<infer R> ? Maybe<R> : never> {
    if (!(Symbol.iterator in Object(this._value))) {
      throw new Error('iterLast can only be called on Chain wrapping an iterable')
    }

    let last: any = None()
    for (const item of this._value as Iterable<any>) {
      last = Some(item)
    }

    return new Pipeline(last)
  }

  iterToMap<K, V>(
    fn: (value: T extends Iterable<infer R> ? R : never) => [K, V],
  ): Pipeline<HashMap<K, V>> {
    if (!(Symbol.iterator in Object(this._value))) {
      throw new Error('iterToMap can only be called on Chain wrapping an iterable')
    }

    const result = new HashMap<K, V>()
    console.log('Building map from iterable...', this._value)
    for (const item of this._value as Iterable<any>) {
      const [key, value] = fn(item)
      result.set(key, value)
    }

    return new Pipeline(result)
  }

  /**
   * Transform the current value using a mapping function
   */
  map<U>(fn: (value: T) => U): Pipeline<U> {
    return new Pipeline(fn(this._value))
  }

  mapArray<U>(fn: (value: T extends Array<infer R> ? R : never) => U): Pipeline<U[]> {
    if (!Array.isArray(this._value)) {
      throw new Error('mapArray can only be called on Chain wrapping an array')
    }
    const result = (this._value as Array<any>).map(fn)
    return new Pipeline(result)
  }

  mapIter<U>(
    fn: (value: T extends Iterable<infer R> ? R : never) => U,
  ): Pipeline<IterableIterator<U>> {
    if (!(Symbol.iterator in Object(this._value))) {
      throw new Error('mapIter can only be called on Chain wrapping an iterable')
    }

    function* generator(this: Pipeline<T>) {
      for (const item of this._value as Iterable<any>) {
        yield fn(item)
      }
    }

    return new Pipeline(generator.call(this))
  }

  /**
   * Apply a side effect without changing the value
   */
  tap(fn: (value: T) => void): Pipeline<T> {
    fn(this._value)
    return this
  }

  tapIter(fn: (value: T extends IterableIterator<infer R> ? R : never) => void): Pipeline<T> {
    if (!(Symbol.iterator in Object(this._value))) {
      throw new Error('tapIter can only be called on Chain wrapping an iterable')
    }

    for (const item of this._value as Iterable<any>) {
      fn(item)
    }

    return this
  }

  tapSome(fn: (value: T extends Maybe<infer R> ? R : never) => void): Pipeline<T> {
    if (isMaybe(this._value) && this._value.isSome()) {
      // @ts-expect-error
      fn(this._value.value())
    }

    return this
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
  when<R>(predicate: (value: T) => boolean, fn: (value: T) => R): Pipeline<R | T> {
    return new Pipeline(predicate(this._value) ? fn(this._value) : this._value)
  }
}

/**
 * Factory function to create a new Pipeline
 * @example
 * const result = pipe(5)
 *   .map(x => x * 2)
 *   .filter(x => x > 5)
 *   .value(); // result is 10
 */
export function pipe<T>(value: T): Pipeline<T> {
  return new Pipeline(value)
}
