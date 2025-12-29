import type { Entity, EntityConstructor } from '../shared/entities/Entity.ts'

const entityToSystemsMap = new Map<EntityConstructor, Set<EntitySystem<any>>>()

// interface EntitySystem<T extends Entity> {
//   update(entity: T): void
//   updateAll(entities: T[]): void
// }

// // eslint-disable-next-line @typescript-eslint/no-namespace
// export namespace EntitySystem {
//   export function For(EntityConstructor: EntityConstructor): ClassDecorator {
//     // @ts-expect-error
//     return function (target: EntityConstructor<Entity>) {
//       let systems = entityToSystemsMap.get(EntityConstructor)
//       if (!systems) {
//         systems = new Set()
//         entityToSystemsMap.set(EntityConstructor, systems)
//       }
//       systems.add(target as unknown as EntitySystem<any>)
//     }
//   }
// }

export abstract class EntitySystem<T extends Entity> {
  /**
   * Decorator to register this system for the given entity constructor.
   * @example
   * ```ts
   * @EntitySystem.For(Player)
   * class PlayerMovementSystem extends EntitySystem<Player> {
   *   // ...
   * }
   * ```
   */
  static For(EntityConstructor: EntityConstructor): ClassDecorator {
    // @ts-expect-error
    return function (target: EntityConstructor<Entity>) {
      let systems = entityToSystemsMap.get(EntityConstructor)
      if (!systems) {
        systems = new Set()
        entityToSystemsMap.set(EntityConstructor, systems)
      }
      systems.add(target as unknown as EntitySystem<any>)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update(_entity: T): void {}

  updateAll(entities: T[]): void {
    for (const entity of entities) {
      this.update(entity)
    }
  }
}
