import * as THREE from 'three'

import type { FPSControls } from './client/FPSControls.ts'
import type { LocalStorageManager } from './client/localStorageManager.ts'
import type { UIState } from './client/ui/state.ts'
import type { SharedConfig } from './config/createConfig.ts'
import type { MinecraftEventQueue } from './queue/minecraft.ts'
import type { DatabaseChunkData } from './server/worldDatabase.ts'

export const BLOCK_NAMES = ['dirt', 'grass', 'stone'] as const

export type BlockInWorld = {
  typeID: number
  /** Within chunk */
  x: number
  /** Within chunk */
  y: number
  /** Within chunk */
  z: number
}

export type BlockName = (typeof BLOCK_NAMES)[number]

export type BlockType = {
  material: THREE.Material | THREE.Material[]
  name: BlockName
}

export type Chunk = {
  blocks: Map<string, BlockInWorld>
  blocksMeshesIndexes: Map<string, number>
  blocksUint: Uint8Array
  chunkX: number
  chunkZ: number
  needsRenderUpdate: boolean
  uuid: UUID
}

export type ClientPlayerData = {
  canJump: boolean
  direction: THREE.Vector3
  height: number
  isMovingBackward: boolean
  isMovingForward: boolean
  isMovingLeft: boolean
  isMovingRight: boolean
  jumpStrength: number
  pitch: number
  position: THREE.Vector3
  speed: number
  velocity: THREE.Vector3
  width: number
  yaw: number
}

export type GameContext = {
  camera: THREE.PerspectiveCamera
  controls: FPSControls
  dispose: () => void
  frameCounter: {
    fps: number
    lastFrames: number
    lastTime: number
    totalFrames: number
    totalTime: number
  }
  paused: boolean
  player: ClientPlayerData
  raycaster: {
    update: () => void
  }
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  world: World
}

export type MinecraftClient = {
  config: SharedConfig
  eventQueue: MinecraftEventQueue
  gameContext: GameContext | null
  getGameContext: () => GameContext
  getUIContext: () => UIContext
  localStorageManager: LocalStorageManager
  uiContext: null | UIContext
}

export type RawVector3 = {
  x: number
  y: number
  z: number
}

export type UIContext = {
  destroy: () => void
  setState: (newState: Partial<UIState>, affectedQuerySelectors?: string | string[]) => void
  state: UIState
}

export type UUID = `${string}-${string}-${string}-${string}-${string}`

export type World = {
  blockMeshes: Map<number, THREE.InstancedMesh>
  blockMeshesCount: Map<number, number>
  blocksMeshesFreeIndexes: Map<number, number[]>
  chunks: Map<string, Chunk>
  dispose: () => void
  getBlock: (x: number, y: number, z: number) => BlockType | null
  requestingChunksState: 'idle' | 'requesting'
  syncChunksFromServer: (chunks: DatabaseChunkData[]) => void
  update: () => void
}
