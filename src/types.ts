import * as THREE from "three";

export const BLOCK_NAMES = ["dirt", "grass", "stone"] as const;

export type BlockName = (typeof BLOCK_NAMES)[number];

export type Block = {
  name: BlockName;
  material: THREE.Material | THREE.Material[];
};

export type Chunk = {
  blocks: Uint8Array;
  x: number;
  z: number;
};

export type World = {
  chunks: Map<string, Chunk>;
  blockMeshes: Map<number, THREE.InstancedMesh>;
  blockMeshesCount: Map<number, number>;
};

export interface ControlsHandler {
  update(delta: number): void;
  dispose(): void;
}
