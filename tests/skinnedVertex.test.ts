import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { installSkinnedBounds } from '../src/render/skinnedBounds';

const original = THREE.SkinnedMesh.prototype.applyBoneTransform;
installSkinnedBounds();
const patched = THREE.SkinnedMesh.prototype.applyBoneTransform;

function rig() {
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [], indices: number[] = [], weights: number[] = [];
  for (let i = 0; i < 24; i++) {
    positions.push(Math.sin(i * 1.7) * 1.3, i * .11 - 1, Math.cos(i * 2.3) * .9);
    indices.push(0, 1, 2, i % 3);
    const a = (i % 5) / 10, b = .5 - a / 2;
    weights.push(.5 + a / 2, b, .25 - a / 4, a / 4 - .25 / 5 + .05);
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  const bones = [0, 1, 2].map(() => new THREE.Bone());
  bones[1].position.set(0, 1, 0); bones[2].position.set(.3, .8, 0);
  bones[0].add(bones[1]); bones[1].add(bones[2]);
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial());
  mesh.add(bones[0]);
  mesh.bind(new THREE.Skeleton(bones));
  bones[0].rotation.set(.3, -.4, .2); bones[1].rotation.set(-.6, .2, .5); bones[2].rotation.set(.1, .9, -.3);
  mesh.position.set(2, -1, .5); mesh.scale.setScalar(1.7);
  mesh.updateMatrixWorld(true);
  return mesh;
}

describe('SkinnedMesh.applyBoneTransform', () => {
  it('is replaced', () => { expect(patched).not.toBe(original); });
  it('answers what three answers, for a Vector3 and for a Vector4', () => {
    const mesh = rig();
    for (let i = 0; i < 24; i++) {
      const a = new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position as THREE.BufferAttribute, i), b = a.clone();
      original.call(mesh, i, a); patched.call(mesh, i, b);
      expect(b.toArray()).toEqual(a.toArray());
      const c = new THREE.Vector4(1, 2, 3, 1), d = c.clone();
      original.call(mesh, i, c); patched.call(mesh, i, d);
      expect(d.toArray()).toEqual(c.toArray());
    }
  });
  it('does not iterate its target (the spread that allocated)', () => {
    const mesh = rig(), v = new THREE.Vector3(), proto = THREE.Vector3.prototype as unknown as Record<symbol, unknown>, iterator = proto[Symbol.iterator];
    let iterated = 0;
    proto[Symbol.iterator] = function* (this: THREE.Vector3) { iterated++; yield this.x; yield this.y; yield this.z; };
    try { for (let i = 0; i < 24; i++) mesh.getVertexPosition(i, v); } finally { proto[Symbol.iterator] = iterator; }
    expect(iterated).toBe(0);
  });
});
