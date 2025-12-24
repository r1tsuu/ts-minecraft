import { SimplexNoise } from 'three/addons/math/SimplexNoise.js'

import type { BlockInWorld, RawVector3 } from '../types.js'
import type { ActiveWorld, MinecraftClientEvent, MinecraftWorkerEvent } from './types.ts'

import { getBlockIdByName, initBlocksWorker } from '../block.js'
import {
  CHUNK_SIZE,
  findByXYZ,
  findChunkByXZ,
  getChunksCoordinatesInRadius,
  rawVector3,
  RENDER_DISTANCE,
  WORLD_HEIGHT,
  zeroRawVector3,
} from '../util.js'
import { getDatabaseClient } from './database.ts'

initBlocksWorker()

const databaseClient = await getDatabaseClient()

let worlds = await databaseClient.fetchWorlds()

let activeWorld: ActiveWorld | null = null

const getActiveWorld = (): ActiveWorld => {
  if (!activeWorld) {
    throw new Error('Active world is not initialized')
  }

  return activeWorld
}

const noise = new SimplexNoise()

const getChunks = async ({
  coordinates,
  worldID,
}: {
  coordinates: { chunkX: number; chunkZ: number }[]
  worldID: number
}) => {
  const dbChunks = await databaseClient.fetchChunks({
    coordinates,
    worldID,
  })

  const chunksToGenerate: { chunkX: number; chunkZ: number }[] = []
  const result: {
    blocks: BlockInWorld[]
    chunkX: number
    chunkZ: number
    id: number
  }[] = []

  for (const coord of coordinates) {
    const existingChunk = findChunkByXZ(dbChunks, coord.chunkX, coord.chunkZ)

    if (!existingChunk) {
      chunksToGenerate.push(coord)
    } else {
      result.push({
        blocks: existingChunk.data.blocks,
        chunkX: existingChunk.chunkX,
        chunkZ: existingChunk.chunkZ,
        id: existingChunk.id,
      })
    }
  }

  const generatedChunks: {
    chunkX: number
    chunkZ: number
    data: {
      blocks: BlockInWorld[]
    }
  }[] = []

  for (const coord of chunksToGenerate) {
    const { chunkX, chunkZ } = coord
    const blocks: BlockInWorld[] = []

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const worldX = chunkX * CHUNK_SIZE + x
        const worldZ = chunkZ * CHUNK_SIZE + z

        const baseY = 30
        const heightVariation = 12
        const amplitude = heightVariation / 2
        const frequency = 0.005

        const yOffset = Math.floor(
          (noise.noise(worldX * frequency, worldZ * frequency) + 1) * amplitude,
        )

        const height = baseY + yOffset

        for (let y = 0; y <= height; y++) {
          const block = y === height ? 'grass' : 'dirt'
          blocks.push({
            typeID: getBlockIdByName(block),
            x,
            y,
            z,
          })
        }
      }
    }

    generatedChunks.push({
      chunkX,
      chunkZ,
      data: {
        blocks,
      },
    })
  }

  if (generatedChunks.length) {
    const createdChunks = await databaseClient.createChunks({
      chunks: generatedChunks,
      worldID,
    })

    for (const chunk of createdChunks) {
      result.push({
        blocks: chunk.data.blocks,
        chunkX: chunk.chunkX,
        chunkZ: chunk.chunkZ,
        id: chunk.id,
      })
    }
  }

  return result
}

const getInitialPlayerPosition = ({
  centralChunk,
}: {
  centralChunk: {
    blocks: BlockInWorld[]
    chunkX: number
    chunkZ: number
    id: number
  }
}): RawVector3 => {
  let latestBlock: BlockInWorld | null = null

  for (let y = 0; y < WORLD_HEIGHT; y++) {
    const maybeBlock = findByXYZ(centralChunk.blocks, 0, y, 0)

    if (maybeBlock) {
      latestBlock = maybeBlock
    } else {
      break
    }
  }

  if (!latestBlock) {
    throw new Error('TODO: Include spawn platform generation')
  }

  return rawVector3(latestBlock.x, Math.floor(latestBlock.y) + 7, latestBlock.z)
}

const sendEventToClient = (event: MinecraftClientEvent) => {
  postMessage(event)
}

