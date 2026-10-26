import type { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export function aheadLoader(loader: GLTFLoader, urls: readonly (string | undefined)[]): GLTFLoader {
  const files = new Map<string, Promise<GLTF>>();
  for (const url of urls) {
    if (!url || files.has(url)) continue;
    const file = loader.loadAsync(url);
    file.catch(() => { });
    files.set(url, file);
  }
  const ahead = Object.create(loader) as GLTFLoader;
  ahead.loadAsync = (url: string) => {
    const file = files.get(url) ?? loader.loadAsync(url);
    files.delete(url);
    return file;
  };
  return ahead;
}
