export class ServerTickPayload {
  static readonly type = 'Server.ServerTick'
  constructor(readonly currentTick: number) {}

  static decode(obj: any): ServerTickPayload {
    return new ServerTickPayload(obj.currentTick)
  }

  static encode(obj: ServerTickPayload): any {
    return {
      currentTick: obj.currentTick,
    }
  }
}
