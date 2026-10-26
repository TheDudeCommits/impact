import * as THREE from 'three';
import {bodyBulk} from './CameraDirector';
import {StageFade} from './StageFade';
import type {Fighter} from './Fighter';

const NEAR_GONE=.3,NEAR_CLEAR=.75;
const FADE_MOST=.82,WINDOW_MOST=.55,WINDOW_FROM=.35;
const WINDOW_SHOT_FROM=.12,WINDOW_SHOT_MOST=.72;
const COVER_FROM=.06,COVER_FULL=.3,CROWD_FROM=.1,CROWD_FULL=.24,FADE_IN=9,FADE_OUT=3.5,SUBJECT_OUT=14;
const SELF_FROM=.1,SELF_FULL=.4,SELF_MOST=.8,SELF_IN=30;
const DUEL_WINDOW=.15,DUEL_COVER_FROM=.45,DUEL_COVER_FULL=.65;
const AHEAD=.35;
const PAD=.32,CROWN=1.9,NEAR_REACH=.45;
const JOINTS=['Head','Hips','LeftFoot','RightFoot','LeftHand','RightHand','LeftShoulder','RightShoulder'] as const;
const ROOM_CLEAR=.12,ROOM_EDGE=.25,ROOM_OUTSIDE=.6;

const shared={
  uOccEye:{value:new THREE.Vector3(0,-1e4,0)},
  uOccNear:{value:new THREE.Vector2(NEAR_GONE,NEAR_CLEAR)},
  uOccRect:{value:new THREE.Vector4(2,2,2,2)},
  uOccRectDepth:{value:0},
};
const PARS= `
uniform vec2 uOccFade;
uniform vec3 uOccEye;
uniform vec2 uOccNear;
uniform vec4 uOccRect;
uniform float uOccRectDepth;
varying vec3 vOccWorld;
varying vec3 vOccClip;
const float OCC_BAYER[16] = float[16]( 0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5. );
bool occlusionDropped() {
	float drop = max( uOccFade.x, 1.0 - smoothstep( uOccNear.x, uOccNear.y, distance( vOccWorld, uOccEye ) ) );
	if ( uOccFade.y > 0.0 && vOccClip.z > 0.05 && vOccClip.z < uOccRectDepth ) {
		vec2 ndc = vOccClip.xy / vOccClip.z;
		vec2 feather = max( ( uOccRect.zw - uOccRect.xy ) * .18, vec2( .02 ) );
		vec2 inside = smoothstep( uOccRect.xy - feather, uOccRect.xy + feather, ndc ) * ( 1.0 - smoothstep( uOccRect.zw - feather, uOccRect.zw + feather, ndc ) );
		drop = max( drop, uOccFade.y * inside.x * inside.y );
	}
	if ( drop <= .004 ) return false;
	ivec2 cell = ivec2( mod( gl_FragCoord.xy, 4.0 ) );
	return ( OCC_BAYER[ cell.y * 4 + cell.x ] + .5 ) / 16. < drop;
}
`;
const KEY='occlusion-fade-v2',ROOM_KEY='occlusion-room-v1';
function ditherShader(shader:THREE.WebGLProgramParametersWithUniforms,fade:{value:THREE.Vector2}){
  Object.assign(shader.uniforms,shared);shader.uniforms.uOccFade=fade;
  shader.vertexShader='varying vec3 vOccWorld;\nvarying vec3 vOccClip;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\n\tvOccWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;\n\tvOccClip = gl_Position.xyw;');
  shader.fragmentShader=PARS+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\n\tif ( occlusionDropped() ) discard;');
}
const twins=new WeakSet<THREE.Material>();
function twinOf(original:THREE.Material,fade:{value:THREE.Vector2}){
  const twin=original.clone(),compile=original.onBeforeCompile;
  twin.onBeforeCompile=function(shader,renderer){compile.call(original,shader,renderer);ditherShader(shader,fade);};
  const inherited=original.customProgramCacheKey===THREE.Material.prototype.customProgramCacheKey?compile.toString():undefined;
  twin.customProgramCacheKey=()=>`${inherited??original.customProgramCacheKey()}|${KEY}`;
  twins.add(twin);
  return twin;
}

interface Twin{mesh:THREE.Mesh;slot:number;original:THREE.Material;twin:THREE.Material}
interface FadeState{
  fade:{value:THREE.Vector2};
  body:number;window:number;
  x0:number;y0:number;x1:number;y1:number;near:number;mid:number;lens:number;seen:boolean;
  twins:Twin[];swapped:boolean;
  room?:THREE.Mesh;inside:{value:number};
}
const records=new WeakMap<object,FadeState>();

