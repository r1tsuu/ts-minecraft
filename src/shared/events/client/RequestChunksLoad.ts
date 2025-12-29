import type { ChunkCoordinates } from '../../../types.ts'

export class RequestChunksLoad {
  static readonly type = 'Client.RequestChunksLoad'
  constructor(readonly chunks: ChunkCoordinates[]) {}

  static deserialize(obj: any): RequestChunksLoad {
    return new RequestChunksLoad(obj.chunks)
  }

  serialize() {
    return {
      chunks: this.chunks,
    }
  }
}
