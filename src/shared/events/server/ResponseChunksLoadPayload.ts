import { Chunk } from '../../entities/Chunk.ts'

export class ResponseChunksLoadPayload {
  static readonly type = 'Server.ResponseChunksLoad'
  constructor(readonly chunks: Map<string, Chunk>) {}

  static decode(obj: any): ResponseChunksLoadPayload {
    const chunks = new Map<string, Chunk>()
    for (const [key, value] of Object.entries(obj.chunks)) {
      chunks.set(key, Chunk.decode(value))
    }
    return new ResponseChunksLoadPayload(chunks)
  }

  static encode(obj: ResponseChunksLoadPayload): any {
    const chunks: Record<string, any> = {}
    for (const [key, value] of obj.chunks) {
      chunks[key] = Chunk.encode(value)
    }
    return { chunks }
  }
}