export function installOcclusionFade(fighter:Fighter){
  if(records.has(fighter))return;
  const record:FadeState={fade:{value:new THREE.Vector2()},body:0,window:0,x0:0,y0:0,x1:0,y1:0,near:0,mid:0,lens:Infinity,seen:false,twins:[],swapped:false,inside:{value:0}};
  records.set(fighter,record);
  const meshes:THREE.Mesh[]=[];
  fighter.group.traverse(object=>{if((object as THREE.Mesh).isMesh)meshes.push(object as THREE.Mesh);});
  const warm=fighter.state.id.startsWith('warm-');
  for(const mesh of meshes){
    const list=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    if(mesh.name==='contact-shadow')continue;
    const translucent=list.some(m=>m&&m.transparent&&m.opacity<1);
    if(translucent){if(mesh.name.startsWith('awaken-on')&&fighter.state.fighter==='law'){record.room=mesh;for(const m of list)if(m)roomShader(m,record.inside);}continue;}
    const made:THREE.Material[]=[];
    list.forEach((material,slot)=>{
      if(!material||(material as THREE.ShaderMaterial).isShaderMaterial){made.push(material);return;}
      const twin=twinOf(material,record.fade);made.push(twin);
      record.twins.push({mesh,slot:Array.isArray(mesh.material)?slot:-1,original:material,twin});
    });
    if(warm&&made.some((m,i)=>m!==list[i])){
      const proxy=mesh.clone(false);
      proxy.material=Array.isArray(mesh.material)?made:made[0];
      proxy.name=mesh.name+'-occlusion-warm';proxy.visible=false;proxy.castShadow=false;proxy.receiveShadow=false;
      proxy.position.set(0,0,0);proxy.quaternion.identity();proxy.scale.set(1,1,1);proxy.matrixAutoUpdate=false;proxy.updateMatrix();
      mesh.add(proxy);
    }
  }
}
export function isOcclusionTwin(material:THREE.Material){return twins.has(material);}
export function occlusionTwins(fighter:Fighter):readonly {original:THREE.Material;twin:THREE.Material}[]{return records.get(fighter)?.twins??[];}
function roomShader(material:THREE.Material,inside:{value:number}){
  const previous=material.onBeforeCompile,inherited=material.customProgramCacheKey===THREE.Material.prototype.customProgramCacheKey?previous.toString():undefined;
  const key=inherited!==undefined?()=>inherited:material.customProgramCacheKey.bind(material);
  material.onBeforeCompile=function(shader,renderer){
    previous.call(this,shader,renderer);
    shader.uniforms.uOccInside=inside;
    shader.fragmentShader='uniform float uOccInside;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`if ( uOccInside > 0.0 ) {
		float occFacing = abs( dot( normalize( normal ), normalize( vViewPosition ) ) );
		diffuseColor.a *= mix( 1.0, mix( ${ROOM_CLEAR.toFixed(3)}, 1.0, smoothstep( .45, .92, 1.0 - occFacing ) ), uOccInside );
	}
	#include <opaque_fragment>`);
  };
  material.customProgramCacheKey=()=>`${key()}|${ROOM_KEY}`;
  material.needsUpdate=true;
}

export class OcclusionFader{
  readonly state={faded:0,most:0,window:0,twinned:0,room:0};
  shotVictim?:Fighter;
  shotHidden=false;
  selfCover=0;
  closeManual=0;
  readonly stage=new StageFade();
  private camera?:THREE.PerspectiveCamera;
  private self?:Fighter;
  private target?:Fighter;
  private focus:readonly (Fighter|undefined)[]=[];
  private dt=0;
  private point=new THREE.Vector3();
  private view=new THREE.Vector3();
  private sphere=new THREE.Sphere();
  private subjectCount=0;
  private subjects:FadeState[]=[];
  private nearest=Infinity;
  private sum=0;private count=0;private pad=0;

