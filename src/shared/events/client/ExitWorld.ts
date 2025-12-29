export class ExitWorld {
  static readonly type = 'Client.ExitWorld'
  constructor() {}

  static deserialize(): ExitWorld {
    return new ExitWorld()
  }

  serialize() {
    return {}
  }
}
