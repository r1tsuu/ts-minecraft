import * as THREE from 'three'
import { describe, expect, test } from 'vitest'

import { Config } from './Config.ts'
import { Chunk } from './entities/Chunk.ts'
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

describe('getBlock', () => {
  test('returns block when it exists at the given coordinates', () => {
    const world = new World()
    const chunk = new Chunk(0, 0)
    chunk.setBlock(5, 10, 7, 1) // Set a block with ID 1
    world.addEntity(chunk)

    const worldX = 5
    const worldY = 10
    const worldZ = 7

    const block = world.getBlock(worldX, worldY, worldZ)
    expect(block.isSome()).toBe(true)
    expect(block.unwrap()).toBe(1)
  })

  test('returns None when block is air (ID 0)', () => {
    const world = new World()
    const chunk = new Chunk(0, 0)
    world.addEntity(chunk)

    const block = world.getBlock(5, 10, 7)
    expect(block.isNone()).toBe(true)
  })

  test('returns None when chunk does not exist', () => {
    const world = new World()

    const block = world.getBlock(5, 10, 7)
    expect(block.isNone()).toBe(true)
  })

  test('works with negative coordinates', () => {
    const world = new World()
    const chunk = new Chunk(-1, -1)

    // Local coordinates (15, 15) in chunk (-1, -1)
    // maps to world coordinates (-1, -1)
    const localX = Config.CHUNK_SIZE - 1
    const localZ = Config.CHUNK_SIZE - 1
    chunk.setBlock(localX, 10, localZ, 2)
    world.addEntity(chunk)

    const block = world.getBlock(-1, 10, -1)
    expect(block.isSome()).toBe(true)
    expect(block.unwrap()).toBe(2)
  })

  test('works across multiple chunks', () => {
    const world = new World()

    // Create chunks at (0,0) and (1,0)
    const chunk1 = new Chunk(0, 0)
    const chunk2 = new Chunk(1, 0)

    chunk1.setBlock(5, 10, 7, 1)
    chunk2.setBlock(2, 15, 3, 2)

    world.addEntity(chunk1)
    world.addEntity(chunk2)

    // Test block in first chunk
    const block1 = world.getBlock(5, 10, 7)
    expect(block1.isSome()).toBe(true)
    expect(block1.unwrap()).toBe(1)

    // Test block in second chunk (offset by CHUNK_SIZE)
    const worldX = Config.CHUNK_SIZE + 2
    const block2 = world.getBlock(worldX, 15, 3)
    expect(block2.isSome()).toBe(true)
    expect(block2.unwrap()).toBe(2)
  })

  test('handles boundary between chunks correctly', () => {
    const world = new World()
    const chunk1 = new Chunk(0, 0)
    const chunk2 = new Chunk(1, 0)

    // Last block in chunk 0
    chunk1.setBlock(Config.CHUNK_SIZE - 1, 10, 5, 1)
    // First block in chunk 1
    chunk2.setBlock(0, 10, 5, 2)

    world.addEntity(chunk1)
    world.addEntity(chunk2)

    const block1 = world.getBlock(Config.CHUNK_SIZE - 1, 10, 5)
    expect(block1.unwrap()).toBe(1)

    const block2 = world.getBlock(Config.CHUNK_SIZE, 10, 5)
    expect(block2.unwrap()).toBe(2)
  })
})

