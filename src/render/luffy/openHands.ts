import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';


export const openHandName = (label: string, side: 'L' | 'R') => `${label}-open-hand-${side}`;

type GLTFJson = { nodes?: { name?: string; mesh?: number }[]; meshes?: { name?: string }[] };

export function closedFist(body: GLTF, root: THREE.Object3D, side: 'L' | 'R') {
  const json = (body as GLTF & { parser?: { json?: GLTFJson } }).parser?.json;
  const prefix = side === 'L' ? 'l_hand_close' : 'r_hand_close';
  const named = (n: { mesh?: number }) => n.mesh !== undefined ? json?.meshes?.[n.mesh]?.name ?? '' : '';
  const node = json?.nodes?.find((n: { name?: string; mesh?: number }) => named(n).startsWith(prefix) && !named(n).includes('_02'));
  if (!node?.name) return undefined;
  const found = root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(node.name)) as THREE.SkinnedMesh | undefined;
  return found?.isSkinnedMesh ? found : undefined;
}

export function addOpenHands(body: GLTF, hands: GLTF, label: string): number {
  let added = 0;
  for (const side of ['L', 'R'] as const) {
    const name = openHandName(label, side);
    if (body.scene.getObjectByName(name)) continue;
    const fist = closedFist(body, body.scene, side);
    const source = hands.scene.getObjectByName(name) as THREE.Mesh | undefined;
    if (!fist?.parent || !source?.isMesh) continue;
    const indices = fist.geometry.getAttribute('skinIndex'), weights = fist.geometry.getAttribute('skinWeight');
    let joint = indices.getComponent(0, 0), most = weights.getComponent(0, 0);
    for (let k = 1; k < 4; k++) if (weights.getComponent(0, k) > most) { most = weights.getComponent(0, k); joint = indices.getComponent(0, k); }
    const geometry = source.geometry.clone();
    const count = geometry.getAttribute('position').count;
    const skinIndex = new Uint16Array(count * 4), skinWeight = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) { skinIndex[i * 4] = joint; skinWeight[i * 4] = 1; }
    geometry.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndex, 4));
    geometry.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
    const open = new THREE.SkinnedMesh(geometry, fist.material);
    open.name = name;
    open.position.copy(fist.position); open.quaternion.copy(fist.quaternion); open.scale.copy(fist.scale);
    open.bindMode = fist.bindMode;
    open.bind(fist.skeleton, fist.bindMatrix);
    open.castShadow = fist.castShadow; open.receiveShadow = fist.receiveShadow; open.frustumCulled = fist.frustumCulled;
    open.renderOrder = fist.renderOrder;
    open.visible = false;
    fist.parent.add(open);
    added++;
  }
  return added;
}
