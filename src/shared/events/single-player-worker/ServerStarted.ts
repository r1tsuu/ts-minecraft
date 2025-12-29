import { chain } from '../../Chain.ts'
import { MinecraftEvent } from '../../MinecraftEvent.ts'
import { World } from '../../World.ts'

export class ServerStarted extends MinecraftEvent {
  readonly type = 'SinglePlayerWorker.ServerStarted'

  constructor(readonly world: World) {
    super()
  }

  static deserialize(obj: any): ServerStarted {
    return chain(obj.world)
      .map(World.deserialize)
      .map((world) => new ServerStarted(world))
      .unwrap()
  }

  serialize() {
    return {
      world: this.world.serialize(),
    }
  }
}
