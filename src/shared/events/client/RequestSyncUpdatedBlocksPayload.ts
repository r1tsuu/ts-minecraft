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

  static decode(obj: any): RequestSyncUpdatedBlocksPayload {
    return chain(obj.blocks as any[])
      .mapArray((block) => ({
        blockID: block.blockID,
        position: Vector3.encode(block.position),
        type: block.type,
      }))
      .map((blocks) => new RequestSyncUpdatedBlocksPayload(blocks))
      .unwrap()
  }

  static encode(obj: RequestSyncUpdatedBlocksPayload): any {
    return {
      blocks: obj.blocks.map((block) => ({
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