  update(dt:number,camera:THREE.PerspectiveCamera,crowd:ReadonlyMap<string,Fighter>|undefined,self:Fighter,target:Fighter|undefined,focus:readonly (Fighter|undefined)[]){
    shared.uOccEye.value.copy(camera.position);
    this.dt=Math.min(Math.max(Number.isFinite(dt)?dt:0,0),.1);this.camera=camera;this.self=self;this.target=target;this.focus=focus;
    const st=this.state;st.faded=0;st.most=0;st.window=0;st.twinned=0;st.room=0;
    camera.updateMatrixWorld();
    this.subjectCount=0;this.nearest=Infinity;
    this.subject(self);if(target&&target!==self)this.subject(target);
    for(let i=0;i<focus.length;i++){const f=focus[i];if(f&&f!==self&&f!==target)this.subject(f);}
    const victim=this.shotVictim&&this.shotVictim!==self&&this.shotVictim.state.alive?this.shotVictim:undefined;
    if(victim&&victim!==target&&!focus.includes(victim))this.subject(victim);
    const windowed=victim??target,t=windowed&&windowed.state.alive?records.get(windowed):undefined;
    if(t&&t.seen&&t.x1>-1&&t.x0<1&&t.y1>-1&&t.y0<1){shared.uOccRect.value.set(t.x0,t.y0,t.x1,t.y1);shared.uOccRectDepth.value=t.mid-AHEAD;}
    else{shared.uOccRect.value.set(2,2,2,2);shared.uOccRectDepth.value=0;}
    if(crowd)crowd.forEach(this.visit);
    const own=records.get(self);
    if(own){
      let window=0,into=FADE_IN;
      if(t&&own.seen&&shared.uOccRectDepth.value>0&&own.near<shared.uOccRectDepth.value){
        const w=Math.min(own.x1,t.x1)-Math.max(own.x0,t.x0),h=Math.min(own.y1,t.y1)-Math.max(own.y0,t.y0);
        if((w>0&&h>0&&w*h>=(victim?WINDOW_SHOT_FROM:WINDOW_FROM)*(t.x1-t.x0)*(t.y1-t.y0))||(victim&&this.shotHidden))window=victim?WINDOW_SHOT_MOST:WINDOW_MOST;
        const torso=victim?0:SELF_MOST*THREE.MathUtils.smoothstep(this.selfCover,SELF_FROM,SELF_FULL);
        if(torso>window){window=torso;into=SELF_IN;}
      }
      if(!victim&&this.closeManual>0&&Number.isFinite(this.selfCover)){
        const covered=THREE.MathUtils.smoothstep(this.selfCover,DUEL_COVER_FROM,DUEL_COVER_FULL);
        const cap=THREE.MathUtils.lerp(SELF_MOST,THREE.MathUtils.lerp(DUEL_WINDOW,SELF_MOST,covered),THREE.MathUtils.clamp(this.closeManual,0,1));
        window=Math.min(window,cap);
      }
      this.ease(own,0,window,SUBJECT_OUT,into);this.room(self,own);st.window=own.window;
    }
    let nearest=own&&own.seen?own.near:Infinity;
    for(let i=0;i<this.subjectCount;i++)nearest=Math.min(nearest,this.subjects[i].near);
    const p=self.group.position,q=windowed?.group.position;
    this.stage.update(this.dt,camera.position,own,windowed&&windowed!==self?t:undefined,windowed,nearest,p.y,self.state.grounded,q?Math.hypot(q.x-p.x,q.z-p.z):Infinity);
  }
  private subject(body:Fighter){
    const r=records.get(body);if(!r)return;
    this.measure(body,r);
    if(!r.seen||!body.state.alive)return;
    if(this.subjectCount>=this.subjects.length)this.subjects.push(r);else this.subjects[this.subjectCount]=r;
    this.subjectCount++;this.nearest=Math.min(this.nearest,r.mid);
  }
  private visit=(body:Fighter)=>{
    const r=records.get(body);if(!r||body===this.self)return;
    if(body===this.target||this.focus.includes(body)){this.ease(r,0,0,SUBJECT_OUT);this.room(body,r);return;}
    let goal=0;
    if(body.state.alive&&body.group.visible){
      this.measure(body,r);
      if(r.seen){
        for(let i=0;i<this.subjectCount;i++){
          const s=this.subjects[i];
          if(r.near>=s.mid-AHEAD)continue;
          const w=Math.min(r.x1,s.x1)-Math.max(r.x0,s.x0),h=Math.min(r.y1,s.y1)-Math.max(r.y0,s.y0);
          if(w<=0||h<=0)continue;
          const share=w*h/Math.max((s.x1-s.x0)*(s.y1-s.y0),1e-6);
          goal=Math.max(goal,THREE.MathUtils.smoothstep(share,COVER_FROM,COVER_FULL));
        }
        if(r.near<this.nearest){
          const w=Math.min(r.x1,1)-Math.max(r.x0,-1),h=Math.min(r.y1,1)-Math.max(r.y0,-1);
          if(w>0&&h>0)goal=Math.max(goal,THREE.MathUtils.smoothstep(w*h/4,CROWD_FROM,CROWD_FULL));
        }
      }
    }else r.lens=Infinity;
    this.ease(r,goal*FADE_MOST,0);this.room(body,r);
  };
  private ease(r:FadeState,body:number,window:number,out=FADE_OUT,into=FADE_IN){
    r.body=this.toward(r.body,body,out);r.window=this.toward(r.window,window,out,into);
    r.fade.value.set(r.body,r.window);
    this.swap(r,r.body>.004||r.window>.004||r.lens<NEAR_CLEAR+NEAR_REACH);
    if(r.body>.01){this.state.faded++;this.state.most=Math.max(this.state.most,r.body);}
    if(r.swapped)this.state.twinned++;
  }
  private toward(now:number,goal:number,out:number,into=FADE_IN){
    const next=now+(goal-now)*(1-Math.exp(-(goal>now?into:out)*this.dt));
    return goal===0&&next<1e-3?0:next;
  }
  private swap(r:FadeState,on:boolean){
    if(!on&&!r.swapped)return;
    for(let i=0;i<r.twins.length;i++){
      const t=r.twins[i],list=t.slot>=0?t.mesh.material as THREE.Material[]:undefined,current=list?list[t.slot]:t.mesh.material;
      if(on){
        if(current===t.original){if(list)list[t.slot]=t.twin;else t.mesh.material=t.twin;}
        if(current===t.original||current===t.twin)copyLook(t.original,t.twin);
      }else if(current===t.twin){if(list)list[t.slot]=t.original;else t.mesh.material=t.original;}
    }
    r.swapped=on;
  }
  private room(body:Fighter,r:FadeState){
    const mesh=r.room;if(!mesh)return;
    let inside=0;
    if(mesh.visible&&body.state.alive){
      const geometry=mesh.geometry;
      if(!geometry.boundingSphere)geometry.computeBoundingSphere();
      this.sphere.copy(geometry.boundingSphere!).applyMatrix4(mesh.matrixWorld);
      const d=this.sphere.center.distanceTo(this.camera!.position),radius=this.sphere.radius;
      inside=1-THREE.MathUtils.smoothstep(d,radius*(1-ROOM_EDGE),radius);
    }
    const goal=mesh.visible?Math.max(ROOM_OUTSIDE,inside):0;
    r.inside.value+=(goal-r.inside.value)*(1-Math.exp(-6*this.dt));
    if(r.inside.value<1e-3&&goal===0)r.inside.value=0;
    this.state.room=Math.max(this.state.room,inside);
  }
  private measure(body:Fighter,r:FadeState){
    const joints=body.joints,bulk=bodyBulk(body.state);
    r.x0=r.y0=Infinity;r.x1=r.y1=-Infinity;r.near=Infinity;r.mid=0;r.lens=Infinity;r.seen=false;this.sum=0;this.count=0;this.pad=PAD*bulk;
    if(joints&&body.model?.visible!==false){
      for(let i=0;i<JOINTS.length;i++){const bone=joints.get(JOINTS[i]);if(bone){bone.getWorldPosition(this.point);this.add(r);}}
    }
    if(!this.count){
      const p=body.group.position;
      for(let k=0;k<3;k++){this.point.set(p.x,p.y+CROWN*bulk*k/2,p.z);this.add(r);}
    }
    if(!this.count)return;
    r.mid=this.sum/this.count;r.seen=true;
  }
  private add(r:FadeState){
    const camera=this.camera!,e=camera.projectionMatrix.elements;
    r.lens=Math.min(r.lens,this.point.distanceTo(camera.position)-this.pad);
    this.view.copy(this.point).applyMatrix4(camera.matrixWorldInverse);
    const depth=-this.view.z;if(depth<.05)return;
    this.point.project(camera);
    const up=this.pad/depth*e[5],across=this.pad/depth*e[0];
    r.x0=Math.min(r.x0,this.point.x-across);r.x1=Math.max(r.x1,this.point.x+across);r.y0=Math.min(r.y0,this.point.y-up);r.y1=Math.max(r.y1,this.point.y+up);
    r.near=Math.min(r.near,depth-this.pad);this.sum+=depth;this.count++;
  }
}

function copyLook(from:THREE.Material,to:THREE.Material){
  to.opacity=from.opacity;to.visible=from.visible;
  const a=from as THREE.MeshToonMaterial,b=to as THREE.MeshToonMaterial;
  if(a.color&&b.color)b.color.copy(a.color);
  if(a.emissive&&b.emissive){b.emissive.copy(a.emissive);b.emissiveIntensity=a.emissiveIntensity;}
}
