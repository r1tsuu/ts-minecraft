export const BLOCK_NAMES = ['dirt', 'grass', 'stone'] as const

export type BlockName = (typeof BLOCK_NAMES)[number]

export type BlocksRegistry = ReturnType<typeof createBlocksRegistry>

type BlockInRegistry = {
  id: number
  name: BlockName
}

export const createBlocksRegistry = () => {
  const registry = new Map<number, BlockInRegistry>()
  const nameToId = new Map<BlockName, number>()

  const registerBlock = (block: Omit<BlockInRegistry, 'id'>) => {
    const id = registry.size + 1
    registry.set(id, { id, ...block })
    nameToId.set(block.name, id)
  }

  const getBlockById = (id: number): BlockInRegistry => {
    const maybeBlock = registry.get(id)

    if (!maybeBlock) {
      throw new Error(`Block with ID ${id} not found`)
    }

    return maybeBlock
  }

  const getBlockNameById = (id: number): BlockName => {
    return getBlockById(id).name
  }

  const getBlockIdByName = (name: BlockName): number => {
    const maybeId = nameToId.get(name)

    if (maybeId === undefined) {
      throw new Error(`Block with name ${name} not found`)
    }

    return maybeId
  }

  for (const name of BLOCK_NAMES) {
    registerBlock({
      name,
    })
  }

  return {
    getBlockById,
    getBlockIdByName,
    getBlockNameById,
    nameToId,
    registerBlock,
    registry,
  }
}
