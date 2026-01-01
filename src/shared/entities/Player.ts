import * as THREE from 'three'

import type { Result } from '../Result.ts'

import { Config } from '../Config.ts'
import { Maybe, None, Some } from '../Maybe.ts'
import { Entity, EntityType } from './Entity.ts'

export class Inventory {
  private items: Maybe<ItemStack>[]

  constructor(readonly _size: number) {
    this.items = new Array(_size).fill(None())
  }

  static deserialize(obj: any): Inventory {
    const inventory = new Inventory(obj.length)
    inventory.items = obj.map((item: any) => Maybe.from(item))
    return inventory
  }

  clearItemAt(slotIndex: number): void {
    this.items[slotIndex] = None()
  }

  decrementAmountAt(slotIndex: number, amount: number): boolean {
    const maybeItemStack = this.getItemAt(slotIndex)
    if (maybeItemStack.isNone()) {
      return false
    }
    const itemStack = maybeItemStack.value()
    if (itemStack.quantity - amount < 0) {
      return false
    }
    itemStack.quantity -= amount
    if (itemStack.quantity === 0) {
      this.clearItemAt(slotIndex)
    }
    return true
  }

  getItemAt(slotIndex: number): Maybe<ItemStack> {
    return this.items[slotIndex] ?? None()
  }

  listItems(): Maybe<ItemStack>[] {
    return this.items
  }

  serialize(): any {
    return this.items.map((item) => item.valueOrNull())
  }

  setItemAt(slotIndex: number, itemStack: ItemStack): void {
    this.items[slotIndex] = Some(itemStack)
  }

  size(): number {
    return this._size
  }
}

export class ItemStack {
  constructor(
    public itemID: number,
    public quantity: number,
  ) {
    if (quantity < 1 || quantity > Config.MAX_STACK_SIZE) {
      throw new Error(`Invalid item stack quantity: ${quantity}`)
    }
  }
}

@EntityType('Player')
export class Player extends Entity {
  private activeSlotIndex: number = 0
  private inventory: Inventory = new Inventory(Config.PLAYER_INVENTORY_SIZE)
  constructor(
    readonly uuid: string,
    readonly position: THREE.Vector3,
    readonly rotation: THREE.Euler,
    readonly velocity: THREE.Vector3,
  ) {
    super()
  }

  static boundingBox(position: THREE.Vector3): THREE.Box3 {
    const min = new THREE.Vector3(
      position.x - Config.PLAYER_WIDTH / 2,
      position.y - Config.PLAYER_HEIGHT,
      position.z - Config.PLAYER_WIDTH / 2,
    )
    const max = new THREE.Vector3(
      position.x + Config.PLAYER_WIDTH / 2,
      position.y,
      position.z + Config.PLAYER_WIDTH / 2,
    )

    return new THREE.Box3(min, max)
  }

  static deserialize(obj: any): Player {
    const player = new Player(
      obj.uuid,
      THREE.Vector3.deserialize(obj.position),
      THREE.Euler.deserialize(obj.rotation),
      THREE.Vector3.deserialize(obj.velocity),
    )
    player.inventory = Inventory.deserialize(obj.inventory)
    return player
  }

  static serialize(player: Player): any {
    return player.serialize()
  }

  getActiveSlotIndex(): number {
    return this.activeSlotIndex
  }

  getInventory(): Inventory {
    return this.inventory
  }

  getWorldID(): string {
    return this.uuid
  }

  serialize(): any {
    return {
      inventory: this.inventory.serialize(),
      position: this.position.serialize(),
      rotation: this.rotation.serialize(),
      uuid: this.uuid,
      velocity: this.velocity.serialize(),
    }
  }

  setActiveSlotIndex(index: number): void {
    this.activeSlotIndex = index
  }
}
