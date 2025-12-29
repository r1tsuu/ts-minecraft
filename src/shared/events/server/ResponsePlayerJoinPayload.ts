import { chain } from '../../Chain.ts'
import { Player } from '../../entities/Player.ts'

export class ResponsePlayerJoinPayload {
  static readonly type = 'Server.ResponsePlayerJoin'
  constructor(readonly player: Player) {}

  static decode(obj: any): ResponsePlayerJoinPayload {
    return chain(obj.player)
      .map(Player.decode)
      .map((player) => new ResponsePlayerJoinPayload(player))
      .unwrap()
  }

  static encode(obj: ResponsePlayerJoinPayload): any {
    return {
      player: Player.encode(obj.player),
    }
  }
}
