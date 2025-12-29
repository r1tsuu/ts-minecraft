import type { Chunk, ChunkCoordinates } from '../shared/entities/Chunk.ts'
import type { Player } from '../shared/entities/Player.ts'
import type { Maybe } from '../shared/Maybe.ts'
import type { Result } from '../shared/Result.ts'
import type { ChunkIndex, UUID } from '../types.ts'

export interface WorldMetadata {
  lastLoadedAt: Date | null
  loadedChunks: ChunkIndex[]
}

export interface WorldStorageAdapter {
  deleteChunk(coordinates: ChunkCoordinates): Promise<void>
  deletePlayer(uuid: UUID): Promise<void>
  readChunk(coordinates: ChunkCoordinates): Promise<Maybe<Chunk>>
  readChunks(coordinates: ChunkCoordinates[]): Promise<Maybe<Chunk>[]>
  readPlayers(): Promise<Player[]>
  writeChunk(chunk: Chunk): Promise<void>
  writePlayers(data: Player[]): Promise<void>
}

export const WorldStorageAdapterSymbol = Symbol('WorldStorageAdapter')
