import * as THREE from 'three';

const released = new WeakSet<THREE.Object3D>();

export function releaseHidden(scene: THREE.Scene, names: readonly string[]) {
  for (const name of names) {
    const root = scene.getObjectByName(name);
    if (!root) continue;
    if (root.visible) { released.delete(root); continue; }
    if (released.has(root)) continue;
    released.add(root);
    const textures = new Set<THREE.Texture>();
    root.traverse(node => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry?.dispose();
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (!material) continue;
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
      }
    });
    for (const texture of textures) texture.dispose();
  }
}
