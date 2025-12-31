import type { RawVector3 } from '../../../types.ts'

import { MinecraftEvent } from '../../MinecraftEvent.ts'

export type BlockUpdateAction =
  | {
      blockID: number
      position: RawVector3
      type: 'SET'
    }
  | {
      position: RawVector3
      type: 'REMOVE'
    }

export class RequestBlocksUpdate extends MinecraftEvent {
  static readonly type = 'Client.RequestBlocksUpdate'

  constructor(readonly actions: BlockUpdateAction[]) {
    super()
  }

  static deserialize(obj: any): RequestBlocksUpdate {
    return new RequestBlocksUpdate(obj.actions)
  }

  serialize() {
    return {
      actions: this.actions,
    }
  }
}
