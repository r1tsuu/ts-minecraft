export class JoinedWorld {
  static readonly type = 'Client.JoinedWorld'
  constructor() {}

  static deserialize(): JoinedWorld {
    return new JoinedWorld()
  }

  serialize() {
    return {}
  }
}
