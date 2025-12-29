import { chain } from '../../Chain.ts'
import { Player } from '../../entities/Player.ts'

export class RequestSyncPlayerPayload {
  static readonly type = 'Client.RequestSyncPlayer'
  constructor(readonly playerData: Player) {}

  static deserialize(obj: any): RequestSyncPlayerPayload {
    return chain(obj.playerData)
      .map(Player.deserialize)
      .map((player) => new RequestSyncPlayerPayload(player))
      .unwrap()
  }

  serialize() {
    return chain(this.playerData)
      .map((player) => player.serialize())
      .map((playerData) => ({ playerData }))
      .unwrap()
  }
}
