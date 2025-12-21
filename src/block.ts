import type { Material } from "three";
import { BLOCK_NAMES, type Block, type BlockName } from "./types.js";

export const blockRegistry = new Map<number, Block>();
export const blockNameToId = new Map<BlockName, number>();

let idCounter = 1;

const registerBlock = (block: Block) => {
  blockNameToId.set(block.name, idCounter);
  blockRegistry.set(idCounter++, block);
};

export const getBlockById = (id: number): Block => {
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

const loadTexture = async (importPromise: Promise<{ default: string }>) => {
  const { TextureLoader } = await import("three");
  const texture = await importPromise;
  return new TextureLoader().load(texture.default);
};

export const initBlocks = async () => {
  const { MeshStandardMaterial } = await import("three");
  const dirtTexture = await loadTexture(import("./static/dirt.png"));
  const grassTexture = await loadTexture(
    import("./static/grass_block_side.png")
  );
  const grassTopTexture = await loadTexture(
    import("./static/grass_block_top.png")
  );

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
