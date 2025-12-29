import type { UUID } from '../../../types.ts'

export class JoinWorldPayload {
  static readonly type = 'Client.JoinWorld'
  constructor(readonly worldUUID: UUID) {}

  static deserialize(obj: any): JoinWorldPayload {
    return new JoinWorldPayload(obj.worldUUID)
  }

  serialize() {
    return {
      worldUUID: this.worldUUID,
    }
  }
}
