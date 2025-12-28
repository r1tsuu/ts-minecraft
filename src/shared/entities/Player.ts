import * as THREE from 'three'

import { Entity, RegisterEntity } from './Entity.ts'

@RegisterEntity()
export class Player extends Entity {
  constructor(
    readonly uuid: string,
    readonly position: THREE.Vector3,
    readonly rotation: THREE.Euler,
    readonly velocity: THREE.Vector3,
  ) {
    super()
  }

  static decode(obj: any): Player {
    return new Player(
      obj.uuid,
      new THREE.Vector3(obj.position.x, obj.position.y, obj.position.z),
      new THREE.Euler(obj.rotation.x, obj.rotation.y, obj.rotation.z),
      new THREE.Vector3(obj.velocity.x, obj.velocity.y, obj.velocity.z),
    )
  }

  static encode(obj: Player): any {
    return {
      position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
      rotation: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z },
      uuid: obj.uuid,
      velocity: { x: obj.velocity.x, y: obj.velocity.y, z: obj.velocity.z },
    }
  }
}
