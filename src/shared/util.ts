import * as THREE from 'three'

import type { RawVector3 } from '../types.ts'
import type { ChunkCoordinates } from './entities/Chunk.ts'

import { Config } from './Config.ts'

export const minutes = (m: number): number => {
  return m * 60 * 1000
}

export const seconds = (s: number): number => {
  return s * 1000
}

export const ticks = (t: number): number => {
  return t * Config.TICK_RATE
}

export const getBlockKey = (x: number, y: number, z: number): string => {
  return `${x},${y},${z}`
}

export const getBlockIndex = (x: number, y: number, z: number): number => {
  return x + Config.CHUNK_SIZE * (z + Config.CHUNK_SIZE * y)
}

export const getChunkCoordinates = ({ x, z }: { x: number; z: number }) => {
  const chunkX = Math.floor(x / Config.CHUNK_SIZE)
  const chunkZ = Math.floor(z / Config.CHUNK_SIZE)

  return {
    chunkX,
    chunkZ,
  }
}

export const getLocalCoordinatesInChunk = ({
  x,
  z,
}: {
  x: number
  z: number
}): { localX: number; localZ: number } => {
  const localX = x % Config.CHUNK_SIZE
  const localZ = z % Config.CHUNK_SIZE

  return {
    localX: localX < 0 ? localX + Config.CHUNK_SIZE : localX,
    localZ: localZ < 0 ? localZ + Config.CHUNK_SIZE : localZ,
  }
}

export const findByXZ = <T extends { x: number; z: number }>(
  array: T[],
  x: number,
  z: number,
): null | T => {
  for (const item of array) {
    if (item.x === x && item.z === z) {
      return item
    }
  }
  return null
}

export const findChunkByXZ = <T extends { chunkX: number; chunkZ: number }>(
  array: T[],
  chunkX: number,
  chunkZ: number,
): null | T => {
  for (const item of array) {
    if (item.chunkX === chunkX && item.chunkZ === chunkZ) {
      return item
    }
  }
  return null
}

export const findByXYZ = <T extends { x: number; y: number; z: number }>(
  array: T[],
  x: number,
  y: number,
  z: number,
): null | T => {
  for (const item of array) {
    if (item.x === x && item.y === y && item.z === z) {
      return item
    }
  }

  return null
}

export const rawVector3 = (x: number, y: number, z: number): RawVector3 => {
  return { x, y, z }
}

export const zeroRawVector3 = (): RawVector3 => {
  return { x: 0, y: 0, z: 0 }
}

export const getChunksCoordinatesInRadius = ({
  centerChunkX,
  centerChunkZ,
  chunkRadius,
}: {
  centerChunkX: number
  centerChunkZ: number
  chunkRadius: number
}): ChunkCoordinates[] => {
  const chunks: { x: number; z: number }[] = []

  for (let dx = -chunkRadius; dx <= chunkRadius; dx++) {
    for (let dz = -chunkRadius; dz <= chunkRadius; dz++) {
      const distanceSquared = dx * dx + dz * dz
      if (distanceSquared <= chunkRadius * chunkRadius) {
        chunks.push({
          x: centerChunkX + dx,
          z: centerChunkZ + dz,
        })
      }
    }
  }

  return chunks
}

declare module 'three' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Vector3 {
    function deserialize(obj: RawVector3): THREE.Vector3
  }

  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Euler {
    function deserialize(obj: { x: number; y: number; z: number }): THREE.Euler
    function zero(): THREE.Euler
  }

  interface Euler {
    serialize(): { x: number; y: number; z: number }
  }

  interface Vector3 {
    serialize(): RawVector3
  }
}

THREE.Vector3.prototype.serialize = function (): RawVector3 {
  return {
    x: this.x,
    y: this.y,
    z: this.z,
  }
}

THREE.Vector3.deserialize = (rawVector: RawVector3): THREE.Vector3 => {
  return new THREE.Vector3(rawVector.x, rawVector.y, rawVector.z)
}

THREE.Euler.prototype.serialize = function (): { x: number; y: number; z: number } {
  return {
    x: this.x,
    y: this.y,
    z: this.z,
  }
}

THREE.Euler.deserialize = (obj: { x: number; y: number; z: number }): THREE.Euler => {
  return new THREE.Euler(obj.x, obj.y, obj.z, Config.EULER_ORDER)
}

THREE.Euler.zero = (): THREE.Euler => {
  return new THREE.Euler(0, 0, 0, Config.EULER_ORDER)
}

export const UP_VECTOR = new THREE.Vector3(0, 1, 0)

/**
 * Method decorator that throttles the execution of the decorated method.
 * The method will only be allowed to execute once every `ms` milliseconds.
 * Subsequent calls within the throttle period will be ignored.
 * @param ms The number of milliseconds to throttle the method.
 * @returns A method decorator that applies the throttling behavior.
 * @example
 * class Example {
 *   @Throttle(1000)
 *   logMessage() {
 *    console.log('This message is throttled to once every second.')
 *  }
 * }
 */
export const Throttle = (ms: number) => {
  return (_instance: any, _methodName: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value
    let lastInvocation = 0

    descriptor.value = function (...args: any[]) {
      const now = Date.now()
      if (now - lastInvocation >= ms) {
        lastInvocation = now
        return originalMethod.apply(this, args)
      }
    }

    return descriptor
  }
}

export type ClassConstructor<T extends object> = new (...args: any[]) => T

export const getObjectConstructor = <T extends object>(obj: T): ClassConstructor<T> => {
  return obj.constructor as ClassConstructor<T>
}

const decodeMap = (decodeFn: (obj: any) => any, obj: any): Map<string, any> => {
  const result = new Map<string, any>()

  for (const [key, value] of Object.entries(obj)) {
    result.set(key, decodeFn(value))
  }

  return result
}

