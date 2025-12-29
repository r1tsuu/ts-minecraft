import { chain } from '../../Chain.ts'
import { MinecraftEvent } from '../../MinecraftEvent.ts'
import { World } from '../../World.ts'

export class ResponsePlayerJoin extends MinecraftEvent {
  static readonly type = 'Server.ResponsePlayerJoin'

  constructor(readonly world: World) {
    super()
  }

  static deserialize(obj: any): ResponsePlayerJoin {
    return chain(obj.world)
      .map(World.deserialize)
      .map((world) => new ResponsePlayerJoin(world))
      .unwrap()
  }

  serialize() {
    return {
      world: this.world.serialize(),
    }
  }
}
