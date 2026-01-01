import {
  BoxGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshPhongMaterial,
  MeshStandardMaterial,
  Raycaster,
  Vector2,
  Vector3,
} from 'three'

import { HashMap } from '../../shared/HashMap.ts'
import { type Maybe, None, Some } from '../../shared/Maybe.ts'
import { createSystemFactory } from './createSystem.ts'

const FAR = 5

export interface RaycastingSystem {
  getLookingAtBlock(): Maybe<Vector3>
  getLookingAtNormal(): Maybe<Vector3>
  getPlacementPosition(): Maybe<Vector3>
}

export const raycastingSystemFactory = createSystemFactory((ctx) => {
  let maybeLookingAtBlock: Maybe<Vector3> = None()
  let maybeLookingAtNormal: Maybe<Vector3> = None()

  const blockPositionMap = new HashMap<number, Vector3>()
  const mesh: Mesh = new Mesh(
    new BoxGeometry(1.01, 1.01, 1.01),
    new MeshStandardMaterial({ opacity: 0.5, transparent: true }),
  )

  const raycaster: Raycaster = new Raycaster()
  const raycastingMesh: InstancedMesh = new InstancedMesh(
    new BoxGeometry(1, 1, 1),
    new MeshPhongMaterial({
      visible: false,
    }),
    (FAR * 2 + 1) ** 3,
  )

  const getPlacementPosition = (): Maybe<Vector3> => {
    if (!maybeLookingAtBlock.isSome() || !maybeLookingAtNormal.isSome()) return None()
    const lookingAtBlock = maybeLookingAtBlock.value()
    const lookingAtNormal = maybeLookingAtNormal.value()

    return Some(
      new Vector3(
        lookingAtBlock.x + lookingAtNormal.x,
        lookingAtBlock.y + lookingAtNormal.y,
        lookingAtBlock.z + lookingAtNormal.z,
      ),
    )
  }

  ctx.onUpdate(() => {
    ctx.scene.remove(mesh)

    raycaster.setFromCamera(new Vector2(0, 0), ctx.camera)

    let index = 0
    const matrix = new Matrix4()
    blockPositionMap.clear()

    const clientPlayer = ctx.getClientPlayer()

    for (let x = -FAR; x <= FAR; x++) {
      for (let y = -FAR; y <= FAR; y++) {
        for (let z = -FAR; z <= FAR; z++) {
          const worldX = Math.floor(clientPlayer.position.x + x)
          const worldY = Math.floor(clientPlayer.position.y + y)
          const worldZ = Math.floor(clientPlayer.position.z + z)

          if (ctx.world.getBlockAt(worldX, worldY, worldZ).isNone()) continue

          const position = new Vector3(worldX, worldY, worldZ)
          matrix.setPosition(worldX + 0.5, worldY + 0.5, worldZ + 0.5)
          raycastingMesh.setMatrixAt(index, matrix)
          blockPositionMap.set(index, position)
          index++
        }
      }
    }

    // Set unused instances far away to avoid raycasting them
    for (let i = index; i < raycastingMesh.count; i++) {
      matrix.setPosition(0, -1000, 0)
      raycastingMesh.setMatrixAt(i, matrix)
    }

    raycastingMesh.instanceMatrix.needsUpdate = true
    raycastingMesh.computeBoundingSphere()
    raycastingMesh.computeBoundingBox()

    const [intersects] = raycaster.intersectObject(raycastingMesh, false)

    if (
      intersects &&
      intersects.object instanceof InstancedMesh &&
      typeof intersects.instanceId === 'number'
    ) {
      const maybePosition = blockPositionMap.get(intersects.instanceId)

      if (maybePosition.isSome()) {
        const position = maybePosition.value()

        mesh.position.set(position.x + 0.5, position.y + 0.5, position.z + 0.5) // Center the box
        ctx.scene.add(mesh)

        maybeLookingAtBlock = Some(position.clone())

        // Calculate the normal of the face that was hit
        if (intersects.face) {
          const normal = intersects.face.normal.clone()
          maybeLookingAtNormal = Some(
            new Vector3(Math.round(normal.x), Math.round(normal.y), Math.round(normal.z)),
          )
        } else {
          maybeLookingAtNormal = None()
        }
      } else {
        maybeLookingAtBlock = None()
        maybeLookingAtNormal = None()
      }
    } else {
      maybeLookingAtBlock = None()
      maybeLookingAtNormal = None()
    }
  })

  const api: RaycastingSystem = {
    getLookingAtBlock: () => maybeLookingAtBlock,
    getLookingAtNormal: () => maybeLookingAtNormal,
    getPlacementPosition,
  }

  return {
    api,
    name: 'RaycastingSystem',
  }
})
