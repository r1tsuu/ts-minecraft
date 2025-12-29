import { Vector3 } from 'three'

import { chain } from '../../Chain.ts'
import { MinecraftEvent } from '../../MinecraftEvent.ts'

type BlockUpdate = {
  blockID: number
  position: Vector3
  type: 'add' | 'remove'
}

export class RequestSyncUpdatedBlocks extends MinecraftEvent {
  readonly type = 'Client.RequestSyncUpdatedBlocks'

  constructor(readonly blocks: BlockUpdate[]) {
    super()
  }

  static deserialize(obj: any): RequestSyncUpdatedBlocks {
    return chain(obj.blocks as any[])
      .mapArray((block) => ({
        blockID: block.blockID,
        position: Vector3.deserialize(block.position),
        type: block.type,
      }))
      .map((blocks) => new RequestSyncUpdatedBlocks(blocks))
      .unwrap()
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
