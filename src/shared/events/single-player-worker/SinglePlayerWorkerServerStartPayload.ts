import { chain } from '../../Chain.ts'
import { Chunk } from '../../entities/Chunk.ts'
import { apply, mapDecoder, mapEncoder } from '../../util.ts'

export class SinglePlayerWorkerServerStartPayload {
  static readonly type = 'SinglePlayerWorker.ServerStarted'
  constructor(readonly loadedChunks: Map<string, Chunk>) {}

  static decode(obj: any): SinglePlayerWorkerServerStartPayload {
    return chain(obj.loadedChunks)
      .map(apply(mapDecoder, Chunk.decode))
      .map((chunks) => new SinglePlayerWorkerServerStartPayload(chunks))
      .unwrap()
  }

  static encode(obj: SinglePlayerWorkerServerStartPayload): any {
    return chain(obj.loadedChunks)
      .map(apply(mapEncoder, Chunk.encode))
      .map((loadedChunks) => ({ loadedChunks }))
      .unwrap()
  }
}
