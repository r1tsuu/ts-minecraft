import { chain } from '../../Chain.ts'
import { Chunk } from '../../entities/Chunk.ts'
import { apply, mapDecoder, mapEncoder } from '../../util.ts'

export class SinglePlayerWorkerServerStartPayload {
  static readonly type = 'SinglePlayerWorker.ServerStarted'
  constructor(readonly loadedChunks: Map<string, Chunk>) {}

  static deserialize(obj: any): SinglePlayerWorkerServerStartPayload {
    return chain(obj.loadedChunks)
      .map(apply(mapDecoder, Chunk.deserialize))
      .map((chunks) => new SinglePlayerWorkerServerStartPayload(chunks))
      .unwrap()
  }

  serialize() {
    return chain(this.loadedChunks)
      .map(apply(mapEncoder, (chunk: Chunk) => chunk.serialize()))
      .map((loadedChunks) => ({ loadedChunks }))
      .unwrap()
  }
}
