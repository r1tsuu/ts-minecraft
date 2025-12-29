/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect, test } from 'vitest'

import { deserializeEntity, Entity, EntityType } from './Entity.ts'

test('EntityType decorator registers entity and adds type to serialization', () => {
  @EntityType('TestEntity')
  class TestEntity extends Entity {
    constructor(readonly value: number) {
      super()
    }

    static deserialize(obj: any): TestEntity {
      return new TestEntity(obj.value)
    }

    getWorldID(): string {
      return `testentity_${this.value}`
    }

    serialize(): any {
      return {
        value: this.value,
      }
    }
  }

  const entity = new TestEntity(42)
  const serialized = entity.serialize()
  expect(serialized).toHaveProperty('__t', 'TestEntity')

  const deserialized = deserializeEntity(serialized) as TestEntity
  expect(deserialized).toBeInstanceOf(TestEntity)
  expect(deserialized.value).toBe(42)
})

test('EntityType decorator throws error if serialize or deserialize not implemented', () => {
  expect(() => {
    @EntityType('InvalidEntity')

    // @ts-expect-error
    class InvalidEntity extends Entity {}
  }).toThrowError(/must implement serialize method/)

  expect(() => {
    @EntityType('AnotherInvalidEntity')
    // @ts-expect-error
    class AnotherInvalidEntity extends Entity {
      serialize(): any {
        return {}
      }
    }
  }).toThrowError(/must implement static deserialize method/)
})
