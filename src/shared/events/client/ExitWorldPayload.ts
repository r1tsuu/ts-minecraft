export class ExitWorldPayload {
  static readonly type = 'Client.ExitWorld'
  constructor() {}

  static decode(): ExitWorldPayload {
    return new ExitWorldPayload()
  }

  static encode(): any {
    return {}
  }
}
