import { Config } from '../Config.ts'
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

  getWorldID(): string {
    return `chunk_${this.x}_${this.z}`
  }

  serialize(): any {
    return {
      blocks: this.blocks,
      x: this.x,
      z: this.z,
    }
  }
}
