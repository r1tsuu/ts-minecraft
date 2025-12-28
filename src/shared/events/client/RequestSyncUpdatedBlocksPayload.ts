import * as THREE from 'three'

export class RequestSyncUpdatedBlocksPayload {
  static readonly type = 'Client.RequestSyncUpdatedBlocks'
  constructor(
    readonly blocks: {
      blockID: number
      position: THREE.Vector3
      type: 'add' | 'remove'
    }[],
  ) {}

  static decode(obj: any): RequestSyncUpdatedBlocksPayload {
    return new RequestSyncUpdatedBlocksPayload(
      obj.blocks.map((block: any) => ({
        blockID: block.blockID,
        position: new THREE.Vector3(block.position.x, block.position.y, block.position.z),
        type: block.type,
      })),
    )
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
