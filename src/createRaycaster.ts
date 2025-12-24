import * as THREE from 'three'

import type { PlayerData, World } from './types.ts'

const FAR = 5

export const createRaycaster = ({
  camera,
  player,
  scene,
  world,
}: {
  camera: THREE.PerspectiveCamera
  player: PlayerData
  scene: THREE.Scene
  world: World
}) => {
  const raycaster = new THREE.Raycaster()
  raycaster.far = FAR + 1

  const raycastingMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshPhongMaterial({
      color: THREE.Color.NAMES.black,
      wireframe: true, // debug
    }),
    (FAR * 2 + 1) ** 3,
  )

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.01, 1.01, 1.01),
    new THREE.MeshStandardMaterial({ opacity: 0.5, transparent: true }),
  )

  let lastUpdated: null | number = null
  scene.add(raycastingMesh)

  const update = () => {
    if (lastUpdated !== null && Date.now() - lastUpdated < 20) return

    scene.remove(mesh)

    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera)

    let index = 0
    const matrix = new THREE.Matrix4()

    for (let x = -FAR; x <= FAR; x++) {
      for (let y = -FAR; y <= FAR; y++) {
        for (let z = -FAR; z <= FAR; z++) {
          const worldX = Math.floor(player.position.x + x)
          const worldY = Math.floor(player.position.y + y)
          const worldZ = Math.floor(player.position.z + z)

          if (!world.getBlock(worldX, worldY, worldZ)) continue

          matrix.setPosition(worldX, worldY, worldZ)
          raycastingMesh.setMatrixAt(index, matrix)
          index++
        }
      }
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
      const matrix = new THREE.Matrix4()
      intersects.object.getMatrixAt(intersects.instanceId, matrix)
      const poistion = new THREE.Vector3().setFromMatrixPosition(matrix)
      mesh.position.set(poistion.x, poistion.y, poistion.z)
      scene.add(mesh)
    }

    lastUpdated = Date.now()
  }

  return {
    update,
  }
}
