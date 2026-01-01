import { Blocks } from './BlocksRegistry.ts'
import { HashMap } from './HashMap.ts'
import { type Maybe, None, Some } from './Maybe.ts'
import { capitalize } from './util.ts'

let id = 1

const blockItems = Object.values(Blocks).map((each) => ({
  id: id++,
  name: each.name,
  relatedBlockID: Some(each.id),
}))

const ItemsFromBlocks = Object.fromEntries(
  blockItems.map((item) => [capitalize(item.name), item]),
) as {
  [key in Capitalize<(typeof blockItems)[number]['name']>]: {
    id: number
    name: (typeof blockItems)[number]['name']
    relatedBlockID: Maybe<number>
  }
}

export const Items = {
  ...ItemsFromBlocks,
} as const

const itemToBlockID = new HashMap<number, number>()
const blockIdToItemId = new HashMap<number, number>()
for (const item of blockItems) {
  if (item.relatedBlockID.isSome()) {
    itemToBlockID.set(item.id, item.relatedBlockID.value())
    blockIdToItemId.set(item.relatedBlockID.value(), item.id)
  }
}

export const itemIDToBlockID = (itemID: number): Maybe<number> => {
  return itemToBlockID.get(itemID)
}

export const blockIDToItemID = (blockID: number): Maybe<number> => {
  return blockIdToItemId.get(blockID)
}
