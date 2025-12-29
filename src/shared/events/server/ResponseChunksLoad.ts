import { chain } from '../../Chain.ts'
import { Chunk } from '../../entities/Chunk.ts'
import { MinecraftEvent } from '../../MinecraftEvent.ts'

export class ResponseChunksLoad extends MinecraftEvent {
  static readonly type = 'Server.ResponseChunksLoad'

  constructor(readonly chunks: Chunk[]) {
    super()
  }

  static deserialize(obj: any): ResponseChunksLoad {
    return chain(obj.chunks)
      .mapArray(Chunk.deserialize)
      .map((chunks) => new ResponseChunksLoad(chunks))
      .unwrap()
  }

  serialize() {
    return chain(this.chunks)
      .mapArray(Chunk.serialize)
      .map((chunks) => ({ chunks }))
      .unwrap()
  }
}
