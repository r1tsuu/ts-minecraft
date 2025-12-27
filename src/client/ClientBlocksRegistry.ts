import * as THREE from 'three'

import { type BlockName, BlocksRegistry } from '../shared/BlocksRegistry.ts'
import dirtTextureImg from '../static/dirt.png?no-inline'
import grassBlockSideTextureImg from '../static/grass_block_side.png?no-inline'
import grassBlockTopTextureImg from '../static/grass_block_top.png?no-inline'
import { ClientContainer } from './ClientContainer.ts'

type BlockClientData = {
  material: THREE.Material | THREE.Material[]
}

export class ClientBlocksRegistry {
  registry: Map<number, BlockClientData> = new Map()

  constructor() {
    const blocksRegistry = ClientContainer.resolve(BlocksRegistry).unwrap()

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

    for (const [id, { name }] of blocksRegistry.registry) {
      const material = nameMaterialMap[name]

      if (!material) {
        throw new Error(
          `No material defined for block name: ${name}. Please update the client block registry.`,
        )
      }

      this.registry.set(id, { material })
    }
  }
}
