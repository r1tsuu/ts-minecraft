/// <reference lib="webworker" />
import type { WorldStorageAdapter } from '../server/types.ts'
import type { DatabasePlayerData } from '../server/WorldDatabase.ts'
import type { ChunkIndex, UUID } from '../types.ts'

import { Option } from '../shared/Option.ts'

export class PrivateFileSystemWorldStorage implements WorldStorageAdapter {
  private static PLAYERS_FILE_NAME = 'players.json'

  constructor(private directory: FileSystemDirectoryHandle) {}

  static async create(worldName: string): Promise<PrivateFileSystemWorldStorage> {
    const directoryHandle = await navigator.storage.getDirectory()
    const worldsDirectory = await directoryHandle.getDirectoryHandle('worlds', { create: true })
    const worldDirectory = await worldsDirectory.getDirectoryHandle(worldName, { create: true })

    return new PrivateFileSystemWorldStorage(worldDirectory)
  }

  async deleteChunk(index: ChunkIndex): Promise<void> {
    try {
      await this.getAccessHandle(this.getChunkFileName(index), false)
    } catch (error) {
      console.warn('Error deleting chunk file:', error)
    }
  }

  async deletePlayer(uuid: UUID): Promise<void> {
    try {
      const accessHandle = await this.getAccessHandle(
        PrivateFileSystemWorldStorage.PLAYERS_FILE_NAME,
        false,
      )
      const size = accessHandle.getSize()
      const buffer = new Uint8Array(size)
      accessHandle.read(buffer, { at: 0 })
      accessHandle.close()

      const textDecoder = new TextDecoder()
      const jsonString = textDecoder.decode(buffer)
      let players: DatabasePlayerData[] = JSON.parse(jsonString)

      players = players.filter((player) => player.uuid !== uuid)

      const textEncoder = new TextEncoder()
      const updatedJsonString = JSON.stringify(players, null, 2)
      const updatedBuffer = textEncoder.encode(updatedJsonString)

      await this.writeFile(PrivateFileSystemWorldStorage.PLAYERS_FILE_NAME, updatedBuffer)
    } catch (e) {
      console.error('Error deleting player file:', e)
    }
  }

  readChunk(index: ChunkIndex): Promise<Option<Uint8Array>> {
    return Option.fromPromise(
      this.getAccessHandle(this.getChunkFileName(index), false).then((accessHandle) => {
        if (accessHandle === null) {
          return null
        }

        const size = accessHandle.getSize()
        const buffer = new Uint8Array(size)
        accessHandle.read(buffer, { at: 0 })
        accessHandle.close()

        return buffer
      }),
      (error) => console.warn('Error reading chunk file:', error),
    )
  }

  readPlayers(): Promise<Option<DatabasePlayerData[]>> {
    return Option.fromPromise(
      this.getAccessHandle(PrivateFileSystemWorldStorage.PLAYERS_FILE_NAME, false).then(
        async (accessHandle) => {
          if (accessHandle === null) {
            return null
          }

          const size = accessHandle.getSize()
          const buffer = new Uint8Array(size)
          accessHandle.read(buffer, { at: 0 })
          accessHandle.close()

          const textDecoder = new TextDecoder()
          const jsonString = textDecoder.decode(buffer)
          const players: DatabasePlayerData[] = JSON.parse(jsonString)
          return players
        },
      ),
      (error) => console.warn('Error reading players file:', error),
    )
  }

  async writeChunk(index: ChunkIndex, data: Uint8Array): Promise<void> {
    await this.writeFile(this.getChunkFileName(index), data)
  }

  writePlayers(data: DatabasePlayerData[]): Promise<void> {
    const textEncoder = new TextEncoder()
    const jsonString = JSON.stringify(data, null, 2)
    const buffer = textEncoder.encode(jsonString)

    return this.writeFile(PrivateFileSystemWorldStorage.PLAYERS_FILE_NAME, buffer)
  }

  private async getAccessHandle(
    fileName: string,
    create: boolean,
  ): Promise<FileSystemSyncAccessHandle> {
    const fileHandle = await this.directory.getFileHandle(fileName, { create })

    return fileHandle.createSyncAccessHandle()
  }

  private getChunkFileName(index: ChunkIndex): string {
    return `chunk_overworld_${index.x}_${index.z}.bin`
  }

  private async writeFile(fileName: string, data: Uint8Array): Promise<void> {
    const accessHandle = await this.getAccessHandle(fileName, true)

    accessHandle.write(data)
    accessHandle.close()
  }
}
