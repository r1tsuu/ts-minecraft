import type { ChunkCoordinates } from '../../../types.ts'

export class RequestChunksLoadPayload {
  static readonly type = 'Client.RequestChunksLoad'
  constructor(readonly chunks: ChunkCoordinates[]) {}

  static decode(obj: any): RequestChunksLoadPayload {
    return new RequestChunksLoadPayload(obj.chunks)
  }

  static encode(obj: RequestChunksLoadPayload): any {
    return {
      chunks: obj.chunks,
    }
  }
}
