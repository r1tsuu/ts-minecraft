/// <reference lib="webworker" />
import type { WorldStorageAdapter } from '../server/types.ts'
import type { UUID } from '../types.ts'

import { asyncPipe } from '../shared/AsyncPipe.ts'
import { Chunk, type ChunkCoordinates } from '../shared/entities/Chunk.ts'
import { Player } from '../shared/entities/Player.ts'
import { Maybe, None, Some } from '../shared/Maybe.ts'

const PLAYERS_FILE_NAME = 'players.json'
const WORLDS_DIRECTORY_NAME = 'worlds'

export const createPrivateFileSystemWorldStorage = async (
  worldName: string,
): Promise<WorldStorageAdapter> => {
  const directory = await asyncPipe(navigator.storage.getDirectory())
    .map((directoryHandle) =>
      directoryHandle.getDirectoryHandle(WORLDS_DIRECTORY_NAME, { create: true }),
    )
    .map((worldsDirectory) => worldsDirectory.getDirectoryHandle(worldName, { create: true }))
    .execute()

  const getAccessHandle = (
    fileName: string,
    create: boolean,
  ): Promise<FileSystemSyncAccessHandle> => {
    return asyncPipe(directory.getFileHandle(fileName, { create }))
      .map((fileHandle) => fileHandle.createSyncAccessHandle())
      .execute()
  }

  const writeFile = async (fileName: string, data: Uint8Array): Promise<void> => {
    await asyncPipe(getAccessHandle(fileName, true)).tap((accessHandle) =>
      asyncPipe()
        .tap(() => accessHandle.write(data))
        .tapError((error) => {
          console.warn('Error writing file:', error)
        })
        .tapFinally(() => accessHandle.close())
        .execute(),
    )
  }

  return {
    async deleteChunk(coordinates: ChunkCoordinates): Promise<void> {
      await asyncPipe(coordinates)
        .map((coords) => getChunkFileName(coords))
        .tap((filename) => directory.removeEntry(filename))
        .tapError((error) => console.error('Error deleting chunk file:', error))
    },
    async deletePlayer(uuid: UUID): Promise<void> {
      await asyncPipe(getAccessHandle(PLAYERS_FILE_NAME, false))
        .map(readBufferIntoString)
        .map((buffer) => JSON.parse(buffer))
        .mapArray(Player.deserialize)
        .filterArray((player) => player.uuid !== uuid)
        .tap(async (players) => {
          const textEncoder = new TextEncoder()
          const jsonString = JSON.stringify(players.map(Player.serialize), null, 2)
          const buffer = textEncoder.encode(jsonString)
          await writeFile(PLAYERS_FILE_NAME, buffer)
        })
        .catch((error) => {
          console.warn('Error deleting player file:', error)
        })
        .execute()
    },
    async readChunk(chunkCoordinates: ChunkCoordinates): Promise<Maybe<Chunk>> {
      return asyncPipe(getChunkFileName(chunkCoordinates))
        .map((filename) => getAccessHandle(filename, false))
        .map(readBuffer)
        .map((buffer) => new Chunk(chunkCoordinates.x, chunkCoordinates.z, buffer))
        .map(Some)
        .catch(() => None<Chunk>())
        .execute()
    },
    async readPlayers(): Promise<Player[]> {
      return asyncPipe(getAccessHandle(PLAYERS_FILE_NAME, false))
        .map(readBufferIntoString)
        .map((buffer) => JSON.parse(buffer))
        .mapArray(Player.deserialize)
        .tapError((error) => {
          console.warn('Error reading players file:', error)
        })
        .catch(() => [])
        .execute()
    },
    async writeChunk(chunk: Chunk): Promise<void> {
      await writeFile(
        getChunkFileName({
          x: chunk.x,
          z: chunk.z,
        }),
        chunk.blocks,
      )
    },
    async writePlayers(data: Player[]): Promise<void> {
      await asyncPipe(data)
        .mapArray(Player.serialize)
        .map(JSON.stringify)
        .map((json) => new TextEncoder().encode(json))
        .tap((buffer) => writeFile(PLAYERS_FILE_NAME, buffer))
        .tapError((error) => console.warn('Error writing players file:', error))
        .execute()
    },
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

const getChunkFileName = (chunkCoordinates: ChunkCoordinates): string => {
  return `chunk_overworld_${chunkCoordinates.x}_${chunkCoordinates.z}.bin`
}
