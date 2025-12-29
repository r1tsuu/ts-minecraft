export class PauseTogglePayload {
  static readonly type = 'Client.PauseToggle'
  constructor() {}

  static deserialize(): PauseTogglePayload {
    return new PauseTogglePayload()
  }

  serialize() {
    return {}
  }
}
