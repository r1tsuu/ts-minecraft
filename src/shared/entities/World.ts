import { Maybe } from '../Maybe.ts'
import { Result } from '../Result.ts'
import { type ClassConstructor } from '../util.ts'
import {
  deserializeEntity,
  Entity,
  type EntityConstructor,
  getEntityConstructor,
} from './Entity.ts'

export interface WorldQuery<T extends Entity[] = [], Initial extends boolean = true> {
  execute(): IterableIterator<{ entity: T[number]; id: string }>

  select<U extends Entity>(
    constructor: EntityConstructor<U>,
  ): WorldQuery<[...(Initial extends true ? [] : T), U], false>

  where(predicate: (entity: T[number]) => boolean): WorldQuery<T>

  whereID(predicate: (id: string) => boolean): WorldQuery<T>
}

class WorldQueryImpl<T extends Entity[] = [], Initial extends boolean = true> implements WorldQuery<
  T,
  Initial
> {
  private entitiesToQuery = new Set<EntityConstructor>()
  private filters: ((entity: T[number]) => boolean)[] = []
  private idFilters: ((id: string) => boolean)[] = []

  constructor(
    private entities: Map<string, Entity> = new Map(),
    private entitiesByType: Map<EntityConstructor, Set<string>> = new Map(),
  ) {}

  *execute(): IterableIterator<{ entity: T[number]; id: string }> {
    if (this.entitiesToQuery.size === 0) {
      throw new Error('Selecting all entities is not supported in WorldQuery')
    }

    for (const constructor of this.entitiesToQuery) {
      const ids = this.entitiesByType.get(constructor)!

      for (const id of ids) {
        if (!this.idFilters.every((filter) => filter(id))) {
          continue
        }

        const entity = this.entities.get(id)!

        if (!this.filters.every((filter) => filter(entity))) {
          continue
        }

        yield {
          entity,
          id,
        }
      }
    }
  }

  select<U extends Entity>(
    constructor: EntityConstructor<U>,
  ): WorldQuery<[...(Initial extends true ? [] : T), U], false> {
    this.entitiesToQuery.add(constructor)

    return this as unknown as WorldQuery<[...(Initial extends true ? [] : T), U], false>
  }

  where(predicate: (entity: T[number]) => boolean): WorldQuery<T, Initial> {
    this.filters.push(predicate)

    return this
  }

  whereID(predicate: (id: string) => boolean): WorldQuery<T, Initial> {
    this.idFilters.push(predicate)

    return this
  }
}

export class World {
  private entities: Map<string, Entity> = new Map()
  private entitiesByType: Map<EntityConstructor, Set<string>> = new Map()

  constructor() {
    this.entities = new Map()
  }

  static deserialize(obj: any): World {
    const entities = obj.entities as any[]
    const world = new World()

    for (const entityObj of entities) {
      const entity = deserializeEntity(entityObj)
      world.addEntity(entity)
    }

    return world
  }

  addEntity(entity: Entity): void {
    const id = entity.getWorldID()
    this.entities.set(id, entity)
    const entityConstructor = getEntityConstructor(entity)
    if (!this.entitiesByType.has(entityConstructor)) {
      this.entitiesByType.set(entityConstructor, new Set())
    }
    this.entitiesByType.get(entityConstructor)!.add(id)
  }

  fetch(): WorldQuery {
    return new WorldQueryImpl(this.entities, this.entitiesByType)
  }

  getEntity<T extends Entity>(id: string): Maybe<T>
  getEntity<T extends Entity>(id: string, type: ClassConstructor<T>): Maybe<T>
  getEntity<T extends Entity>(id: string, type?: ClassConstructor<T>): Maybe<T> {
    const entity = this.entities.get(id)

    if (!entity) return Maybe.None()

    if (!type) {
      return Maybe.Some(entity as T)
    }

    if (entity instanceof type) {
      return Maybe.Some(entity as T)
    }

    return Maybe.None()
  }
  removeEntity(id: string): Result<Entity, 'EntityNotFound'> {
    const entity = this.getEntity(id)

    if (entity.isNone()) {
      return Result.Err('EntityNotFound')
    }

    this.entities.delete(id)

    for (const [, ids] of this.entitiesByType) {
      ids.delete(id)
    }

    return Result.Ok(entity.value())
  }

  serialize(): any {
    const entities: any[] = []

    for (const [, entity] of this.entities) {
      entities.push(entity.serialize())
    }

    return {
      entities,
    }
  }
}
