import * as THREE from "three";
import type { PlayerConfig, World } from "./types.ts";

export const createRaycaster = ({
  camera,
  world,
  scene,
  player,
}: {
  player: PlayerConfig;
  world: World;
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
}) => {
  const raycaster = new THREE.Raycaster();
  raycaster.far = 5;

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.01, 1.01, 1.01),
    new THREE.MeshStandardMaterial({ opacity: 0.5, transparent: true })
  );

  let lastUpdated: null | number = null;

  const update = () => {
    if (lastUpdated !== null && Date.now() - lastUpdated < 50) return;

    scene.remove(mesh);
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

    const [intersects] = raycaster.intersectObjects(
      Array.from(world.blockMeshes.values()),
      false
    );

    if (
      intersects &&
      intersects.object instanceof THREE.InstancedMesh &&
      typeof intersects.instanceId === "number"
    ) {
      const matrix = new THREE.Matrix4();
      intersects.object.getMatrixAt(intersects.instanceId, matrix);
      const poistion = new THREE.Vector3().setFromMatrixPosition(matrix);
      mesh.position.set(poistion.x, poistion.y, poistion.z);
      scene.add(mesh);
    }

    lastUpdated = Date.now();
  };

  return {
    update,
  };
};
