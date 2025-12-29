import type { UUID } from '../../../types.ts'

export class RequestPlayerJoinPayload {
  static readonly type = 'Client.RequestPlayerJoin'
  constructor(readonly playerUUID: UUID) {}

  static deserialize(obj: any): RequestPlayerJoinPayload {
    return new RequestPlayerJoinPayload(obj.playerUUID)
  }

  serialize() {
    return {
      playerUUID: this.playerUUID,
    }
  }
}
