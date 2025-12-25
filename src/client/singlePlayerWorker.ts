import { createMinecraftEventQueue, type MinecraftEvent } from '../queue/minecraft.ts'
import { createMinecraftServer, type MinecraftServerInstance } from '../server/create.ts'

let localServer: MinecraftServerInstance | null = null

const eventQueue = createMinecraftEventQueue('SERVER')

const clientEventForwardMatcher = (event: MinecraftEvent) => {
  if (event.from === 'CLIENT') {
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
  if (clientEventForwardMatcher(event)) {
    postMessage(event.serialize())
  }
})

onmessage = async (message: MessageEvent<MinecraftEvent>) => {
  if (message.data.type === 'START_LOCAL_SERVER') {
    if (localServer) {
      console.warn('Received START_LOCAL_SERVER but Local server is already started.')
      return
    }

    console.log(`Starting local server...`, message)

    localServer = await createMinecraftServer({
      eventQueue,
      worldDatabaseName: message.data.payload.worldDatabaseName,
    })

    console.log('Local server started.', localServer)

    return
  }

  if (localServer !== null) {
    localServer.eventQueue.emit(
      message.data.type,
      message.data.payload,
      message.data.eventUUID,
      message.data.timestamp,
      message.data.from,
    )
  } else {
    console.warn('Received event but local server is not started yet:', message.data)
  }
}

eventQueue.emit('SINGLEPLAYER_WORKER_READY', {})
