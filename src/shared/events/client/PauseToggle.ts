export class PauseToggle {
  static readonly type = 'Client.PauseToggle'
  constructor() {}

  static deserialize(): PauseToggle {
    return new PauseToggle()
  }

  serialize() {
    return {}
  }
}
