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

export type LocalStorageManager = ReturnType<typeof createLocalStorageManager>

export const createLocalStorageManager = () => {
  const storage = window.localStorage.getItem(LOCAL_STORAGE_KEY)

  if (!storage) {
    const initialData: MinecraftClientLocalStorage = {
      playerUUID: crypto.randomUUID(),
      worlds: [],
    }
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initialData))
  }

  const getStorage = (): MinecraftClientLocalStorage => {
    const storage = window.localStorage.getItem(LOCAL_STORAGE_KEY)

    if (!storage) {
      throw new Error('Local storage is not initialized')
    }

    return JSON.parse(storage) as MinecraftClientLocalStorage
  }

  const setStorage = (data: MinecraftClientLocalStorage) => {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data))
  }

  const getListWorlds = () => {
    return getStorage().worlds
  }

  const getWorld = (worldUUID: UUID) => {
    const world = getListWorlds().find((world) => world.uuid === worldUUID)

    if (!world) {
      throw new Error(`World with UUID ${worldUUID} not found`)
    }

    return world
  }

  const addWorld = (name: string, seed: string) => {
    const storage = getStorage()

    const newWorld = {
      createdAt: new Date().toISOString(),
      lastPlayedAt: null,
      name,
      seed,
      uuid: crypto.randomUUID(),
    }

    storage.worlds.push(newWorld)

    setStorage(storage)

    return newWorld
  }

  const deleteWorld = (worldUUID: UUID) => {
    const storage = getStorage()

    storage.worlds = storage.worlds.filter((world) => world.uuid !== worldUUID)

    setStorage(storage)
  }

  const getPlayerUUID = () => {
    return getStorage().playerUUID
  }

  return {
    addWorld,
    deleteWorld,
    getListWorlds,
    getPlayerUUID,
    getWorld,
  }
}
