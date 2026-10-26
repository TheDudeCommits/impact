import type { MeshToonMaterial } from 'three';
import { addShaderPatch } from '../look/shaderPatch';
export const GAROU_COSMIC_TEXTURE_FLOOR = 4;
const floors = new WeakMap<MeshToonMaterial, {value:number}>();
export function applyGarouCosmicLook(material: MeshToonMaterial, fighter: string, isForm: boolean, strength=GAROU_COSMIC_TEXTURE_FLOOR) {
  if (fighter !== 'garou' || !isForm || material.name !== 'Cosmic' || !material.map) return false;
  let floor=floors.get(material);
  if(!floor){floor={value:strength};floors.set(material,floor);}
  floor.value=Math.max(0,Math.min(4,Number.isFinite(strength)?strength:GAROU_COSMIC_TEXTURE_FLOOR));
  addShaderPatch(material, 'garou-native-cosmic-texture-v2', shader => {
    shader.uniforms.garouNativeTextureFloor=floor;
    shader.fragmentShader='uniform float garouNativeTextureFloor;\n'+shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <premultiplied_alpha_fragment>', `
#ifdef USE_MAP
  vec3 garouNativeLight = texture2D(map, vMapUv).rgb * garouNativeTextureFloor;
  #if defined(TONE_MAPPING)
    garouNativeLight = toneMapping(garouNativeLight);
  #endif
  garouNativeLight = linearToOutputTexel(vec4(garouNativeLight, 1.0)).rgb;
  gl_FragColor.rgb = max(gl_FragColor.rgb, garouNativeLight);
#endif
#include <premultiplied_alpha_fragment>`);
  });
  return true;
}