const encodeMap = (encodeFn: (obj: any) => any, map: Map<string, any>): any => {
  const result: any = {}

  for (const [key, value] of map.entries()) {
    result[key] = encodeFn(value)
  }

  return result
}

export const mapEncoder = (encodeFn: (obj: any) => any) => {
  return (map: Map<string, any>): any => {
    return encodeMap(encodeFn, map)
  }
}

export const mapDecoder = (decodeFn: (obj: any) => any) => {
  return (obj: any): Map<string, any> => {
    return decodeMap(decodeFn, obj)
  }
}

export const encoder = (keys: Record<string, (obj: any) => any>) => {
  return (obj: any): any => {
    const result: any = {}

    for (const key of Object.keys(obj)) {
      const maybeEncodeFn = keys[key]
      if (!maybeEncodeFn) {
        result[key] = obj[key]
        continue
      }

      const encodeFn = maybeEncodeFn
      result[key] = encodeFn(obj[key])
    }

    return result
  }
}

export const decoder = (keys: Record<string, (obj: any) => any>) => {
  return (obj: any): any => {
    const result: any = {}

    for (const key of Object.keys(obj)) {
      const maybeDecodeFn = keys[key]
      if (!maybeDecodeFn) {
        result[key] = obj[key]
        continue
      }
      result[key] = maybeDecodeFn(obj[key])
    }

    return result
  }
}

/**
 * Creates a codec with encode and decode functions for the given keys.
 * @param keys An object where each key maps to a tuple containing the decode and encode functions.
 * @returns An object with `encode` and `decode` methods.
 * @example
 * const userCodec = codec({
 *   name: [
 *     (obj) => obj as string, // decode function
 *     (obj) => obj,          // encode function
 *   ],
 *   age: [
 *     (obj) => parseInt(obj, 10), // decode function
 *     (obj) => obj.toString(),    // encode function
 *   ],
 * })
 *
 * const encoded = userCodec.encode({ name: 'Alice', age: 30 })
 * const decoded = userCodec.decode(encoded)
 */
export const codec = (keys: Record<string, [(obj: any) => any, (obj: any) => any]>) => {
  const encodeFns: Record<string, (obj: any) => any> = {}
  const decodeFns: Record<string, (obj: any) => any> = {}

  for (const [key, [decodeFn, encodeFn]] of Object.entries(keys)) {
    encodeFns[key] = encodeFn
    decodeFns[key] = decodeFn
  }

  return {
    decode: decoder(decodeFns),
    encode: encoder(encodeFns),
  }
}

// Type-safe compose function (right-to-left composition)
// compose(f, g, h)(x) = f(g(h(x)))

// Overloads for different numbers of functions
export function compose<A>(fn: (a: A) => A): (a: A) => A
export function compose<A, B>(fn2: (b: B) => A, fn1: (a: A) => B): (a: A) => A
export function compose<A, B, C>(fn3: (c: C) => A, fn2: (b: B) => C, fn1: (a: A) => B): (a: A) => A
export function compose<A, B, C, D>(
  fn4: (d: D) => A,
  fn3: (c: C) => D,
  fn2: (b: B) => C,
  fn1: (a: A) => B,
): (a: A) => A
export function compose<A, B, C, D, E>(
  fn5: (e: E) => A,
  fn4: (d: D) => E,
  fn3: (c: C) => D,
  fn2: (b: B) => C,
  fn1: (a: A) => B,
): (a: A) => A

// Implementation
export function compose(...fns: Function[]) {
  return (input: any) => fns.reduceRight((acc, fn) => fn(acc), input)
}

export const apply = <A, B>(fn: (arg: A) => B, arg: A): B => fn(arg)

export const isIterable = <T>(obj: any): obj is Iterable<T> => {
  return obj != null && typeof obj[Symbol.iterator] === 'function'
}

/**
 * Merges multiple iterators into a single iterator.
 * The merged iterator yields values from each input iterator in sequence.
 * @param iterators The input iterators to merge.
 * @returns An iterator that yields values from all input iterators.
 * @example
 * const array = [1, 2, 3]
 * const set = new Set(['a', 'b', 'c'])
 * const map = new Map([[true, 'yes'], [false, 'no']])
 * const mergedIterator = combineIterators(array, set, map.keys())
 * for (const value of mergedIterator) {
 *  console.log(value)
 * }
 */
export function* combineIterators<T extends unknown[]>(
  ...iterators: {
    [K in keyof T]: Iterable<T[K]>
  }
): IterableIterator<T[number]> {
  for (const iterator of iterators) {
    for (const value of iterator) {
      yield value
    }
  }
}

export function range(end: number): IterableIterator<number>
export function range(start: number, end: number): IterableIterator<number>
export function* range(startOrEnd: number, end?: number): IterableIterator<number> {
  if (end === undefined) {
    end = startOrEnd
    startOrEnd = 0
  }

  for (let i = startOrEnd; i < end; i++) {
    yield i
  }
}

export function rangeReverse(end: number): IterableIterator<number>
export function rangeReverse(start: number, end: number): IterableIterator<number>
export function* rangeReverse(startOrEnd: number, end?: number): IterableIterator<number> {
  if (end === undefined) {
    end = startOrEnd
    startOrEnd = 0
  }

  for (let i = end - 1; i >= startOrEnd; i--) {
    yield i
  }
}

export function reduce<T, U>(iter: Iterable<T>, reducer: (acc: U, value: T) => U, initial: U): U {
  let acc = initial
  for (const value of iter) {
    acc = reducer(acc, value)
  }
  return acc
}
