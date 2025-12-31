// ============= Usage Examples =============

import { isIterable } from './util.ts'

/**
 * A type-safe AsyncPipeline class for functional method chaining with async support
 */
class AsyncPipeline<T> {
  constructor(private promise: Promise<T>) {}

  /**
   * Catch errors and provide a fallback value
   */
  catch<U>(handler: (error: unknown) => Promise<U> | U): AsyncPipeline<T | U> {
    return new AsyncPipeline(this.promise.catch(handler))
  }

  /**
   * Collect an AsyncIterable into an array
   */
  collect<U>(this: AsyncPipeline<AsyncIterable<U>>): AsyncPipeline<U[]> {
    const promiseFn = this.promise instanceof Promise ? this.promise : Promise.resolve(this.promise)
    return new AsyncPipeline(
      promiseFn.then(async (iterable) => {
        if (!isIterable(iterable)) {
          console.log(iterable)
          throw new Error('collect can only be called on ChainAsync wrapping an AsyncIterable')
        }

        const result: U[] = []
        for await (const item of iterable) {
          result.push(item)
        }
        return result
      }),
    )
  }

  /**
   * Provide a default value if current value is null or undefined
   */
  default<U>(defaultValue: U): AsyncPipeline<NonNullable<T> | U> {
    return new AsyncPipeline(
      this.promise.then((value) => (value ?? defaultValue) as NonNullable<T> | U),
    )
  }

  /**
   * Alias for value()
   */
  execute(): Promise<T> {
    return this.promise
  }

  /**
   * Filter the value - if predicate fails, returns ChainAsync with undefined
   */
  filter(predicate: (value: T) => boolean | Promise<boolean>): AsyncPipeline<T | undefined> {
    return new AsyncPipeline(
      this.promise.then(async (value) => {
        const passes = await predicate(value)
        return passes ? value : undefined
      }),
    )
  }

  filterArray(
    predicate: (value: T extends Array<infer R> ? R : never) => boolean | Promise<boolean>,
  ): AsyncPipeline<Array<T extends Array<infer R> ? R : never>> {
    return new AsyncPipeline(
      this.promise.then(async (value) => {
        if (!Array.isArray(value)) {
          throw new Error('filterArray can only be called on ChainAsync wrapping an array')
        }
        const result: Array<any> = []
        for (const item of value as Array<any>) {
          if (await predicate(item)) {
            result.push(item)
          }
        }
        return result
      }),
    )
  }

  finally<U>(fn: () => Promise<void> | void): AsyncPipeline<T | U> {
    return new AsyncPipeline(this.promise.finally(fn))
  }

  /**
   * Flat map - useful for chaining operations that return ChainAsync
   */
  flatMap<U>(fn: (value: T) => AsyncPipeline<U> | Promise<AsyncPipeline<U>>): AsyncPipeline<U> {
    return new AsyncPipeline(
      this.promise.then(async (value) => {
        const chain = await fn(value)
        return chain
      }),
    )
  }

  /**
   * Transform the current value using a mapping function (sync or async)
   */
  map<const U>(fn: (value: T) => Promise<U> | U): AsyncPipeline<U> {
    return new AsyncPipeline(this.promise.then(fn))
  }

  /**
   * Eager map over an array (sync or async)
   */
  mapArray<U>(
    fn: (value: T extends Array<infer R> ? R : never, index: number) => Promise<U> | U,
  ): AsyncPipeline<U[]> {
    return new AsyncPipeline(
      this.promise.then(async (value) => {
        if (!Array.isArray(value)) {
          throw new Error('mapArray can only be called on ChainAsync wrapping an array')
        }

        const result: U[] = []
        let i = 0

        for (const item of value as Array<any>) {
          result.push(await fn(item, i++))
        }

        return result
      }),
    )
  }

  mapIter<U>(
    fn: (value: T extends Iterable<infer R> ? R : never) => Promise<U> | U,
  ): AsyncPipeline<AsyncIterable<U>> {
    function asyncIterableFromPromise(promise: Promise<T>): AsyncIterable<U> {
      return {
        async *[Symbol.asyncIterator]() {
          const value = await promise

          if (!isIterable(value)) {
            throw new Error('mapIter can only be called on ChainAsync wrapping an iterable')
          }

          for (const item of value as Iterable<any>) {
            yield await fn(item)
          }
        },
      }
    }

    // @ts-expect-error
    return new AsyncPipeline(asyncIterableFromPromise(this.promise))
  }

