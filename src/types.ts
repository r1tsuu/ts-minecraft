import * as THREE from "three";
import type { FPSControls } from "./FPSControls.ts";

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
  blocksUint: Uint8Array;
  blockMeshes: Map<number, THREE.InstancedMesh>;
  blockMeshesCount: Map<number, number>;
  mesh: THREE.Mesh;
  chunkX: number;
  chunkZ: number;
  id: number;
};

export type World = {
  id: number;
  chunks: Map<string, Chunk>;
  requestingChunksState: "idle" | "requesting" | "received";
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

export type MinecraftInstance = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  world: World;
  paused: boolean;
  controls: FPSControls;
  player: PlayerData;
};

export type RawVector3 = {
  x: number;
  y: number;
  z: number;
};
