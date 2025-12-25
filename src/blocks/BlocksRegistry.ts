export const BLOCK_NAMES = ['dirt', 'grass', 'stone'] as const

export type BlockName = (typeof BLOCK_NAMES)[number]

type BlockInRegistry = {
  id: number
  name: BlockName
}

export class BlocksRegistry {
  nameToId = new Map<BlockName, number>()
  registry = new Map<number, BlockInRegistry>()

  constructor() {
    for (const name of BLOCK_NAMES) {
      this.registerBlock({
        name,
      })
    }
  }

  getBlockById(id: number): BlockInRegistry {
    const maybeBlock = this.registry.get(id)

    if (!maybeBlock) {
      throw new Error(`Block with ID ${id} not found`)
    }

    return maybeBlock
  }

  getBlockIdByName(name: BlockName): number {
    const maybeId = this.nameToId.get(name)

    if (maybeId === undefined) {
      throw new Error(`Block with name ${name} not found`)
    }

    return maybeId
  }

  getBlockNameById(id: number): BlockName {
    return this.getBlockById(id).name
  }

  registerBlock(block: Omit<BlockInRegistry, 'id'>) {
    const id = this.registry.size + 1
    this.registry.set(id, { id, ...block })
    this.nameToId.set(block.name, id)
  }
}
