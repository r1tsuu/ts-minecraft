import { MinecraftEvent } from '../../MinecraftEvent.ts'

export class WorkerReady extends MinecraftEvent {
  static readonly type = 'SinglePlayerWorker.WorkerReady'

  constructor() {
    super()
  }

  static deserialize(): WorkerReady {
    return new WorkerReady()
  }

  serialize() {
    return {}
  }
}
