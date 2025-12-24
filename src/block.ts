import { BLOCK_NAMES, type BlockName, type BlockType } from './types.js'

export const blockRegistry = new Map<number, BlockType>()
export const blockNameToId = new Map<BlockName, number>()

let idCounter = 1

export const registerBlock = (block: BlockType) => {
  blockNameToId.set(block.name, idCounter)
  blockRegistry.set(idCounter++, block)
}

export const getBlockById = (id: number): BlockType => {
  const maybeBlock = blockRegistry.get(id)

  if (!maybeBlock) {
    throw new Error(`Block with ID ${id} not found`)
  }

  return maybeBlock
}

export const getBlockIdByName = (name: BlockName): number => {
  const maybeId = blockNameToId.get(name)

  if (maybeId === undefined) {
    throw new Error(`Block with name ${name} not found`)
  }

  return maybeId
}

export const initBlocksWorker = () => {
  for (const name of BLOCK_NAMES) {
    registerBlock({
      material: null as any,
      name,
    })
  }
}
