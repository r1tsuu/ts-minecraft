import type { MinecraftEventQueueEvent } from '../queue/minecraft.ts'

import { createMinecraftServer, type MinecraftServerInstance } from '../server/create.ts'

let localServer: MinecraftServerInstance | null = null

onmessage = async (message: MessageEvent<MinecraftEventQueueEvent>) => {
  if (message.data.type === 'START_LOCAL_SERVER') {
    if (localServer) {
      console.warn('Received START_LOCAL_SERVER but Local server is already started.')
      return
    }

    localServer = await createMinecraftServer({
      worldDatabaseName: message.data.payload.worldDatabaseName,
    })

    localServer.eventQueue.on('*', (event) => {
      if (
        event.from === 'SERVER' &&
        (event.type.startsWith('RESPONSE_') || event.type === 'SERVER_STARTED')
      )
        postMessage(event)
    })

    return
  }

  if (localServer !== null) {
    localServer.eventQueue.emit(
      message.data.type,
      message.data.payload,
      message.data.eventUUID,
      message.data.timestamp,
    )
  } else {
    console.warn('Received event but local server is not started yet:', message.data)
  }
}

const readyEvent: Omit<MinecraftEventQueueEvent, 'cancel' | 'respond'> = {
  eventUUID: crypto.randomUUID(),
  from: 'SERVER',
  payload: {},
  timestamp: Date.now(),
  type: 'SINGLEPLAYER_WORKER_READY',
}

postMessage(readyEvent)
