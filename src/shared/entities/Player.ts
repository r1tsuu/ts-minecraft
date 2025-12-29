import * as THREE from 'three'

import { Config } from '../Config.ts'
import { Entity, EntityType } from './Entity.ts'

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

  static boundingBox(position: THREE.Vector3): THREE.Box3 {
    const min = new THREE.Vector3(
      position.x - Config.PLAYER_WIDTH / 2,
      position.y - Config.PLAYER_HEIGHT,
      position.z - Config.PLAYER_WIDTH / 2,
    )
    const max = new THREE.Vector3(
      position.x + Config.PLAYER_WIDTH / 2,
      position.y,
      position.z + Config.PLAYER_WIDTH / 2,
    )

    return new THREE.Box3(min, max)
  }

  static deserialize(obj: any): Player {
    return new Player(
      obj.uuid,
      THREE.Vector3.deserialize(obj.position),
      THREE.Euler.deserialize(obj.rotation),
      THREE.Vector3.deserialize(obj.velocity),
    )
  }

  static serialize(player: Player): any {
    return player.serialize()
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
