import {
  deserializeEntity,
  Entity,
  type EntityConstructor,
  getEntityConstructor,
} from './entities/Entity.ts'
import { HashMap } from './HashMap.ts'
import { Maybe, None, Some } from './Maybe.ts'
import { Result } from './Result.ts'
import { type ClassConstructor } from './util.ts'

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
    private entities: HashMap<string, Entity> = new HashMap(),
    private entitiesByType: HashMap<EntityConstructor, Set<string>> = new HashMap(),
  ) {}

  *execute(): IterableIterator<{ entity: T[number]; id: string }> {
    if (this.entitiesToQuery.size === 0) {
      throw new Error('Selecting all entities is not supported in WorldQuery')
    }

    for (const constructor of this.entitiesToQuery) {
      const ids = this.entitiesByType.get(constructor).unwrap()

      for (const id of ids) {
        if (!this.idFilters.every((filter) => filter(id))) {
          continue
        }

        const entity = this.entities.get(id).unwrap()

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
  private dirtyEntities = new Set<string>()
  private entities: HashMap<string, Entity> = new HashMap()
  private entitiesByType: HashMap<EntityConstructor, Set<string>> = new HashMap()

  constructor() {
    this.entities = new HashMap()
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

  /**
   * Add an entity to the world and mark it as dirty.
   * @param resolveEntity - A function that resolves to the entity to add.
   * @returns The added entity.
   * @example
   * ```ts
   * const player = world.addDirtyEntity(() => new Player(uuid, name))
   * ```
   *
   * Useful for new entity creation where you want to both add and mark as dirty in one step.
   * For example when generating a new player or chunk.
   */
  addDirtyEntity<T extends Entity>(resolveEntity: () => T): T {
    const entity = resolveEntity()
    this.addEntity(entity)
    this.markEntityAsDirty(entity.getWorldID())
    return entity
  }

  /**
   * Add multiple entities to the world.
   * @param iterators - Iterable collections of entities to add.
   * @example
   * ```ts
   * const players: Player[] = [...] // some array of Player entities
   * const chunks: Chunk[] = [...] // some array of Chunk entities
   *
   * world.addEntities(players, chunks)
   * ```
   */
  addEntities(...iterators: Iterable<Entity>[]): void {
    for (const iterator of iterators) {
      for (const entity of iterator) {
        this.addEntity(entity)
      }
    }
  }

  addEntity(entity: Entity): void {
    const id = entity.getWorldID()
    this.entities.set(id, entity)
    const entityConstructor = getEntityConstructor(entity)
    if (!this.entitiesByType.has(entityConstructor)) {
      this.entitiesByType.set(entityConstructor, new Set())
    }
    this.entitiesByType.get(entityConstructor).unwrap().add(id)
  }
  /**
   * Get an entity by its ID
   */
  getEntity<T extends Entity>(id: string): Maybe<T>
  /**
   * Get an entity by its ID and type.
   */
  getEntity<T extends Entity>(id: string, type: ClassConstructor<T>): Maybe<T>
  /**
   * internal implementation
   */
  getEntity<T extends Entity>(id: string, type?: ClassConstructor<T>): Maybe<T> {
    const maybeEntity = this.entities.get(id)
    if (maybeEntity.isNone()) return None()
    const entity = maybeEntity.value()

    if (!type) {
      return Some(entity as T)
    }

    if (entity instanceof type) {
      return Some(entity as T)
    }

    return None()
  }

  markEntityAsDirty(id: string): void {
    this.dirtyEntities.add(id)
  }

  query(): WorldQuery {
    return new WorldQueryImpl(this.entities, this.entitiesByType)
  }

  queryDirty(): WorldQuery {
    return this.query().whereID((id) => this.dirtyEntities.has(id))
  }

  removeEntity(id: string): Result<
    Entity,
    {
      id: string
      type: 'EntityNotFound'
    }
  > {
    const entity = this.getEntity(id)

    if (entity.isNone()) {
      return Result.Err({
        id,
        type: 'EntityNotFound',
      })
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

  unmarkEntityAsDirty(id: string): void {
    this.dirtyEntities.delete(id)
  }
}
