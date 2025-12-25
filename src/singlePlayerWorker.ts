import type { MinecraftEventQueueEvent } from './queue/minecraft.ts'

import {
  createMinecraftServer,
  type MinecraftServerInstance,
} from './server/createMinecraftServer.ts'

let localServer: MinecraftServerInstance | null = null

onmessage = async (message: MessageEvent<MinecraftEventQueueEvent>) => {
  if (message.data.type === 'START_LOCAL_SERVER') {
    localServer = await createMinecraftServer({
      worldDatabaseName: message.data.payload.worldDatabaseName,
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
  }
}

postMessage({ type: 'WORKER_READY' })
