export class JoinedWorldPayload {
  static readonly type = 'Client.JoinedWorld'
  constructor() {}

  static deserialize(): JoinedWorldPayload {
    return new JoinedWorldPayload()
  }

  serialize() {
    return {}
  }
}
