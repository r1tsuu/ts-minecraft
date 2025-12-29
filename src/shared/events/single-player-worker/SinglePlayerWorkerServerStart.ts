import { chain } from '../../Chain.ts'
import { Chunk } from '../../entities/Chunk.ts'
import { MinecraftEvent } from '../../MinecraftEvent.ts'
import { apply, mapDecoder, mapEncoder } from '../../util.ts'

export class ServerStarted extends MinecraftEvent {
  static readonly type = 'SinglePlayerWorker.ServerStarted'

  constructor(readonly loadedChunks: Map<string, Chunk>) {
    super()
  }

  static deserialize(obj: any): ServerStarted {
    return chain(obj.loadedChunks)
      .map(apply(mapDecoder, Chunk.deserialize))
      .map((chunks) => new ServerStarted(chunks))
      .unwrap()
  }

  serialize() {
    return chain(this.loadedChunks)
      .map(apply(mapEncoder, (chunk: Chunk) => chunk.serialize()))
      .map((loadedChunks) => ({ loadedChunks }))
      .unwrap()
  }
}
