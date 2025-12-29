import { chain } from '../../Chain.ts'
import { World } from '../../World.ts'

export class ServerStarted {
  static readonly type = 'SinglePlayerWorker.ServerStarted'
  /**
   * @param world The world that has been started
   */
  constructor(readonly world: World) {}

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
