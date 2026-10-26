import * as THREE from 'three';
import { applyToonShading } from '../look/toonShading';
import { addShaderPatch } from '../look/shaderPatch';
import { airUniforms } from '../look/air';
import { installCameraCutaway } from '../CameraCutaway';

type Shader = THREE.WebGLProgramParametersWithUniforms;

export const GROUND_ANSWERS = {
  uRimPeak: { value: 0 },
  uLookTech: { value: 0 },
  uLookSilhouette: { value: 0 },
  uCookieFighters: { value: 1 },
  uCloudFighters: { value: 1 },
  uToonFlatten: { value: 0 },
  uToonSaturation: { value: 1 },
  uToonNeutral: { value: .45 },
};

export function groundMaterial(name: string, key: string, edit: (shader: Shader) => void, params: THREE.MeshToonMaterialParameters = {}) {
  const material = new THREE.MeshToonMaterial({ name, ...params });
  applyToonShading(material, 'body');
  addShaderPatch(material, key, shader => {
    Object.assign(shader.uniforms, GROUND_ANSWERS, { uAirFog: airUniforms.uAirFog });
    edit(shader);
  });
  optOutOfCutaway(material);
  return material;
}

export function optOutOfCutaway(material: THREE.Material) {
  const compile = material.onBeforeCompile, key = material.customProgramCacheKey;
  installCameraCutaway(material);
  material.onBeforeCompile = compile;
  material.customProgramCacheKey = key;
  material.needsUpdate = true;
}

export function edit(source: string, find: string, replacement: string, label: string) {
  if (!source.includes(find)) {
    console.warn(`ground: shader edit "${label}" did not find ${find}`);
    return source;
  }
  return source.replace(find, replacement);
}

export function withLookHead<T extends THREE.BufferGeometry>(geometry: T): T {
  geometry.setAttribute('lookHead', new THREE.BufferAttribute(new Float32Array(geometry.getAttribute('position').count), 1));
  return geometry;
}
