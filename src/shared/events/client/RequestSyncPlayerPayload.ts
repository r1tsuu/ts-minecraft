import { chain } from '../../Chain.ts'
import { Player } from '../../entities/Player.ts'

export class RequestSyncPlayerPayload {
  static readonly type = 'Client.RequestSyncPlayer'
  constructor(readonly playerData: Player) {}

  static decode(obj: any): RequestSyncPlayerPayload {
    return chain(obj.playerData)
      .map(Player.decode)
      .map((player) => new RequestSyncPlayerPayload(player))
      .unwrap()
  }

  static encode(obj: RequestSyncPlayerPayload): any {
    return chain(obj.playerData)
      .map(Player.encode)
      .map((playerData) => ({ playerData }))
      .unwrap()
  }
}
