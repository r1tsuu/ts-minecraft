const entityTypes = new Map<string, typeof Entity>()

export interface Codec<T> {
  decode(obj: any): T
  encode(obj: T): any
}

export abstract class Entity {}

export function getEntityType(entity: Entity): string {
  return (entity as any).__type
}

export function RegisterEntity(type?: string): ClassDecorator {
  return (target) => {
    entityTypes.set(type ?? target.name, target as unknown as typeof Entity)
    target.prototype['__type'] = type ?? target.name
    return target
  }
}
