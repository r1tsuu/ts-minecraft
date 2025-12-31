import { Euler, Vector3 } from 'three'

import { MinecraftEvent } from '../../MinecraftEvent.ts'

export class RequestPlayerUpdate extends MinecraftEvent {
  static readonly type = 'Client.RequestPlayerUpdate'

  constructor(
    readonly playerID: string,
    readonly position: Vector3,
    readonly rotation: Euler,
    readonly velocity: Vector3,
  ) {
    super()
  }

  static deserialize(obj: any): RequestPlayerUpdate {
    return new RequestPlayerUpdate(
      obj.playerID,
      Vector3.deserialize(obj.position),
      Euler.deserialize(obj.rotation),
      Vector3.deserialize(obj.velocity),
    )
  }

  serialize() {
    return {
      playerID: this.playerID,
      position: this.position.serialize(),
      rotation: this.rotation.serialize(),
      velocity: this.velocity.serialize(),
    }
  }
}
