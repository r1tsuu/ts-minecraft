export class PauseTogglePayload {
  static readonly type = 'Client.PauseToggle'
  constructor() {}

  static decode(): PauseTogglePayload {
    return new PauseTogglePayload()
  }

  static encode(): any {
    return {}
  }
}
