import * as THREE from 'three'

import { HashMap } from '../../shared/HashMap.ts'
import { type Maybe, None, Some } from '../../shared/Maybe.ts'
import { createSystemFactory } from './createSystem.ts'

const FAR = 5

export type RaycastingSystem = ReturnType<typeof raycastingSystemFactory>

export const raycastingSystemFactory = createSystemFactory((ctx) => {
  let maybeLookingAtBlock: Maybe<THREE.Vector3> = None()
  let maybeLookingAtNormal: Maybe<THREE.Vector3> = None()

  const blockPositionMap = new HashMap<number, THREE.Vector3>()
  const mesh: THREE.Mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.01, 1.01, 1.01),
    new THREE.MeshStandardMaterial({ opacity: 0.5, transparent: true }),
  )

  const raycaster: THREE.Raycaster = new THREE.Raycaster()
  const raycastingMesh: THREE.InstancedMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshPhongMaterial({
      visible: false,
    }),
    (FAR * 2 + 1) ** 3,
  )

  const getPlacementPosition = (): Maybe<THREE.Vector3> => {
    if (!maybeLookingAtBlock.isSome() || !maybeLookingAtNormal.isSome()) return None()
    const lookingAtBlock = maybeLookingAtBlock.value()
    const lookingAtNormal = maybeLookingAtNormal.value()

    return Some(
      new THREE.Vector3(
        lookingAtBlock.x + lookingAtNormal.x,
        lookingAtBlock.y + lookingAtNormal.y,
        lookingAtBlock.z + lookingAtNormal.z,
      ),
    )
  }

  ctx.onUpdate(() => {
    ctx.gameLoop.scene.remove(mesh)

    raycaster.setFromCamera(new THREE.Vector2(0, 0), ctx.gameLoop.camera)

    let index = 0
    const matrix = new THREE.Matrix4()
    blockPositionMap.clear()

    const clientPlayer = ctx.gameLoop.getClientPlayer()

    for (let x = -FAR; x <= FAR; x++) {
      for (let y = -FAR; y <= FAR; y++) {
        for (let z = -FAR; z <= FAR; z++) {
          const worldX = Math.floor(clientPlayer.position.x + x)
          const worldY = Math.floor(clientPlayer.position.y + y)
          const worldZ = Math.floor(clientPlayer.position.z + z)

          if (ctx.gameLoop.world.getBlock(worldX, worldY, worldZ).isNone()) continue

          const position = new THREE.Vector3(worldX, worldY, worldZ)
          matrix.setPosition(worldX, worldY, worldZ)
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
      intersects.object instanceof THREE.InstancedMesh &&
      typeof intersects.instanceId === 'number'
    ) {
      const maybePosition = blockPositionMap.get(intersects.instanceId)

      if (maybePosition.isSome()) {
        const position = maybePosition.value()
        mesh.position.set(position.x, position.y, position.z)
        ctx.gameLoop.scene.add(mesh)

        maybeLookingAtBlock = Some(position.clone())

        // Calculate the normal of the face that was hit
        if (intersects.face) {
          const normal = intersects.face.normal.clone()
          maybeLookingAtNormal = Some(
            new THREE.Vector3(Math.round(normal.x), Math.round(normal.y), Math.round(normal.z)),
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

  const getLookingAtBlock = (): Maybe<THREE.Vector3> => maybeLookingAtBlock
  const getLookingAtNormal = (): Maybe<THREE.Vector3> => maybeLookingAtNormal

  return {
    getLookingAtBlock,
    getLookingAtNormal,
    getPlacementPosition,
    name: 'RaycastingSystem',
  }
})
