import type { Material } from "three";
import { BLOCK_NAMES, type BlockName } from "./types.js";
import dirtTextureImg from "./static/dirt.png?no-inline";
import grassBlockSideTextureImg from "./static/grass_block_side.png?no-inline";
import grassBlockTopTextureImg from "./static/grass_block_top.png?no-inline";
import * as THREE from "three";
import type { RawVector3 } from "./types.ts";
import { registerBlock } from "./block.ts";

export const rawVector3ToThreeVector3 = (
  rawVector: RawVector3
): THREE.Vector3 => {
  return new THREE.Vector3(rawVector.x, rawVector.y, rawVector.z);
};

export const threeVector3ToRawVector3 = (vector: THREE.Vector3): RawVector3 => {
  return { x: vector.x, y: vector.y, z: vector.z };
};

const textureLoader = new THREE.TextureLoader();

export const initBlocks = () => {
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
