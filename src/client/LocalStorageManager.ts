import type { UUID } from '../types.ts'

type MinecraftClientLocalStorage = {
  playerUUID: UUID
  worlds: {
    createdAt: string
    lastPlayedAt: null | string
    name: string
    seed: string
    uuid: UUID
  }[]
}

const LOCAL_STORAGE_KEY = 'minecraft_client_local_storage_v1'

export class LocalStorageManager {
  constructor() {
    const storage = window.localStorage.getItem(LOCAL_STORAGE_KEY)

    if (!storage) {
      const initialData: MinecraftClientLocalStorage = {
        playerUUID: crypto.randomUUID(),
        worlds: [],
      }
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initialData))
    }
  }

  addWorld(name: string, seed: string) {
    const storage = this.getStorage()

    const newWorld = {
      createdAt: new Date().toISOString(),
      lastPlayedAt: null,
      name,
      seed,
      uuid: crypto.randomUUID(),
    }

    storage.worlds.push(newWorld)

    this.setStorage(storage)

    return newWorld
  }

  deleteWorld(worldUUID: UUID) {
    const storage = this.getStorage()

    storage.worlds = storage.worlds.filter((world) => world.uuid !== worldUUID)

    this.setStorage(storage)
  }

  getListWorlds() {
    return this.getStorage().worlds
  }

  getPlayerUUID() {
    return this.getStorage().playerUUID
  }

  getWorld(worldUUID: UUID) {
    const world = this.getListWorlds().find((world) => world.uuid === worldUUID)

    if (!world) {
      throw new Error(`World with UUID ${worldUUID} not found`)
    }

    return world
  }

  private getStorage(): MinecraftClientLocalStorage {
    const storage = window.localStorage.getItem(LOCAL_STORAGE_KEY)

    if (!storage) {
      throw new Error('Local storage is not initialized')
    }

    return JSON.parse(storage) as MinecraftClientLocalStorage
  }

  private setStorage(data: MinecraftClientLocalStorage): void {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data))
  }
}