describe('boxIntersectsWorldBlocks', () => {
  test('returns true when box intersects a block', () => {
    const world = new World()
    const chunk = new Chunk(0, 0)
    chunk.setBlock(5, 10, 7, 1)
    world.addEntity(chunk)

    // Box that overlaps with block at (5, 10, 7)
    const box = new THREE.Box3(new THREE.Vector3(5.2, 10.2, 7.2), new THREE.Vector3(5.8, 10.8, 7.8))

    expect(world.boxIntersectsWorldBlocks(box)).toBe(true)
  })

  test('returns false when box does not intersect any blocks', () => {
    const world = new World()
    const chunk = new Chunk(0, 0)
    chunk.setBlock(5, 10, 7, 1)
    world.addEntity(chunk)

    // Box far away from the block
    const box = new THREE.Box3(new THREE.Vector3(20, 20, 20), new THREE.Vector3(21, 21, 21))

    expect(world.boxIntersectsWorldBlocks(box)).toBe(false)
  })

  test('returns false when world has no blocks', () => {
    const world = new World()
    const chunk = new Chunk(0, 0)
    world.addEntity(chunk)

    const box = new THREE.Box3(new THREE.Vector3(5, 10, 7), new THREE.Vector3(6, 11, 8))

    expect(world.boxIntersectsWorldBlocks(box)).toBe(false)
  })

  test('returns true when box edge touches block edge', () => {
    const world = new World()
    const chunk = new Chunk(0, 0)
    chunk.setBlock(5, 10, 7, 1)
    world.addEntity(chunk)

    // Block AABB is [5, 6) x [10, 11) x [7, 8)
    // Box that just touches the block
    const box = new THREE.Box3(new THREE.Vector3(4.5, 9.5, 6.5), new THREE.Vector3(5.1, 10.1, 7.1))

    expect(world.boxIntersectsWorldBlocks(box)).toBe(true)
  })

  test('returns false when box is exactly adjacent but not overlapping', () => {
    const world = new World()
    const chunk = new Chunk(0, 0)
    chunk.setBlock(5, 10, 7, 1)
    world.addEntity(chunk)

    // Block AABB is [5, 6) x [10, 11) x [7, 8)
    // Box adjacent on X axis: [6, 7) x [10, 11) x [7, 8)
    const box = new THREE.Box3(new THREE.Vector3(6, 10, 7), new THREE.Vector3(7, 11, 8))

    expect(world.boxIntersectsWorldBlocks(box)).toBe(false)
  })

  test('handles box spanning multiple blocks', () => {
    const world = new World()
    const chunk = new Chunk(0, 0)
    chunk.setBlock(5, 10, 7, 1)
    chunk.setBlock(6, 10, 7, 1)
    chunk.setBlock(7, 10, 7, 1)
    world.addEntity(chunk)

    // Large box that spans multiple blocks
    const box = new THREE.Box3(new THREE.Vector3(5.5, 10.5, 7.5), new THREE.Vector3(7.5, 10.9, 7.9))

    expect(world.boxIntersectsWorldBlocks(box)).toBe(true)
  })

  test('handles box with negative coordinates', () => {
    const world = new World()
    const chunk = new Chunk(-1, -1)

    const localX = Config.CHUNK_SIZE - 1
    const localZ = Config.CHUNK_SIZE - 1
    chunk.setBlock(localX, 10, localZ, 1)
    world.addEntity(chunk)

    // Box at negative world coordinates
    const box = new THREE.Box3(
      new THREE.Vector3(-1.5, 9.5, -1.5),
      new THREE.Vector3(-0.5, 10.5, -0.5),
    )

    expect(world.boxIntersectsWorldBlocks(box)).toBe(true)
  })

  test('returns true when box fully contains a block', () => {
    const world = new World()
    const chunk = new Chunk(0, 0)
    chunk.setBlock(5, 10, 7, 1)
    world.addEntity(chunk)

    // Large box that fully contains the block
    const box = new THREE.Box3(new THREE.Vector3(4, 9, 6), new THREE.Vector3(7, 12, 9))

    expect(world.boxIntersectsWorldBlocks(box)).toBe(true)
  })

  test('returns true when block fully contains the box', () => {
    const world = new World()
    const chunk = new Chunk(0, 0)
    chunk.setBlock(5, 10, 7, 1)
    world.addEntity(chunk)

    // Small box fully inside the block
    const box = new THREE.Box3(new THREE.Vector3(5.1, 10.1, 7.1), new THREE.Vector3(5.9, 10.9, 7.9))

    expect(world.boxIntersectsWorldBlocks(box)).toBe(true)
  })

  test('handles very small box', () => {
    const world = new World()
    const chunk = new Chunk(0, 0)
    chunk.setBlock(5, 10, 7, 1)
    world.addEntity(chunk)

    // Tiny box inside the block
    const box = new THREE.Box3(
      new THREE.Vector3(5.5, 10.5, 7.5),
      new THREE.Vector3(5.51, 10.51, 7.51),
    )

    expect(world.boxIntersectsWorldBlocks(box)).toBe(true)
  })

  test('handles box across chunk boundaries', () => {
    const world = new World()
    const chunk1 = new Chunk(0, 0)
    const chunk2 = new Chunk(1, 0)

    // Block near the end of chunk 0
    chunk1.setBlock(Config.CHUNK_SIZE - 1, 10, 5, 1)
    // Block at the start of chunk 1
    chunk2.setBlock(0, 10, 5, 1)

    world.addEntity(chunk1)
    world.addEntity(chunk2)

    // Box that spans across chunk boundary
    const box = new THREE.Box3(
      new THREE.Vector3(Config.CHUNK_SIZE - 0.5, 10.2, 5.2),
      new THREE.Vector3(Config.CHUNK_SIZE + 0.5, 10.8, 5.8),
    )

    expect(world.boxIntersectsWorldBlocks(box)).toBe(true)
  })
})

