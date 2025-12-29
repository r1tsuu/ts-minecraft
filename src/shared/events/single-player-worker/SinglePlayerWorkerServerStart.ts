import { Chunk } from '../../entities/Chunk.ts'
import { MinecraftEvent } from '../../MinecraftEvent.ts'
import { pipe } from '../../Pipe.ts'
import { apply, mapDecoder, mapEncoder } from '../../util.ts'

export class ServerStarted extends MinecraftEvent {
  static readonly type = 'SinglePlayerWorker.ServerStarted'

  constructor(readonly loadedChunks: Map<string, Chunk>) {
    super()
  }

  static deserialize(obj: any): ServerStarted {
    return pipe(obj.loadedChunks)
      .map(apply(mapDecoder, Chunk.deserialize))
      .map((chunks) => new ServerStarted(chunks))
      .value()
  }

  serialize() {
    return pipe(this.loadedChunks)
      .map(apply(mapEncoder, (chunk: Chunk) => chunk.serialize()))
      .map((loadedChunks) => ({ loadedChunks }))
      .value()
  }
}