onmessage = async (msg: MessageEvent<MinecraftWorkerEvent>) => {
  try {
    switch (msg.data.type) {
      case 'createWorld': {
        const { name: incomingName, seed } = msg.data.payload

        let name = incomingName

        let worldByName = worlds.find((w) => w.name === name)
        let attempt = 1

        while (worldByName) {
          if (name.match(/\(_\(\d+\)\)$/)) {
            name = name.replace(/\(_\(\d+\)\)$/, `(_(${attempt}))`)
          } else {
            name = `${incomingName} (${attempt})`
          }
          worldByName = worlds.find((w) => w.name === name)
          attempt++
        }

        const world = await databaseClient.createWorld({ name, seed })
        worlds.push(world)

        sendEventToClient({
          payload: world,
          status: 'SUCCESS',
          type: 'worldCreated',
          uuid: msg.data.uuid,
        })

        break
      }

      case 'deleteWorld': {
        const { worldID } = msg.data.payload

        await databaseClient.deleteWorld(worldID)

        worlds = await databaseClient.fetchWorlds()

        sendEventToClient({
          payload: { worldID },
          status: 'SUCCESS',
          type: 'worldDeleted',
          uuid: msg.data.uuid,
        })
        break
      }

      case 'initializeWorld': {
        const { worldID } = msg.data.payload

        const world = worlds.find((w) => w.id === worldID)

        if (!world) {
          throw new Error('World not found')
        }

        const loadedChunks: {
          blocks: BlockInWorld[]
          chunkX: number
          chunkZ: number
          id: number
        }[] = []

        const chunkRadius = world.initialized ? RENDER_DISTANCE : RENDER_DISTANCE * 3

        const chunksCoordinates = getChunksCoordinatesInRadius({
          centerChunkX: 0,
          centerChunkZ: 0,
          chunkRadius,
        })

        const chunks = await getChunks({
          coordinates: chunksCoordinates,
          worldID: world.id,
        })

        for (const coordinates of getChunksCoordinatesInRadius({
          centerChunkX: 0,
          centerChunkZ: 0,
          chunkRadius: RENDER_DISTANCE,
        })) {
          const chunk = findChunkByXZ(chunks, coordinates.chunkX, coordinates.chunkZ)

          if (chunk) {
            loadedChunks.push(chunk)
          }
        }

        if (!world.initialized) {
          const centralChunk = findChunkByXZ(chunks, 0, 0)!
          const playerPosition = getInitialPlayerPosition({ centralChunk })

          world.playerData = {
            canJump: true,
            direction: zeroRawVector3(),
            height: 1.8,
            isMovingBackward: false,
            isMovingForward: false,
            isMovingLeft: false,
            isMovingRight: false,
            jumpStrength: 8,
            pitch: 0,
            position: playerPosition,
            speed: 5,
            velocity: zeroRawVector3(),
            width: 0.6,
            yaw: 0,
          }

          await databaseClient.updateWorld({
            data: {
              initialized: true,
              playerData: world.playerData,
            },
            worldID: world.id,
          })

          world.initialized = true
        }

        activeWorld = {
          loadedChunks,
          world,
        }

        sendEventToClient({
          payload: activeWorld,
          status: 'SUCCESS',
          type: 'worldInitialized',
          uuid: msg.data.uuid,
        })

        break
      }

      case 'requestChunks':
        {
          const { chunksCoordinates } = msg.data.payload

          const chunks = await getChunks({
            coordinates: chunksCoordinates,
            worldID: getActiveWorld().world.id,
          })

          sendEventToClient({
            payload: { chunks },
            status: 'SUCCESS',
            type: 'chunksGenerated',
            uuid: msg.data.uuid,
          })
        }

        break

      case 'syncPlayer': {
        const { playerData } = msg.data.payload

        const activeWorld = getActiveWorld()

        activeWorld.world.playerData = playerData

        await databaseClient.updateWorld({
          data: {
            playerData,
          },
          worldID: activeWorld.world.id,
        })

        sendEventToClient({
          payload: {},
          status: 'SUCCESS',
          type: 'playerSynced',
          uuid: msg.data.uuid,
        })

        break
      }

      case 'requestListWorlds': {
        sendEventToClient({
          payload: {
            worlds,
          },
          status: 'SUCCESS',
          type: 'listWorldsResponse',
          uuid: msg.data.uuid,
        })
        break
      }

      case 'stopActiveWorld': {
        activeWorld = null

        sendEventToClient({
          payload: {},
          status: 'SUCCESS',
          type: 'activeWorldStopped',
          uuid: msg.data.uuid,
        })
        break
      }
    }
  } catch (error) {
    console.error('Error in worker message handler:', error)
  }
}

sendEventToClient({
  payload: {},
  status: 'SUCCESS',
  type: 'workerInitialized',
})
