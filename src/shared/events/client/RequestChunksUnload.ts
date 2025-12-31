import type { ChunkCoordinates } from '../../entities/Chunk.ts'

import { MinecraftEvent } from '../../MinecraftEvent.ts'

export class RequestChunksUnload extends MinecraftEvent {
  static readonly type = 'Client.RequestChunksUnload'

  constructor(readonly chunks: ChunkCoordinates[]) {
    super()
  }

  static deserialize(obj: any): RequestChunksUnload {
    return new RequestChunksUnload(obj.chunks)
  }

  serialize() {
    return {
      chunks: this.chunks,
    }
  }
}
