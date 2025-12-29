import { chain } from '../../Chain.ts'
import { Player } from '../../entities/Player.ts'
import { MinecraftEvent } from '../../MinecraftEvent.ts'

export class ResponsePlayerJoin extends MinecraftEvent {
  readonly type = 'Server.ResponsePlayerJoin'

  constructor(readonly player: Player) {
    super()
  }

  static deserialize(obj: any): ResponsePlayerJoin {
    return chain(obj.player)
      .map(Player.deserialize)
      .map((player) => new ResponsePlayerJoin(player))
      .unwrap()
  }

  serialize() {
    return {
      player: this.player.serialize(),
    }
  }
}
