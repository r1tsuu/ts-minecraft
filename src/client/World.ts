import * as THREE from 'three'

import type { DatabaseChunkData } from '../server/WorldDatabase.ts'
import type { BlockInWorld, Chunk } from '../types.ts'

import { Component } from '../shared/Component.ts'
import { Config } from '../shared/Config.ts'
import {
  MinecraftEvent,
  MinecraftEventBus,
  type MinecraftEventPayload,
} from '../shared/MinecraftEventBus.ts'
import { Scheduler } from '../shared/Scheduler.ts'
import { getBlockIndex, getBlockKey, getChunkCoordinates } from '../shared/util.ts'
import { ClientBlocksRegistry } from './blocks.ts'
import { ClientContainer } from './ClientContainer.ts'
import { GameSession } from './GameSession.ts'

const chunkKey = (x: number, z: number) => `${x},${z}`

@Component()
@MinecraftEventBus.ClientListener()
@Scheduler.ClientSchedulable()
export class World implements Component {
  blockMeshes = new Map<number, THREE.InstancedMesh>()
  blockMeshesCount = new Map<number, number>()
  blocksMeshesFreeIndexes = new Map<number, number[]>()
  chunks = new Map<string, Chunk>()
  requestingChunksState: 'idle' | 'requesting' = 'idle'

  // Track which chunks need rendering to avoid checking all chunks every frame
  private chunksNeedingRender = new Set<string>()

  // Cache the last player chunk position to avoid unnecessary chunk loading checks
  private lastPlayerChunkX: null | number = null
  private lastPlayerChunkZ: null | number = null

  private syncUpdatedBlocksQueue: MinecraftEventPayload<'Client.RequestSyncUpdatedBlocks'>['updatedBlocks'] =
    []

  constructor(initialChunksFromServer: DatabaseChunkData[]) {
    const backgroundColor = 0x87ceeb
    const scene = ClientContainer.resolve(THREE.Scene).unwrap()

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

    const MAX_COUNT =
      (Config.RENDER_DISTANCE *
        Config.RENDER_DISTANCE *
        Config.CHUNK_SIZE *
        Config.CHUNK_SIZE *
        Config.WORLD_HEIGHT) /
      2

    const geometry = new THREE.BoxGeometry()

    const clientRegistry = ClientContainer.resolve(ClientBlocksRegistry).unwrap()

    for (const [id, block] of clientRegistry.registry) {
      const mesh = new THREE.InstancedMesh(geometry, block.material, MAX_COUNT)
      mesh.frustumCulled = false
      scene.add(mesh)
      this.blockMeshes.set(id, mesh)
      this.blockMeshesCount.set(id, 0)
      this.blocksMeshesFreeIndexes.set(id, [])
    }

    this.syncChunksFromServer(initialChunksFromServer)
  }

  addBlock(x: number, y: number, z: number, typeID: number): void {
    const { chunkX, chunkZ } = getChunkCoordinates({ x, z })
    const key = chunkKey(chunkX, chunkZ)
    const chunk = this.chunks.get(key)

    if (!chunk) {
      console.warn(`Trying to add block to non-existing chunk at ${chunkX},${chunkZ}`)
      return
    }

    const localX = x - chunkX * Config.CHUNK_SIZE
    const localZ = z - chunkZ * Config.CHUNK_SIZE

    const blockKey = getBlockKey(localX, y, localZ)

    if (chunk.blocks.has(blockKey)) {
      console.warn(`Block already exists at ${x},${y},${z}`)
      return
    }

    const block: BlockInWorld = {
      typeID,
      x: localX,
      y,
      z: localZ,
    }

    chunk.blocks.set(blockKey, block)
    chunk.blocksUint[getBlockIndex(localX, y, localZ)] = typeID
    chunk.needsRenderUpdate = true
    this.chunksNeedingRender.add(key)

    this.syncUpdatedBlocksQueue.push({ blockID: typeID, position: { x, y, z }, type: 'add' })
  }

