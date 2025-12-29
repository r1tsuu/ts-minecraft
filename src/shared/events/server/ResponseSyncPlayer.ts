export class ResponseSyncPlayer {
  static readonly type = 'Server.ResponseSyncPlayer'
  constructor() {}

  static deserialize(): ResponseSyncPlayer {
    return new ResponseSyncPlayer()
  }

  serialize() {
    return {}
  }
}
