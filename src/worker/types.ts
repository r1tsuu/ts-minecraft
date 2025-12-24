import type { BlockInWorld } from '../types.ts'
import type { DatabasePlayerData, DatabaseWorldData } from './database.ts'

export type ActiveWorld = {
  loadedChunks: {
    blocks: BlockInWorld[]
    chunkX: number
    chunkZ: number
    id: number
  }[]
  world: DatabaseWorldData
}

export type BaseClientEvent<T extends string, Data> = {
  status: Status
} & BaseEvent<T, Data>

export type BaseEvent<T extends string, Data> = {
  payload: Data
  type: T
  uuid?: string
}

export type MinecraftClientEvent =
  | BaseClientEvent<'activeWorldStopped', {}>
  | BaseClientEvent<
      'chunksGenerated',
      {
        chunks: {
          blocks: BlockInWorld[]
          chunkX: number
          chunkZ: number
          id: number
        }[]
      }
    >
  | BaseClientEvent<
      'listWorldsResponse',
      {
        worlds: {
          createdAt: Date
          id: number
          name: string
          seed: string
        }[]
      }
    >
  | BaseClientEvent<'playerSynced', {}>
  | BaseClientEvent<'workerInitialized', {}>
  | BaseClientEvent<
      'worldCreated',
      {
        createdAt: Date
        id: number
        name: string
        seed: string
      }
    >
  | BaseClientEvent<'worldDeleted', { worldID: number }>
  | BaseClientEvent<'worldInitialized', ActiveWorld>

export type MinecraftWorkerEvent =
  | BaseEvent<
      'createWorld',
      {
        name: string
        seed: string
      }
    >
  | BaseEvent<'deleteWorld', { worldID: number }>
  | BaseEvent<'initializeWorld', { worldID: number }>
  | BaseEvent<
      'requestChunks',
      {
        chunksCoordinates: {
          chunkX: number
          chunkZ: number
        }[]
        worldID: number
      }
    >
  | BaseEvent<'requestListWorlds', {}>
  | BaseEvent<'stopActiveWorld', {}>
  | BaseEvent<'syncPlayer', { playerData: DatabasePlayerData }>

export type Status = 'SUCCESS' | 'UNKNOWN_ERROR'
