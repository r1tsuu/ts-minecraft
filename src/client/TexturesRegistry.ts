import { NearestFilter, Texture, TextureLoader } from 'three'

import type { RawVector2 } from '../types.ts'

import { type BlockID, Blocks } from '../shared/BlocksRegistry.ts'
import { HashMap } from '../shared/HashMap.ts'
import { Maybe } from '../shared/Maybe.ts'
import { deepMapToObj } from '../shared/util.ts'
import dirtTextureImg from '../static/dirt.png?no-inline'
import grassBlockSideTextureImg from '../static/grass_block_side.png?no-inline'
import grassBlockTopTextureImg from '../static/grass_block_top.png?no-inline'

type BlockClientData = {
  [key in Side]: string
} & {
  name: string
}

type Side = 'back' | 'bottom' | 'front' | 'left' | 'right' | 'top'

const blocksTextureMap: Record<BlockID, Omit<BlockClientData, 'name'>> = {
  [Blocks.Bedrock.id]: {
    back: dirtTextureImg,
    bottom: dirtTextureImg,
    front: dirtTextureImg,
    left: dirtTextureImg,
    right: dirtTextureImg,
    top: dirtTextureImg,
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
  [Blocks.Stone.id]: {
    back: dirtTextureImg,
    bottom: dirtTextureImg,
    front: dirtTextureImg,
    left: dirtTextureImg,
    right: dirtTextureImg,
    top: dirtTextureImg,
  },
}

export interface TexturesRegistry {
  readonly atlas: Texture<HTMLCanvasElement>
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
  const ctx2d = Maybe.from(canvas.getContext('2d')).expect('2D context is not supported')
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

  console.log(deepMapToObj(uvMap))
  const atlasTexture = new Texture(canvas)
  atlasTexture.needsUpdate = true
  atlasTexture.magFilter = NearestFilter
  atlasTexture.minFilter = NearestFilter

  console.log(`Created texture atlas with size ${atlasSize}x${atlasSize}`)
  const getUVForBlockSide = (blockID: number, side: Side): RawVector2 => {
    return uvMap
      .get(blockID)
      .expect(`No UV mapping for block ID ${blockID}`)
      .get(side)
      .expect(`No UV mapping for block ID ${blockID} side ${side}`)
  }

  return {
    atlas: atlasTexture,
    getUVForBlockSide,
    tilesPerRow,
  }
}
