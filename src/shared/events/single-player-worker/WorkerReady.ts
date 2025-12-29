export class WorkerReady {
  static readonly type = 'SinglePlayerWorker.WorkerReady'
  constructor() {}

  static deserialize(): WorkerReady {
    return new WorkerReady()
  }

  serialize() {
    return {}
  }
}