describe('addBlock', () => {
  test('adds a block to an existing chunk', () => {
    const world = new World()
    const chunk = new Chunk(0, 0)
    world.addEntity(chunk)

    // Initially no block
    expect(world.getBlock(5, 10, 7).isNone()).toBe(true)

    // Add block
    world.addBlock(5, 10, 7, 2)

    // Block should now exist
    const block = world.getBlock(5, 10, 7)
    expect(block.isSome()).toBe(true)
    expect(block.unwrap()).toBe(2)
  })

  test('adds a block with negative coordinates', () => {
    const world = new World()
    const chunk = new Chunk(-1, -1)
    world.addEntity(chunk)

    world.addBlock(-1, 10, -1, 3)

    const block = world.getBlock(-1, 10, -1)
    expect(block.isSome()).toBe(true)
    expect(block.unwrap()).toBe(3)
  })

  test('adds blocks across multiple chunks', () => {
    const world = new World()
    const chunk1 = new Chunk(0, 0)
    const chunk2 = new Chunk(1, 0)
    world.addEntity(chunk1)
    world.addEntity(chunk2)

    // Add block in chunk 1
    world.addBlock(5, 10, 7, 1)

    // Add block in chunk 2
    const worldX = Config.CHUNK_SIZE + 2
    world.addBlock(worldX, 15, 3, 2)

    // Verify both blocks exist
    expect(world.getBlock(5, 10, 7).unwrap()).toBe(1)
    expect(world.getBlock(worldX, 15, 3).unwrap()).toBe(2)
  })

  test('updates an existing block', () => {
    const world = new World()
    const chunk = new Chunk(0, 0)
    chunk.setBlock(5, 10, 7, 1)
    world.addEntity(chunk)

    // Verify initial block
    expect(world.getBlock(5, 10, 7).unwrap()).toBe(1)

    // Update block
    world.addBlock(5, 10, 7, 5)

    // Verify block was updated
    expect(world.getBlock(5, 10, 7).unwrap()).toBe(5)
  })

  test('adds block at chunk boundary', () => {
    const world = new World()
    const chunk = new Chunk(0, 0)
    world.addEntity(chunk)

    // Last block in chunk 0
    world.addBlock(Config.CHUNK_SIZE - 1, 10, 5, 3)

    const block = world.getBlock(Config.CHUNK_SIZE - 1, 10, 5)
    expect(block.unwrap()).toBe(3)
  })

  test('does nothing when chunk does not exist', () => {
    const world = new World()

    // Try to add block without creating chunk
    world.addBlock(5, 10, 7, 1)

    // Block should not exist
    expect(world.getBlock(5, 10, 7).isNone()).toBe(true)
  })
})

describe('removeBlock', () => {
  test('removes an existing block', () => {
    const world = new World()
    const chunk = new Chunk(0, 0)
    chunk.setBlock(5, 10, 7, 1)
    world.addEntity(chunk)

    // Verify block exists
    expect(world.getBlock(5, 10, 7).isSome()).toBe(true)

    // Remove block
    world.removeBlock(5, 10, 7)

    // Block should be gone
    expect(world.getBlock(5, 10, 7).isNone()).toBe(true)
  })

  test('removes block with negative coordinates', () => {
    const world = new World()
    const chunk = new Chunk(-1, -1)
    const localX = Config.CHUNK_SIZE - 1
    const localZ = Config.CHUNK_SIZE - 1
    chunk.setBlock(localX, 10, localZ, 2)
    world.addEntity(chunk)

    // Verify block exists
    expect(world.getBlock(-1, 10, -1).unwrap()).toBe(2)

    // Remove block
    world.removeBlock(-1, 10, -1)

    // Block should be gone
    expect(world.getBlock(-1, 10, -1).isNone()).toBe(true)
  })

  test('handles removing a non-existent block', () => {
    const world = new World()
    const chunk = new Chunk(0, 0)
    world.addEntity(chunk)

    // Try to remove block that doesn't exist (should not throw)
    expect(() => world.removeBlock(5, 10, 7)).not.toThrow()

    // Still no block
    expect(world.getBlock(5, 10, 7).isNone()).toBe(true)
  })

  test('does nothing when chunk does not exist', () => {
    const world = new World()

    // Try to remove block without creating chunk (should not throw)
    expect(() => world.removeBlock(5, 10, 7)).not.toThrow()
  })

  test('removes and re-adds a block', () => {
    const world = new World()
    const chunk = new Chunk(0, 0)
    chunk.setBlock(5, 10, 7, 1)
    world.addEntity(chunk)

    // Remove block
    world.removeBlock(5, 10, 7)
    expect(world.getBlock(5, 10, 7).isNone()).toBe(true)

    // Re-add with different ID
    world.addBlock(5, 10, 7, 3)
    expect(world.getBlock(5, 10, 7).unwrap()).toBe(3)
  })

  test('removes block at chunk boundary', () => {
    const world = new World()
    const chunk = new Chunk(0, 0)
    chunk.setBlock(Config.CHUNK_SIZE - 1, 10, 5, 1)
    world.addEntity(chunk)

    world.removeBlock(Config.CHUNK_SIZE - 1, 10, 5)

    expect(world.getBlock(Config.CHUNK_SIZE - 1, 10, 5).isNone()).toBe(true)
  })
})
