import { type AnyMinecraftEvent, MinecraftEventQueue } from '../shared/MinecraftEventQueue.ts'
import { MinecraftServer } from '../server/MinecraftServer.ts'

let localServer: MinecraftServer | null = null

const eventQueue = new MinecraftEventQueue('Server')

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

eventQueue.on('*', (event) => {
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

    localServer = await MinecraftServer.create(eventQueue, message.data.payload.worldDatabaseName)

    eventQueue.emit(
      'SinglePlayerWorker.ServerStarted',
      {
        loadedChunks: localServer.loadedChunks,
      },
      message.data.eventUUID,
    )

    console.log('Local server started.', localServer)

    return
  }

  if (localServer !== null) {
    eventQueue.emit(message.data.type, message.data.payload, message.data.eventUUID, {
      environment: message.data.metadata.environment,
      isForwarded: true,
    })
  } else {
    console.warn('Received event but local server is not started yet:', message.data)
  }
}

eventQueue.emit('SinglePlayerWorker.WorkerReady', {})
