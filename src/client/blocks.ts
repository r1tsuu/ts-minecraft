import * as THREE from 'three'

import { type BlockName, BlocksRegistry } from '../blocks/BlocksRegistry.ts'
import dirtTextureImg from '../static/dirt.png?no-inline'
import grassBlockSideTextureImg from '../static/grass_block_side.png?no-inline'
import grassBlockTopTextureImg from '../static/grass_block_top.png?no-inline'

export type ClientBlockRegisty = ReturnType<typeof createClientBlockRegistry>

type BlockClientData = {
  material: THREE.Material | THREE.Material[]
}

export const createClientBlockRegistry = () => {
  const registry = new BlocksRegistry()
  const clientRegistry = new Map<number, BlockClientData>()
  const textureLoader = new THREE.TextureLoader()

  const dirtTexture = textureLoader.load(dirtTextureImg)
  const grassTexture = textureLoader.load(grassBlockSideTextureImg)
  const grassTopTexture = textureLoader.load(grassBlockTopTextureImg)

  const nameMaterialMap: Record<BlockName, THREE.Material | THREE.Material[]> = {
    dirt: new THREE.MeshStandardMaterial({
      map: dirtTexture,
    }),
    grass: [
      new THREE.MeshStandardMaterial({ map: grassTexture }), // sides
      new THREE.MeshStandardMaterial({ map: grassTexture }), // sides
      new THREE.MeshStandardMaterial({ map: grassTopTexture }), // top
      new THREE.MeshStandardMaterial({ map: dirtTexture }), // dirt
      new THREE.MeshStandardMaterial({ map: grassTexture }), // sides
      new THREE.MeshStandardMaterial({ map: grassTexture }), // sides
    ],
    stone: new THREE.MeshStandardMaterial({
      color: 0x888888,
    }),
  }

  for (const [id, { name }] of registry.registry) {
    const material = nameMaterialMap[name]

    if (!material) {
      throw new Error(
        `No material defined for block name: ${name}. Please update the client block registry.`,
      )
    }

    clientRegistry.set(id, { material })
  }

  return {
    clientRegistry,
    registry,
  }
}
