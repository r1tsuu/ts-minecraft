import * as THREE from 'three'

import type { DatabaseChunkData } from '../server/WorldDatabase.ts'
import type { BlockInWorld, Chunk } from '../types.ts'

import { Component } from '../shared/Component.ts'
import { Config } from '../shared/Config.ts'
import { MinecraftEvent, MinecraftEventBus } from '../shared/MinecraftEventBus.ts'
import { getBlockIndex, getBlockKey } from '../shared/util.ts'
import { ClientBlocksRegistry } from './blocks.ts'
import { ClientContainer } from './ClientContainer.ts'
import { GameSession } from './GameSession.ts'

const chunkKey = (x: number, z: number) => `${x},${z}`

@Component()
@MinecraftEventBus.ClientListener()
export class World implements Component {
  blockMeshes = new Map<number, THREE.InstancedMesh>()
  blockMeshesCount = new Map<number, number>()
  blocksMeshesFreeIndexes = new Map<number, number[]>()
  chunks = new Map<string, Chunk>()
  requestingChunksState: 'idle' | 'requesting' = 'idle'

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
  }

  getBlock(x: number, y: number, z: number): null | number {
    const chunkX = Math.floor(x / Config.CHUNK_SIZE)
    const chunkZ = Math.floor(z / Config.CHUNK_SIZE)
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

  update(): void {
    const player = ClientContainer.resolve(GameSession).unwrap().getCurrentPlayer()
    const playerChunkX = Math.floor(player.position.x / Config.CHUNK_SIZE)
    const playerChunkZ = Math.floor(player.position.z / Config.CHUNK_SIZE)

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

    const meshesNeedUpdate = new Set<THREE.InstancedMesh>()

    // Unload chunks outside render distance
    for (const key of this.chunks.keys()) {
      if (!needed.has(key)) {
        const chunk = this.chunks.get(key)!
        for (const block of chunk.blocks.values()) {
          const blockTypeID = block.typeID
          if (!blockTypeID) continue
          const count = this.blockMeshesCount.get(blockTypeID)
          if (count === undefined) {
            throw new Error(`Mesh count for block ID ${blockTypeID} not found`)
          }

          const blockMeshIndex = chunk.blocksMeshesIndexes.get(
            getBlockKey(block.x, block.y, block.z),
          )!

          if (blockMeshIndex !== undefined) {
            const mesh = this.blockMeshes.get(blockTypeID)!
            mesh.setMatrixAt(blockMeshIndex, new THREE.Matrix4())
            this.blocksMeshesFreeIndexes.get(blockTypeID)!.push(blockMeshIndex)
            meshesNeedUpdate.add(mesh)
          }
        }

        this.chunks.delete(key)
      }
    }

    const matrix = new THREE.Matrix4()

    for (const chunk of this.chunks.values()) {
      if (!chunk.needsRenderUpdate) continue

      chunk.needsRenderUpdate = false

      for (const block of chunk.blocks.values()) {
        const blockTypeID = block.typeID
        if (!blockTypeID) continue

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

        if (index === undefined) {
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

  @MinecraftEventBus.Handler('Server.ResponseChunksLoad')
  protected onResponseChunksLoad(event: MinecraftEvent<'Server.ResponseChunksLoad'>): void {
    this.syncChunksFromServer(event.payload.chunks)
    this.requestingChunksState = 'idle'
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
    }
  }
}
