import * as THREE from 'three';
import { MeshoptSimplifier } from 'three/examples/jsm/libs/meshopt_simplifier.module.js';

export async function distantGeometry(source: THREE.BufferGeometry) {
  if (!MeshoptSimplifier.supported || !source.index || source.index.count < 6000 || !source.attributes.skinIndex || !source.attributes.skinWeight || !source.attributes.normal) return undefined;
  await MeshoptSimplifier.ready;
  const p = source.attributes.position, n = source.attributes.normal, uv = source.attributes.uv;
  const joints = source.attributes.skinIndex, skin = source.attributes.skinWeight;
  const positions = new Float32Array(p.count * 3), attributes = new Float32Array(p.count * 13);
  for (let i = 0; i < p.count; i++) {
    positions.set([p.getX(i), p.getY(i), p.getZ(i)], i * 3);
    const a = i * 13;
    attributes[a] = n.getX(i); attributes[a + 1] = n.getY(i); attributes[a + 2] = n.getZ(i);
    attributes[a + 3] = uv?.getX(i) ?? 0; attributes[a + 4] = uv?.getY(i) ?? 0;
    for (let k = 0; k < 4; k++) {
      attributes[a + 5 + k] = joints.getComponent(i, k);
      attributes[a + 9 + k] = skin.getComponent(i, k);
    }
  }
  const [index] = MeshoptSimplifier.simplifyWithAttributes(
    Uint32Array.from(source.index.array), positions, 3, attributes, 13,
    [.2, .2, .2, 1, 1, .05, .05, .05, .05, 1, 1, 1, 1], null,
    Math.floor(source.index.count * .4 / 3) * 3, .012,
  );
  if (index.length >= source.index.count * .85) return undefined;
  const coarse = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(source.attributes)) {
    if (attribute instanceof THREE.InterleavedBufferAttribute) coarse.setAttribute(name, attribute.clone());
    else coarse.setAttribute(name, new THREE.BufferAttribute(attribute.array, attribute.itemSize, attribute.normalized));
  }
  coarse.setIndex(new THREE.BufferAttribute(p.count > 65535 ? index : Uint16Array.from(index), 1));
  coarse.boundingBox = source.boundingBox?.clone() ?? null;
  coarse.boundingSphere = source.boundingSphere?.clone() ?? null;
  return coarse;
}

export function useDistantMesh(distance: number, height: number, wasDistant: boolean) {
  return distance > Math.max(13, height * 8) + (wasDistant ? -1.5 : 1.5);
}
