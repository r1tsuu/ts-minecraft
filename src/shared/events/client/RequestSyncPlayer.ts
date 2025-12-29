import { Player } from '../../entities/Player.ts'
import { MinecraftEvent } from '../../MinecraftEvent.ts'
import { pipe } from '../../Pipe.ts'

export class RequestSyncPlayer extends MinecraftEvent {
  static readonly type = 'Client.RequestSyncPlayer'

  constructor(readonly playerData: Player) {
    super()
  }

  static deserialize(obj: any): RequestSyncPlayer {
    return pipe(obj.playerData)
      .map(Player.deserialize)
      .map((player) => new RequestSyncPlayer(player))
      .value()
  }

  serialize() {
    return pipe(this.playerData)
      .map((player) => player.serialize())
      .map((playerData) => ({ playerData }))
      .value()
  }
}
