import * as THREE from 'three'

import { Component } from '../shared/Component.ts'
import { ClientContainer } from './ClientContainer.ts'
import { GameSession } from './GameSession.ts'
import { World_Legacy } from './WorldLegacy.ts'

const FAR = 5

@Component()
export class Raycaster implements Component {
  lookingAtBlock: { x: number; y: number; z: number } | null = null
  lookingAtNormal: { x: number; y: number; z: number } | null = null
  private blockPositionMap: Map<number, THREE.Vector3> = new Map()
  private lastUpdated: null | number = null
  private mesh: THREE.Mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.01, 1.01, 1.01),
    new THREE.MeshStandardMaterial({ opacity: 0.5, transparent: true }),
  )
  private raycaster: THREE.Raycaster = new THREE.Raycaster()

  private raycastingMesh: THREE.InstancedMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshPhongMaterial({
      visible: false,
    }),
    (FAR * 2 + 1) ** 3,
  )

  constructor() {
    const scene = ClientContainer.resolve(THREE.Scene).unwrap()
    scene.add(this.raycastingMesh)
  }

  getPlacementPosition(): { x: number; y: number; z: number } | null {
    if (!this.lookingAtBlock || !this.lookingAtNormal) return null

    return {
      x: this.lookingAtBlock.x + this.lookingAtNormal.x,
      y: this.lookingAtBlock.y + this.lookingAtNormal.y,
      z: this.lookingAtBlock.z + this.lookingAtNormal.z,
    }
  }

  update() {
    if (this.lastUpdated !== null && Date.now() - this.lastUpdated < 20) return

    const scene = ClientContainer.resolve(THREE.Scene).unwrap()
    const camera = ClientContainer.resolve(THREE.PerspectiveCamera).unwrap()
    const player = ClientContainer.resolve(GameSession).unwrap().getCurrentPlayer()
    const world = ClientContainer.resolve(World_Legacy).unwrap()

    scene.remove(this.mesh)

    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), camera)

    let index = 0
    const matrix = new THREE.Matrix4()
    this.blockPositionMap.clear()

    for (let x = -FAR; x <= FAR; x++) {
      for (let y = -FAR; y <= FAR; y++) {
        for (let z = -FAR; z <= FAR; z++) {
          const worldX = Math.floor(player.position.x + x)
          const worldY = Math.floor(player.position.y + y)
          const worldZ = Math.floor(player.position.z + z)

          if (!world.getBlock(worldX, worldY, worldZ)) continue

          const position = new THREE.Vector3(worldX, worldY, worldZ)
          matrix.setPosition(worldX, worldY, worldZ)
          this.raycastingMesh.setMatrixAt(index, matrix)
          this.blockPositionMap.set(index, position)
          index++
        }
      }
    }

    // Set unused instances far away to avoid raycasting them
    for (let i = index; i < this.raycastingMesh.count; i++) {
      matrix.setPosition(0, -1000, 0)
      this.raycastingMesh.setMatrixAt(i, matrix)
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
      const position = this.blockPositionMap.get(intersects.instanceId)

      if (position) {
        this.mesh.position.set(position.x, position.y, position.z)
        scene.add(this.mesh)

        this.lookingAtBlock = {
          x: Math.floor(position.x),
          y: Math.floor(position.y),
          z: Math.floor(position.z),
        }

        // Calculate the normal of the face that was hit
        if (intersects.face) {
          const normal = intersects.face.normal.clone()
          this.lookingAtNormal = {
            x: Math.round(normal.x),
            y: Math.round(normal.y),
            z: Math.round(normal.z),
          }
        } else {
          this.lookingAtNormal = null
        }
      } else {
        this.lookingAtBlock = null
        this.lookingAtNormal = null
      }
    } else {
      this.lookingAtBlock = null
      this.lookingAtNormal = null
    }

    this.lastUpdated = Date.now()
  }
}
