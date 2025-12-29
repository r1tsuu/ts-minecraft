export class WorkerReadyPayload {
  static readonly type = 'SinglePlayerWorker.WorkerReady'
  constructor() {}

  static deserialize(): WorkerReadyPayload {
    return new WorkerReadyPayload()
  }

  serialize() {
    return {}
  }
}
