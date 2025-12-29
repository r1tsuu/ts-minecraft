export class ServerTick {
  static readonly type = 'Server.ServerTick'
  constructor(readonly currentTick: number) {}

  static deserialize(obj: any): ServerTick {
    return new ServerTick(obj.currentTick)
  }

  serialize() {
    return {
      currentTick: this.currentTick,
    }
  }
}
