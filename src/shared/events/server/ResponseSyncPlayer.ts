import { MinecraftEvent } from '../../MinecraftEvent.ts'

export class ResponseSyncPlayer extends MinecraftEvent {
  static readonly type = 'Server.ResponseSyncPlayer'

  constructor() {
    super()
  }

  static deserialize(): ResponseSyncPlayer {
    return new ResponseSyncPlayer()
  }

  serialize() {
    return {}
  }
}
