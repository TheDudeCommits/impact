import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { shareTextures } from './sharedTextures';
import { capTextures, currentTextureCap } from './textureCap';

type WithDecoder = GLTFLoader & { meshoptDecoder?: unknown };
const parse = GLTFLoader.prototype.parse;
if (!(parse as { meshopt?: boolean }).meshopt) {
  const withDecoder = function (this: WithDecoder, ...[data, path, onLoad, onError]: Parameters<GLTFLoader['parse']>) {
    if (!this.meshoptDecoder) this.setMeshoptDecoder(MeshoptDecoder);
    return parse.call(this, data, path, gltf => {
      try { shareTextures(gltf); } catch (error) { console.warn('[textures] not shared', error); }
      if (Number.isFinite(currentTextureCap())) void capTextures(gltf).catch(() => 0).then(() => onLoad(gltf));
      else onLoad(gltf);
    }, onError);
  };
  (withDecoder as { meshopt?: boolean }).meshopt = true;
  GLTFLoader.prototype.parse = withDecoder;
}
