export class JoinedWorldPayload {
  static readonly type = 'Client.JoinedWorld'
  constructor() {}

  static decode(): JoinedWorldPayload {
    return new JoinedWorldPayload()
  }

  static encode(): any {
    return {}
  }
}
