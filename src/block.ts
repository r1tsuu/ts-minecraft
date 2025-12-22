import type { Material } from "three";
import { BLOCK_NAMES, type BlockType, type BlockName } from "./types.js";
import dirtTextureImg from "./static/dirt.png?no-inline";
import grassBlockSideTextureImg from "./static/grass_block_side.png?no-inline";
import grassBlockTopTextureImg from "./static/grass_block_top.png?no-inline";

export const blockRegistry = new Map<number, BlockType>();
export const blockNameToId = new Map<BlockName, number>();

let idCounter = 1;

const registerBlock = (block: BlockType) => {
  blockNameToId.set(block.name, idCounter);
  blockRegistry.set(idCounter++, block);
};

export const getBlockById = (id: number): BlockType => {
  const maybeBlock = blockRegistry.get(id);

  if (!maybeBlock) {
    throw new Error(`Block with ID ${id} not found`);
  }

  return maybeBlock;
};

export const getBlockIdByName = (name: BlockName): number => {
  const maybeId = blockNameToId.get(name);

  if (maybeId === undefined) {
    throw new Error(`Block with name ${name} not found`);
  }

  return maybeId;
};

export const initBlocksWorker = () => {
  for (const name of BLOCK_NAMES) {
    registerBlock({
      name,
      material: null as any,
    });
  }
};

const loadTexture = async (
  textureOrimportPromise: string | Promise<{ default: string }>
) => {
  const { TextureLoader } = await import("three");
  const texture =
    typeof textureOrimportPromise === "string"
      ? { default: textureOrimportPromise }
      : await textureOrimportPromise;

  return new TextureLoader().load(texture.default);
};

export const initBlocks = async () => {
  const { MeshStandardMaterial } = await import("three");
  const dirtTexture = await loadTexture(dirtTextureImg);
  const grassTexture = await loadTexture(grassBlockSideTextureImg);
  const grassTopTexture = await loadTexture(grassBlockTopTextureImg);

  for (const name of BLOCK_NAMES) {
    const nameMaterialMap: Record<BlockName, Material | Material[]> = {
      dirt: new MeshStandardMaterial({
        map: dirtTexture,
      }),
      stone: new MeshStandardMaterial({
        color: 0x888888,
      }),
      grass: [
        new MeshStandardMaterial({ map: grassTexture }), // sides
        new MeshStandardMaterial({ map: grassTexture }), // sides
        new MeshStandardMaterial({ map: grassTopTexture }), // top
        new MeshStandardMaterial({ map: dirtTexture }), // dirt
        new MeshStandardMaterial({ map: grassTexture }), // sides
        new MeshStandardMaterial({ map: grassTexture }), // sides
      ],
    };

    registerBlock({
      name,
      material: nameMaterialMap[name],
    });
  }
};
