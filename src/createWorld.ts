import * as THREE from 'three'

import type { BlockInWorld, BlockType, PlayerData, World } from './types.ts'
import type { ActiveWorld } from './worker/types.ts'

import { blockRegistry, getBlockById } from './block.ts'
import { CHUNK_SIZE, getBlockIndex, getBlockKey, RENDER_DISTANCE, WORLD_HEIGHT } from './util.ts'
import { listenToWorkerEvents, sendEventToWorker } from './worker/workerClient.ts'

export const createWorld = ({
  activeWorld,
  player,
  scene,
}: {
  activeWorld: ActiveWorld
  player: PlayerData
  scene: THREE.Scene
}): World => {
  const backgroundColor = 0x87ceeb
  scene.fog = new THREE.Fog(backgroundColor, 1, 96)
  scene.background = new THREE.Color(backgroundColor)

  const sunLight = new THREE.DirectionalLight(0xffffff, 3)
  sunLight.position.set(500, 500, 500)
  scene.add(sunLight)
  const sunLight2 = new THREE.DirectionalLight(0xffffff, 3)
  sunLight2.position.set(-500, 500, -500)
  scene.add(sunLight2)

  const reflectionLight = new THREE.AmbientLight(0x404040, 0.5)
  scene.add(reflectionLight)

  const blockMeshes = new Map<number, THREE.InstancedMesh>()
  const blockMeshesCount = new Map<number, number>()
  const blocksMeshesFreeIndexes = new Map<number, number[]>()

  const MAX_COUNT = (RENDER_DISTANCE * RENDER_DISTANCE * CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT) / 2

  const geometry = new THREE.BoxGeometry()

  for (const [id, block] of blockRegistry) {
    const mesh = new THREE.InstancedMesh(geometry, block.material, MAX_COUNT)
    mesh.frustumCulled = false
    scene.add(mesh)
    blockMeshes.set(id, mesh)
    blockMeshesCount.set(id, 0)
    blocksMeshesFreeIndexes.set(id, [])
  }

  const getBlock = (x: number, y: number, z: number): BlockType | null => {
    const chunkX = Math.floor(x / CHUNK_SIZE)
    const chunkZ = Math.floor(z / CHUNK_SIZE)
    const key = chunkKey(chunkX, chunkZ)
    const chunk = world.chunks.get(key)

    if (!chunk) {
      return null
    }
    const localX = x - chunkX * CHUNK_SIZE
    const localZ = z - chunkZ * CHUNK_SIZE

    if (y < 0 || y >= WORLD_HEIGHT) {
      return null
    }

    const block = chunk.blocksUint[getBlockIndex(localX, y, localZ)]

    if (!block) {
      return null
    }

    return getBlockById(block)
  }

  const update = () => {
    const playerChunkX = Math.floor(player.position.x / CHUNK_SIZE)
    const playerChunkZ = Math.floor(player.position.z / CHUNK_SIZE)

    const needed = new Set<string>()
    const chunksToLoad: string[] = []

    for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
      for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
        const cx = playerChunkX + dx
        const cz = playerChunkZ + dz
        const key = chunkKey(cx, cz)

        needed.add(key)

        if (!world.chunks.has(key)) {
          chunksToLoad.push(key)
        }
      }
    }

    if (chunksToLoad.length) {
      if (world.requestingChunksState === 'idle') {
        sendEventToWorker({
          payload: {
            chunksCoordinates: chunksToLoad.map((key) => {
              const [chunkX, chunkZ] = key.split(',').map(Number)
              return { chunkX, chunkZ }
            }),
            worldID: world.id,
          },
          type: 'requestChunks',
        })
        world.requestingChunksState = 'requesting'
      }
    }

    const meshesNeedUpdate = new Set<THREE.InstancedMesh>()

    // Unload chunks outside render distance
    for (const key of world.chunks.keys()) {
      if (!needed.has(key)) {
        const chunk = world.chunks.get(key)!
        for (const block of chunk.blocks.values()) {
          const blockTypeID = block.typeID
          if (!blockTypeID) continue
          const count = world.blockMeshesCount.get(blockTypeID)
          if (count === undefined) {
            throw new Error(`Mesh count for block ID ${blockTypeID} not found`)
          }

          const blockMeshIndex = chunk.blocksMeshesIndexes.get(
            getBlockKey(block.x, block.y, block.z),
          )!

          if (blockMeshIndex !== undefined) {
            const mesh = world.blockMeshes.get(blockTypeID)!
            mesh.setMatrixAt(blockMeshIndex, new THREE.Matrix4())
            world.blocksMeshesFreeIndexes.get(blockTypeID)!.push(blockMeshIndex)
            meshesNeedUpdate.add(mesh)
          }
        }

        world.chunks.delete(key)
      }
    }

    const matrix = new THREE.Matrix4()

    for (const chunk of world.chunks.values()) {
      if (!chunk.needsRenderUpdate) continue

      chunk.needsRenderUpdate = false

      for (const block of chunk.blocks.values()) {
        const blockTypeID = block.typeID
        if (!blockTypeID) continue

        const freeList = world.blocksMeshesFreeIndexes.get(blockTypeID)!

        const mesh = world.blockMeshes.get(blockTypeID)

        if (!mesh) {
          throw new Error(`Mesh for block ID ${blockTypeID} not found`)
        }

        matrix.setPosition(
          chunk.chunkX * CHUNK_SIZE + block.x,
          block.y,
          chunk.chunkZ * CHUNK_SIZE + block.z,
        )

        let index: number
        if (freeList.length > 0) {
          index = freeList.pop()!
        } else {
          index = world.blockMeshesCount.get(blockTypeID)!
          world.blockMeshesCount.set(blockTypeID, index + 1)
        }

        if (index === undefined) {
          console.log(world.blockMeshesCount, blockTypeID)
          throw new Error(`Mesh count for block ID ${blockTypeID} not found`)
        }

        meshesNeedUpdate.add(mesh)
        mesh.setMatrixAt(index, matrix)
        chunk.blocksMeshesIndexes.set(getBlockKey(block.x, block.y, block.z), index)
      }
    }

    for (const mesh of meshesNeedUpdate) {
      mesh.instanceMatrix.needsUpdate = true
    }
  }

  const syncChunksFromServer: World['syncChunksFromServer'] = (chunks) => {
    for (const chunk of chunks) {
      const key = `${chunk.chunkX},${chunk.chunkZ}`

      const blocks: Map<string, BlockInWorld> = new Map()
      const blocksUint = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT)

      for (const block of chunk.blocks) {
        const blockKey = `${block.x},${block.y},${block.z}`
        blocks.set(blockKey, block)
        blocksUint[getBlockIndex(block.x, block.y, block.z)] = block.typeID
      }

      world.chunks.set(key, {
        blocks,
        blocksMeshesIndexes: new Map<string, number>(),
        blocksUint,
        chunkX: chunk.chunkX,
        chunkZ: chunk.chunkZ,
        id: chunk.id,
        needsRenderUpdate: true,
      })
    }
  }

  const unsubscribeFromWorkerEvents = listenToWorkerEvents((event) => {
    switch (event.type) {
      case 'chunksGenerated': {
        const { chunks } = event.payload
        const now = Date.now()
        world.syncChunksFromServer(chunks)
        console.log('Processing chunks took', Date.now() - now, 'ms')
        world.requestingChunksState = 'idle'
        break
      }
    }
  })

  const dispose = () => {
    unsubscribeFromWorkerEvents()
    for (const mesh of blockMeshes.values()) {
      mesh.geometry.dispose()
      if (Array.isArray(mesh.material)) {
        for (const mat of mesh.material) {
          mat.dispose()
        }
      } else {
        mesh.material.dispose()
      }
      scene.remove(mesh)
    }
    blockMeshes.clear()
    blockMeshesCount.clear()
    blocksMeshesFreeIndexes.clear()
    world.chunks.clear()
  }

  const world: World = {
    blockMeshes: blockMeshes,
    blockMeshesCount,
    blocksMeshesFreeIndexes,
    chunks: new Map(),
    dispose,
    getBlock,
    id: activeWorld.world.id,
    requestingChunksState: 'idle',
    syncChunksFromServer,
    update,
  }

  // Initial sync of loaded chunks from server
  world.syncChunksFromServer(activeWorld.loadedChunks)

  return world
}

const chunkKey = (x: number, z: number) => `${x},${z}`
