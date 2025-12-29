export class StartLocalServerPayload {
  static readonly type = 'Client.StartLocalServer'
  constructor(readonly worldDatabaseName: string) {}

  static deserialize(obj: any): StartLocalServerPayload {
    return new StartLocalServerPayload(obj.worldDatabaseName)
  }

  serialize() {
    return {
      worldDatabaseName: this.worldDatabaseName,
    }
  }
}
