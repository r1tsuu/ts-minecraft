import { chain } from '../../Chain.ts'
import { Player } from '../../entities/Player.ts'

export class ResponsePlayerJoinPayload {
  static readonly type = 'Server.ResponsePlayerJoin'
  constructor(readonly player: Player) {}

  static deserialize(obj: any): ResponsePlayerJoinPayload {
    return chain(obj.player)
      .map(Player.deserialize)
      .map((player) => new ResponsePlayerJoinPayload(player))
      .unwrap()
  }

  serialize() {
    return {
      player: this.player.serialize(),
    }
  }
}
