export const Blocks = {
  Bedrock: {
    id: 4,
    name: 'bedrock',
  },
  CoalOre: {
    id: 10,
    name: 'coal_ore',
  },
  DiamondOre: {
    id: 12,
    name: 'diamond_ore',
  },
  Dirt: {
    id: 1,
    name: 'dirt',
  },
  Grass: {
    id: 2,
    name: 'grass',
  },
  Gravel: {
    id: 9,
    name: 'gravel',
  },
  IronOre: {
    id: 11,
    name: 'iron_ore',
  },
  OakLeaves: {
    id: 6,
    name: 'oak_leaves',
  },
  OakLog: {
    id: 5,
    name: 'oak_log',
  },
  Sand: {
    id: 8,
    name: 'sand',
  },
  Stone: {
    id: 3,
    name: 'stone',
  },
} as const

export type BlockID = (typeof Blocks)[keyof typeof Blocks]['id'] | ({} & number)
export type BlockName = (typeof Blocks)[keyof typeof Blocks]['name']
