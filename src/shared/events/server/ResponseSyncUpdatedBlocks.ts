import { MinecraftEvent } from '../../MinecraftEvent.ts'

export class ResponseSyncUpdatedBlocks extends MinecraftEvent {
  static readonly type = 'Server.ResponseSyncUpdatedBlocks'

  constructor() {
    super()
  }

  static deserialize(): ResponseSyncUpdatedBlocks {
    return new ResponseSyncUpdatedBlocks()
  }

  serialize() {
    return {}
  }
}
