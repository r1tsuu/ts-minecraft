import * as THREE from 'three'
import { describe, expect, test } from 'vitest'

import { Config } from './Config.ts'
import { Chunk } from './entities/Chunk.ts'
import { boxIntersectsWorldBlocks, getBlockInWorld } from './util.ts'
import { World } from './World.ts'

describe('getBlockInWorld', () => {
  test('returns block when it exists at the given coordinates', () => {
    const world = new World()
    const chunk = new Chunk(0, 0)
    chunk.setBlock(5, 10, 7, 1) // Set a block with ID 1
    world.addEntity(chunk)

    const worldX = 5
    const worldY = 10
    const worldZ = 7

    const block = getBlockInWorld(world, worldX, worldY, worldZ)
    expect(block.isSome()).toBe(true)
    expect(block.unwrap()).toBe(1)
  })

  test('returns None when block is air (ID 0)', () => {
    const world = new World()
    const chunk = new Chunk(0, 0)
    world.addEntity(chunk)

    const block = getBlockInWorld(world, 5, 10, 7)
    expect(block.isNone()).toBe(true)
  })

  test('returns None when chunk does not exist', () => {
    const world = new World()

    const block = getBlockInWorld(world, 5, 10, 7)
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

    const block = getBlockInWorld(world, -1, 10, -1)
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
    const block1 = getBlockInWorld(world, 5, 10, 7)
    expect(block1.isSome()).toBe(true)
    expect(block1.unwrap()).toBe(1)

    // Test block in second chunk (offset by CHUNK_SIZE)
    const worldX = Config.CHUNK_SIZE + 2
    const block2 = getBlockInWorld(world, worldX, 15, 3)
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

    const block1 = getBlockInWorld(world, Config.CHUNK_SIZE - 1, 10, 5)
    expect(block1.unwrap()).toBe(1)

    const block2 = getBlockInWorld(world, Config.CHUNK_SIZE, 10, 5)
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

    expect(boxIntersectsWorldBlocks(world, box)).toBe(true)
  })

  test('returns false when box does not intersect any blocks', () => {
    const world = new World()
    const chunk = new Chunk(0, 0)
    chunk.setBlock(5, 10, 7, 1)
    world.addEntity(chunk)

    // Box far away from the block
    const box = new THREE.Box3(new THREE.Vector3(20, 20, 20), new THREE.Vector3(21, 21, 21))

    expect(boxIntersectsWorldBlocks(world, box)).toBe(false)
  })

  test('returns false when world has no blocks', () => {
    const world = new World()
    const chunk = new Chunk(0, 0)
    world.addEntity(chunk)

    const box = new THREE.Box3(new THREE.Vector3(5, 10, 7), new THREE.Vector3(6, 11, 8))

    expect(boxIntersectsWorldBlocks(world, box)).toBe(false)
  })

  test('returns true when box edge touches block edge', () => {
    const world = new World()
    const chunk = new Chunk(0, 0)
    chunk.setBlock(5, 10, 7, 1)
    world.addEntity(chunk)

    // Block AABB is [5, 6) x [10, 11) x [7, 8)
    // Box that just touches the block
    const box = new THREE.Box3(new THREE.Vector3(4.5, 9.5, 6.5), new THREE.Vector3(5.1, 10.1, 7.1))

    expect(boxIntersectsWorldBlocks(world, box)).toBe(true)
  })

  test('returns false when box is exactly adjacent but not overlapping', () => {
    const world = new World()
    const chunk = new Chunk(0, 0)
    chunk.setBlock(5, 10, 7, 1)
    world.addEntity(chunk)

    // Block AABB is [5, 6) x [10, 11) x [7, 8)
    // Box adjacent on X axis: [6, 7) x [10, 11) x [7, 8)
    const box = new THREE.Box3(new THREE.Vector3(6, 10, 7), new THREE.Vector3(7, 11, 8))

    expect(boxIntersectsWorldBlocks(world, box)).toBe(false)
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

    expect(boxIntersectsWorldBlocks(world, box)).toBe(true)
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

    expect(boxIntersectsWorldBlocks(world, box)).toBe(true)
  })

  test('returns true when box fully contains a block', () => {
    const world = new World()
    const chunk = new Chunk(0, 0)
    chunk.setBlock(5, 10, 7, 1)
    world.addEntity(chunk)

    // Large box that fully contains the block
    const box = new THREE.Box3(new THREE.Vector3(4, 9, 6), new THREE.Vector3(7, 12, 9))

    expect(boxIntersectsWorldBlocks(world, box)).toBe(true)
  })

  test('returns true when block fully contains the box', () => {
    const world = new World()
    const chunk = new Chunk(0, 0)
    chunk.setBlock(5, 10, 7, 1)
    world.addEntity(chunk)

    // Small box fully inside the block
    const box = new THREE.Box3(new THREE.Vector3(5.1, 10.1, 7.1), new THREE.Vector3(5.9, 10.9, 7.9))

    expect(boxIntersectsWorldBlocks(world, box)).toBe(true)
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

    expect(boxIntersectsWorldBlocks(world, box)).toBe(true)
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

    expect(boxIntersectsWorldBlocks(world, box)).toBe(true)
  })
})
