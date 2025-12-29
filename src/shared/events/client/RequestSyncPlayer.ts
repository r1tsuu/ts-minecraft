import { chain } from '../../Chain.ts'
import { Player } from '../../entities/Player.ts'
import { MinecraftEvent } from '../../MinecraftEvent.ts'

export class RequestSyncPlayer extends MinecraftEvent {
  readonly type = 'Client.RequestSyncPlayer'

  constructor(readonly playerData: Player) {
    super()
  }

  static deserialize(obj: any): RequestSyncPlayer {
    return chain(obj.playerData)
      .map(Player.deserialize)
      .map((player) => new RequestSyncPlayer(player))
      .unwrap()
  }

  serialize() {
    return chain(this.playerData)
      .map((player) => player.serialize())
      .map((playerData) => ({ playerData }))
      .unwrap()
  }
}
