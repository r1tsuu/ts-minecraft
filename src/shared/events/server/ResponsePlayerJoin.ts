import { chain } from '../../Chain.ts'
import { Player } from '../../entities/Player.ts'

export class ResponsePlayerJoin {
  static readonly type = 'Server.ResponsePlayerJoin'
  constructor(readonly player: Player) {}

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
