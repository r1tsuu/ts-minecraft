import { MinecraftEvent } from '../../MinecraftEvent.ts'

export class ServerTick extends MinecraftEvent {
  readonly type = 'Server.ServerTick'

  constructor(readonly currentTick: number) {
    super()
  }

  static deserialize(obj: any): ServerTick {
    return new ServerTick(obj.currentTick)
  }

  serialize() {
    return {
      currentTick: this.currentTick,
    }
  }
}
