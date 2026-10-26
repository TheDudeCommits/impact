import {describe,it,expect} from 'vitest';
import * as T from 'three';
import {installCameraCutaway,setCameraCutaway,resetCameraCutaway} from '../src/render/CameraCutaway';
describe('camera scenery aperture',()=>{
 it('patches scenery once, supports instances, preserves floors and restores on reset',()=>{
  const material=new T.MeshStandardMaterial(),renderer={} as T.WebGLRenderer;
  installCameraCutaway(material);const key=material.customProgramCacheKey();installCameraCutaway(material);
  expect(material.customProgramCacheKey()).toBe(key);
  const shader={uniforms:{} as Record<string,{value:unknown}>,vertexShader:'#include <project_vertex>',fragmentShader:'#include <opaque_fragment>'};
  material.onBeforeCompile(shader as unknown as T.WebGLProgramParametersWithUniforms,renderer);
  expect(shader.vertexShader).toContain('instanceMatrix*cutLocal');
  expect(shader.fragmentShader).toContain('vCutWorld.y>uCutFloor+0.035');
  expect(shader.fragmentShader).toContain('along>0.06 && along<1.12');
  expect(shader.fragmentShader).toContain('#include <opaque_fragment>');
  setCameraCutaway(new T.Vector3(1,2,3),new T.Vector3(0,1,0),0,1.35);
  expect(shader.uniforms.uCutCamera.value).toEqual(new T.Vector3(1,2,3));
  expect(shader.uniforms.uCutEnabled.value).toBe(1);
  expect(shader.uniforms.uCutTargetEnabled.value).toBe(0);
  setCameraCutaway(new T.Vector3(0,1,-3),new T.Vector3(0,1,0),0,1.35,new T.Vector3(0,1,6));
  expect(shader.uniforms.uCutTargetEnabled.value).toBe(1);
  expect(shader.uniforms.uCutTargetFrom.value as number).toBeCloseTo(1-3/9+.05,6);
  expect(shader.fragmentShader).toContain('reach>uCutTargetFrom && reach<1.12');
  resetCameraCutaway();expect(shader.uniforms.uCutEnabled.value).toBe(0);expect(shader.uniforms.uCutTargetEnabled.value).toBe(0);
  expect(material.transparent).toBe(false);expect(material.depthWrite).toBe(true);
  material.dispose();
 });
});
