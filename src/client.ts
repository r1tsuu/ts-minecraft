import type { Material } from "three";
import { BLOCK_NAMES, type BlockName } from "./types.js";
import dirtTextureImg from "./static/dirt.png?no-inline";
import grassBlockSideTextureImg from "./static/grass_block_side.png?no-inline";
import grassBlockTopTextureImg from "./static/grass_block_top.png?no-inline";
import * as THREE from "three";
import type { BlockInWorld, RawVector3, World } from "./types.ts";
import { blockRegistry, registerBlock } from "./block.ts";
import { CHUNK_SIZE, getBlockIndex, WORLD_HEIGHT } from "./util.ts";

export const rawVector3ToThreeVector3 = (
  rawVector: RawVector3
): THREE.Vector3 => {
  return new THREE.Vector3(rawVector.x, rawVector.y, rawVector.z);
};

export const threeVector3ToRawVector3 = (vector: THREE.Vector3): RawVector3 => {
  return { x: vector.x, y: vector.y, z: vector.z };
};

const textureLoader = new THREE.TextureLoader();

export const initBlocks = async () => {
  const dirtTexture = textureLoader.load(dirtTextureImg);
  const grassTexture = textureLoader.load(grassBlockSideTextureImg);
  const grassTopTexture = textureLoader.load(grassBlockTopTextureImg);

  const nameMaterialMap: Record<BlockName, Material | Material[]> = {
    dirt: new THREE.MeshStandardMaterial({
      map: dirtTexture,
    }),
    stone: new THREE.MeshStandardMaterial({
      color: 0x888888,
    }),
    grass: [
      new THREE.MeshStandardMaterial({ map: grassTexture }), // sides
      new THREE.MeshStandardMaterial({ map: grassTexture }), // sides
      new THREE.MeshStandardMaterial({ map: grassTopTexture }), // top
      new THREE.MeshStandardMaterial({ map: dirtTexture }), // dirt
      new THREE.MeshStandardMaterial({ map: grassTexture }), // sides
      new THREE.MeshStandardMaterial({ map: grassTexture }), // sides
    ],
  };

  for (const name of BLOCK_NAMES) {
    registerBlock({
      name,
      material: nameMaterialMap[name],
    });
  }
};

export const syncServerChunksOnClient = (
  chunks: {
    chunkX: number;
    chunkZ: number;
    id: number;
    blocks: BlockInWorld[];
  }[],
  world: World,
  scene: THREE.Scene
) => {
  for (const chunk of chunks) {
    const key = `${chunk.chunkX},${chunk.chunkZ}`;

    const blocks: Map<string, BlockInWorld> = new Map();
    const blocksUint = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT);

    const blockMeshes = new Map<number, THREE.InstancedMesh>();
    const blockMeshesCount = new Map<number, number>();

    const MAX_COUNT = (CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT) / 2;

    const chunkGeometry = new THREE.BoxGeometry(
      CHUNK_SIZE,
      WORLD_HEIGHT,
      CHUNK_SIZE
    );
    const chunkMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      wireframe: true,
    });

    const chunkMesh = new THREE.Mesh(chunkGeometry, chunkMaterial);

    chunkMesh.position.set(
      chunk.chunkX * CHUNK_SIZE + CHUNK_SIZE,
      0,
      chunk.chunkZ * CHUNK_SIZE + CHUNK_SIZE
    );

    scene.add(chunkMesh);

    const geometry = new THREE.BoxGeometry();

    for (const [id, block] of blockRegistry) {
      const mesh = new THREE.InstancedMesh(geometry, block.material, MAX_COUNT);
      mesh.frustumCulled = false;
      chunkMesh.add(mesh);
      blockMeshes.set(id, mesh);
      blockMeshesCount.set(id, 0);
    }

    const matrix = new THREE.Matrix4();

    for (const block of chunk.blocks) {
      const blockKey = `${block.x},${block.y},${block.z}`;
      blocks.set(blockKey, block);
      blocksUint[getBlockIndex(block.x, block.y, block.z)] = block.typeID;
      const mesh = blockMeshes.get(block.typeID);

      if (mesh) {
        const count = blockMeshesCount.get(block.typeID) || 0;
        matrix.setPosition(block.x, block.y, block.z);
        mesh.setMatrixAt(count, matrix);
        blockMeshesCount.set(block.typeID, count + 1);
      }
    }

    world.chunks.set(key, {
      blocks,
      blocksUint,
      mesh: chunkMesh,
      blockMeshes,
      blockMeshesCount,
      id: chunk.id,
      chunkX: chunk.chunkX,
      chunkZ: chunk.chunkZ,
    });
  }
};
