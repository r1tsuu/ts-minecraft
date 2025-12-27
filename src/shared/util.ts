import * as THREE from 'three'

import type { RawVector3 } from '../types.ts'

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
}): {
  chunkX: number
  chunkZ: number
}[] => {
  const chunks: { chunkX: number; chunkZ: number }[] = []

  for (let dx = -chunkRadius; dx <= chunkRadius; dx++) {
    for (let dz = -chunkRadius; dz <= chunkRadius; dz++) {
      const distanceSquared = dx * dx + dz * dz
      if (distanceSquared <= chunkRadius * chunkRadius) {
        chunks.push({
          chunkX: centerChunkX + dx,
          chunkZ: centerChunkZ + dz,
        })
      }
    }
  }

  return chunks
}

declare module 'three' {
  interface Vector3 {
    toRaw(): RawVector3
  }

  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Vector3 {
    function fromRaw(rawVector: RawVector3): Vector3
  }
}

THREE.Vector3.prototype.toRaw = function (): RawVector3 {
  return {
    x: this.x,
    y: this.y,
    z: this.z,
  }
}

THREE.Vector3.fromRaw = function (rawVector: RawVector3): THREE.Vector3 {
  return new THREE.Vector3(rawVector.x, rawVector.y, rawVector.z)
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
