import { Config } from '../Config.ts'
import { Maybe, None, Some } from '../Maybe.ts'
import { Entity, EntityType } from './Entity.ts'

export type ChunkCoordinates = {
  x: number
  z: number
}

@EntityType('Chunk')
export class Chunk extends Entity {
  constructor(
    readonly x: number,
    readonly z: number,
    readonly blocks: Uint8Array = new Uint8Array(
      Config.CHUNK_SIZE * Config.CHUNK_SIZE * Config.WORLD_HEIGHT,
    ),
  ) {
    super()
  }

  static blockIndex(x: number, y: number, z: number): number {
    return x + Config.CHUNK_SIZE * (z + Config.CHUNK_SIZE * y)
  }

  static coordsInRadius(centerX: number, centerZ: number, chunkRadius: number): ChunkCoordinates[] {
    const coordinates: ChunkCoordinates[] = []

    for (let x = centerX - chunkRadius; x <= centerX + chunkRadius; x++) {
      for (let z = centerZ - chunkRadius; z <= centerZ + chunkRadius; z++) {
        coordinates.push({
          x,
          z,
        })
      }
    }

    return coordinates
  }

  static deserialize(obj: any): Chunk {
    if (!(obj.blocks instanceof Uint8Array)) {
      obj.blocks = new Uint8Array(obj.blocks)
    }

    return new Chunk(obj.x, obj.z, obj.blocks)
  }

  static getWorldID(coords: ChunkCoordinates): string {
    return `chunk_${coords.x}_${coords.z}`
  }

  static serialize(chunk: Chunk): any {
    return chunk.serialize()
  }

  getBlock(x: number, y: number, z: number): Maybe<number> {
    const index = Chunk.blockIndex(x, y, z)
    const blockID = this.blocks[index]

    if (blockID === undefined || blockID === 0) {
      // Assuming 0 is air / non-existent block
      return None()
    }

    return Some(blockID)
  }

  getWorldID(): string {
    return Chunk.getWorldID(this)
  }

  serialize(): any {
    return {
      blocks: this.blocks,
      x: this.x,
      z: this.z,
    }
  }

  setBlock(x: number, y: number, z: number, blockID: number): void {
    const index = Chunk.blockIndex(x, y, z)
    this.blocks[index] = blockID
  }
}
