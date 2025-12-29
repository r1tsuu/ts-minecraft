import { chain } from '../../Chain.ts'
import { Chunk } from '../../entities/Chunk.ts'
import { MinecraftEvent } from '../../MinecraftEvent.ts'
import { apply, mapDecoder, mapEncoder } from '../../util.ts'

export class ResponseChunksLoad extends MinecraftEvent {
  static readonly type = 'Server.ResponseChunksLoad'

  constructor(readonly chunks: Map<string, Chunk>) {
    super()
  }

  static deserialize(obj: any): ResponseChunksLoad {
    return chain(obj.chunks)
      .map(apply(mapDecoder, Chunk.deserialize))
      .map((chunks) => new ResponseChunksLoad(chunks))
      .unwrap()
  }

  serialize() {
    return chain(this.chunks)
      .map(apply(mapEncoder, (chunk: Chunk) => chunk.serialize()))
      .map((chunks) => ({ chunks }))
      .unwrap()
  }
}
