export class WorkerReadyPayload {
  static readonly type = 'SinglePlayerWorker.WorkerReady'
  constructor() {}

  static decode(): WorkerReadyPayload {
    return new WorkerReadyPayload()
  }

  static encode(): any {
    return {}
  }
}
