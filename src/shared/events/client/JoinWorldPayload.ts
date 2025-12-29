import type { UUID } from '../../../types.ts'

export class JoinWorldPayload {
  static readonly type = 'Client.JoinWorld'
  constructor(readonly worldUUID: UUID) {}

  static decode(obj: any): JoinWorldPayload {
    return new JoinWorldPayload(obj.worldUUID)
  }

  static encode(obj: JoinWorldPayload): any {
    return {
      worldUUID: obj.worldUUID,
    }
  }
}
