export class ResponseSyncUpdatedBlocks {
  static readonly type = 'Server.ResponseSyncUpdatedBlocks'
  constructor() {}

  static deserialize(): ResponseSyncUpdatedBlocks {
    return new ResponseSyncUpdatedBlocks()
  }

  serialize() {
    return {}
  }
}
