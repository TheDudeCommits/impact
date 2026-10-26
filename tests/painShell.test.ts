import * as T from 'three';
import { describe, expect, it } from 'vitest';
import { applyInkShell } from '../src/render/look/toonShading';
import { preservePainCloakSurface } from '../src/render/look/painShell';
import { shaderPatchKeys } from '../src/render/look/shaderPatch';

function shell(fighter: string, mesh: string) {
  const material = new T.MeshToonMaterial({color:0x081621,side:T.BackSide,depthWrite:false});
  applyInkShell(material,1,.035);
  preservePainCloakSurface(material,fighter,mesh);
  const shader={uniforms:{},vertexShader:T.ShaderLib.toon.vertexShader,fragmentShader:T.ShaderLib.toon.fragmentShader,defines:{}} as unknown as T.WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader,{} as T.WebGLRenderer);
  return {material,shader};
}
describe('Pain cloak outline clearance',()=>{
  it('keeps screen-space expansion and ink color while moving only the ink behind the cloth',()=>{
    const{material,shader}=shell('pain','body_pain');
    expect(shader.vertexShader).toContain('uInkWidth * uInkScale * inkPixel * inkFar');
    expect(shader.vertexShader).toContain('mvPosition.z -= 0.0350;');
    expect(shader.vertexShader).toContain('mvPosition.xyz *= (painInkDepth + 0.2050) / painInkDepth;');
    expect(shader.fragmentShader).toContain('outgoingLight = uInkColor;');
    expect(material.side).toBe(T.BackSide);expect(material.depthWrite).toBe(false);
    expect(shaderPatchKeys(material)).toEqual(['look-ink-v2','pain-cloak-shell-clearance-v2']);
    material.dispose();
  });
  it('preserves projected outline position at near and distant perspective views',()=>{
    for(const fov of [35,60,85]) for(const aspect of [.5625,1,1.7778]) {
      const camera=new T.PerspectiveCamera(fov,aspect,.01,500);
      for(const depth of [.06,.25,1,4,20,80]) for(const x of [-1.3,0,.7]) {
        const point=new T.Vector4(x,.4,-depth,1);
        const before=point.clone().applyMatrix4(camera.projectionMatrix);
        const scale=(Math.max(-point.z,.05)+.205)/Math.max(-point.z,.05);
        const after=new T.Vector4(point.x*scale,point.y*scale,point.z*scale,1).applyMatrix4(camera.projectionMatrix);
        expect(after.x/after.w).toBeCloseTo(before.x/before.w,10);
        expect(after.y/after.w).toBeCloseTo(before.y/before.w,10);
        expect(after.z/after.w).toBeGreaterThan(before.z/before.w);
      }
    }
  });
  it.each([['minato','body_pain'],['pain','Pain_BlackReceiver'],['pain','body_pain-extra']])('leaves %s / %s unchanged',(fighter,mesh)=>{
    const a=shell(fighter,mesh),b=shell('goku','body');
    expect(a.shader.vertexShader).toBe(b.shader.vertexShader);
    expect(a.material.customProgramCacheKey()).toBe(b.material.customProgramCacheKey());
    a.material.dispose();b.material.dispose();
  });
  it('cannot reuse the ordinary hull program for the corrected cloth',()=>{
    const a=shell('pain','body_pain'),b=shell('goku','body');
    expect(a.material.customProgramCacheKey()).not.toBe(b.material.customProgramCacheKey());
    a.material.dispose();b.material.dispose();
  });
});
