import { chain } from '../../Chain.ts'
import { Chunk } from '../../entities/Chunk.ts'
import { apply, mapDecoder, mapEncoder } from '../../util.ts'

export class ResponseChunksLoadPayload {
  static readonly type = 'Server.ResponseChunksLoad'
  constructor(readonly chunks: Map<string, Chunk>) {}

  static deserialize(obj: any): ResponseChunksLoadPayload {
    return chain(obj.chunks)
      .map(apply(mapDecoder, Chunk.deserialize))
      .map((chunks) => new ResponseChunksLoadPayload(chunks))
      .unwrap()
  }

  serialize() {
    return chain(this.chunks)
      .map(apply(mapEncoder, (chunk: Chunk) => chunk.serialize()))
      .map((chunks) => ({ chunks }))
      .unwrap()
  }
}
