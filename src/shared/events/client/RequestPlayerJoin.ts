import type { UUID } from '../../../types.ts'

import { MinecraftEvent } from '../../MinecraftEvent.ts'

export class RequestPlayerJoin extends MinecraftEvent {
  static readonly type = 'Client.RequestPlayerJoin'

  constructor(readonly playerUUID: UUID) {
    super()
  }

  static deserialize(obj: any): RequestPlayerJoin {
    return new RequestPlayerJoin(obj.playerUUID)
  }

  serialize() {
    return {
      playerUUID: this.playerUUID,
    }
  }
}
