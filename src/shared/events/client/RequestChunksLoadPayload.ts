import type { ChunkCoordinates } from '../../../types.ts'

export class RequestChunksLoadPayload {
  static readonly type = 'Client.RequestChunksLoad'
  constructor(readonly chunks: ChunkCoordinates[]) {}

  static deserialize(obj: any): RequestChunksLoadPayload {
    return new RequestChunksLoadPayload(obj.chunks)
  }

  serialize() {
    return {
      chunks: this.chunks,
    }
  }
}
