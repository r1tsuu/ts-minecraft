import { setCurrentEnvironment } from '../shared/env.ts'
setCurrentEnvironment('Server')

import type { StartLocalServer } from '../shared/events/client/StartLocalServer.ts'
import type { MinecraftEvent } from '../shared/MinecraftEvent.ts'

import { createMinecraftServer } from '../server/create.ts'
import { MinecraftServer } from '../server/MinecraftServer.ts'
import { deserializeEvent, serializeEvent } from '../shared/Event.ts'
import { ClientEvent } from '../shared/events/client/index.ts'
import { SinglePlayerWorkerEvent } from '../shared/events/single-player-worker/index.ts'
import { Maybe, None, Some } from '../shared/Maybe.ts'
import { eventBus, Handler, Listener } from '../shared/MinecraftEventBus.ts'
import { PrivateFileSystemWorldStorage } from './PrivateFileSystemWorldStorage.ts'

@Listener()
class SinglePlayerServerImpl {
  server: Maybe<MinecraftServer> = None()

  constructor() {
    eventBus.publish(new SinglePlayerWorkerEvent.WorkerReady())
  }

  handleMessage(message: MessageEvent<MinecraftEvent>): void {
    const event = deserializeEvent(eventBus, message.data)
    event.metadata.isForwarded = true // Mark as forwarded
    eventBus.publish(event)
  }

  @Handler('*')
  protected forwardEventsToClient(event: MinecraftEvent): void {
    if (
      event.getType().startsWith('Server.Response') ||
      event instanceof SinglePlayerWorkerEvent.WorkerReady ||
      event instanceof SinglePlayerWorkerEvent.ServerStarted
    ) {
      postMessage(serializeEvent(event))
    }
  }

  @Handler(ClientEvent.StartLocalServer)
  protected async onStartLocalServer(event: StartLocalServer): Promise<void> {
    if (this.server.isSome()) {
      console.warn(
        `Received ${ClientEvent.StartLocalServer.type} but Local server is already started.`,
      )
      return
    }

    console.log(`Starting local server...`)

    const storage = await PrivateFileSystemWorldStorage.create(event.worldName)
    const { server, world } = await createMinecraftServer(storage)
    this.server = Some(server)

    eventBus.publish(
      new SinglePlayerWorkerEvent.ServerStarted(world),
      event.metadata.uuid.valueOrUndefined(),
    )
  }
}

const singlePlayerServer = new SinglePlayerServerImpl()

self.onmessage = (message: MessageEvent<MinecraftEvent>) => {
  singlePlayerServer.handleMessage(message)
}
