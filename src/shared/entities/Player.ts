import * as THREE from 'three'

import { Entity, EntityType } from './Entity.ts'
import '../util.ts' // for side-effect of registering Entity types

@EntityType('Player')
export class Player extends Entity {
  constructor(
    readonly uuid: string,
    readonly position: THREE.Vector3,
    readonly rotation: THREE.Euler,
    readonly velocity: THREE.Vector3,
  ) {
    super()
  }

  static deserialize(obj: any): Player {
    return new Player(
      obj.uuid,
      THREE.Vector3.deserialize(obj.position),
      THREE.Euler.deserialize(obj.rotation),
      THREE.Vector3.deserialize(obj.velocity),
    )
  }

  getWorldID(): string {
    return this.uuid
  }

  serialize(): any {
    return {
      position: this.position.serialize(),
      rotation: this.rotation.serialize(),
      uuid: this.uuid,
      velocity: this.velocity.serialize(),
    }
  }
}
