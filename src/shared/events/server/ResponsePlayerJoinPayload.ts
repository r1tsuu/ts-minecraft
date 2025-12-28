import { Player } from '../../entities/Player.ts'

export class ResponsePlayerJoinPayload {
  static readonly type = 'Server.ResponsePlayerJoin'
  constructor(readonly player: Player) {}

  static decode(obj: any): ResponsePlayerJoinPayload {
    return new ResponsePlayerJoinPayload(Player.decode(obj.player))
  }

  static encode(obj: ResponsePlayerJoinPayload): any {
    return { player: Player.encode(obj.player) }
  }
}
