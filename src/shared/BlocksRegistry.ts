let id = 1

export const Blocks = {
  Bedrock: {
    id: id++,
    name: 'bedrock',
  },
  CoalOre: {
    id: id++,
    name: 'coal_ore',
  },
  DiamondOre: {
    id: id++,
    name: 'diamond_ore',
  },
  Dirt: {
    id: id++,
    name: 'dirt',
  },
  Grass: {
    id: id++,
    name: 'grass',
  },
  Gravel: {
    id: id++,
    name: 'gravel',
  },
  IronOre: {
    id: id++,
    name: 'iron_ore',
  },
  OakLeaves: {
    id: id++,
    name: 'oak_leaves',
  },
  OakLog: {
    id: id++,
    name: 'oak_log',
  },
  Sand: {
    id: id++,
    name: 'sand',
  },
  Stone: {
    id: id++,
    name: 'stone',
  },
} as const

export const blockIDS: number[] = Object.values(Blocks).map((block) => block.id)

export type BlockID = (typeof Blocks)[keyof typeof Blocks]['id'] | ({} & number)
export type BlockName = (typeof Blocks)[keyof typeof Blocks]['name']
