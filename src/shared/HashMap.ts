import { Maybe } from './Maybe.ts'

/**
 * A simple HashMap implementation that wraps a JavaScript Map.
 * Provides type safety and utility methods.
 * @template K The type of keys in the map.
 * @template V The type of values in the map.
 * @example
 * ```ts
 * const hashMap = new HashMap<string, number>()
 * hashMap.set('one', 1)
 * const maybeValue = hashMap.get('one') // Maybe.Some(1)
 * const value = maybeValue.unwrap() // 1
 * const missingValue = hashMap.get('two') // Maybe.None()
 * const size = hashMap.size() // 1
 * ```
 */
export class HashMap<K, V> {
  private readonly map: Map<K, V> = new Map()
  delete(key: K): boolean {
    return this.map.delete(key)
  }

  entries(): IterableIterator<[K, V]> {
    return this.map.entries()
  }

  get(key: K): Maybe<V> {
    const value = this.map.get(key)
    return value !== undefined ? Maybe.Some(value) : Maybe.None<V>()
  }

  has(key: K): boolean {
    return this.map.has(key)
  }

  keys(): IterableIterator<K> {
    return this.map.keys()
  }

  set(key: K, value: V): void {
    this.map.set(key, value)
  }

  size(): number {
    return this.map.size
  }

  [Symbol.iterator](): IterableIterator<[K, V]> {
    return this.map[Symbol.iterator]()
  }

  values(): IterableIterator<V> {
    return this.map.values()
  }
}
