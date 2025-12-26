import * as THREE from 'three'

import type { RawVector3 } from '../types.ts'

export const rawVector3ToThreeVector3 = (rawVector: RawVector3): THREE.Vector3 => {
  return new THREE.Vector3(rawVector.x, rawVector.y, rawVector.z)
}

export const threeVector3ToRawVector3 = (vector: THREE.Vector3): RawVector3 => {
  return { x: vector.x, y: vector.y, z: vector.z }
}

export const UP_VECTOR = new THREE.Vector3(0, 1, 0)

export const eulerFromPitchYaw = (pitch: number, yaw: number): THREE.Euler => {
  return new THREE.Euler(pitch, yaw, 0, 'YXZ')
}
