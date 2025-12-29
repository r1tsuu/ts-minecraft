import { MinecraftEvent } from '../../MinecraftEvent.ts'

export class PauseToggle extends MinecraftEvent {
  static readonly type = 'Client.PauseToggle'

  constructor() {
    super()
  }

  static deserialize(): PauseToggle {
    return new PauseToggle()
  }

  serialize() {
    return {}
  }
}
