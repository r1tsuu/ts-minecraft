import * as THREE from 'three'

import type { ClientBlockRegisty } from './client/blocks.ts'
import type { FPSControls } from './client/FPSControls.ts'
import type { GUIState } from './client/gui/state.ts'
import type { LocalStorageManager } from './client/localStorageManager.ts'
import type { SharedConfig } from './config.ts'
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

export type GUI = {
  destroy: () => void
  setState: (newState: Partial<GUIState>, affectedQuerySelectors?: string | string[]) => void
  state: GUIState
}

export type MinecraftClient = {
  blocksRegistry: ClientBlockRegisty
  config: SharedConfig
  eventQueue: MinecraftEventQueue
  gameContext: GameContext | null
  getGameContext: () => GameContext
  getGUI: () => GUI
  gui: GUI | null
  localStorageManager: LocalStorageManager
}

export type RawVector3 = {
  x: number
  y: number
  z: number
}

export type UUID = `${string}-${string}-${string}-${string}-${string}`

export type World = {
  blockMeshes: Map<number, THREE.InstancedMesh>
  blockMeshesCount: Map<number, number>
  blocksMeshesFreeIndexes: Map<number, number[]>
  chunks: Map<string, Chunk>
  dispose: () => void
  getBlock: (x: number, y: number, z: number) => null | number
  requestingChunksState: 'idle' | 'requesting'
  syncChunksFromServer: (chunks: DatabaseChunkData[]) => void
  update: () => void
}
