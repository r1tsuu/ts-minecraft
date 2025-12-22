import * as THREE from "three";

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
  x: number;
  z: number;
  id: number;
};

export type World = {
  id: number;
  chunks: Map<string, Chunk>;
  blockMeshes: Map<number, THREE.InstancedMesh>;
  blockMeshesCount: Map<number, number>;
  requestingChunksState: "idle" | "requesting" | "received";
};

export interface ControlsHandler {
  update(delta: number): void;
  dispose(): void;
}

export type Controls = {
  handler: ControlsHandler;
  type: "free" | "fps";
};

export type PlayerConfig = {
  width: number;
  height: number;
};

export type MinecraftInstance = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  world: World;
  paused: boolean;
  controls: Controls;
  player: PlayerConfig;
};
