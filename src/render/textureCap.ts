import type * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Settings } from '../config';

export const textureCapFor = (quality: Settings['quality']): number => quality === 'low' ? 1024 : quality === 'medium' ? 2048 : Infinity;

let cap = Infinity;
export const setTextureCap = (side: number) => { cap = side; };
export const currentTextureCap = () => cap;

type Bitmapish = { width: number; height: number; close?: () => void };

export async function capTextures(gltf: GLTF, side: number = cap, patience = 8000): Promise<number> {
  if (!Number.isFinite(side) || typeof createImageBitmap !== 'function') return 0;
  const sources = new Map<THREE.Texture['source'], THREE.Texture[]>();
  for (const scene of gltf.scenes?.length ? gltf.scenes : [gltf.scene]) scene.traverse(o => {
    const material = (o as THREE.Mesh).material; if (!material) return;
    for (const m of [material].flat()) for (const value of Object.values(m)) {
      const texture = value as THREE.Texture | null;
      if (!texture?.isTexture) continue;
      const list = sources.get(texture.source) ?? []; list.push(texture); sources.set(texture.source, list);
    }
  });
  let shrunk = 0;
  await Promise.all([...sources].map(async ([source, textures]) => {
    const image = source.data as Bitmapish | null | undefined;
    if (!image || !(image.width > side || image.height > side)) return;
    if (typeof ImageBitmap === 'undefined' || !(image instanceof ImageBitmap) && !(typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement)) return;
    const k = side / Math.max(image.width, image.height), width = Math.max(1, Math.round(image.width * k)), height = Math.max(1, Math.round(image.height * k));
    try {
      const small = await Promise.race([
        createImageBitmap(image as ImageBitmap, { resizeWidth: width, resizeHeight: height, resizeQuality: 'high', premultiplyAlpha: 'none', colorSpaceConversion: 'none' }),
        new Promise<never>((_, no) => setTimeout(() => no(new Error('resize timed out')), patience)),
      ]);
      for (const texture of textures) texture.dispose();
      source.data = small; source.needsUpdate = true;
      for (const texture of textures) texture.needsUpdate = true;
      (image as ImageBitmap).close?.();
      shrunk++;
    } catch { }
  }));
  return shrunk;
}
