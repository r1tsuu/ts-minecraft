import { Player } from '../../entities/Player.ts'

export class RequestSyncPlayerPayload {
  static readonly type = 'Client.RequestSyncPlayer'
  constructor(readonly playerData: Player) {}

  static decode(obj: any): RequestSyncPlayerPayload {
    return new RequestSyncPlayerPayload(Player.decode(obj.playerData))
  }

  static encode(obj: RequestSyncPlayerPayload): any {
    return { playerData: Player.encode(obj.playerData) }
  }
}
