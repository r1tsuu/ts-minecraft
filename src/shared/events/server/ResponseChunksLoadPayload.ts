import { chain } from '../../Chain.ts'
import { Chunk } from '../../entities/Chunk.ts'
import { apply, mapDecoder, mapEncoder } from '../../util.ts'

export class ResponseChunksLoadPayload {
  static readonly type = 'Server.ResponseChunksLoad'
  constructor(readonly chunks: Map<string, Chunk>) {}

  static decode(obj: any): ResponseChunksLoadPayload {
    return chain(obj.chunks)
      .map(apply(mapDecoder, Chunk.decode))
      .map((chunks) => new ResponseChunksLoadPayload(chunks))
      .unwrap()
  }

  static encode(obj: ResponseChunksLoadPayload): any {
    return chain(obj.chunks)
      .map(apply(mapEncoder, Chunk.encode))
      .map((chunks) => ({ chunks }))
      .unwrap()
  }
}
