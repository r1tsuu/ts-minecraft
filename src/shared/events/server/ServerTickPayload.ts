export class ServerTickPayload {
  static readonly type = 'Server.ServerTick'
  constructor(readonly currentTick: number) {}

  static deserialize(obj: any): ServerTickPayload {
    return new ServerTickPayload(obj.currentTick)
  }

  serialize() {
    return {
      currentTick: this.currentTick,
    }
  }
}
