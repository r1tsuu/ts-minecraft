import type { StartLocalServer } from '../shared/events/client/StartLocalServer.ts'
import type { MinecraftEvent } from '../shared/MinecraftEvent.ts'

import { MinecraftServer } from '../server/MinecraftServer.ts'
import { MinecraftServerFactory } from '../server/MinecraftServerFactory.ts'
import { ServerContainer } from '../server/ServerContainer.ts'
import { deserializeEvent, serializeEvent } from '../shared/Event.ts'
import { ClientEvent } from '../shared/events/client/index.ts'
import { SinglePlayerWorkerEvent } from '../shared/events/single-player-worker/index.ts'
import { Maybe } from '../shared/Maybe.ts'
import { MinecraftEventBus } from '../shared/MinecraftEventBus.ts'
import { PrivateFileSystemWorldStorage } from './PrivateFileSystemWorldStorage.ts'

class SinglePlayerServerImpl {
  private eventBus: MinecraftEventBus
  private server: Maybe<MinecraftServer> = Maybe.None()

  constructor() {
    this.eventBus = new MinecraftEventBus('Server')
    ServerContainer.registerSingleton(this.eventBus)
    this.eventBus.registerHandlers(this)
    this.eventBus.publish(new SinglePlayerWorkerEvent.WorkerReady())
  }

  async handleMessage(message: MessageEvent<MinecraftEvent>): Promise<void> {
    const event = deserializeEvent(this.eventBus, message.data)
    event.metadata.isForwarded = true // Mark as forwarded
    this.eventBus.publish(event)
  }

  @MinecraftEventBus.Handler('*')
  protected forwardEventsToClient(event: MinecraftEvent): void {
    if (
      event.getType().startsWith('Server.Response') ||
      event instanceof SinglePlayerWorkerEvent.WorkerReady ||
      event instanceof SinglePlayerWorkerEvent.ServerStarted
    ) {
      postMessage(serializeEvent(event))
    }
  }

  @MinecraftEventBus.Handler(ClientEvent.StartLocalServer)
  protected async startLocalServer(event: StartLocalServer): Promise<void> {
    if (this.server.isSome()) {
      console.warn(
        `Received ${ClientEvent.StartLocalServer.type} but Local server is already started.`,
      )
      return
    }

    console.log(`Starting local server...`)

    const storage = await PrivateFileSystemWorldStorage.create(event.worldName)
    const { server, world } = await new MinecraftServerFactory(storage).build()
    this.server = Maybe.Some(server)

    this.eventBus.publish(
      new SinglePlayerWorkerEvent.ServerStarted(world),
      event.metadata.uuid.valueOrUndefined(),
    )
  }
}

const singlePlayerServer = new SinglePlayerServerImpl()

self.onmessage = (message: MessageEvent<MinecraftEvent>) => {
  singlePlayerServer.handleMessage(message)
}
