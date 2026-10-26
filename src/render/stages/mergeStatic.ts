import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { StageId } from '../../game/stages';

export const MERGED_PLACES: ReadonlySet<StageId> = new Set<StageId>(['onigashima', 'hueco-mundo', 'null-realm', 'chunin-exam-room']);

export function mergeStaticMeshes(model: THREE.Object3D): { before: number; after: number } {
  model.updateMatrixWorld(true);
  const toModel = new THREE.Matrix4().copy(model.matrixWorld).invert();
  const groups = new Map<string, THREE.Mesh[]>();
  let before = 0;
  model.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    before++;
    if ((mesh as THREE.InstancedMesh).isInstancedMesh || (mesh as THREE.SkinnedMesh).isSkinnedMesh || !mesh.visible) return;
    if (Array.isArray(mesh.material) || Object.keys(mesh.geometry.morphAttributes).length) return;
    if (mesh.matrixWorld.determinant() < 0) return;
    const geometry = mesh.geometry;
    const attributes = Object.keys(geometry.attributes).sort().map(name => {
      const a = geometry.getAttribute(name) as THREE.BufferAttribute;
      return `${name}:${a.itemSize}:${a.normalized}:${a.array.constructor.name}`;
    }).join(',');
    const key = [mesh.material.uuid, mesh.castShadow, mesh.receiveShadow, mesh.renderOrder, mesh.frustumCulled, mesh.layers.mask,
      !!mesh.userData.placeCaster, !!geometry.index, attributes].join('|');
    const list = groups.get(key);
    if (list) list.push(mesh); else groups.set(key, [mesh]);
  });
  let removed = 0;
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const parts = list.map(mesh => mesh.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(toModel, mesh.matrixWorld)));
    const geometry = mergeGeometries(parts, false);
    for (const part of parts) part.dispose();
    if (!geometry) continue;
    const first = list[0];
    const merged = new THREE.Mesh(geometry, first.material);
    merged.name = `merged ${(first.material as THREE.Material).name}`;
    merged.castShadow = first.castShadow; merged.receiveShadow = first.receiveShadow;
    merged.renderOrder = first.renderOrder; merged.frustumCulled = first.frustumCulled;
    merged.layers.mask = first.layers.mask;
    if (first.userData.placeCaster) merged.userData.placeCaster = true;
    model.add(merged);
    for (const mesh of list) { mesh.removeFromParent(); mesh.geometry.dispose(); }
    removed += list.length - 1;
  }
  model.updateMatrixWorld(true);
  return { before, after: before - removed };
}
