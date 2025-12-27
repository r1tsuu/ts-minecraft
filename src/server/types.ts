import type { Option } from '../shared/util.ts'
import type { ChunkIndex, UUID } from '../types.ts'
import type { DatabasePlayerData } from './WorldDatabase.ts'

export interface WorldMetadata {
  lastLoadedAt: Date | null
  loadedChunks: ChunkIndex[]
}

export interface WorldStorageAdapter {
  deleteChunk(index: ChunkIndex): Promise<void>
  deletePlayer(uuid: UUID): Promise<void>
  readChunk(index: ChunkIndex): Promise<Option<Uint8Array>>
  readPlayers(): Promise<Option<DatabasePlayerData[]>>
  writeChunk(index: ChunkIndex, data: Uint8Array): Promise<void>
  writePlayers(data: DatabasePlayerData[]): Promise<void>
}
