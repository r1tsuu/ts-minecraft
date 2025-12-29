import { MinecraftEvent } from '../../MinecraftEvent.ts'

export class JoinedWorld extends MinecraftEvent {
  static readonly type = 'Client.JoinedWorld'

  constructor() {
    super()
  }

  static deserialize(): JoinedWorld {
    return new JoinedWorld()
  }

  serialize() {
    return {}
  }
}