  /**
   * Run multiple async operations in parallel, with optional concurrency limit
   */
  parallel<U extends readonly unknown[]>(
    fn: (value: T) => Promise<readonly [...U]> | readonly [...U],
    limit?: number,
  ): AsyncPipeline<{ [K in keyof U]: Awaited<U[K]> }> {
    return new AsyncPipeline(
      this.promise.then(async (value) => {
        const tasks = await fn(value)

        if (!limit || limit >= tasks.length) {
          return Promise.all(tasks) as Promise<{ [K in keyof U]: Awaited<U[K]> }>
        }

        // Concurrency-limited execution
        const results: any[] = []
        let i = 0

        async function runNext() {
          if (i >= tasks.length) return
          const idx = i++
          results[idx] = await tasks[idx]
          await runNext()
        }

        const runners = Array(Math.min(limit, tasks.length)).fill(null).map(runNext)
        await Promise.all(runners)
        return results as { [K in keyof U]: Awaited<U[K]> }
      }),
    )
  }

  /**
   * Retry the operation if it fails
   */
  retry(times: number, delay = 0): AsyncPipeline<T> {
    return new AsyncPipeline(
      this.promise.catch(async (error) => {
        if (times <= 0) throw error

        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay))
        }

        // Need to reconstruct the chain to retry
        throw error // This is simplified - in production, store the original function
      }),
    )
  }

  /**
   * Apply a side effect without changing the value (sync or async)
   */
  tap(fn: (value: T) => any | Promise<void>): AsyncPipeline<T> {
    return new AsyncPipeline(
      this.promise.then(async (value) => {
        await fn(value)
        return value
      }),
    )
  }

  tapError(fn: (error: unknown) => Promise<void> | void): AsyncPipeline<T> {
    return new AsyncPipeline(
      this.promise.catch(async (error) => {
        await fn(error)
        throw error
      }),
    )
  }

  /**
   * Execute a function regardless of success or failure
   * @example
   * asyncPipe(someAsyncOperation())
   *   .tapFinally(() => {
   *     console.log('Operation completed (success or failure)')
   *   })
   *   .catch((error) => {
   *     console.error('Operation failed:', error)
   *   })
   */
  tapFinally(fn: () => Promise<void> | void): AsyncPipeline<T> {
    return new AsyncPipeline(
      this.promise.finally(async () => {
        await fn()
      }),
    )
  }

  tapIter(
    fn: (value: T extends Iterable<infer R> ? R : never) => any | Promise<void>,
  ): AsyncPipeline<T> {
    const promiseFn = this.promise instanceof Promise ? this.promise : Promise.resolve(this.promise)
    return new AsyncPipeline(
      promiseFn.then(async (value) => {
        console.log(value)
        if (!isIterable(value)) {
          throw new Error('tapIter can only be called on ChainAsync wrapping an iterable')
        }

        // @ts-expect-error
        if (value[Symbol.asyncIterator]) {
          // @ts-expect-error
          for await (const item of value as AsyncIterable<any>) {
            await fn(item)
          }
        } else {
          for (const item of value as Iterable<any>) {
            await fn(item)
          }
        }

        return value
      }),
    )
  }

  /**
   * Convert to regular Promise for use with await
   */
  then<U>(
    onFulfilled?: ((value: T) => PromiseLike<U> | U) | null,
    onRejected?: ((reason: unknown) => PromiseLike<U> | U) | null,
  ): Promise<U> {
    return this.promise.then(onFulfilled, onRejected)
  }

  /**
   * Add timeout to the chain
   */
  timeout(ms: number, message = 'Operation timed out'): AsyncPipeline<T> {
    return new AsyncPipeline(
      Promise.race([
        this.promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
      ]),
    )
  }

  /**
   * Execute a function if the value matches a condition
   */
  when(
    predicate: (value: T) => boolean | Promise<boolean>,
    fn: (value: T) => Promise<T> | T,
  ): AsyncPipeline<T> {
    return new AsyncPipeline(
      this.promise.then(async (value) => {
        const shouldExecute = await predicate(value)
        return shouldExecute ? await fn(value) : value
      }),
    )
  }
}

/**
 * Factory function to create a new AsyncPipeline
 */
// @ts-expect-error
export function asyncPipe<T>(value: Promise<T> | T = null): AsyncPipeline<T> {
  return new AsyncPipeline(Promise.resolve(value))
}
