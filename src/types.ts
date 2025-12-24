import * as THREE from "three";
import type { FPSControls } from "./FPSControls.ts";
import type { UIState } from "./ui/state.ts";

export const BLOCK_NAMES = ["dirt", "grass", "stone"] as const;

export type BlockName = (typeof BLOCK_NAMES)[number];

export type BlockType = {
  name: BlockName;
  material: THREE.Material | THREE.Material[];
};

export type BlockInWorld = {
  typeID: number;
  /** Within chunk */
  x: number;
  /** Within chunk */
  y: number;
  /** Within chunk */
  z: number;
};

export type Chunk = {
  blocks: Map<string, BlockInWorld>;
  blocksMeshesIndexes: Map<string, number>;
  blocksUint: Uint8Array;
  chunkX: number;
  chunkZ: number;
  id: number;
  needsRenderUpdate: boolean;
};

export type World = {
  id: number;
  chunks: Map<string, Chunk>;
  blockMeshes: Map<number, THREE.InstancedMesh>;
  blockMeshesCount: Map<number, number>;
  blocksMeshesFreeIndexes: Map<number, number[]>;
  requestingChunksState: "idle" | "requesting";
  getBlock: (x: number, y: number, z: number) => BlockType | null;
  update: () => void;
  syncChunksFromServer: (
    chunks: {
      chunkX: number;
      chunkZ: number;
      id: number;
      blocks: BlockInWorld[];
    }[]
  ) => void;
  dispose: () => void;
};

export type PlayerData = {
  width: number;
  height: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  direction: THREE.Vector3;
  yaw: number;
  pitch: number;
  isMovingForward: boolean;
  isMovingBackward: boolean;
  isMovingLeft: boolean;
  isMovingRight: boolean;
  canJump: boolean;
  speed: number;
  jumpStrength: number;
};

export type GameInstance = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  world: World;
  paused: boolean;
  controls: FPSControls;
  player: PlayerData;
  frameCounter: {
    frames: number;
    lastTime: number;
    fps: number;
  };
  raycaster: {
    update: () => void;
  };
  dispose: () => void;
};

export type UIInstance = {
  state: UIState;
  setState: (
    newState: Partial<UIState>,
    affectedQuerySelectors?: string[] | string
  ) => void;
  destroy: () => void;
};

export type MinecraftInstance = {
  game: GameInstance | null;
  ui: UIInstance | null;
  getGame: () => GameInstance;
  getUI: () => UIInstance;
};

export type RawVector3 = {
  x: number;
  y: number;
  z: number;
};
