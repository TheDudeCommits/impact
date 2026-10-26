import type * as THREE from 'three';

export const LENS_NEAR = `
float lensNear( vec3 centre ) { return clamp( ( distance( centre, cameraPosition ) - 1.8 ) / 3.0, 0.0, 1.0 ); }`;

export function shrinkNearLens<M extends THREE.Material>(material: M): M {
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', `${LENS_NEAR}\nvoid main() {`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\ttransformed *= lensNear( ( modelMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz );');
  };
  material.customProgramCacheKey = () => 'survival-lens-near';
  return material;
}
