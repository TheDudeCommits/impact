import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MERGED_PLACES, mergeStaticMeshes } from '../src/render/stages/mergeStatic';
import { STAGES } from '../src/game/stages';

function corners(model: THREE.Object3D) {
  model.updateMatrixWorld(true);
  const out: string[] = [];
  const v = new THREE.Vector3();
  model.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible) return;
    const position = mesh.geometry.getAttribute('position'), index = mesh.geometry.index;
    const n = index ? index.count : position.count;
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(position, index ? index.getX(i) : i).applyMatrix4(mesh.matrixWorld);
      out.push(`${(mesh.material as THREE.Material).name} ${v.x.toFixed(4)} ${v.y.toFixed(4)} ${v.z.toFixed(4)}`);
    }
  });
  return out.sort();
}

function place() {
  const model = new THREE.Group();
  model.position.set(3, -2, 5); model.rotation.y = .7;
  const a = new THREE.MeshStandardMaterial({ name: 'a' }), b = new THREE.MeshStandardMaterial({ name: 'b' });
  const piece = (material: THREE.Material, x: number, rot: number, scale: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 3), material);
    mesh.position.set(x, x * .5, -x); mesh.rotation.set(rot, rot * 2, 0); mesh.scale.set(scale, 1, scale * 1.5);
    mesh.receiveShadow = true;
    model.add(mesh);
    return mesh;
  };
  piece(a, 0, 0, 1); piece(a, 4, .4, 2); piece(a, -6, 1.1, .5); piece(b, 2, .2, 1);
  const hidden = piece(a, 9, 0, 1); hidden.visible = false;
  const caster = piece(a, -9, 0, 1); caster.castShadow = true;
  return { model, hidden, caster };
}

describe('the speed pass: a place of many pieces merged by material', () => {
  it('draws the same triangles in the same places in fewer meshes', () => {
    const { model } = place();
    const before = corners(model);
    expect(mergeStaticMeshes(model)).toEqual({ before: 6, after: 4 });
    expect(corners(model)).toEqual(before);
    const meshes: THREE.Mesh[] = [];
    model.traverse(o => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
    expect(meshes).toHaveLength(4);
    expect(meshes.filter(m => m.name === 'merged a')).toHaveLength(1);
  });

  it('leaves a hidden piece, a piece with other flags and a material used once as they were', () => {
    const { model, hidden, caster } = place();
    mergeStaticMeshes(model);
    expect(hidden.parent).toBe(model);
    expect(caster.parent).toBe(model);
    const merged = model.children.find(o => o.name === 'merged a') as THREE.Mesh;
    expect(merged.receiveShadow).toBe(true);
    expect(merged.castShadow).toBe(false);
    expect(model.children.some(o => (o as THREE.Mesh).isMesh && ((o as THREE.Mesh).material as THREE.Material).name === 'b' && o.name !== 'merged b')).toBe(true);
  });

  it('leaves a mirrored piece as it is', () => {
    const { model } = place();
    const mirrored = model.children[1] as THREE.Mesh;
    mirrored.scale.x = -2;
    const before = corners(model);
    mergeStaticMeshes(model);
    expect(mirrored.parent).toBe(model);
    expect(corners(model)).toEqual(before);
  });

  it('is only switched on for real places', () => {
    for (const stage of MERGED_PLACES) expect(STAGES[stage]?.model, stage).toBeTruthy();
  });
});
