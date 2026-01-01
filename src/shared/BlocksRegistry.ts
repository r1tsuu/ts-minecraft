export const Blocks = {
  Bedrock: {
    id: 4,
    name: 'bedrock',
  },
  Dirt: {
    id: 1,
    name: 'dirt',
  },
  Grass: {
    id: 2,
    name: 'grass',
  },
  OakLeaves: {
    id: 6,
    name: 'oak_leaves',
  },
  OakLog: {
    id: 5,
    name: 'oak_log',
  },
  Stone: {
    id: 3,
    name: 'stone',
  },
} as const

export type BlockID = (typeof Blocks)[keyof typeof Blocks]['id'] | ({} & number)
export type BlockName = (typeof Blocks)[keyof typeof Blocks]['name']
