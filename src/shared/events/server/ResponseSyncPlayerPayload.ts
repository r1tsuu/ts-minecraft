export class ResponseSyncPlayerPayload {
  static readonly type = 'Server.ResponseSyncPlayer'
  constructor() {}

  static decode(): ResponseSyncPlayerPayload {
    return new ResponseSyncPlayerPayload()
  }

  static encode(): any {
    return {}
  }
}
