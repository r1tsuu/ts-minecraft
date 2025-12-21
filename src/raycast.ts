import * as THREE from "three";
import type { PlayerConfig, World } from "./types.ts";
import { CHUNK_SIZE, WORLD_HEIGHT } from "./util.ts";

export const createRaycaster = ({
  // player,
  camera,
  world,
  scene,
}: {
  player: PlayerConfig;
  world: World;
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
}) => {
  const raycaster = new THREE.Raycaster();
  raycaster.far = 8;

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xff0000 })
  );
  scene.add(mesh);

  const getLookingAtBlock = (): {
    position: THREE.Vector3;
    face: THREE.Vector3;
  } | null => {
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.intersectObjects(
      Array.from(world.blockMeshes.values()),
      true
    );

    if (intersects.length === 0) {
      return null;
    }

    const intersect = intersects[0];
    const point = intersect.point;
    const normal = intersect.face?.normal;

    console.log(intersect);
    if (!normal) {
      return null;
    }

    const position = new THREE.Vector3(
      Math.floor(point.x + normal.x * 0.5),
      Math.floor(point.y + normal.y * 0.5),
      Math.floor(point.z + normal.z * 0.5)
    );

    mesh.position.copy(position);

    return { position, face: normal };
  };

  return {
    getLookingAtBlock,
  };
};
