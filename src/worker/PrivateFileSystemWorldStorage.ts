/// <reference lib="webworker" />
import type { WorldStorageAdapter } from '../server/types.ts'
import type { UUID } from '../types.ts'

import { chainAsync } from '../shared/ChainAsync.ts'
import { Chunk, type ChunkCoordinates } from '../shared/entities/Chunk.ts'
import { Player } from '../shared/entities/Player.ts'
import { Maybe } from '../shared/Maybe.ts'

export class PrivateFileSystemWorldStorage implements WorldStorageAdapter {
  private static readonly PLAYERS_FILE_NAME = 'players.json'

  constructor(private directory: FileSystemDirectoryHandle) {}

  static async create(worldName: string): Promise<PrivateFileSystemWorldStorage> {
    return chainAsync(navigator.storage.getDirectory())
      .map((directoryHandle) => directoryHandle.getDirectoryHandle('worlds', { create: true }))
      .map((worldsDirectory) => worldsDirectory.getDirectoryHandle(worldName, { create: true }))
      .map((worldDirectory) => new PrivateFileSystemWorldStorage(worldDirectory))
      .catch((error) => {
        console.error('Error creating PrivateFileSystemWorldStorage:', error)
        throw error
      })
      .execute()
  }

  async deleteChunk(coordinates: ChunkCoordinates): Promise<void> {
    const filename = this.getChunkFileName(coordinates)
    await this.directory.removeEntry(filename).catch((e) => {
      console.warn('Error deleting chunk file:', e)
    })
  }

  async deletePlayer(uuid: UUID): Promise<void> {
    await chainAsync(this.getAccessHandle(PrivateFileSystemWorldStorage.PLAYERS_FILE_NAME, false))
      .map((handle) => {
        try {
          const size = handle.getSize()
          const buffer = new Uint8Array(size)
          handle.read(buffer, { at: 0 })
          return new TextDecoder().decode(buffer)
        } finally {
          handle.close()
        }
      })
      .map((buffer) => JSON.parse(buffer) as Player[])
      .filterArray((player) => player.uuid !== uuid)
      .tap(async (players) => {
        const textEncoder = new TextEncoder()
        const jsonString = JSON.stringify(players, null, 2)
        const buffer = textEncoder.encode(jsonString)
        await this.writeFile(PrivateFileSystemWorldStorage.PLAYERS_FILE_NAME, buffer)
      })
      .catch((error) => {
        console.warn('Error deleting player file:', error)
      })
      .execute()
  }

  async readChunk(chunkCoordinates: ChunkCoordinates): Promise<Maybe<Chunk>> {
    const accessHandle = await this.getAccessHandle(this.getChunkFileName(chunkCoordinates), false)

    return chainAsync(accessHandle)
      .map((accessHandle) => {
        try {
          const size = accessHandle.getSize()
          const buffer = new Uint8Array(size)
          accessHandle.read(buffer, { at: 0 })
          return buffer
        } finally {
          accessHandle.close()
        }
      })

      .map((buffer) => new Chunk(chunkCoordinates.x, chunkCoordinates.z, buffer))
      .map(Maybe.Some)
      .catch((error) => {
        console.warn('Error reading chunk file:', error)
        return Maybe.None<Chunk>()
      })
      .execute()
  }

  readChunks(chunks: ChunkCoordinates[]): Promise<Maybe<Chunk>[]> {
    return chainAsync(chunks)
      .mapArray((chunk) => this.readChunk(chunk))
      .execute()
  }

  async readPlayers(): Promise<Player[]> {
    return chainAsync(this.getAccessHandle(PrivateFileSystemWorldStorage.PLAYERS_FILE_NAME, false))
      .map((handle) => {
        try {
          const size = handle.getSize()
          const buffer = new Uint8Array(size)
          handle.read(buffer, { at: 0 })
          return new TextDecoder().decode(buffer)
        } finally {
          handle.close()
        }
      })
      .map((buffer) => JSON.parse(buffer))
      .execute()
  }

  async writeChunk(chunk: Chunk): Promise<void> {
    await this.writeFile(
      this.getChunkFileName({
        x: chunk.x,
        z: chunk.z,
      }),
      chunk.blocks,
    )
  }

  async writePlayers(data: Player[]): Promise<void> {
    const textEncoder = new TextEncoder()
    const jsonString = JSON.stringify(data, null, 2)
    const buffer = textEncoder.encode(jsonString)

    await this.writeFile(PrivateFileSystemWorldStorage.PLAYERS_FILE_NAME, buffer).catch((error) => {
      console.warn('Error writing players file:', error)
    })
  }

  private async getAccessHandle(
    fileName: string,
    create: boolean,
  ): Promise<FileSystemSyncAccessHandle> {
    return chainAsync(this.directory.getFileHandle(fileName, { create }))
      .map((fileHandle) => fileHandle.createSyncAccessHandle())
      .execute()
  }

  private getChunkFileName(chunkCoordinates: ChunkCoordinates): string {
    return `chunk_overworld_${chunkCoordinates.x}_${chunkCoordinates.z}.bin`
  }

  private async writeFile(fileName: string, data: Uint8Array): Promise<void> {
    const accessHandle = await this.getAccessHandle(fileName, true)

    try {
      accessHandle.write(data)
    } catch (error) {
      console.warn('Error writing file:', error)
    } finally {
      accessHandle.close()
    }
  }
}
