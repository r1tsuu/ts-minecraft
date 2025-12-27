import type * as THREE from 'three'

export type BlockInWorld = {
  typeID: number
  /** Within chunk */
  x: number
  /** Within chunk */
  y: number
  /** Within chunk */
  z: number
}

export type Chunk = {
  blocks: Map<string, BlockInWorld>
  blocksMeshesIndexes: Map<string, number>
  blocksUint: Uint8Array
  chunkX: number
  chunkZ: number
  needsRenderUpdate: boolean
  uuid: UUID
}

export type ChunkCoordinates = {
  chunkX: number
  chunkZ: number
}

export type ChunkIndex = {
  readonly __brand: 'ChunkIndex'
  x: number
  z: number
}

export type ClientPlayerData = {
  canJump: boolean
  direction: THREE.Vector3
  height: number
  isMovingBackward: boolean
  isMovingForward: boolean
  isMovingLeft: boolean
  isMovingRight: boolean
  jumpStrength: number
  pitch: number
  position: THREE.Vector3
  speed: number
  velocity: THREE.Vector3
  width: number
  yaw: number
}

export type RawVector3 = {
  x: number
  y: number
  z: number
}

export type UUID = `${string}-${string}-${string}-${string}-${string}`

export const chunkIndex = (x: number, z: number): ChunkIndex => {
  return {
    x,
    z,
  } as ChunkIndex
}
