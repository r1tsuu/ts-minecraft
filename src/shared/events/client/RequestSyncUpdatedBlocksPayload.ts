import { Vector3 } from 'three'

import { chain } from '../../Chain.ts'

type BlockUpdate = {
  blockID: number
  position: Vector3
  type: 'add' | 'remove'
}

export class RequestSyncUpdatedBlocksPayload {
  static readonly type = 'Client.RequestSyncUpdatedBlocks'
  constructor(readonly blocks: BlockUpdate[]) {}

  static deserialize(obj: any): RequestSyncUpdatedBlocksPayload {
    return chain(obj.blocks as any[])
      .mapArray((block) => ({
        blockID: block.blockID,
        position: Vector3.deserialize(block.position),
        type: block.type,
      }))
      .map((blocks) => new RequestSyncUpdatedBlocksPayload(blocks))
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
