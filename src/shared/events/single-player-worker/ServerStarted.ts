import { MinecraftEvent } from '../../MinecraftEvent.ts'
import { pipe } from '../../Pipe.ts'
import { World } from '../../World.ts'

export class ServerStarted extends MinecraftEvent {
  static readonly type = 'SinglePlayerWorker.ServerStarted'

  constructor(readonly world: World) {
    super()
  }

  static deserialize(obj: any): ServerStarted {
    return pipe(obj.world)
      .map(World.deserialize)
      .map((world) => new ServerStarted(world))
      .value()
  }

  serialize() {
    return {
      world: this.world.serialize(),
    }
  }
}
