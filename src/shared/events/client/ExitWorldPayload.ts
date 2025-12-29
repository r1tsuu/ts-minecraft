export class ExitWorldPayload {
  static readonly type = 'Client.ExitWorld'
  constructor() {}

  static deserialize(): ExitWorldPayload {
    return new ExitWorldPayload()
  }

  serialize() {
    return {}
  }
}
