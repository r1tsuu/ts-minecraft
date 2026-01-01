import { NearestFilter, Texture, TextureLoader } from 'three'

import type { RawVector2 } from '../types.ts'

import { type BlockID, blockIDS, Blocks } from '../shared/BlocksRegistry.ts'
import { HashMap } from '../shared/HashMap.ts'
import { itemIDToBlockID } from '../shared/ItemRegistry.ts'
import { Maybe } from '../shared/Maybe.ts'
import { pipe } from '../shared/Pipe.ts'
import bedrockTextureImg from '../static/textures/blocks/bedrock.png?no-inline'
import coalOreTextureImg from '../static/textures/blocks/coal_ore.png?no-inline'
import diamondOreTextureImg from '../static/textures/blocks/diamond_ore.png?no-inline'
import dirtTextureImg from '../static/textures/blocks/dirt.png?no-inline'
import grassBlockSideTextureImg from '../static/textures/blocks/grass_block_side.png?no-inline'
import grassBlockTopTextureImg from '../static/textures/blocks/grass_block_top.png?no-inline'
import gravelTextureImg from '../static/textures/blocks/gravel.png?no-inline'
import ironOreTextureImg from '../static/textures/blocks/iron_ore.png?no-inline'
import oakLeavesTextureImg from '../static/textures/blocks/oak_leaves.png?no-inline'
import oakLogTopTextureImg from '../static/textures/blocks/oak_log_top.png?no-inline'
import oakLogTextureImg from '../static/textures/blocks/oak_log.png?no-inline'
import sandTextureImg from '../static/textures/blocks/sand.png?no-inline'
import stoneTextureImg from '../static/textures/blocks/stone.png?no-inline'

type BlockClientData = {
  [key in Side]: string
} & {
  name: string
}

type Side = 'back' | 'bottom' | 'front' | 'left' | 'right' | 'top'

const blocksTextureMap: Record<BlockID, Omit<BlockClientData, 'name'>> = {
  [Blocks.Bedrock.id]: {
    back: bedrockTextureImg,
    bottom: bedrockTextureImg,
    front: bedrockTextureImg,
    left: bedrockTextureImg,
    right: bedrockTextureImg,
    top: bedrockTextureImg,
  },
  [Blocks.CoalOre.id]: {
    back: coalOreTextureImg,
    bottom: coalOreTextureImg,
    front: coalOreTextureImg,
    left: coalOreTextureImg,
    right: coalOreTextureImg,
    top: coalOreTextureImg,
  },
  [Blocks.DiamondOre.id]: {
    back: diamondOreTextureImg,
    bottom: diamondOreTextureImg,
    front: diamondOreTextureImg,
    left: diamondOreTextureImg,
    right: diamondOreTextureImg,
    top: diamondOreTextureImg,
  },
  [Blocks.Dirt.id]: {
    back: dirtTextureImg,
    bottom: dirtTextureImg,
    front: dirtTextureImg,
    left: dirtTextureImg,
    right: dirtTextureImg,
    top: dirtTextureImg,
  },
  [Blocks.Grass.id]: {
    back: grassBlockSideTextureImg,
    bottom: dirtTextureImg,
    front: grassBlockSideTextureImg,
    left: grassBlockSideTextureImg,
    right: grassBlockSideTextureImg,
    top: grassBlockTopTextureImg,
  },
  [Blocks.Gravel.id]: {
    back: gravelTextureImg,
    bottom: gravelTextureImg,
    front: gravelTextureImg,
    left: gravelTextureImg,
    right: gravelTextureImg,
    top: gravelTextureImg,
  },
  [Blocks.IronOre.id]: {
    back: ironOreTextureImg,
    bottom: ironOreTextureImg,
    front: ironOreTextureImg,
    left: ironOreTextureImg,
    right: ironOreTextureImg,
    top: ironOreTextureImg,
  },
  [Blocks.OakLeaves.id]: {
    back: oakLeavesTextureImg,
    bottom: oakLeavesTextureImg,
    front: oakLeavesTextureImg,
    left: oakLeavesTextureImg,
    right: oakLeavesTextureImg,
    top: oakLeavesTextureImg,
  },
  [Blocks.OakLog.id]: {
    back: oakLogTextureImg,
    bottom: oakLogTopTextureImg,
    front: oakLogTextureImg,
    left: oakLogTextureImg,
    right: oakLogTextureImg,
    top: oakLogTopTextureImg,
  },
  [Blocks.Sand.id]: {
    back: sandTextureImg,
    bottom: sandTextureImg,
    front: sandTextureImg,
    left: sandTextureImg,
    right: sandTextureImg,
    top: sandTextureImg,
  },
  [Blocks.Stone.id]: {
    back: stoneTextureImg,
    bottom: stoneTextureImg,
    front: stoneTextureImg,
    left: stoneTextureImg,
    right: stoneTextureImg,
    top: stoneTextureImg,
  },
}

export interface TexturesRegistry {
  readonly atlas: Texture<HTMLCanvasElement>
  getItemTexture(itemID: number): string
  getUVForBlockSide(blockID: number, side: Side): RawVector2
  readonly tilesPerRow: number
}

