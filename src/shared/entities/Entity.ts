import type { ClassConstructor } from '../util.ts'

/**
 * Interface representing a constructor for Entity subclasses.
 * @template T The type of Entity.
 * @example
 * ```typescript
 * class MyEntity extends Entity {
 *   static deserialize(obj: any): MyEntity {
 *     // Implementation...
 *   }
 * }
 *
 * const constructor: EntityConstructor<MyEntity> = MyEntity;
 * ```
 */
export interface EntityConstructor<T extends Entity = Entity> extends ClassConstructor<T> {
  deserialize(obj: any): T
}

/**
 * Abstract base class for all entities in the system.
 * Entities must implement methods to get their world ID and serialize themselves when transferring over the network.
 */
export abstract class Entity {
  /**
   * Generator function to fetch all registered entity constructors along with their type strings.
   * @returns An iterable of objects containing the constructor and its associated type string.
   * @example
   * ```typescript
   * for (const { Constructor, type } of Entity.fetchEntityConstructors()) {
   *   console.log(`Entity type: ${type}, Constructor:`, Constructor);
   * }
   * ```
   */
  static *iterEntityConstructors(): Iterable<{
    Constructor: EntityConstructor<Entity>
    type: string
  }> {
    for (const [type, Constructor] of entityTypeMap) {
      yield {
        Constructor,
        type,
      }
    }
  }

  abstract getWorldID(): string

  serialize(): any {
    throw new Error('Method not implemented.')
  }
}

const ENTITY_TYPE_KEY = '__t'

const entityTypeMap = new Map<string, EntityConstructor<Entity>>()

/**
 * Decorator to register an Entity subclass with a specific type string.
 * If no type string is provided, the class name will be used.
 * @param incomingType Optional type string to register the entity with.
 * @return Class decorator function.
 * @example
 * ```typescript
 * \@EntityType('CustomEntity')
 * class CustomEntity extends Entity {
 *   // Implementation...
 * }
 * ```
 * WARNING: The decorated class must implement static `encode` and `decode` methods, otherwise an error will be thrown.
 * UPDATE: This requirement has been removed, but ensure your class implements `serialize` and `deserialize` methods if you transfer entities over the network.
 */
export const EntityType = (incomingType?: string): ClassDecorator => {
  // @ts-expect-error
  return (target: EntityConstructor<Entity>) => {
    const type = incomingType ?? target.name
    const entitySerialize = (target.prototype as Entity).serialize

    entityTypeMap.set(type, target)

    if (typeof entitySerialize === 'function') {
      target.prototype.serialize = function (this: Entity): any {
        const result = entitySerialize.call(this)
        result[ENTITY_TYPE_KEY] = type
        return result
      }
    }

    return target
  }
}

export const getEntityType = (entity: Entity): string => {
  return (entity as any)[ENTITY_TYPE_KEY]
}

export const getEntityConstructor = <T extends Entity>(entity: T): EntityConstructor<T> => {
  return entity.constructor as EntityConstructor<T>
}

/**
 * Deserializes an object into an Entity instance based on its registered type.
 * @param obj The object to deserialize.
 * @returns The deserialized Entity instance.
 * @throws Will throw an error if the object does not have a valid entity type or if the type is unknown.
 * @example
 * ```typescript
 * const serializedObj = { __t: 'CustomEntity', /* other properties *\/ };
 * const entity = deserializeEntity(serializedObj);
 * ```
 */
export const deserializeEntity = (obj: any): Entity => {
  if (typeof obj[ENTITY_TYPE_KEY] !== 'string') {
    throw new Error(`${obj} is not a valid serialized Entity`)
  }

  const constructor = entityTypeMap.get(obj[ENTITY_TYPE_KEY])

  if (!constructor) {
    throw new Error(`Unknown entity type: ${obj[ENTITY_TYPE_KEY]}`)
  }

  return constructor.deserialize(obj)
}
