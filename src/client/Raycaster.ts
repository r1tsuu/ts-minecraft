import * as THREE from 'three'

import type { Player } from './Player.ts'
import type { World } from './World.ts'

const FAR = 5

export class Raycaster {
  private lastUpdated: null | number = null
  private mesh: THREE.Mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.01, 1.01, 1.01),
    new THREE.MeshStandardMaterial({ opacity: 0.5, transparent: true }),
  )
  private raycaster: THREE.Raycaster = new THREE.Raycaster()
  private raycastingMesh: THREE.InstancedMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshPhongMaterial({
      color: THREE.Color.NAMES.black,
      wireframe: true, // debug
    }),
    (FAR * 2 + 1) ** 3,
  )

  constructor(
    private camera: THREE.PerspectiveCamera,
    private player: Player,
    private scene: THREE.Scene,
    private world: World,
  ) {
    this.scene.add(this.raycastingMesh)
  }

  update() {
    if (this.lastUpdated !== null && Date.now() - this.lastUpdated < 20) return

    this.scene.remove(this.mesh)

    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera)

    let index = 0
    const matrix = new THREE.Matrix4()

    for (let x = -FAR; x <= FAR; x++) {
      for (let y = -FAR; y <= FAR; y++) {
        for (let z = -FAR; z <= FAR; z++) {
          const worldX = Math.floor(this.player.position.x + x)
          const worldY = Math.floor(this.player.position.y + y)
          const worldZ = Math.floor(this.player.position.z + z)

          if (!this.world.getBlock(worldX, worldY, worldZ)) continue

          matrix.setPosition(worldX, worldY, worldZ)
          this.raycastingMesh.setMatrixAt(index, matrix)
          index++
        }
      }
    }

    this.raycastingMesh.instanceMatrix.needsUpdate = true
    this.raycastingMesh.computeBoundingSphere()
    this.raycastingMesh.computeBoundingBox()

    const [intersects] = this.raycaster.intersectObject(this.raycastingMesh, false)

    if (
      intersects &&
      intersects.object instanceof THREE.InstancedMesh &&
      typeof intersects.instanceId === 'number'
    ) {
      const matrix = new THREE.Matrix4()
      intersects.object.getMatrixAt(intersects.instanceId, matrix)
      const poistion = new THREE.Vector3().setFromMatrixPosition(matrix)
      this.mesh.position.set(poistion.x, poistion.y, poistion.z)
      this.scene.add(this.mesh)
    }

    this.lastUpdated = Date.now()
  }
}
