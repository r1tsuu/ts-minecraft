import type { ChunkCoordinates } from '../../entities/Chunk.ts'

import { MinecraftEvent } from '../../MinecraftEvent.ts'

export class RequestChunksLoad extends MinecraftEvent {
  static readonly type = 'Client.RequestChunksLoad'

  constructor(readonly chunks: ChunkCoordinates[]) {
    super()
  }

  static deserialize(obj: any): RequestChunksLoad {
    return new RequestChunksLoad(obj.chunks)
  }

  serialize() {
    return {
      chunks: this.chunks,
    }
  }
}
