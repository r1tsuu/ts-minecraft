import type { UUID } from '../../../types.ts'

export class JoinWorld {
  static readonly type = 'Client.JoinWorld'
  constructor(readonly worldUUID: UUID) {}

  static deserialize(obj: any): JoinWorld {
    return new JoinWorld(obj.worldUUID)
  }

  serialize() {
    return {
      worldUUID: this.worldUUID,
    }
  }
}
