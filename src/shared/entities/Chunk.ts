import { Entity } from './Entity.ts'

export class Chunk extends Entity {
  constructor(
    readonly x: number,
    readonly z: number,
    readonly blocks: Uint8Array,
  ) {
    super()
  }

  static decode(obj: any): Chunk {
    if (!(obj.blocks instanceof Uint8Array)) {
      obj.blocks = new Uint8Array(obj.blocks)
    }

    return new Chunk(obj.x, obj.z, obj.blocks)
  }

  static encode(obj: Chunk): any {
    return {
      blocks: obj.blocks,
      x: obj.x,
      z: obj.z,
    }
  }
}
