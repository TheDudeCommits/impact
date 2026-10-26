import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

type Image = THREE.Texture['source'];
const byContent = new Map<string, WeakRef<Image>>();
const holders = new WeakMap<Image, number>();
const contentOf = new WeakMap<Image, string>();
const released = new WeakSet<THREE.Object3D>();
export const textureSharing = { images: 0, shared: 0 };

function eachTexture(root: THREE.Object3D, visit: (texture: THREE.Texture) => void) {
  root.traverse(o => {
    const material = (o as THREE.Mesh).material; if (!material) return;
    for (const m of [material].flat()) for (const value of Object.values(m)) if ((value as THREE.Texture | null)?.isTexture) visit(value as THREE.Texture);
  });
}

export function shareTextures(gltf: GLTF) {
  const mapped = new Map<Image, Image>(), counted = new Set<Image>();
  for (const scene of gltf.scenes?.length ? gltf.scenes : [gltf.scene]) eachTexture(scene, texture => {
    const content = texture.userData?.imageSha; if (typeof content !== 'string') return;
    let shared = mapped.get(texture.source);
    if (!shared) {
      const own = texture.source, here = byContent.get(content)?.deref();
      textureSharing.images++;
      if (here && here !== own && here.data) {
        textureSharing.shared++;
        (own.data as { close?: () => void } | null)?.close?.();
        shared = here;
      } else { shared = own; byContent.set(content, new WeakRef(shared)); contentOf.set(shared, content); }
      mapped.set(own, shared); mapped.set(shared, shared);
    }
    if (!counted.has(shared)) { counted.add(shared); holders.set(shared, (holders.get(shared) ?? 0) + 1); }
    texture.source = shared;
  });
}

export function releaseTextures(root: THREE.Object3D) {
  if (released.has(root)) return; released.add(root);
  const done = new Set<Image>();
  eachTexture(root, texture => {
    const source = texture.source; if (done.has(source)) return; done.add(source);
    const content = contentOf.get(source);
    if (content !== undefined) {
      const left = (holders.get(source) ?? 1) - 1; holders.set(source, left);
      if (left > 0) return;
      if (byContent.get(content)?.deref() === source) byContent.delete(content);
    }
    (source.data as { close?: () => void } | null)?.close?.();
  });
}
