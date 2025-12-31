import type { MinecraftEvent } from '../shared/MinecraftEvent.ts'

import { createMinecraftServer, type MinecraftServer } from '../server/MinecraftServer.ts'
import { deserializeEvent, serializeEvent } from '../shared/Event.ts'
import { ClientEvent } from '../shared/events/client/index.ts'
import { StartLocalServer } from '../shared/events/client/StartLocalServer.ts'
import { SinglePlayerWorkerEvent } from '../shared/events/single-player-worker/index.ts'
import { WorkerReady } from '../shared/events/single-player-worker/WorkerReady.ts'
import { Maybe, None, Some } from '../shared/Maybe.ts'
import { MinecraftEventBus } from '../shared/MinecraftEventBus.ts'
import { createPrivateFileSystemWorldStorage } from './PrivateFileSystemWorldStorage.ts'

let server: Maybe<MinecraftServer> = None()

const eventBus = new MinecraftEventBus('Server')

eventBus.subscribe('*', (event: MinecraftEvent) => {
  if (
    event.getType().startsWith('Server.Response') ||
    event instanceof SinglePlayerWorkerEvent.WorkerReady ||
    event instanceof SinglePlayerWorkerEvent.ServerStarted
  ) {
    postMessage(serializeEvent(event))
  }
})

eventBus.subscribe(StartLocalServer, async (event) => {
  if (server.isSome()) {
    console.warn(
      `Received ${ClientEvent.StartLocalServer.type} but Local server is already started.`,
    )
    return
  }

  console.log(`Starting local server...`)

  const storage = await createPrivateFileSystemWorldStorage(event.worldName)
  const createdServer = await createMinecraftServer({ eventBus, storage })
  server = Some(createdServer)

  eventBus.publish(
    new SinglePlayerWorkerEvent.ServerStarted(createdServer.world),
    event.metadata.uuid.valueOrUndefined(),
  )
})

onmessage = async (message: MessageEvent<MinecraftEvent>) => {
  const event = deserializeEvent(eventBus, message.data)
  event.metadata.isForwarded = true // Mark as forwarded
  eventBus.publish(event)
}

eventBus.publish(new WorkerReady())
