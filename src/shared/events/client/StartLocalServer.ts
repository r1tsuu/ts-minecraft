import { MinecraftEvent } from '../../MinecraftEvent.ts'

export class StartLocalServer extends MinecraftEvent {
  readonly type = 'Client.StartLocalServer'

  constructor(readonly worldName: string) {
    super()
  }

  static deserialize(obj: any): StartLocalServer {
    return new StartLocalServer(obj.worldName)
  }

  serialize() {
    return {
      worldName: this.worldName,
    }
  }
}
