export class StartLocalServerPayload {
  static readonly type = 'Client.StartLocalServer'
  constructor(readonly worldDatabaseName: string) {}

  static decode(obj: any): StartLocalServerPayload {
    return new StartLocalServerPayload(obj.worldDatabaseName)
  }

  static encode(obj: StartLocalServerPayload): any {
    return { worldDatabaseName: obj.worldDatabaseName }
  }
}
