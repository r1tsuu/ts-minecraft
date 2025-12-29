/// <reference lib="webworker" />
import type { WorldStorageAdapter } from '../server/types.ts'
import type { UUID } from '../types.ts'

import { asyncPipe } from '../shared/AsyncPipe.ts'
import { Chunk, type ChunkCoordinates } from '../shared/entities/Chunk.ts'
import { Player } from '../shared/entities/Player.ts'
import { Maybe, None, Some } from '../shared/Maybe.ts'

export class PrivateFileSystemWorldStorage implements WorldStorageAdapter {
  private static readonly PLAYERS_FILE_NAME = 'players.json'

  private constructor(private directory: FileSystemDirectoryHandle) {}

  static create(worldName: string): Promise<PrivateFileSystemWorldStorage> {
    return asyncPipe(navigator.storage.getDirectory())
      .map((directoryHandle) => directoryHandle.getDirectoryHandle('worlds', { create: true }))
      .map((worldsDirectory) => worldsDirectory.getDirectoryHandle(worldName, { create: true }))
      .map((worldDirectory) => new PrivateFileSystemWorldStorage(worldDirectory))
      .tapError((error) => console.error('Error accessing file system:', error))
      .execute()
  }

  async deleteChunk(coordinates: ChunkCoordinates): Promise<void> {
    await asyncPipe(coordinates)
      .map((coords) => this.getChunkFileName(coords))
      .tap((filename) => this.directory.removeEntry(filename))
      .tapError((error) => console.error('Error deleting chunk file:', error))
  }

  async deletePlayer(uuid: UUID): Promise<void> {
    await asyncPipe(this.getAccessHandle(PrivateFileSystemWorldStorage.PLAYERS_FILE_NAME, false))
      .map(readBufferIntoString)
      .map((buffer) => JSON.parse(buffer))
      .mapArray(Player.deserialize)
      .filterArray((player) => player.uuid !== uuid)
      .tap(async (players) => {
        const textEncoder = new TextEncoder()
        const jsonString = JSON.stringify(players.map(Player.serialize), null, 2)
        const buffer = textEncoder.encode(jsonString)
        await this.writeFile(PrivateFileSystemWorldStorage.PLAYERS_FILE_NAME, buffer)
      })
      .catch((error) => {
        console.warn('Error deleting player file:', error)
      })
      .execute()
  }

  async readChunk(chunkCoordinates: ChunkCoordinates): Promise<Maybe<Chunk>> {
    return asyncPipe(this.getChunkFileName(chunkCoordinates))
      .map((filename) => this.getAccessHandle(filename, false))
      .map(readBuffer)
      .map((buffer) => new Chunk(chunkCoordinates.x, chunkCoordinates.z, buffer))
      .map(Some)
      .tapError((error) => console.warn('Error reading chunk file:', error))
      .catch(() => None<Chunk>())
      .execute()
  }

  readChunks(chunks: ChunkCoordinates[]): Promise<
    {
      chunk: Maybe<Chunk>
      x: number
      z: number
    }[]
  > {
    return asyncPipe(chunks)
      .mapArray(async (chunk) => ({
        chunk: await this.readChunk({ x: chunk.x, z: chunk.z }),
        x: chunk.x,
        z: chunk.z,
      }))
      .execute()
  }

  async readPlayers(): Promise<Player[]> {
    return asyncPipe(this.getAccessHandle(PrivateFileSystemWorldStorage.PLAYERS_FILE_NAME, false))
      .map(readBufferIntoString)
      .map((buffer) => JSON.parse(buffer))
      .mapArray(Player.deserialize)
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
    await asyncPipe(data)
      .mapArray(Player.serialize)
      .map(JSON.stringify)
      .map(new TextEncoder().encode)
      .tap((buffer) => this.writeFile(PrivateFileSystemWorldStorage.PLAYERS_FILE_NAME, buffer))
      .tapError((error) => console.warn('Error writing players file:', error))
      .execute()
  }

  private async getAccessHandle(
    fileName: string,
    create: boolean,
  ): Promise<FileSystemSyncAccessHandle> {
    return asyncPipe(this.directory.getFileHandle(fileName, { create }))
      .map((fileHandle) => fileHandle.createSyncAccessHandle())
      .execute()
  }

  private getChunkFileName(chunkCoordinates: ChunkCoordinates): string {
    return `chunk_overworld_${chunkCoordinates.x}_${chunkCoordinates.z}.bin`
  }

  private async writeFile(fileName: string, data: Uint8Array): Promise<void> {
    await asyncPipe(this.getAccessHandle(fileName, true)).tap((accessHandle) =>
      asyncPipe()
        .tap(() => accessHandle.write(data))
        .tapError((error) => {
          console.warn('Error writing file:', error)
        })
        .tapFinally(() => accessHandle.close())
        .execute(),
    )
  }
}

const readBuffer = (handle: FileSystemSyncAccessHandle) =>
  asyncPipe()
    .map(() => {
      const size = handle.getSize()
      const buffer = new Uint8Array(size)
      handle.read(buffer, { at: 0 })
      return buffer
    })
    .tapFinally(() => handle.close())
    .execute()

const readBufferIntoString = (handle: FileSystemSyncAccessHandle) =>
  readBuffer(handle).then((buffer) => new TextDecoder().decode(buffer))
