export class ResponseSyncUpdatedBlocksPayload {
  static readonly type = 'Server.ResponseSyncUpdatedBlocks'
  constructor() {}

  static decode(): ResponseSyncUpdatedBlocksPayload {
    return new ResponseSyncUpdatedBlocksPayload()
  }

  static encode(): any {
    return {}
  }
}
