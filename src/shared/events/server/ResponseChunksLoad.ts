import { Chunk } from '../../entities/Chunk.ts'
import { MinecraftEvent } from '../../MinecraftEvent.ts'
import { pipe } from '../../Pipe.ts'

export class ResponseChunksLoad extends MinecraftEvent {
  static readonly type = 'Server.ResponseChunksLoad'

  constructor(readonly chunks: Chunk[]) {
    super()
  }

  static deserialize(obj: any): ResponseChunksLoad {
    return pipe(obj.chunks)
      .mapArray(Chunk.deserialize)
      .map((chunks) => new ResponseChunksLoad(chunks))
      .value()
  }

  serialize() {
    return pipe(this.chunks)
      .mapArray(Chunk.serialize)
      .map((chunks) => ({ chunks }))
      .value()
  }
}
