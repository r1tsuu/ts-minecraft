import type { UUID } from '../../../types.ts'

import { MinecraftEvent } from '../../MinecraftEvent.ts'

export class JoinWorld extends MinecraftEvent {
  static readonly type = 'Client.JoinWorld'

  constructor(readonly worldUUID: UUID) {
    super()
  }

  static deserialize(obj: any): JoinWorld {
    return new JoinWorld(obj.worldUUID)
  }

  serialize() {
    return {
      worldUUID: this.worldUUID,
    }
  }
}