export const createTexturesRegistry = async (): Promise<TexturesRegistry> => {
  const texturesCache = new HashMap<string, HTMLImageElement>()
  const loadedTextures = new HashMap<number, HashMap<Side, HTMLImageElement>>()

  const loader = new TextureLoader()

  // LOAD TEXTURES
  for (const stringID of Object.keys(blocksTextureMap)) {
    const id = Number(stringID)
    const textures = blocksTextureMap[id]
    const map = new HashMap<Side, HTMLImageElement>()

    for (const side of Object.keys(textures) as Side[]) {
      if (texturesCache.has(textures[side])) {
        map.set(side, texturesCache.get(textures[side]).unwrap())
        console.log(`Reused cached texture for block ${id} side ${side} from ${textures[side]}`)
        continue
      }

      const texture = await loader.loadAsync(textures[side])
      console.log(`Loaded texture for block ${id} side ${side} from ${textures[side]}`)
      map.set(side, texture.image)
      texturesCache.set(textures[side], texture.image)
    }

    loadedTextures.set(id, map)
  }

  console.log(`Loaded ${loadedTextures.size()} block textures.`, loadedTextures)

  // BUILD ATLAS
  const tileSize = 16
  const tilesPerRow = Math.ceil(Math.sqrt(loadedTextures.size() * 6))
  const atlasSize = tilesPerRow * tileSize

  const canvas = document.createElement('canvas')
  canvas.width = atlasSize
  canvas.height = atlasSize
  const ctx2d = Maybe.from(canvas.getContext('2d', { alpha: true })).expect(
    '2D context is not supported',
  )

  // Clear canvas (transparent by default when alpha: true)
  ctx2d.clearRect(0, 0, atlasSize, atlasSize)

  let i = 0

  const uvMap = new HashMap<number, HashMap<Side, RawVector2>>()
  for (const blockID of loadedTextures.keys()) {
    for (const side of loadedTextures.get(blockID).unwrap().keys()) {
      const x = (i % tilesPerRow) * tileSize
      const y = Math.floor(i / tilesPerRow) * tileSize

      const img = loadedTextures
        .get(blockID)
        .expect(`Missing textures for block ${blockID}`)
        .get(side)
        .expect(`Missing image for block ${blockID} side ${side}`)

      uvMap
        .getOrSet(blockID, () => new HashMap<Side, RawVector2>())
        .set(side, {
          x: x / atlasSize,
          y: y / atlasSize,
        })

      ctx2d.drawImage(img, x, y, tileSize, tileSize)

      i++
    }
  }

  const atlasTexture = new Texture(canvas)
  atlasTexture.needsUpdate = true
  atlasTexture.magFilter = NearestFilter
  atlasTexture.minFilter = NearestFilter
  atlasTexture.flipY = false // Don't flip the texture

  const getUVForBlockSide = (blockID: number, side: Side): RawVector2 => {
    const blockMap = uvMap.get(blockID)
    if (blockMap.isNone()) {
      console.error(`No UV mapping for block ID ${blockID}`)
      console.error('Available block IDs:', Array.from(uvMap.keys()))
      throw new Error(`No UV mapping for block ID ${blockID}`)
    }
    const uv = blockMap.value().get(side)
    if (uv.isNone()) {
      console.error(`No UV mapping for block ID ${blockID} side ${side}`)
      console.error(`Available sides for block ${blockID}:`, Array.from(blockMap.value().keys()))
      throw new Error(`No UV mapping for block ID ${blockID} side ${side}`)
    }
    return uv.value()
  }

  const createItemTextureForBlock = (blockID: number): string => {
    const size = 64
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx2d = Maybe.from(canvas.getContext('2d', { alpha: true })).expect(
      '2D context is not supported',
    )

    ctx2d.imageSmoothingEnabled = false

    const uvFront = getUVForBlockSide(blockID, 'front')
    const tilePixelSize = atlasSize / tilesPerRow

    // Simple centered block texture
    const blockSize = size * 0.85
    const offset = (size - blockSize) / 2

    // Draw main front face
    ctx2d.drawImage(
      atlasTexture.image,
      uvFront.x * atlasSize,
      uvFront.y * atlasSize,
      tilePixelSize,
      tilePixelSize,
      offset,
      offset,
      blockSize,
      blockSize,
    )

    return canvas.toDataURL()
  }

  const itemTexturesMap = pipe(
    blockIDS.map((id) => ({ id, texture: createItemTextureForBlock(id) })),
  )
    .iterToMap<number, string>(({ id, texture }) => [id, texture])
    .value()

  const getItemTexture = (itemID: number): string => {
    return pipe(itemIDToBlockID(itemID).expect(`No block ID for item ID ${itemID}`))
      .map((blockID) =>
        itemTexturesMap.get(blockID).expect(`No item texture for block ID ${blockID}`),
      )
      .value()
  }

  return {
    atlas: atlasTexture,
    getItemTexture,
    getUVForBlockSide,
    tilesPerRow,
  }
}
