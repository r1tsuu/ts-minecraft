import type { UUID } from '../../../types.ts'

export class RequestPlayerJoinPayload {
  static readonly type = 'Client.RequestPlayerJoin'
  constructor(readonly playerUUID: UUID) {}

  static decode(obj: any): RequestPlayerJoinPayload {
    return new RequestPlayerJoinPayload(obj.playerUUID)
  }

  static encode(obj: RequestPlayerJoinPayload): any {
    return { playerUUID: obj.playerUUID }
  }
}
