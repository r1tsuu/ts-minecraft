import { ExitWorld } from './ExitWorld.ts'
import { JoinedWorld } from './JoinedWorld.ts'
import { JoinWorld } from './JoinWorld.ts'
import { PauseToggle } from './PauseToggle.ts'
import { RequestChunksLoad } from './RequestChunksLoad.ts'
import { RequestChunksUnload } from './RequestChunksUnload.ts'
import { RequestPlayerJoin } from './RequestPlayerJoin.ts'
import { RequestSyncPlayer } from './RequestSyncPlayer.ts'
import { RequestSyncUpdatedBlocks } from './RequestSyncUpdatedBlocks.ts'
import { StartLocalServer } from './StartLocalServer.ts'

export const ClientEvent = {
  ExitWorld,
  JoinedWorld,
  JoinWorld,
  PauseToggle,
  RequestChunksLoad,
  RequestChunksUnload,
  RequestPlayerJoin,
  RequestSyncPlayer,
  RequestSyncUpdatedBlocks,
  StartLocalServer,
}

export type ClientEvent = typeof ClientEvent
