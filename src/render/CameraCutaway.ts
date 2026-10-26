import * as THREE from 'three';
import {stageFadeUniforms,STAGE_FADE_FRAGMENT,STAGE_FADE_VERTEX} from './StageFade';

const uniforms={
 uCutCamera:{value:new THREE.Vector3()},uCutFocus:{value:new THREE.Vector3()},
 uCutFloor:{value:0},uCutRadius:{value:1.35},uCutEnabled:{value:0},
 uCutTarget:{value:new THREE.Vector3()},uCutTargetFrom:{value:1},uCutTargetEnabled:{value:0},
};
const installed=new WeakSet<THREE.Material>();
export function setCameraCutaway(camera:THREE.Vector3,focus:THREE.Vector3,floor:number,radius:number,target?:THREE.Vector3){
 uniforms.uCutCamera.value.copy(camera);uniforms.uCutFocus.value.copy(focus);
 uniforms.uCutFloor.value=floor;uniforms.uCutRadius.value=radius;uniforms.uCutEnabled.value=1;
 if(target){
  const toTarget=camera.distanceTo(target),toFocus=camera.distanceTo(focus);
  uniforms.uCutTarget.value.copy(target);
  uniforms.uCutTargetFrom.value=THREE.MathUtils.clamp(1-toFocus/Math.max(toTarget,1e-3)+.05,.06,1);
  uniforms.uCutTargetEnabled.value=1;
 }else uniforms.uCutTargetEnabled.value=0;
}
export function resetCameraCutaway(){uniforms.uCutEnabled.value=0;uniforms.uCutTargetEnabled.value=0;}
export function coverStage(occluders:readonly THREE.Object3D[]){
 let root:THREE.Object3D|null=occluders[0]??null;if(!root)return 0;
 while(root.parent&&!(root.parent as THREE.Scene).isScene)root=root.parent;
 let added=0;
 root.traverse(object=>{
  const mesh=object as THREE.Mesh;if(!mesh.isMesh||!mesh.material)return;
  for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
   if(installed.has(material)||(material as THREE.ShaderMaterial).isShaderMaterial||material.visible===false)continue;
   installCameraCutaway(material);added++;
  }
 });
 return added;
}
export function installCameraCutaway(material:THREE.Material){
 if(installed.has(material))return;installed.add(material);
 const previous=material.onBeforeCompile,cache=material.customProgramCacheKey.bind(material);
 material.onBeforeCompile=function(shader,renderer){
  previous.call(this,shader,renderer);Object.assign(shader.uniforms,uniforms,stageFadeUniforms);
  shader.vertexShader='varying vec3 vCutWorld;\nvarying vec3 vStageClip;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
   vec4 cutLocal=vec4(transformed,1.0);
   #ifdef USE_INSTANCING
    cutLocal=instanceMatrix*cutLocal;
   #endif
   vCutWorld=(modelMatrix*cutLocal).xyz;
   #include <project_vertex>`+STAGE_FADE_VERTEX);
  shader.fragmentShader=`varying vec3 vCutWorld;
   uniform vec3 uCutCamera,uCutFocus,uCutTarget;
   uniform float uCutFloor,uCutRadius,uCutEnabled,uCutTargetFrom,uCutTargetEnabled;\n`+STAGE_FADE_FRAGMENT+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
   float cutDither=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(0.06711056,0.00583715))));
   if(uCutEnabled>0.5 && vCutWorld.y>uCutFloor+0.035){
    vec3 ray=uCutCamera-uCutFocus;
    float lengthSquared=max(dot(ray,ray),0.001);
    float along=dot(vCutWorld-uCutFocus,ray)/lengthSquared;
    if(along>0.06 && along<1.12){
     float distanceToView=length(vCutWorld-(uCutFocus+ray*along));
     float coverage=smoothstep(uCutRadius*0.82,uCutRadius,distanceToView);
     if(coverage<cutDither)discard;
    }
    if(uCutTargetEnabled>0.5){
     vec3 toLens=uCutCamera-uCutTarget;
     float reach=dot(vCutWorld-uCutTarget,toLens)/max(dot(toLens,toLens),0.001);
     if(reach>uCutTargetFrom && reach<1.12){
      float distanceToTarget=length(vCutWorld-(uCutTarget+toLens*reach));
      if(smoothstep(uCutRadius*0.82,uCutRadius,distanceToTarget)<cutDither)discard;
     }
    }
   }
   if(stageDrop(vCutWorld)>cutDither)discard;
   #include <opaque_fragment>`);
 };
 material.customProgramCacheKey=()=>cache()+'-player-cutaway-v3';material.needsUpdate=true;
}
