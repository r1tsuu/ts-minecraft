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

export type OptionType<T> = {
  isNone(): this is OptionNone
  isSome(): this is OptionSome<T>
  unwrap(): T
  unwrapOr(defaultValue: T): T
} & (OptionNone | OptionSome<T>)

interface OptionNone {
  readonly kind: 'none'
  value: undefined
}

interface OptionSome<T> {
  readonly kind: 'some'
  value: T
}

export const option = <T>(value: T | undefined): OptionType<T> => {
  if (value === undefined) {
    return {
      // @ts-expect-error
      isNone: () => true,
      // @ts-expect-error
      isSome: () => false,
      kind: 'none',
      unwrap: () => {
        throw new Error('Called unwrap on None option')
      },
      unwrapOr: (defaultValue: T) => defaultValue,
      value: undefined,
    }
  } else {
    return {
      // @ts-expect-error
      isNone: () => false,
      // @ts-expect-error
      isSome: () => true,
      kind: 'some',
      unwrap: () => value,
      unwrapOr: () => value,
      value,
    }
  }
}
