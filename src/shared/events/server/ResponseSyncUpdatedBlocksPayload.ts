export class ResponseSyncUpdatedBlocksPayload {
  static readonly type = 'Server.ResponseSyncUpdatedBlocks'
  constructor() {}

  static deserialize(): ResponseSyncUpdatedBlocksPayload {
    return new ResponseSyncUpdatedBlocksPayload()
  }

  serialize() {
    return {}
  }
}
