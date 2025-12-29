import { ExitWorld } from './ExitWorld.ts'
import { JoinWorld } from './JoinWorld.ts'
import { RequestChunksLoad } from './RequestChunksLoad.ts'
import { StartLocalServer } from './StartLocalServer.ts'

export const ClientEvent = {
  ExitWorld,
  JoinWorld,
  RequestChunksLoad,
  StartLocalServer,
}

export type ClientEvent = typeof ClientEvent
