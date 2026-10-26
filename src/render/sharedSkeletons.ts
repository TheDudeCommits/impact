import * as THREE from 'three';

export function shareSkeletons(root: THREE.Object3D) {
  const kept: THREE.Skeleton[] = [];
  root.traverse(o => {
    const mesh = o as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh || !mesh.skeleton) return;
    const own = mesh.skeleton;
    const same = kept.find(s => s.bones.length === own.bones.length && s.bones.every((bone, i) => bone === own.bones[i])
      && (s.boneInverses === own.boneInverses || s.boneInverses.every((m, i) => m.equals(own.boneInverses[i]))));
    if (same) { mesh.skeleton = same; if (same !== own) own.dispose(); } else kept.push(own);
  });
  return kept.length;
}

export function disposeSkeletons(root: THREE.Object3D) {
  const done = new Set<THREE.Skeleton>();
  root.traverse(o => { const skeleton = (o as THREE.SkinnedMesh).isSkinnedMesh ? (o as THREE.SkinnedMesh).skeleton : undefined; if (skeleton && !done.has(skeleton)) { done.add(skeleton); skeleton.dispose(); } });
}