  checkCollisionWithBox(box: THREE.Box3): boolean {
    const minX = Math.floor(box.min.x)
    const maxX = Math.floor(box.max.x)
    const minY = Math.floor(box.min.y)
    const maxY = Math.floor(box.max.y)
    const minZ = Math.floor(box.min.z)
    const maxZ = Math.floor(box.max.z)

    // Check all blocks that could intersect with box
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          if (this.getBlock(x, y, z)) {
            // Block exists, create its bounding box
            const blockBox = new THREE.Box3().setFromCenterAndSize(
              new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5),
              new THREE.Vector3(1, 1, 1),
            )

            // Check intersection
            if (box.intersectsBox(blockBox)) {
              return true
            }
          }
        }
      }
    }

    return false
  }

  dispose(): void {
    const scene = ClientContainer.resolve(THREE.Scene).unwrap()

    for (const mesh of this.blockMeshes.values()) {
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

    this.blockMeshes.clear()
    this.blockMeshesCount.clear()
    this.blocksMeshesFreeIndexes.clear()
    this.chunks.clear()
    this.chunksNeedingRender.clear()
  }

  getBlock(x: number, y: number, z: number): null | number {
    const { chunkX, chunkZ } = getChunkCoordinates({ x, z })
    const key = chunkKey(chunkX, chunkZ)
    const chunk = this.chunks.get(key)

    if (!chunk) {
      return null
    }
    const localX = x - chunkX * Config.CHUNK_SIZE
    const localZ = z - chunkZ * Config.CHUNK_SIZE

    if (y < 0 || y >= Config.WORLD_HEIGHT) {
      return null
    }

    const block = chunk.blocksUint[getBlockIndex(localX, y, localZ)]

    if (!block) {
      return null
    }

    return block
  }

  removeBlock(x: number, y: number, z: number): void {
    const { chunkX, chunkZ } = getChunkCoordinates({ x, z })
    const key = chunkKey(chunkX, chunkZ)
    const chunk = this.chunks.get(key)

    if (!chunk) {
      return
    }

    const localX = x - chunkX * Config.CHUNK_SIZE
    const localZ = z - chunkZ * Config.CHUNK_SIZE

    const blockKey = getBlockKey(localX, y, localZ)
    const block = chunk.blocks.get(blockKey)

    if (!block) {
      console.warn(`Trying to remove non-existing block at ${x},${y},${z}`)
      return
    }

    const blockTypeID = block.typeID
    if (!blockTypeID) return

    const blockMeshIndex = chunk.blocksMeshesIndexes.get(blockKey)

    if (blockMeshIndex !== undefined) {
      const mesh = this.blockMeshes.get(blockTypeID)!
      // Set to a matrix with scale 0 to effectively hide the block
      const hideMatrix = new THREE.Matrix4().makeScale(0, 0, 0)
      mesh.setMatrixAt(blockMeshIndex, hideMatrix)
      mesh.instanceMatrix.needsUpdate = true // Ensure immediate update
      this.blocksMeshesFreeIndexes.get(blockTypeID)!.push(blockMeshIndex)
    }

    chunk.blocks.delete(blockKey)
    chunk.blocksMeshesIndexes.delete(blockKey)
    chunk.blocksUint[getBlockIndex(localX, y, localZ)] = 0
    chunk.needsRenderUpdate = true
    this.chunksNeedingRender.add(key)

    this.syncUpdatedBlocksQueue.push({
      blockID: blockTypeID,
      position: { x, y, z },
      type: 'remove',
    })
  }

  update(): void {
    const player = ClientContainer.resolve(GameSession).unwrap().getCurrentPlayer()
    const playerChunkX = Math.floor(player.position.x / Config.CHUNK_SIZE)
    const playerChunkZ = Math.floor(player.position.z / Config.CHUNK_SIZE)

    // Only check for new chunks if player moved to a different chunk
    const playerChunkChanged =
      this.lastPlayerChunkX !== playerChunkX || this.lastPlayerChunkZ !== playerChunkZ

    if (playerChunkChanged) {
      this.lastPlayerChunkX = playerChunkX
      this.lastPlayerChunkZ = playerChunkZ

      const needed = new Set<string>()
      const chunksToLoad: string[] = []

      for (let dx = -Config.RENDER_DISTANCE; dx <= Config.RENDER_DISTANCE; dx++) {
        for (let dz = -Config.RENDER_DISTANCE; dz <= Config.RENDER_DISTANCE; dz++) {
          const cx = playerChunkX + dx
          const cz = playerChunkZ + dz
          const key = chunkKey(cx, cz)

          needed.add(key)

          if (!this.chunks.has(key)) {
            chunksToLoad.push(key)
          }
        }
      }

      if (chunksToLoad.length) {
        if (this.requestingChunksState === 'idle') {
          const eventBus = ClientContainer.resolve(MinecraftEventBus).unwrap()

          eventBus.publish('Client.RequestChunksLoad', {
            chunks: chunksToLoad.map((key) => {
              const [chunkX, chunkZ] = key.split(',').map(Number)
              return { chunkX, chunkZ }
            }),
          })
          this.requestingChunksState = 'requesting'
        }
      }

      // Unload chunks outside render distance
      for (const key of this.chunks.keys()) {
        if (!needed.has(key)) {
          this.unloadChunk(key)
        }
      }
    }

    // Only update meshes for chunks that need rendering
    if (this.chunksNeedingRender.size > 0) {
      this.updateChunkMeshes()
    }
  }

  @MinecraftEventBus.Handler('Server.ResponseChunksLoad')
  protected onResponseChunksLoad(event: MinecraftEvent<'Server.ResponseChunksLoad'>): void {
    this.syncChunksFromServer(event.payload.chunks)
    this.requestingChunksState = 'idle'
  }

  @Scheduler.Every(1000)
  protected sendSyncUpdatedBlocks(): void {
    if (this.syncUpdatedBlocksQueue.length === 0) {
      return
    }

    const eventBus = ClientContainer.resolve(MinecraftEventBus).unwrap()
    eventBus.publish('Client.RequestSyncUpdatedBlocks', {
      updatedBlocks: this.syncUpdatedBlocksQueue,
    })

    this.syncUpdatedBlocksQueue = []
  }

  private syncChunksFromServer(chunks: DatabaseChunkData[]): void {
    for (const chunk of chunks) {
      const key = `${chunk.chunkX},${chunk.chunkZ}`

      const blocks: Map<string, BlockInWorld> = new Map()
      const blocksUint = new Uint8Array(Config.CHUNK_SIZE * Config.CHUNK_SIZE * Config.WORLD_HEIGHT)

      for (const block of chunk.data.blocks) {
        const blockKey = `${block.x},${block.y},${block.z}`
        blocks.set(blockKey, block)
        blocksUint[getBlockIndex(block.x, block.y, block.z)] = block.typeID
      }

      this.chunks.set(key, {
        blocks,
        blocksMeshesIndexes: new Map<string, number>(),
        blocksUint,
        chunkX: chunk.chunkX,
        chunkZ: chunk.chunkZ,
        needsRenderUpdate: true,
        uuid: chunk.uuid,
      })

      this.chunksNeedingRender.add(key)
    }
  }

  private unloadChunk(key: string): void {
    const chunk = this.chunks.get(key)
    if (!chunk) return

    const meshesNeedUpdate = new Set<THREE.InstancedMesh>()

    for (const block of chunk.blocks.values()) {
      const blockTypeID = block.typeID
      if (!blockTypeID) continue

      const blockMeshIndex = chunk.blocksMeshesIndexes.get(getBlockKey(block.x, block.y, block.z))

      if (blockMeshIndex !== undefined) {
        const mesh = this.blockMeshes.get(blockTypeID)!
        const hideMatrix = new THREE.Matrix4().makeScale(0, 0, 0)
        mesh.setMatrixAt(blockMeshIndex, hideMatrix)
        this.blocksMeshesFreeIndexes.get(blockTypeID)!.push(blockMeshIndex)
        meshesNeedUpdate.add(mesh)
      }
    }

    for (const mesh of meshesNeedUpdate) {
      mesh.instanceMatrix.needsUpdate = true
    }

    this.chunks.delete(key)
    this.chunksNeedingRender.delete(key)
  }

  private updateChunkMeshes(): void {
    const meshesNeedUpdate = new Set<THREE.InstancedMesh>()
    const matrix = new THREE.Matrix4()

    for (const chunkKey of this.chunksNeedingRender) {
      const chunk = this.chunks.get(chunkKey)
      if (!chunk || !chunk.needsRenderUpdate) continue

      chunk.needsRenderUpdate = false

      for (const block of chunk.blocks.values()) {
        const blockTypeID = block.typeID
        if (!blockTypeID) continue

        const blockKey = getBlockKey(block.x, block.y, block.z)

        // Skip if this block already has a mesh index (already rendered)
        if (chunk.blocksMeshesIndexes.has(blockKey)) {
          continue
        }

        const freeList = this.blocksMeshesFreeIndexes.get(blockTypeID)!
        const mesh = this.blockMeshes.get(blockTypeID)

        if (!mesh) {
          throw new Error(`Mesh for block ID ${blockTypeID} not found`)
        }

        matrix.setPosition(
          chunk.chunkX * Config.CHUNK_SIZE + block.x,
          block.y,
          chunk.chunkZ * Config.CHUNK_SIZE + block.z,
        )

        let index: number
        if (freeList.length > 0) {
          index = freeList.pop()!
        } else {
          index = this.blockMeshesCount.get(blockTypeID)!
          this.blockMeshesCount.set(blockTypeID, index + 1)
        }

        meshesNeedUpdate.add(mesh)
        mesh.setMatrixAt(index, matrix)
        chunk.blocksMeshesIndexes.set(blockKey, index)
      }
    }

    for (const mesh of meshesNeedUpdate) {
      mesh.instanceMatrix.needsUpdate = true
    }

    this.chunksNeedingRender.clear()
  }
}
