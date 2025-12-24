import * as THREE from 'three'

import type { FPSControls } from './FPSControls.ts'
import type { UIState } from './ui/state.ts'

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
  id: number
  needsRenderUpdate: boolean
}

export type GameInstance = {
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
  player: PlayerData
  raycaster: {
    update: () => void
  }
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  world: World
}

export type MinecraftInstance = {
  game: GameInstance | null
  getGame: () => GameInstance
  getUI: () => UIInstance
  ui: null | UIInstance
}

export type PlayerData = {
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

export type RawVector3 = {
  x: number
  y: number
  z: number
}

export type UIInstance = {
  destroy: () => void
  setState: (newState: Partial<UIState>, affectedQuerySelectors?: string | string[]) => void
  state: UIState
}

export type World = {
  blockMeshes: Map<number, THREE.InstancedMesh>
  blockMeshesCount: Map<number, number>
  blocksMeshesFreeIndexes: Map<number, number[]>
  chunks: Map<string, Chunk>
  dispose: () => void
  getBlock: (x: number, y: number, z: number) => BlockType | null
  id: number
  requestingChunksState: 'idle' | 'requesting'
  syncChunksFromServer: (
    chunks: {
      blocks: BlockInWorld[]
      chunkX: number
      chunkZ: number
      id: number
    }[],
  ) => void
  update: () => void
}
