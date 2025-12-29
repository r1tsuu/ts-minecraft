export class StartLocalServer {
  static readonly type = 'Client.StartLocalServer'
  constructor(readonly worldName: string) {}

  static deserialize(obj: any): StartLocalServer {
    return new StartLocalServer(obj.worldName)
  }

  serialize() {
    return {
      worldName: this.worldName,
    }
  }
}
