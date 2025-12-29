import * as THREE from 'three'
import { expect, test } from 'vitest'

import { Config } from './Config.ts'
import { Entity, EntityType } from './entities/Entity.ts'
import { Player } from './entities/Player.ts'
import { World } from './World.ts'

test('World can add and retrieve entities', () => {
  const world = new World()
  const player = new Player(
    '123e4567-e89b-12d3-a456-426614174000',
    new THREE.Vector3(1, 2, 3),
    new THREE.Euler(0, 0, 0, Config.EULER_ORDER),
    new THREE.Vector3(0, 0, 0),
  )
  world.addEntity(player)

  const retrieved = world.getEntity(player.getWorldID(), Player)
  expect(retrieved.unwrap()).toBe(player)
})

test('World returns none for non-existent entities', () => {
  const world = new World()
  const retrieved = world.getEntity('non-existent-id', Player)
  expect(retrieved.isNone()).toBe(true)
})

test('World can retrieve entities by only id', () => {
  const world = new World()
  const player = new Player(
    '123e4567-e89b-12d3-a456-426614174000',
    new THREE.Vector3(1, 2, 3),
    new THREE.Euler(0, 0, 0, Config.EULER_ORDER),
    new THREE.Vector3(0, 0, 0),
  )
  world.addEntity(player)

  const retrieved = world.getEntity<Player>(player.getWorldID())
  expect(retrieved.unwrap()).toBe(player)
})

@EntityType()
class TestEntity extends Entity {
  constructor(readonly name: string) {
    super()
  }

  static deserialize(obj: any): TestEntity {
    return new TestEntity(obj.name)
  }

  getWorldID(): string {
    return `testentity_${this.name}`
  }

  serialize(): any {
    return {
      name: this.name,
    }
  }
}

test('World can serialize and deserialize', () => {
  const world = new World()
  const player = new Player(
    '123e4567-e89b-12d3-a456-426614174000',
    new THREE.Vector3(1, 2, 3),
    new THREE.Euler(0, 0, 0, Config.EULER_ORDER),
    new THREE.Vector3(0, 0, 0),
  )
  world.addEntity(player)

  const serialized = world.serialize()
  const deserialized = World.deserialize(serialized)

  const retrieved = deserialized.getEntity(player.getWorldID(), Player).unwrap()
  expect(retrieved).toBeInstanceOf(Player)
  expect(retrieved.uuid).toBe(player.uuid)
  expect(retrieved.position.equals(player.position)).toBe(true)
  expect(retrieved.rotation.equals(player.rotation)).toBe(true)
  expect(retrieved.velocity.equals(player.velocity)).toBe(true)
})

test('World can serialize and deserialize', () => {
  const world = new World()
  const player = new Player(
    '123e4567-e89b-12d3-a456-426614174000',
    new THREE.Vector3(1, 2, 3),
    new THREE.Euler(0, 0, 0, Config.EULER_ORDER),
    new THREE.Vector3(0, 0, 0),
  )
  world.addEntity(player)

  const serialized = world.serialize()
  const deserialized = World.deserialize(serialized)

  const retrieved = deserialized.getEntity(player.getWorldID(), Player).unwrap()
  expect(retrieved).toBeInstanceOf(Player)
  expect(retrieved.uuid).toBe(player.uuid)
  expect(retrieved.position.equals(player.position)).toBe(true)
  expect(retrieved.rotation.equals(player.rotation)).toBe(true)
  expect(retrieved.velocity.equals(player.velocity)).toBe(true)
})

test('WorldQuery throws error when no entity type is selected', () => {
  const world = new World()
  const query = world.query()

  expect(() => {
    query.execute().next() // Attempt to iterate
  }).toThrow('Selecting all entities is not supported in WorldQuery')
})

test('WorldQuery can select and retrieve entities by type', () => {
  const world = new World()
  const player1 = new Player(
    '123e4567-e89b-12d3-a456-426614174000',
    new THREE.Vector3(1, 2, 3),
    new THREE.Euler(0, 0, 0, Config.EULER_ORDER),
    new THREE.Vector3(0, 0, 0),
  )
  const player2 = new Player(
    '123e4567-e89b-12d3-a456-426614174001',
    new THREE.Vector3(4, 5, 6),
    new THREE.Euler(0, 0, 0, Config.EULER_ORDER),
    new THREE.Vector3(1, 1, 1),
  )
  const testEntity = new TestEntity('test1')

  world.addEntity(player1)
  world.addEntity(player2)
  world.addEntity(testEntity)

  const results = Array.from(world.query().select(Player).execute())

  expect(results.length).toBe(2)
  expect(results[0].entity).toBeInstanceOf(Player)
  expect(results[1].entity).toBeInstanceOf(Player)
})

