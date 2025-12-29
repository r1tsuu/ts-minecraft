import { MinecraftEvent } from '../../MinecraftEvent.ts'
import { pipe } from '../../Pipe.ts'
import { World } from '../../World.ts'

export class ResponsePlayerJoin extends MinecraftEvent {
  static readonly type = 'Server.ResponsePlayerJoin'

  constructor(readonly world: World) {
    super()
  }

  static deserialize(obj: any): ResponsePlayerJoin {
    return pipe(obj.world)
      .map(World.deserialize)
      .map((world) => new ResponsePlayerJoin(world))
      .value()
  }

  serialize() {
    return {
      world: this.world.serialize(),
    }
  }
}
