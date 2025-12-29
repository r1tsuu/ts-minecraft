import { MinecraftEvent } from '../../MinecraftEvent.ts'

export class ExitWorld extends MinecraftEvent {
  static readonly type = 'Client.ExitWorld'

  constructor() {
    super()
  }

  static deserialize(): ExitWorld {
    return new ExitWorld()
  }

  serialize() {
    return {}
  }
}
