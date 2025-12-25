import { type AnyMinecraftEvent, MinecraftEventQueue } from '../queue/MinecraftQueue.ts'
import { MinecraftServer } from '../server/MinecraftServer.ts'

let localServer: MinecraftServer | null = null

const eventQueue = new MinecraftEventQueue('SERVER')

const shouldForwardEventToClient = (event: AnyMinecraftEvent) => {
  if (event.metadata.environment === 'CLIENT') {
    return false
  }

  if (event.type.startsWith('RESPONSE_')) {
    return true
  }

  if (event.type === 'SINGLEPLAYER_WORKER_READY' || event.type === 'SERVER_STARTED') {
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
  if (message.data.type === 'START_LOCAL_SERVER') {
    if (localServer) {
      console.warn('Received START_LOCAL_SERVER but Local server is already started.')
      return
    }

    console.log(`Starting local server...`, message)

    localServer = await MinecraftServer.create(eventQueue, message.data.payload.worldDatabaseName)

    eventQueue.emit(
      'SERVER_STARTED',
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

eventQueue.emit('SINGLEPLAYER_WORKER_READY', {})
