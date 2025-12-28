import { Chunk } from '../../entities/Chunk.ts'

export class SinglePlayerWorkerServerStartPayload {
  static readonly type = 'SinglePlayerWorker.ServerStarted'
  constructor(readonly loadedChunks: Map<string, Chunk>) {}

  static decode(obj: any): SinglePlayerWorkerServerStartPayload {
    const loadedChunks = new Map<string, Chunk>()
    for (const [key, value] of Object.entries(obj.loadedChunks)) {
      loadedChunks.set(key, Chunk.decode(value))
    }
    return new SinglePlayerWorkerServerStartPayload(loadedChunks)
  }

  static encode(obj: SinglePlayerWorkerServerStartPayload): any {
    const loadedChunks: Record<string, any> = {}
    for (const [key, value] of obj.loadedChunks) {
      loadedChunks[key] = Chunk.encode(value)
    }
    return { loadedChunks }
  }
}
