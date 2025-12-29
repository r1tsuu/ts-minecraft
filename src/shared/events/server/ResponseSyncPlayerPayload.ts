export class ResponseSyncPlayerPayload {
  static readonly type = 'Server.ResponseSyncPlayer'
  constructor() {}

  static deserialize(): ResponseSyncPlayerPayload {
    return new ResponseSyncPlayerPayload()
  }

  serialize() {
    return {}
  }
}