test('WorldQuery can filter entities with where clause', () => {
  const world = new World()
  const player1 = new Player(
    '123e4567-e89b-12d3-a456-426614174000',
    new THREE.Vector3(1, 2, 3),
    new THREE.Euler(0, 0, 0, Config.EULER_ORDER),
    new THREE.Vector3(0, 0, 0),
  )
  const player2 = new Player(
    '123e4567-e89b-12d3-a456-426614174001',
    new THREE.Vector3(10, 20, 30),
    new THREE.Euler(0, 0, 0, Config.EULER_ORDER),
    new THREE.Vector3(1, 1, 1),
  )

  world.addEntity(player1)
  world.addEntity(player2)

  const results = Array.from(
    world
      .query()
      .select(Player)
      .where((entity) => entity.position.x > 5)
      .execute(),
  )

  expect(results.length).toBe(1)
  expect(results[0].entity).toBe(player2)
})

test('WorldQuery can filter entities with whereID clause', () => {
  const world = new World()
  const player1 = new Player(
    '123e4567-e89b-12d3-a456-426614174000',
    new THREE.Vector3(1, 2, 3),
    new THREE.Euler(0, 0, 0, Config.EULER_ORDER),
    new THREE.Vector3(0, 0, 0),
  )
  const player2 = new Player(
    '123e4567-e89b-12d3-a456-426614174001',
    new THREE.Vector3(4, 5, 6),
    new THREE.Euler(0, 0, 0, Config.EULER_ORDER),
    new THREE.Vector3(1, 1, 1),
  )

  world.addEntity(player1)
  world.addEntity(player2)

  const results = Array.from(
    world
      .query()
      .select(Player)
      .whereID((id) => id.includes('174000'))
      .execute(),
  )

  expect(results.length).toBe(1)
  expect(results[0].id).toBe('123e4567-e89b-12d3-a456-426614174000')
  expect(results[0].entity).toBe(player1)
})

test('WorldQuery can chain multiple filters', () => {
  const world = new World()
  const player1 = new Player(
    '123e4567-e89b-12d3-a456-426614174000',
    new THREE.Vector3(1, 2, 3),
    new THREE.Euler(0, 0, 0, Config.EULER_ORDER),
    new THREE.Vector3(0, 0, 0),
  )
  const player2 = new Player(
    '123e4567-e89b-12d3-a456-426614174001',
    new THREE.Vector3(10, 20, 30),
    new THREE.Euler(0, 0, 0, Config.EULER_ORDER),
    new THREE.Vector3(5, 5, 5),
  )
  const player3 = new Player(
    '123e4567-e89b-12d3-a456-426614174002',
    new THREE.Vector3(15, 25, 35),
    new THREE.Euler(0, 0, 0, Config.EULER_ORDER),
    new THREE.Vector3(1, 1, 1),
  )

  world.addEntity(player1)
  world.addEntity(player2)
  world.addEntity(player3)

  const results = Array.from(
    world
      .query()
      .select(Player)
      .where((entity) => entity.position.x > 5)
      .where((entity) => entity.velocity.x < 3)
      .execute(),
  )

  expect(results.length).toBe(1)
  expect(results[0].entity).toBe(player3)
})

test('WorldQuery can select multiple entity types', () => {
  const world = new World()
  const player = new Player(
    '123e4567-e89b-12d3-a456-426614174000',
    new THREE.Vector3(1, 2, 3),
    new THREE.Euler(0, 0, 0, Config.EULER_ORDER),
    new THREE.Vector3(0, 0, 0),
  )
  const testEntity = new TestEntity('test1')

  world.addEntity(player)
  world.addEntity(testEntity)

  const results = Array.from(world.query().select(Player).select(TestEntity).execute())

  expect(results.length).toBe(2)
  const entities = results.map((r) => r.entity)
  expect(entities).toContain(player)
  expect(entities).toContain(testEntity)
})

test('WorldQuery returns empty results when no entities match filters', () => {
  const world = new World()
  const player = new Player(
    '123e4567-e89b-12d3-a456-426614174000',
    new THREE.Vector3(1, 2, 3),
    new THREE.Euler(0, 0, 0, Config.EULER_ORDER),
    new THREE.Vector3(0, 0, 0),
  )

  world.addEntity(player)

  const results = Array.from(
    world
      .query()
      .select(Player)
      .where((entity) => entity.position.x > 100)
      .execute(),
  )

  expect(results.length).toBe(0)
})
