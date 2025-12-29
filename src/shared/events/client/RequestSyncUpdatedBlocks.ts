import { Vector3 } from 'three'

import { MinecraftEvent } from '../../MinecraftEvent.ts'
import { pipe } from '../../Pipe.ts'

type BlockUpdate = {
  blockID: number
  position: Vector3
  type: 'add' | 'remove'
}

export class RequestSyncUpdatedBlocks extends MinecraftEvent {
  static readonly type = 'Client.RequestSyncUpdatedBlocks'

  constructor(readonly blocks: BlockUpdate[]) {
    super()
  }

  static deserialize(obj: any): RequestSyncUpdatedBlocks {
    return pipe(obj.blocks as any[])
      .mapArray((block) => ({
        blockID: block.blockID,
        position: Vector3.deserialize(block.position),
        type: block.type,
      }))
      .map((blocks) => new RequestSyncUpdatedBlocks(blocks))
      .value()
  }

  serialize() {
    return {
      blocks: this.blocks.map((block) => ({
        blockID: block.blockID,
        position: {
          x: block.position.x,
          y: block.position.y,
          z: block.position.z,
        },
        type: block.type,
      })),
    }
  }
}
