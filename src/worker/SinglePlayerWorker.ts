import { MinecraftServer } from '../server/MinecraftServer.ts'
import { SinglePlayerWorkerServerStartPayload } from '../shared/events/single-player-worker/SinglePlayerWorkerServerStartPayload.ts'
import { type AnyMinecraftEvent, MinecraftEventBus } from '../shared/MinecraftEventBus.ts'

let localServer: MinecraftServer | null = null

const eventBus = new MinecraftEventBus('Server')

const shouldForwardEventToClient = (event: AnyMinecraftEvent) => {
  if (event.metadata.environment === 'Client') {
    return false
  }

  if (event.type.startsWith('Server.Response')) {
    return true
  }

  if (
    event.type === 'SinglePlayerWorker.WorkerReady' ||
    event.type === 'SinglePlayerWorker.ServerStarted'
  ) {
    return true
  }

  return false
}

eventBus.subscribe('*', (event) => {
  if (shouldForwardEventToClient(event)) {
    postMessage(event.intoRaw())
  }
})

onmessage = async (message: MessageEvent<AnyMinecraftEvent>) => {
  if (message.data.type === 'Client.StartLocalServer') {
    if (localServer) {
      console.warn('Received START_LOCAL_SERVER but Local server is already started.')
      return
    }

    console.log(`Starting local server...`, message)

    localServer = await MinecraftServer.create(eventBus, message.data.payload.worldDatabaseName)

    eventBus.publish(
      new SinglePlayerWorkerServerStartPayload(localServer.loadedChunks),
      message.data.eventUUID,
    )

    console.log('Local server started.', localServer)

    return
  }

  if (localServer !== null) {
    eventBus.publish(message.data.type, message.data.payload, message.data.eventUUID, {
      environment: message.data.metadata.environment,
      isForwarded: true,
    })
  } else {
    console.warn('Received event but local server is not started yet:', message.data)
  }
}

eventBus.publish('SinglePlayerWorker.WorkerReady', {})
