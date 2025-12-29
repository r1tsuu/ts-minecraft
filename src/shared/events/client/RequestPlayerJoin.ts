import type { UUID } from '../../../types.ts'

export class RequestPlayerJoin {
  static readonly type = 'Client.RequestPlayerJoin'
  constructor(readonly playerUUID: UUID) {}

  static deserialize(obj: any): RequestPlayerJoin {
    return new RequestPlayerJoin(obj.playerUUID)
  }

  serialize() {
    return {
      playerUUID: this.playerUUID,
    }
  }
}
