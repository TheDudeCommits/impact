import * as THREE from 'three';
import type {Fighter} from '../Fighter';

const WINDOWS=8;
const JOINTS=['Head','Hips','LeftFoot','RightFoot','LeftShoulder','RightShoulder']as const;
export class NeteroVisibility{
 private subjects:Fighter[]=[];private frame=-1;private camera?:THREE.Camera;
 private point=new THREE.Vector3();private view=new THREE.Vector3();
 readonly uniforms={uBodhiRects:{value:Array.from({length:WINDOWS},()=>new THREE.Vector4())},uBodhiDepths:{value:new Float32Array(WINDOWS)}};
 reset(){this.subjects.length=0;this.frame=-1;this.camera=undefined;this.uniforms.uBodhiDepths.value.fill(0);}
 protect(f:Fighter|undefined){const body=f?.shownBody??f;if(body&&this.subjects.length<WINDOWS&&!this.subjects.includes(body))this.subjects.push(body);}
 update(renderer:THREE.WebGLRenderer,camera:THREE.Camera){
  if(this.frame===renderer.info.render.frame&&this.camera===camera)return;
  this.frame=renderer.info.render.frame;this.camera=camera;
  for(let i=0;i<WINDOWS;i++){
   const f=this.subjects[i];this.uniforms.uBodhiDepths.value[i]=0;if(!f?.group.visible)continue;
   let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity,depthSum=0,count=0;
   const sample=(point:THREE.Vector3)=>{const depth=-this.view.copy(point).applyMatrix4(camera.matrixWorldInverse).z;if(depth<.05)return;point.project(camera);const px=.17/depth*camera.projectionMatrix.elements[0],py=.17/depth*camera.projectionMatrix.elements[5];x0=Math.min(x0,point.x-px);x1=Math.max(x1,point.x+px);y0=Math.min(y0,point.y-py);y1=Math.max(y1,point.y+py);depthSum+=depth;count++;};
   for(const name of JOINTS){const joint=f.joints?.get(name);if(joint)sample(joint.getWorldPosition(this.point));}
   if(!count)for(let k=0;k<3;k++)sample(this.point.copy(f.group.position).addScaledVector(THREE.Object3D.DEFAULT_UP,k*.85));
   if(count){this.uniforms.uBodhiRects.value[i].set(x0,y0,x1,y1);this.uniforms.uBodhiDepths.value[i]=depthSum/count-.18;}
  }
 }
 compile(shader:THREE.WebGLProgramParametersWithUniforms){
  Object.assign(shader.uniforms,this.uniforms);
  shader.vertexShader='varying vec3 vBodhiClip;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvBodhiClip=gl_Position.xyw;');
  shader.fragmentShader=`uniform vec4 uBodhiRects[${WINDOWS}];uniform float uBodhiDepths[${WINDOWS}];varying vec3 vBodhiClip;
float bodhiVisibility(){
 float keep=smoothstep(.22,.95,vBodhiClip.z);
 if(vBodhiClip.z<=.05)return 0.;
 vec2 ndc=vBodhiClip.xy/vBodhiClip.z;
 for(int i=0;i<${WINDOWS};i++){
  float depth=uBodhiDepths[i];if(depth<=0.||vBodhiClip.z>=depth)continue;
  vec4 r=uBodhiRects[i];vec2 q=abs(ndc-(r.xy+r.zw)*.5)/max((r.zw-r.xy)*.5,vec2(.001));q*=q;
  float inside=(1.-smoothstep(.75,1.2,sqrt(sqrt(q.x*q.x+q.y*q.y))))*smoothstep(0.,.4,depth-vBodhiClip.z);
  keep=min(keep,mix(1.,.025,inside));
 }
 return keep;
}\n`+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('if(bodhiDither>vBodhiPresence)discard;','if(bodhiDither>vBodhiPresence*bodhiVisibility())discard;');
 }
}
