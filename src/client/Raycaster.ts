import * as THREE from 'three'

import { Component } from '../shared/Component.ts'
import { ClientContainer } from './ClientContainer.ts'
import { GameSession } from './GameSession.ts'
import { World } from './World.ts'

const FAR = 5

@Component()
export class Raycaster implements Component {
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

  constructor() {
    const scene = ClientContainer.resolve(THREE.Scene).unwrap()
    scene.add(this.raycastingMesh)
  }

  update() {
    if (this.lastUpdated !== null && Date.now() - this.lastUpdated < 20) return

    const scene = ClientContainer.resolve(THREE.Scene).unwrap()
    const camera = ClientContainer.resolve(THREE.PerspectiveCamera).unwrap()
    const player = ClientContainer.resolve(GameSession).unwrap().getCurrentPlayer()
    const world = ClientContainer.resolve(World).unwrap()

    scene.remove(this.mesh)

    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), camera)

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
      scene.add(this.mesh)
    }

    this.lastUpdated = Date.now()
  }
}
