import * as THREE from 'three';
import {GLTFLoader,type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {Fighter,bindClips} from './Fighter';
import {FIGHTERS} from '../config';
import {MOVES,PLAYER_RADIUS,meleeReach,type MoveDefinition} from '../game/moves';
import {AWAKENINGS,moveFor,rushMove} from '../game/awakening';
import type {CombatEvent,FighterId} from '../game/types';
import {chargeWasCancelled,FLIGHTS} from './CombatEffects';
import {slashWaveMaterial,applySlashStyle,SLASH} from './signature/SlashWave';
import {LightVolumes} from './signature/LightVolumes';
import {BoltBatch} from './signature/BoltBatch';
import {GlowBatch,RING,STAR} from './signature/GlowBatch';
import {BankaiEffects} from './signature/Bankai';
import {SantoryuEffects,ASURA_ASSET} from './signature/Santoryu';
import {GhostShell,warmGhosts,type GhostPrint} from './signature/GhostShell';
import {RoadRollers,rollerAt,ROLLER_TIMING,type RollerPose} from './signature/RoadRoller';
import {SIGNATURE} from './signature/context';
import {whiffGone} from './signature/ultimateClock';
import {setLoomTop,clearLoomTops} from './loomRegistry';
import {tourContacts} from '../game/timeStopBarrage';
import {VfxKit} from './vfx/VfxKit';
import {ghostTint} from './vfx/palette';
import type {AttackSlot,PlayerState} from '../game/types';
import {COMBO_KEYS,comboMove} from '../game/combos';
import {comboClip} from './comboClips';
import {JOLYNE_REFERENCE_ENTRY,JOLYNE_REFERENCE_RETURN,jolyneContactReference} from './signature/JolyneContactReference';
import {JOLYNE_STAND_STAGING,jolyneFlankAroundContact,jolyneViewFlank,jolyneInitialFlank} from './signature/JolyneStandStaging';

export interface StandUser{
  asset:string;
  name:string;
  heavy:'finger'|'knives'|'punch';
  fistMesh?:string;
  fist:number;
  aliases?:Readonly<Record<string,string>>;
  punches?:string;
  string?:boolean;
}
const authoredStand=(fighter:FighterId)=>fighter==='josuke'||fighter==='jolyne';
export const STAND_USERS:Partial<Record<FighterId,StandUser>>={
  jolyne:{asset:'/assets/fighters/stone-free1.glb',name:'stone-free',heavy:'punch',fist:0x6fdadd,string:true},
  josuke:{asset:'/assets/fighters/crazy-diamond1.glb',name:'crazy-diamond',heavy:'punch',fist:0x80dcf2,string:true},
  jotaro:{asset:'/assets/fighters/star-combat1.glb',name:'star-platinum',heavy:'finger',fistMesh:'star_closed_Right',fist:0x8962ad,aliases:{'Straight Punch':'Star Platinum Punch'},punches:'/assets/fighters/star-fanim1.glb',string:true},
  dio:{asset:'/assets/fighters/the-world1.glb',name:'the-world',heavy:'knives',fist:0xd9b53c,punches:'/assets/fighters/the-world-fanim1.glb',string:true},
};
const STRING_STAND={reach:.95,least:.3,most:1.25,side:.28};
export const KNIFE_ASSET='/assets/fighters/dio-knife1.glb';
export const SWORD_STAND_ASSETS=[STAND_USERS.jotaro!.asset,STAND_USERS.dio!.asset,STAND_USERS.josuke!.asset,STAND_USERS.jolyne!.asset,KNIFE_ASSET,ASURA_ASSET] as const;
type SlashMesh=THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>;
type TimeField={dome:THREE.Mesh<THREE.SphereGeometry,THREE.ShaderMaterial>;still:THREE.Mesh<THREE.SphereGeometry,THREE.ShaderMaterial>;graded?:number;origin:THREE.Vector3;anchored:boolean};
const STAND_OPACITY=.74;
export const LOOM={
  scale:1.5,
  back:.55,side:.6,lift:.18,restLean:.03,bend:.6,strikeBend:.12,tilt:.3,strikeTilt:.05,
  strikeBack:-.12,strikeSide:.56,strikeLift:.1,lean:.2,guard:.3,
  bob:.045,bobRate:.55,breathe:.014,breatheRate:.36,sway:.03,
  turn:7,follow:9,surgeIn:12,surgeOut:4,
  riseFrom:.12,riseTo:1.25,emergeScale:.92,emergeLift:-.25,exit:.9,
  keepTarget:.14,keepUser:.42,near:.9,far:1.8,
};
type Loom={referenceSeq?:number;referenceFrom?:THREE.Vector3;referenceYaw?:number;referencePresent?:boolean;referenceActive?:boolean;referenceReturn?:number;stagedYaw?:number;flank?:number;flankGoal?:number;flankView?:number;flankSeq?:number;presence:number;surge:number;bearing:number;height:number;placed:boolean;clock:number;risen:number;state:PlayerState;stare:THREE.Vector3;shadow?:THREE.Object3D;
  anchor?:THREE.Object3D;
  bones:(THREE.Bone|undefined)[];rest:THREE.Quaternion[];bent:boolean;
  casters:THREE.Mesh[];casting:boolean};
const BEND_BONES=['Spine','Spine1','Spine2','Neck'] as const,BEND_NECK=-.55;
type UltimateTiming={contacts:readonly number[];stop:NonNullable<MoveDefinition['timeStop']>;stopFrom:number;finisher:number;barrageFrom:number;barrageTo:number};
const wrap=(angle:number)=>Math.atan2(Math.sin(angle),Math.cos(angle));
const BARRAGE_LEAD=.15,BARRAGE_TAIL=.12,BARRAGE_LOOP=4;
const STAND_REACH=3.4;
const TRAIL_STEP=.25,TRAIL_LIFE=.28,TRAIL_HEIGHTS=[.5,1.05,1.6] as const,TRAILS=24;
const GHOST_STEP=.55;
const FIST_NEAR=3.2,FIST_GONE=1.4;
const STILL=new THREE.Color(.62,.74,.84);
const STAND_SHELL:Partial<Record<FighterId,{body:THREE.Color;rim:number;ink:number;print:GhostPrint}>>={
  jolyne:{body:new THREE.Color(.38,.82,.75),rim:0xc6ffdf,ink:0x131925,print:{shade:new THREE.Color(.035,.11,.10),light:new THREE.Color(.93,1.1,1.05),line:0x131925,levels:[.12,.9],loom:true}},
  josuke:{body:new THREE.Color(.9,.38,.65),rim:0x9feaff,ink:0x201126,print:{shade:new THREE.Color(.10,.035,.10),light:new THREE.Color(1.1,.95,1.1),line:0x201126,levels:[.12,.9],loom:true}},
  jotaro:{body:new THREE.Color(.34,.24,1.5),rim:0xc9a8ff,ink:0x080620,print:{shade:new THREE.Color(.03,.018,.15),light:new THREE.Color(1.05,.9,2.3),line:0x0a0624,levels:[.1,.85],glow:/^Material__2$/,loom:true}},
  dio:{body:new THREE.Color(1.25,.85,.12),rim:0xffe28a,ink:0x140c02,print:{shade:new THREE.Color(.16,.07,.01),light:new THREE.Color(2.1,1.8,.75),line:0x1a0e02,levels:[.15,.95],glowUv:[.4,.06,.48,.225],loom:true}},
};
type Slash={event:CombatEvent;root:THREE.Group;meshes:SlashMesh[];hitAt?:number;hitPoint?:THREE.Vector3;light:THREE.Color};
const SLASH_POOL=40;
const STAND_GLOW:Partial<Record<FighterId,THREE.Color>>={jolyne:new THREE.Color(.45,1.1,.9),josuke:new THREE.Color(.65,1.1,1.4),jotaro:new THREE.Color(.8,.42,1.8),dio:new THREE.Color(1.7,1.2,.3)};
const SLASH_LIGHT={mihawk:new THREE.Color(.3,1.0,.42),zoro:new THREE.Color(.35,1.1,.45)};
type Finger={event:CombatEvent;root:THREE.Group;shaft:THREE.Mesh;core:THREE.Mesh;tip:THREE.Mesh;hitAt?:number;hitPoint?:THREE.Vector3;};
const FINGER_RETRACT=52;
const FINGER_HOLD=.06;
const KNIVES=3,KNIFE_SPREAD=.13,KNIFE_FAN=.09,KNIFE_FLIGHTS=8;
const vertex='varying vec2 p;void main(){p=uv*2.0-1.0;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
const UP=new THREE.Vector3(0,1,0),FORWARD=new THREE.Vector3(0,0,1);

function fistGeometry(gltf:GLTF,user:StandUser):THREE.BufferGeometry|undefined{
  let named:THREE.SkinnedMesh|undefined,skin:THREE.SkinnedMesh|undefined;
  gltf.scene.traverse(o=>{const m=o as THREE.SkinnedMesh;if(!m.isSkinnedMesh)return;if(user.fistMesh&&o.name===user.fistMesh)named=m;if(!skin)skin=m;});
  if(named){const index=named.skeleton.bones.findIndex(b=>b.name==='RightHand');if(index<0)return;return named.geometry.clone().applyMatrix4(named.skeleton.boneInverses[index]);}
  if(!skin)return;
  const bones=skin.skeleton.bones,hand=bones.findIndex(b=>b.name==='RightHand');if(hand<0)return;
  const ofHand=new Set<number>();bones.forEach((b,i)=>{for(let p:THREE.Object3D|null=b;p;p=p.parent)if(p===bones[hand]){ofHand.add(i);break;}});
  const g=skin.geometry,position=g.attributes.position,joints=g.attributes.skinIndex.array,weights=g.attributes.skinWeight.array,index=g.index;
  const owned=(v:number)=>{let w=0;for(let k=0;k<4;k++)if(ofHand.has(joints[v*4+k]))w+=weights[v*4+k];return w>.5;};
  const count=index?index.count:position.count,keep:number[]=[];
  for(let t=0;t+2<count;t+=3){const a=index?index.getX(t):t,b=index?index.getX(t+1):t+1,c=index?index.getX(t+2):t+2;if(owned(a)&&owned(b)&&owned(c))keep.push(a,b,c);}
  if(keep.length<3)return;
  const out=new Float32Array(keep.length*3),p=new THREE.Vector3(),toHand=skin.skeleton.boneInverses[hand].clone().multiply(skin.bindMatrix);
  keep.forEach((v,i)=>{p.fromBufferAttribute(position,v).applyMatrix4(toHand);out[i*3]=p.x;out[i*3+1]=p.y;out[i*3+2]=p.z;});
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(out,3));return geometry;
}
export function standClips(fighter:FighterId,source:GLTF,rush?:THREE.AnimationClip[]){
  const user=STAND_USERS[fighter];
  for(const [name,from] of Object.entries(user?.aliases??{})){
    if(source.animations.some(c=>c.name===name))continue;
    const clip=source.animations.find(c=>c.name===from);
    if(clip){const copy=clip.clone();copy.name=name;source.animations.push(copy);}
  }
  return rush?bindClips(source.scene,rush,user?.name??fighter):undefined;
}
export function standEnderClips(fighter:FighterId,owner:Fighter,source:GLTF){
  const names=new Set(COMBO_KEYS.map(key=>comboClip(fighter,key)?.clip).filter((name):name is string=>!!name));
  if(!names.size)return [];
  const own=(owner.clips??[]).filter(c=>names.has(c.name)&&!source.animations.some(a=>a.name===c.name));
  return own.length?bindClips(source.scene,own,STAND_USERS[fighter]?.name??fighter):[];
}
function standFistMaterial(body:THREE.Color,rim:number){
  return new THREE.ShaderMaterial({name:'StandFist',transparent:true,depthWrite:false,toneMapped:false,
    blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneMinusSrcAlphaFactor,blendSrcAlpha:THREE.OneFactor,blendDstAlpha:THREE.OneMinusSrcAlphaFactor,
    uniforms:{uBody:{value:body.clone()},uRim:{value:new THREE.Color(rim)}},
    vertexShader:'varying vec3 vN;varying vec3 vV;void main(){vec4 mv=modelViewMatrix*instanceMatrix*vec4(position,1.);vV=-mv.xyz;vN=normalize(normalMatrix*mat3(instanceMatrix)*normal);gl_Position=projectionMatrix*mv;}',
    fragmentShader:'uniform vec3 uBody;uniform vec3 uRim;varying vec3 vN;varying vec3 vV;void main(){float f=abs(dot(normalize(vN),normalize(vV)));float rim=pow(1.-f,2.2);float near=smoothstep('+FIST_GONE.toFixed(2)+','+FIST_NEAR.toFixed(2)+',length(vV));float a=(.88+.1*rim)*near;gl_FragColor=vec4((mix(uBody,uRim,.5)*(.5+.5*f)*(.88+.1*rim)+uRim*rim*1.4)*near,a);}'});
}
export class SwordStandEffects{
  private sources=new Map<FighterId,GLTF>();
  private rushClips=new Map<FighterId,THREE.AnimationClip[]>();
  private stands=new Map<string,Fighter>();
  private standFades=new Map<string,number>();
  private looms=new Map<string,Loom>();
  private cost=new Float32Array(120);private costAt=0;
  get stats(){const sorted=Float32Array.from(this.cost).sort();return {ms:sorted[sorted.length>>1],worst:sorted[sorted.length-1],mean:this.cost.reduce((a,b)=>a+b,0)/this.cost.length};}
  probeHidden=false;
  private bendAxis=new THREE.Vector3();private bendAcross=new THREE.Vector3();private bendTilt=new THREE.Quaternion();private bendWorld=new THREE.Quaternion();private bendParent=new THREE.Quaternion();private bendLocal=new THREE.Quaternion();
  private ultimates=new Map<FighterId,UltimateTiming[]>();
  private shells=new Map<string,GhostShell>();
  private ghostWarm:ReturnType<typeof warmGhosts>;
  private fists=new Map<FighterId,THREE.InstancedMesh>();
  private fistCounts=new Map<FighterId,number>();
  private fistPose=new THREE.Object3D();
  private slashes:Slash[]=[];
  private fingers:Finger[]=[];
  private fingerGeometry=new THREE.CylinderGeometry(1,1,1,10,1,true);
  private fingerTipGeometry=new THREE.SphereGeometry(1,12,8);
  private fingerMaterial=new THREE.MeshBasicMaterial({color:0x8962ad,transparent:true,opacity:.86,depthWrite:false,toneMapped:false});
  private fingerCoreMaterial=new THREE.MeshBasicMaterial({color:new THREE.Color(1.8,1.45,2.6),transparent:true,opacity:.95,depthWrite:false,toneMapped:false});
  private fingerFrom=new THREE.Vector3();
  private fingerDir=new THREE.Vector3();
  private fingerTipAt=new THREE.Vector3();
  private knifeGeometry:THREE.BufferGeometry=new THREE.BoxGeometry(.018,.005,.24);
  private knifeMaterial:THREE.Material=new THREE.MeshBasicMaterial({color:0xd7dde4,toneMapped:false});
  private knives?:THREE.InstancedMesh;
  private knifePose=new THREE.Object3D();
  private knifeSide=new THREE.Vector3();
  private knifeAim=new THREE.Vector3();
  private knifeGrip=new THREE.Vector3();
  private rollerSet?:RoadRollers;
  private get rollers(){return this.rollerSet??=new RoadRollers(this.scene);}
  private kit?:VfxKit;
  private get vfx(){return this.kit??=VfxKit.for(this.scene);}
  private seen=new Set<number>();
  private plane=new THREE.PlaneGeometry(1,1);
  private slashPool:SlashMesh[]=[];
  private slashHolder=new THREE.Group();
  private lights=new LightVolumes(8,'sword-stand-light');
  private ringGeometry=new THREE.SphereGeometry(1,32,16);
  private domeMaterial=new THREE.ShaderMaterial({name:'ZaWarudoDome',transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,blending:THREE.AdditiveBlending,uniforms:{opacity:{value:0},tint:{value:new THREE.Color(1.2,.8,2.2)}},
    vertexShader:'varying vec3 vN;varying vec3 vV;void main(){vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.0);vV=-mv.xyz;gl_Position=projectionMatrix*mv;}',
    fragmentShader:'varying vec3 vN;varying vec3 vV;uniform float opacity;uniform vec3 tint;void main(){float f=1.-abs(dot(normalize(vN),normalize(vV)));gl_FragColor=vec4(tint*pow(f,3.)*opacity,1.);}'});
  private timeFields=new Map<string,TimeField>();
  private stillMaterial=new THREE.ShaderMaterial({name:'ZaWarudoStill',transparent:true,depthWrite:false,depthTest:false,side:THREE.BackSide,toneMapped:false,
    blending:THREE.CustomBlending,blendEquation:THREE.AddEquation,blendSrc:THREE.DstColorFactor,blendDst:THREE.ZeroFactor,blendSrcAlpha:THREE.ZeroFactor,blendDstAlpha:THREE.OneFactor,
    uniforms:{tint:{value:new THREE.Color(1,1,1)}},vertexShader:'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform vec3 tint;void main(){gl_FragColor=vec4(tint,1.);}'});
  private fieldWarm=new THREE.Group();
  private bolts=new BoltBatch(900,'stand-barrage-smears');
  private glows=new GlowBatch(64,'stand-barrage-flash',true);
  private bankai:BankaiEffects;
  private santoryu:SantoryuEffects;
  private barrageTarget=new THREE.Vector3();private barrageFrom=new THREE.Vector3();private lift=new THREE.Vector3();private smearTail=new THREE.Vector3();
  private trails=Array.from({length:TRAILS},()=>({from:new THREE.Vector3(),to:new THREE.Vector3(),born:-Infinity,fighter:'jotaro' as FighterId}));
  private trailNext=0;
  private lastAt=new Map<string,THREE.Vector3>();
  private ghostAt=new Map<string,THREE.Vector3>();
  constructor(private scene:THREE.Scene){
    this.bankai=new BankaiEffects(scene);this.santoryu=new SantoryuEffects(scene);this.ghostWarm=warmGhosts(scene);
    if(import.meta.env?.DEV&&typeof window!=='undefined')(window as unknown as {__stands?:{effects:SwordStandEffects;loom:typeof LOOM}}).__stands={effects:this,loom:LOOM};
    this.slashHolder.name='sword-wave-pool';this.slashHolder.position.set(0,-50,0);scene.add(this.slashHolder,this.lights.mesh,this.bolts.mesh,this.glows.mesh);
    this.fieldWarm.name='time-stop-warm';this.fieldWarm.position.set(0,-50,0);for(const m of [this.domeMaterial,this.stillMaterial]){const warm=new THREE.Mesh(this.ringGeometry,m);warm.scale.setScalar(.001);warm.frustumCulled=false;this.fieldWarm.add(warm);}this.fieldWarm.children[0].onAfterRender=()=>{this.fieldWarm.visible=false;};scene.add(this.fieldWarm);
    for(let i=0;i<SLASH_POOL;i++){const mesh=new THREE.Mesh(this.plane,slashWaveMaterial());mesh.frustumCulled=false;mesh.renderOrder=4;this.slashHolder.add(mesh);this.slashPool.push(mesh);}
    for(let i=1;i<SLASH_POOL;i++)this.slashPool[i].visible=false;
    this.slashPool[0].onAfterRender=()=>{this.slashHolder.visible=false;for(const m of this.slashPool)m.visible=true;this.slashPool[0].onAfterRender=()=>{};};
  }
  private loads=new Map<string,Promise<void>>();
  load(fighters:Iterable<string>){
    const once=(key:string,work:()=>Promise<void>)=>{let loading=this.loads.get(key);if(!loading){loading=work().catch(error=>{this.loads.delete(key);console.warn(`${key} did not load`,error);});this.loads.set(key,loading);}return loading;};
    const jobs:Promise<void>[]=[];
    for(const fighter of new Set(fighters)){
      const user=STAND_USERS[fighter as FighterId];
      if(user)jobs.push(once(user.name,()=>this.loadStand(fighter as FighterId,user)));
      if(fighter==='dio'){void this.rollers;jobs.push(once('DIO knife',()=>this.loadKnife()));}
      if(fighter==='zoro')jobs.push(once('Asura phantom',()=>this.santoryu.load()));
    }
    return Promise.all(jobs).then(()=>{});
  }
  private async loadStand(fighter:FighterId,user:StandUser){
    const loader=new GLTFLoader();
    const source=await loader.loadAsync(user.asset);source.scene.updateMatrixWorld(true);
    const url=FIGHTERS[fighter].rushModel;let rush:THREE.AnimationClip[]|undefined;
    if(url)try{rush=(await loader.loadAsync(url)).animations;}catch(error){console.warn(`${user.name}: rush clips unavailable (${url})`,error);}
    if(user.punches)try{
      const own=(await loader.loadAsync(user.punches)).animations,stages=own.filter(c=>/^Rush \d$/.test(c.name)),staged=new Set(stages.map(c=>c.name));
      const rest=bindClips(source.scene,own.filter(c=>!staged.has(c.name)),user.name),names=new Set(rest.map(c=>c.name));
      source.animations=[...source.animations.filter(c=>!names.has(c.name)),...rest];
      if(stages.length)rush=[...(rush??[]).filter(c=>!staged.has(c.name)),...stages];
    }catch(error){console.warn(`${user.name}: its own takes are unavailable (${user.punches}); it throws its user's`,error);}
    const bound=standClips(fighter,source,rush);if(bound)this.rushClips.set(fighter,bound);
    this.sources.set(fighter,source);
    const geometry=authoredStand(fighter)?undefined:fistGeometry(source,user);
    if(geometry){if(!geometry.attributes.normal)geometry.computeVertexNormals();const look=STAND_SHELL[fighter];const fists=new THREE.InstancedMesh(geometry,standFistMaterial(look?look.body:new THREE.Color(user.fist),look?look.rim:0xffffff),96);fists.count=0;fists.frustumCulled=false;fists.name=fighter==='jotaro'?'ora-sourced-fist-trails':user.name+'-fist-trails';this.fists.set(fighter,fists);this.scene.add(fists);}
  }
  private async loadKnife(){
    const knife=await new GLTFLoader().loadAsync(KNIFE_ASSET);let mesh:THREE.Mesh|undefined;knife.scene.traverse(o=>{if(!mesh&&(o as THREE.Mesh).isMesh)mesh=o as THREE.Mesh;});
    if(mesh){this.knifeGeometry.dispose();this.knifeGeometry=mesh.geometry;const material=(Array.isArray(mesh.material)?mesh.material[0]:mesh.material) as THREE.MeshStandardMaterial;this.knifeMaterial=new THREE.MeshBasicMaterial({map:material.map??null,color:material.map?0xffffff:0xd7dde4});}
    if(!this.knives)this.knifeMesh().visible=false;
  }
  private knifeMesh(){if(!this.knives){this.knives=new THREE.InstancedMesh(this.knifeGeometry,this.knifeMaterial,KNIVES*KNIFE_FLIGHTS);this.knives.count=0;this.knives.frustumCulled=false;this.knives.name='dio-knives';this.scene.add(this.knives);}return this.knives;}
  private slashMesh():SlashMesh{
    let mesh=this.slashPool.pop();
    if(!mesh){const oldest=this.slashes.shift();if(oldest)this.remove(oldest);mesh=this.slashPool.pop()!;}
    mesh.rotation.set(0,0,0);mesh.position.set(0,0,0);mesh.visible=true;return mesh;
  }
  handle(events:CombatEvent[]){this.bankai.handle(events);this.santoryu.handle(events);for(const e of events){if(this.seen.has(e.id))continue;this.seen.add(e.id);if(this.seen.size>2048)this.seen.delete(this.seen.values().next().value!);
    if(e.kind==='cast'&&e.origin&&e.endpoint&&e.fighter==='zoro'&&(e.slot==='light'||e.slot==='heavy'&&!e.branch)){
      const root=new THREE.Group(),meshes:SlashMesh[]=[];root.name=e.fighter+'-sword-path';this.scene.add(root);
      const heavy=e.slot==='heavy',count=heavy?1:2;
      const arc=heavy?.95:1.3,thick=heavy?.1:.2;
      for(let i=0;i<count;i++){const mesh=this.slashMesh();applySlashStyle(mesh.material,SLASH.zoro,e.id*7+i*13,arc,thick);mesh.rotation.z=heavy?1.57:i*.85-.5;mesh.position.z=i*.035;root.add(mesh);meshes.push(mesh);}
      this.slashes.push({event:e,root,meshes,light:SLASH_LIGHT.zoro});if(this.slashes.length>32)this.remove(this.slashes.shift()!);
    }
    if(e.kind==='release'&&e.origin&&e.endpoint&&e.fighter==='mihawk'&&e.slot==='special'&&!e.branch){
      const root=new THREE.Group(),meshes:SlashMesh[]=[];root.name='mihawk-black-blade-wave';this.scene.add(root);
      for(let i=0;i<2;i++){const mesh=this.slashMesh();applySlashStyle(mesh.material,SLASH.mihawk,e.id,1.2,.19,i===1);root.add(mesh);meshes.push(mesh);}
      this.slashes.push({event:e,root,meshes,light:SLASH_LIGHT.mihawk});
      if(this.slashes.length>32)this.remove(this.slashes.shift()!);
    }
    if(e.kind==='cast'&&e.origin&&e.endpoint&&e.fighter&&STAND_USERS[e.fighter]?.heavy==='finger'&&e.slot==='heavy'&&!e.branch){
      const root=new THREE.Group();root.name='star-finger';root.visible=false;
      const shaft=new THREE.Mesh(this.fingerGeometry,this.fingerMaterial),core=new THREE.Mesh(this.fingerGeometry,this.fingerCoreMaterial),tip=new THREE.Mesh(this.fingerTipGeometry,this.fingerMaterial);
      shaft.name='star-finger-shaft';core.name='star-finger-core';tip.name='star-finger-tip';root.add(shaft,core,tip);this.scene.add(root);
      this.fingers.push({event:e,root,shaft,core,tip});if(this.fingers.length>8)this.removeFinger(this.fingers.shift()!);
    }
    if(['hit','guard-break','blocked'].includes(e.kind)){
      for(const slash of this.slashes)if(slash.event.actorId===e.actorId&&slash.event.slot===e.slot&&e.serverTime>slash.event.serverTime&&slash.hitAt===undefined){slash.hitAt=e.serverTime;if(e.endpoint)slash.hitPoint=new THREE.Vector3(e.endpoint.x,e.endpoint.y,e.endpoint.z);}
      if(e.endpoint)for(const finger of this.fingers)if(finger.event.actorId===e.actorId&&e.slot==='heavy'&&!e.branch&&e.serverTime>finger.event.serverTime&&finger.hitAt===undefined){finger.hitAt=e.serverTime;finger.hitPoint=new THREE.Vector3(e.endpoint.x,e.endpoint.y,e.endpoint.z);}
    }
  }}
  static fingerReach(age:number,hitAt?:number){
    const move=MOVES.jotaro.heavy,contact=move.contacts[0],speed=move.speed??40;
    const out=Math.max(0,age-contact)*speed;
    const stopAt=hitAt!==undefined?Math.min(move.range,Math.max(0,hitAt-contact)*speed):move.range;
    const reachedAt=contact+stopAt/speed;
    if(age<reachedAt)return Math.min(out,stopAt);
    return Math.max(0,stopAt-Math.max(0,age-reachedAt-FINGER_HOLD)*FINGER_RETRACT);
  }
  static rollerAt(elapsed:number,finisher:number){return rollerAt(elapsed,finisher);}
  private removeFinger(f:Finger){f.root.removeFromParent();}
  private victimOf(owner:Fighter,fighters:ReadonlyMap<string,Fighter>):Fighter|undefined{
    const s=owner.state,fx=Math.sin(s.yaw),fz=Math.cos(s.yaw);let best:Fighter|undefined,score=-Infinity;
    for(const [id,body] of fighters){const q=body.state;
      if(id===s.id||!q.alive||id.startsWith('warm-')||(s.team!==undefined&&q.team===s.team))continue;
      const dx=q.x-s.x,dz=q.z-s.z,d=Math.hypot(dx,dz);if(d>STAND_REACH||d<1e-3)continue;
      const along=(dx*fx+dz*fz)/d;if(along<.6)continue;
      const value=along*2-d;if(value>score){score=value;best=body;}}
    return best;
  }
  private barrageState(into:PlayerState,s:PlayerState,fighter:FighterId,elapsed:number,from:number){
    const ora=MOVES[fighter].special,first=ora.contacts[0],loop=ora.contacts[Math.min(BARRAGE_LOOP,ora.contacts.length-1)]-first,t=elapsed-from;
    const clock=t<BARRAGE_LEAD?first-BARRAGE_LEAD+t:first+(t-BARRAGE_LEAD)%loop;
    into.action='special';into.actionStarted=s.actionStarted+from;into.actionDuration=ora.duration;into.actionTime=clock/ora.duration;into.actionSeq=s.actionSeq;into.chain=0;
  }
  private ultimate(fighter:FighterId,awakened:boolean):UltimateTiming{
    let both=this.ultimates.get(fighter);
    if(!both){both=[false,true].map(a=>{const move=moveFor(fighter,'ultimate',a),stop=move.timeStop!,stopFrom=move.contacts[stop.contact],blows=tourContacts(move);
      return {contacts:move.contacts,stop,stopFrom,finisher:move.contacts[move.contacts.length-1],barrageFrom:(blows?move.contacts[blows.first]:stopFrom)-BARRAGE_LEAD,barrageTo:(blows?move.contacts[blows.last]:stopFrom)+BARRAGE_TAIL};});this.ultimates.set(fighter,both);}
    return both[awakened?1:0];
  }
  private standFor(id:string,owner:Fighter,user:StandUser){
    let stand=this.stands.get(id);if(stand)return stand;
    const s=owner.state,fighter=s.fighter,source=this.sources.get(fighter);if(!source)return undefined;
    stand=new Fighter({...s,id:id+'-stand',awakened:false},source,false,[...this.rushClips.get(fighter)??[],...standEnderClips(fighter,owner,source)]);stand.stand=true;stand.prepareRush();
    stand.dynamics=false;
    stand.group.rotation.order='YXZ';
    stand.model.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh&&m.geometry.morphAttributes.position)m.castShadow=false;});stand.group.name=user.name;stand.model.traverse(o=>{if(!(o as THREE.Mesh).isMesh)return;const m=o as THREE.Mesh;for(const mat of Array.isArray(m.material)?m.material:[m.material]){mat.transparent=true;mat.opacity=.94;}});this.stands.set(id,stand);this.scene.add(stand.group);
    this.looms.set(id,{presence:0,surge:0,bearing:s.yaw,height:s.y,placed:false,clock:0,risen:0,state:{...stand.state},stare:new THREE.Vector3(),shadow:stand.group.getObjectByName('contact-shadow'),
      bones:BEND_BONES.map(name=>stand!.joints.get(name) as THREE.Bone|undefined),rest:BEND_BONES.map(()=>new THREE.Quaternion()),bent:false,casters:[],casting:true});
    stand.model.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh&&m.castShadow)this.looms.get(id)!.casters.push(m);});
    const look=STAND_SHELL[fighter];if(look){const chest=new THREE.Object3D();chest.position.y=1.2;stand.group.add(chest);this.looms.get(id)!.anchor=chest;const shell=new GhostShell(stand.model,look.body,look.rim,STAND_OPACITY,look.ink,2.2,false,look.print);shell.fadeNear(chest,1.3,2.6);this.shells.set(id,shell);
      if(id.startsWith('warm-'))shell.enabled=true;}
    return stand;
  }
  private mirror(into:PlayerState,s:PlayerState,barrage:boolean,elapsed:number,barrageFrom:number){
    if(barrage){into.branch=undefined;this.barrageState(into,s,s.fighter,elapsed,barrageFrom);return;}
    into.action=s.action;into.actionStarted=s.actionStarted;into.actionDuration=s.actionDuration;into.actionTime=s.actionTime;into.actionSeq=s.actionSeq;into.chain=s.chain;
    into.branch=s.branch;
  }
  private drawStand(id:string,owner:Fighter,user:StandUser,fighters:ReadonlyMap<string,Fighter>,time:number,dt:number,elapsed:number,barrage:boolean,barrageFrom:number,finisher:number,camera?:THREE.Camera){
    const stand=this.standFor(id,owner,user);if(!stand)return;
    const s=owner.state,fighter=s.fighter,loom=this.looms.get(id)!,shell=this.shells.get(id),st=loom.state;
    if(fighter==='jolyne'&&(s.action==='special'||s.action==='ultimate')&&loom.referenceSeq!==s.actionSeq){
      loom.referenceSeq=s.actionSeq;loom.referencePresent=stand.group.visible;loom.referenceYaw=stand.group.rotation.y;
      if(loom.referencePresent)(loom.referenceFrom??=new THREE.Vector3()).copy(stand.group.position);
    }
    if(fighter==='jolyne'){
      const command=s.alive&&(s.action==='special'||s.action==='ultimate');
      const otherStrike=s.action==='light'||s.action==='heavy';
      if(!command&&loom.referenceActive&&s.alive&&s.awakened&&!otherStrike&&stand.group.visible){
        (loom.referenceFrom??=new THREE.Vector3()).copy(stand.group.position);
        loom.referenceYaw=stand.group.rotation.y;loom.referenceReturn=0;
      }
      if(command||otherStrike||!s.alive||!s.awakened)loom.referenceReturn=undefined;
      loom.referenceActive=command;
    }
    if(fighter==='jolyne'&&loom.stagedYaw!==undefined){stand.group.rotation.y=loom.stagedYaw;loom.stagedYaw=undefined;}
    if(authoredStand(fighter))owner.standSource=stand;
    const awake=!!s.awakened&&s.alive;
    loom.risen=!awake?0:s.action==='awaken'?Math.max(elapsed,loom.risen):loom.risen+dt;
    let goal=0;
    if(awake){
      goal=THREE.MathUtils.smoothstep(loom.risen,LOOM.riseFrom,LOOM.riseTo);
      if(s.awakenedUntil!==undefined)goal=Math.min(goal,THREE.MathUtils.clamp((s.awakenedUntil-time)/LOOM.exit,0,1));
    }
    loom.presence+=(goal-loom.presence)*(1-Math.exp(-dt*(awake?24:5)));
    if(!awake&&loom.presence<.004)loom.presence=0;
    const looming=awake||loom.presence>0;
    const struck=this.victimOf(owner,fighters),lock=s.target?fighters.get(s.target):undefined,foe=struck??(barrage?undefined:lock);
    st.fighter=fighter;st.team=s.team;st.target=s.target;st.hitstop=s.hitstop;st.actionFrozen=s.actionFrozen;
    st.awakened=false;st.alive=true;st.grounded=authoredStand(fighter)?s.grounded:true;st.timeStopped=s.timeStopped;
    if(authoredStand(fighter)){st.confirmedAt=s.confirmedAt;st.whiffedAt=s.whiffedAt;}
    let x:number,y:number,z:number,yaw:number,scale=1,lean=0,shown:boolean;
    if(looming){
      const striking=s.alive&&(s.action==='light'||s.action==='heavy'||s.action==='special'||s.action==='ultimate');
      let want=0;
      if(striking){
        const ender=Fighter.ender(s),contacts=s.action==='light'?rushMove(fighter,s.chain??0,!!s.awakened).contacts:s.action==='ultimate'?undefined
          :(ender&&comboMove(fighter,ender,!!s.awakened)||moveFor(fighter,s.action as AttackSlot,!!s.awakened)).contacts;
        want=elapsed<(contacts?contacts[contacts.length-1]:finisher)+.3?1:0;
      }else if(s.alive&&s.action==='guard')want=LOOM.guard;
      loom.surge+=(want-loom.surge)*(1-Math.exp(-dt*(want>loom.surge?LOOM.surgeIn:LOOM.surgeOut)));
      if(striking||s.alive&&(s.action==='guard'||s.action==='awaken'))this.mirror(st,s,barrage,elapsed,barrageFrom);
      else{st.action='idle';st.actionStarted=0;st.actionDuration=0;st.actionTime=0;st.actionSeq=undefined;st.chain=0;}
      if(!s.hitstop&&!s.timeStopped)loom.clock+=dt;
      const u=loom.surge,calm=1-u,k=loom.presence,rise=k*k*(3-2*k),c=loom.clock*Math.PI*2;
      const p=owner.group.position;
      if(!loom.placed){loom.bearing=s.yaw;loom.height=p.y;loom.placed=true;}
      loom.bearing+=wrap(s.yaw-loom.bearing)*(1-Math.exp(-dt*LOOM.turn));
      loom.height+=(p.y-loom.height)*(1-Math.exp(-dt*LOOM.follow));
      const back=THREE.MathUtils.lerp(LOOM.back,LOOM.strikeBack,u)*rise,side=(THREE.MathUtils.lerp(LOOM.side,LOOM.strikeSide,u)+Math.sin(c*.21+1.3)*LOOM.sway*calm)*rise;
      const lift=THREE.MathUtils.lerp(LOOM.emergeLift,THREE.MathUtils.lerp(LOOM.lift,LOOM.strikeLift,u)+Math.sin(c*LOOM.bobRate)*LOOM.bob*(1-.7*u),rise);
      const fx=Math.sin(loom.bearing),fz=Math.cos(loom.bearing);
      x=p.x-fx*back+fz*side;z=p.z-fz*back-fx*side;y=loom.height+lift;
      yaw=loom.bearing;if(foe&&u>.001)yaw+=wrap(Math.atan2(foe.group.position.x-x,foe.group.position.z-z)-loom.bearing)*u;
      scale=THREE.MathUtils.lerp(LOOM.emergeScale,AWAKENINGS[fighter].formScale??LOOM.scale,rise)*(1+Math.sin(c*LOOM.breatheRate)*LOOM.breathe*(1-.5*u));
      lean=(LOOM.restLean*calm+LOOM.lean*u)*rise;
      shown=true;
      this.standFades.set(id,0);
    }else{
      loom.placed=false;loom.surge=0;
      const string=!!user.string&&s.action==='light'&&(s.grounded||authoredStand(fighter));
      const attacking=s.alive&&(string||s.action==='special'||s.action==='ultimate'||(s.action==='heavy'&&(user.heavy==='finger'||user.heavy==='punch'||!!Fighter.ender(s))));
      const fade=THREE.MathUtils.lerp(this.standFades.get(id)??0,attacking?1:0,1-Math.exp(-dt*(attacking?40:18)));this.standFades.set(id,fade);
      shown=fade>.015;
      if(attacking)this.mirror(st,s,barrage,elapsed,barrageFrom);
      let forward=-.32,side=.62;
      if(string||authoredStand(fighter)&&attacking){const gap=foe?Math.hypot(foe.state.x-s.x,foe.state.z-s.z):STRING_STAND.reach+STRING_STAND.most;forward=THREE.MathUtils.clamp(gap-STRING_STAND.reach,STRING_STAND.least,STRING_STAND.most);side=STRING_STAND.side;}
      x=s.x+Math.sin(s.yaw)*forward+Math.cos(s.yaw)*side;z=s.z+Math.cos(s.yaw)*forward-Math.sin(s.yaw)*side;y=s.y+(string?.12:.3);
      yaw=foe?Math.atan2(foe.state.x-x,foe.state.z-z):s.yaw;
    }
    const nativeJolyneStrike=fighter==='jolyne'&&s.alive&&(s.action==='light'||s.action==='heavy'||s.action==='special'||s.action==='ultimate');
    if(nativeJolyneStrike){
      const gap=foe?Math.hypot(foe.state.x-s.x,foe.state.z-s.z):2;
      const forward=THREE.MathUtils.clamp(gap-.95,.0,1.25),side=.20;
      x=s.x+Math.sin(s.yaw)*forward+Math.cos(s.yaw)*side;
      z=s.z+Math.cos(s.yaw)*forward-Math.sin(s.yaw)*side;
      y=s.y;scale=1;lean=0;yaw=foe?Math.atan2(foe.state.x-x,foe.state.z-z):s.yaw;
    }
    if(fighter==='jolyne'&&looming&&!nativeJolyneStrike){
      const rise=loom.presence*loom.presence*(3-2*loom.presence),side=.55+(JOLYNE_STAND_STAGING.idleSide-.55)*rise;
      x=owner.group.position.x+Math.cos(s.yaw)*side-Math.sin(s.yaw)*JOLYNE_STAND_STAGING.idleBack;
      z=owner.group.position.z-Math.sin(s.yaw)*side-Math.cos(s.yaw)*JOLYNE_STAND_STAGING.idleBack;
      y=owner.group.position.y+JOLYNE_STAND_STAGING.idleLift*rise;scale=1;lean=0;yaw=s.yaw;
    }
    stand.group.visible=shown&&!this.probeHidden;
    if(!shown){if(shell)shell.dissolve=0;setLoomTop(id,0);return;}
    st.x=x;st.y=y;st.z=z;st.yaw=yaw;
    stand.group.scale.setScalar(scale);
    const head=foe?.state.alive?foe.joints.get('Head'):undefined;
    stand.targetPoint=head?head.getWorldPosition(loom.stare):foe?.state.alive?loom.stare.copy(foe.group.position).setY(foe.group.position.y+1.6):undefined;
    this.unbend(loom);
    stand.update(dt,st,true);
    stand.group.rotation.x=lean;
    if(nativeJolyneStrike){
      let flank:number=JOLYNE_STAND_STAGING.flankRadians;
      stand.strikePoint(this.lift);
      const reference=(s.action==='special'||s.action==='ultimate')&&jolyneContactReference(stand.group,stand.joints.get('Hips'),stand.displayedClipName,stand.displayedClipTime,this.lift,this.lift);
      if(camera&&foe&&(s.action==='special'||s.action==='ultimate')){
        const e=camera.matrixWorld.elements,view=Math.atan2(e[0],e[2]);
        const entering=loom.flankSeq!==s.actionSeq;
        if(entering){loom.flankSeq=s.actionSeq;loom.flankView=undefined;loom.flankGoal=jolyneInitialFlank(owner.group.position,foe.group.position,camera);}
        if(loom.flankView===undefined||Math.abs(Math.atan2(Math.sin(view-loom.flankView),Math.cos(view-loom.flankView)))>JOLYNE_STAND_STAGING.viewHysteresis){
          loom.flankGoal=jolyneViewFlank(stand.joints,owner.joints,foe.joints,this.lift,camera,loom.flankGoal??flank);loom.flankView=view;
          if(entering)loom.flank=loom.flankGoal;
        }
        const current=loom.flank??flank,step=JOLYNE_STAND_STAGING.turnSpeed*Math.min(.05,Math.max(0,dt));
        flank=current+THREE.MathUtils.clamp((loom.flankGoal??flank)-current,-step,step);loom.flank=flank;
      }
      loom.stagedYaw=stand.group.rotation.y;jolyneFlankAroundContact(stand.group,this.lift,reference?1:THREE.MathUtils.smoothstep(elapsed,0,.065),flank);
      if(reference&&loom.referencePresent&&loom.referenceFrom&&elapsed<JOLYNE_REFERENCE_ENTRY){
        const u=THREE.MathUtils.smoothstep(elapsed,0,JOLYNE_REFERENCE_ENTRY),from=loom.referenceYaw??stand.group.rotation.y;
        stand.group.position.lerpVectors(loom.referenceFrom,stand.group.position,u);
        stand.group.rotation.y=from+wrap(stand.group.rotation.y-from)*u;stand.group.updateMatrixWorld(true);
      }
    }
    if(fighter==='jolyne'&&!nativeJolyneStrike&&loom.referenceReturn!==undefined&&loom.referenceFrom){
      const u=THREE.MathUtils.smoothstep(loom.referenceReturn,0,JOLYNE_REFERENCE_RETURN),from=loom.referenceYaw??stand.group.rotation.y;
      loom.stagedYaw=stand.group.rotation.y;
      stand.group.position.lerpVectors(loom.referenceFrom,stand.group.position,u);
      stand.group.rotation.y=from+wrap(stand.group.rotation.y-from)*u;stand.group.updateMatrixWorld(true);
      if(u===1)loom.referenceReturn=undefined;
      else if(!s.hitstop&&!s.timeStopped)loom.referenceReturn+=Math.max(0,dt);
    }
    if(looming&&fighter!=='jolyne'&&!nativeJolyneStrike)this.bend(stand,loom,THREE.MathUtils.lerp(LOOM.bend,LOOM.strikeBend,loom.surge)*loom.presence,THREE.MathUtils.lerp(LOOM.tilt,LOOM.strikeTilt,loom.surge)*loom.presence);
    const neck=looming?loom.bones[3]??stand.joints.get('Head'):undefined;
    setLoomTop(id,neck?(neck.getWorldPosition(this.lift).y-owner.group.position.y)*loom.presence:0);
    if(loom.shadow)loom.shadow.visible=false;
    const casting=!looming||loom.presence>.97;
    if(casting!==loom.casting){loom.casting=casting;for(const m of loom.casters)m.castShadow=casting;}
    if(shell){
      shell.enabled=true;shell.opacity=STAND_OPACITY*(looming?1:this.standFades.get(id)!);shell.clock=time;
      shell.dissolve=looming?1-loom.presence:0;
      if(loom.anchor)loom.anchor.position.y=looming?.55:1.2;
      if(looming)shell.fadeRange(LOOM.near,LOOM.far,loom.bones[3]);else shell.fadeRange(1.3,2.6);
      const target=lock&&lock!==owner&&lock.state.alive?lock:foe;
      shell.setWindow(0,target,LOOM.keepTarget);
      shell.setWindow(1,looming||fighter==='jolyne'?owner:undefined,fighter==='jolyne'?JOLYNE_STAND_STAGING.ownerWindow:LOOM.keepUser);
      const local=SIGNATURE.localId===undefined?undefined:fighters.get(SIGNATURE.localId);
      const theirs=local&&local!==owner&&local.state.target?fighters.get(local.state.target):undefined;
      shell.setWindow(2,theirs&&theirs!==target&&theirs!==owner&&theirs.state.alive?theirs:undefined,LOOM.keepTarget);
    }
    this.barrageFists(stand,fighter,s,foe,elapsed,barrage);
  }
  private bend(stand:Fighter,loom:Loom,amount:number,tilt=0){
    if(Math.abs(amount)<1e-4&&Math.abs(tilt)<1e-4)return;
    stand.group.updateMatrixWorld(true);
    stand.group.getWorldQuaternion(this.bendParent);
    const axis=this.bendAxis.set(1,0,0).applyQuaternion(this.bendParent),across=this.bendAcross.set(0,0,1).applyQuaternion(this.bendParent);
    for(let i=0;i<loom.bones.length;i++){
      const bone=loom.bones[i];if(!bone?.parent)continue;
      loom.rest[i].copy(bone.quaternion);
      const share=i<3?1/3:BEND_NECK;
      this.bendWorld.setFromAxisAngle(axis,amount*share).multiply(this.bendTilt.setFromAxisAngle(across,tilt*share));
      bone.parent.getWorldQuaternion(this.bendParent);
      this.bendLocal.copy(this.bendParent).invert().multiply(this.bendWorld).multiply(this.bendParent);
      bone.quaternion.premultiply(this.bendLocal);
      bone.updateMatrixWorld(true);
    }
    loom.bent=true;
    stand.bones.get('righthand')?.getWorldPosition(stand.handR);stand.bones.get('lefthand')?.getWorldPosition(stand.handL);
  }
  private unbend(loom:Loom){
    if(!loom.bent)return;
    for(let i=0;i<loom.bones.length;i++)loom.bones[i]?.quaternion.copy(loom.rest[i]);
    loom.bent=false;
  }
  private barrageFists(stand:Fighter,fighter:FighterId,s:PlayerState,foe:Fighter|undefined,elapsed:number,barrage:boolean){
    if(authoredStand(fighter)){
      if(s.action!=='light'&&s.action!=='heavy'&&s.action!=='special'&&s.action!=='ultimate')return;
      const slot=s.action as AttackSlot,ender=Fighter.ender(s),move=ender?comboMove(fighter,ender,false):slot==='light'?rushMove(fighter,s.chain??0,false):moveFor(fighter,slot,false);
      if(!move)return;const times=move.contacts,glow=STAND_GLOW[fighter]!;
      for(let i=0;i<times.length;i++){
        if(slot==='ultimate'&&i>0&&s.confirmedAt===undefined)continue;
        const near=1-Math.min(1,Math.abs(elapsed-times[i])/.11);if(near<=0)continue;
        const alternate=!ender&&(slot==='special'||slot==='ultimate');
        const hand=fighter==='jolyne'&&stand.meleeContactPoint(i,this.lift)?this.lift:alternate&&i%2?stand.handL:stand.handR;
        this.glows.add(hand,.17+.06*near,glow,.38*near,RING,.025,0);
      }
      return;
    }
    const fists=this.fists.get(fighter);
    const ora=MOVES[fighter].special;
    if(!fists||!foe||!((s.action==='special'&&!Fighter.ender(s)&&elapsed>ora.contacts[0]-.3&&elapsed<ora.contacts[ora.contacts.length-1]+.3)||barrage))return;
    let fistCount=this.fistCounts.get(fighter)??0;const wrist=stand.bones.get('righthand');const target=this.barrageTarget;target.copy(foe.group.position).add(this.lift.set(0,1.12,0));if(wrist)wrist.getWorldQuaternion(this.fistPose.quaternion);
    if(!barrage){const reach=meleeReach(fighter,'special',ora),dx=target.x-s.x,dz=target.z-s.z,d=Math.hypot(dx,dz);if(d>reach){const edge=reach-PLAYER_RADIUS;target.x=s.x+dx/d*edge;target.z=s.z+dz/d*edge;}}
    const glow=STAND_GLOW[fighter]!;
    this.barrageFrom.copy(target).sub(stand.handR).normalize();this.knifeSide.crossVectors(UP,this.barrageFrom).normalize();
    for(let k=0;k<30&&fistCount<94;k++){const phase=(elapsed*5.5+k*.618)%1,lateral=((k%8)/7*2-1)*.95,rise=(((k*3)%5)/4*2-1)*.55,spread=1-.8*phase;
      this.fistPose.position.copy(stand.handR).lerp(target,phase).addScaledVector(this.knifeSide,lateral*spread).addScaledVector(UP,rise*spread);this.fistPose.scale.setScalar(2.5+phase*.4);this.fistPose.updateMatrix();fists.setMatrixAt(fistCount++,this.fistPose.matrix);
      if(k%2===0){this.smearTail.copy(this.fistPose.position).addScaledVector(this.barrageFrom,-.32);this.fistPose.position.copy(this.smearTail);this.fistPose.scale.setScalar(2.1+phase*.3);this.fistPose.updateMatrix();fists.setMatrixAt(fistCount++,this.fistPose.matrix);}
      this.smearTail.copy(this.fistPose.position).addScaledVector(this.barrageFrom,-(.3+.3*phase));this.bolts.segment(this.smearTail,this.fistPose.position,.06,glow,.5*(1-phase*.4),.12);}
    this.fistCounts.set(fighter,fistCount);
    const beats=barrage?this.ultimate(fighter,!!s.awakened).contacts:MOVES[fighter].special.contacts;let near=0;for(const c of beats)near=Math.max(near,1-Math.min(1,Math.abs(elapsed-c)/.06));
    if(near>0){this.glows.add(target,.9*near,glow,near,STAR,.18,Math.floor(elapsed*30));this.glows.add(target,.7,glow,.6*near,RING,.05,0,.3+.5*(1-near));}
    this.lights.add(target,3,glow,.25+.35*near);
  }
  private trace(id:string,owner:Fighter,fighter:FighterId,touring:boolean,time:number){
    let last=this.lastAt.get(id),ghost=this.ghostAt.get(id);
    if(!last){last=owner.group.position.clone();this.lastAt.set(id,last);}
    if(!ghost){ghost=owner.group.position.clone();this.ghostAt.set(id,ghost);}
    if(touring&&last.distanceToSquared(owner.group.position)>TRAIL_STEP*TRAIL_STEP){
      const trail=this.trails[this.trailNext++%this.trails.length];trail.from.copy(last);trail.to.copy(owner.group.position);trail.born=time;trail.fighter=fighter;
      if(ghost.distanceToSquared(owner.group.position)>GHOST_STEP*GHOST_STEP){VfxKit.for(this.scene).ghosts.spawn(owner,ghostTint(fighter),time,.28,.65);ghost.copy(owner.group.position);}
    }else if(!touring)ghost.copy(owner.group.position);
    last.copy(owner.group.position);
  }
  update(time:number,dt:number,fighters:ReadonlyMap<string,Fighter>,density=1,camera?:THREE.Camera){
    this.bankai.update(time,dt,fighters,density);this.santoryu.update(time,dt,fighters,density);
    this.fistCounts.clear();this.lights.begin();this.bolts.begin();this.glows.begin(time);
    let spent=0;
    for(const [id,owner] of fighters){const user=STAND_USERS[owner.state.fighter];if(!user)continue;const fighter=owner.state.fighter,s=owner.state,elapsed=s.actionTime*s.actionDuration;
      if(authoredStand(fighter)){
        const started=performance.now(),move=moveFor(fighter,'ultimate',!!s.awakened);
        this.drawStand(id,owner,user,fighters,time,dt,elapsed,false,0,move.contacts[move.contacts.length-1],camera);
        if(!id.startsWith('warm-'))spent+=performance.now()-started;
        continue;
      }
      const {stop,stopFrom,finisher,barrageFrom,barrageTo}=this.ultimate(fighter,!!s.awakened);
      const barrage=s.alive&&s.action==='ultimate'&&s.confirmedAt!==undefined&&elapsed>=barrageFrom&&elapsed<barrageTo;
      const started=performance.now();
      this.drawStand(id,owner,user,fighters,time,dt,elapsed,barrage,barrageFrom,finisher,camera);
      if(!id.startsWith('warm-'))spent+=performance.now()-started;
      this.trace(id,owner,fighter,s.alive&&s.action==='ultimate'&&s.confirmedAt!==undefined&&elapsed>stopFrom&&elapsed<finisher+.05,time);
      let field=this.timeFields.get(id);if(!field){const dome=new THREE.Mesh(this.ringGeometry,this.domeMaterial.clone());dome.name='the-world-time-stop';dome.renderOrder=22;dome.frustumCulled=false;const still=new THREE.Mesh(this.ringGeometry,this.stillMaterial.clone());still.name='the-world-stillness';still.renderOrder=21;still.frustumCulled=false;field={dome,still,origin:new THREE.Vector3(),anchored:false};this.timeFields.set(id,field);this.scene.add(dome,still);}
      const stopTo=Math.min(stopFrom+stop.duration,whiffGone(s)),stopped=s.action==='ultimate'&&elapsed>=stopFrom&&elapsed<stopTo;
      field.dome.visible=field.still.visible=stopped;
      if(stopped){
        const inside=elapsed-stopFrom,left=stopTo-elapsed;
        if(!field.anchored){field.origin.set(s.x,s.y,s.z);field.anchored=true;}
        const origin=field.origin;
        const sweep=THREE.MathUtils.smoothstep(inside,0,.35),edge=(1-THREE.MathUtils.smoothstep(inside,.25,.5))+(1-THREE.MathUtils.smoothstep(left,0,.25))*.6;
        const hold=THREE.MathUtils.smoothstep(inside,.2,.45)*THREE.MathUtils.smoothstep(left,.05,.3);
        field.dome.position.set(origin.x,origin.y+1,origin.z);field.still.position.copy(field.dome.position);
        field.dome.scale.setScalar(stop.radius*Math.max(.05,inside<.5?sweep:1));field.dome.visible=edge>.01;field.dome.material.uniforms.opacity.value=edge;
        const local=SIGNATURE.localId===undefined?undefined:fighters.get(SIGNATURE.localId);
        const held=!local||local===owner||Math.hypot(local.state.x-origin.x,local.state.z-origin.z)<stop.radius;
        const screen=SIGNATURE.screen;
        if(held&&typeof screen?.timeStop==='function'){if(field.graded===undefined)screen.impactFrame?.(1);screen.timeStop(hold);field.still.visible=false;field.graded=hold;}
        else{field.still.scale.setScalar(stop.radius);field.still.visible=hold>.01;(field.still.material.uniforms.tint.value as THREE.Color).setRGB(1,1,1).lerp(STILL,hold);}
      }else{field.anchored=false;if(field.graded!==undefined){SIGNATURE.screen?.timeStop?.(0);field.graded=undefined;}}
      if(fighter==='dio'){
        const at=s.action==='ultimate'&&s.alive&&s.confirmedAt!==undefined?rollerAt(elapsed,finisher):undefined;
        if(at)this.dropRoller(id,owner,fighters,at,time,stop.radius);
        else if(this.rollerSet?.get(id)?.live)this.rollerSet.release(id);
      }
    }
    for(const trail of this.trails){const age=time-trail.born;if(!(age>=0&&age<TRAIL_LIFE))continue;const k=1-age/TRAIL_LIFE,glow=STAND_GLOW[trail.fighter]??STAND_GLOW.jotaro!;
      for(const h of TRAIL_HEIGHTS){this.smearTail.copy(trail.from);this.smearTail.y+=h;this.barrageFrom.copy(trail.to);this.barrageFrom.y+=h;this.bolts.segment(this.smearTail,this.barrageFrom,.11*k,glow,.6*k,.15);}
      if(age<.12){this.lift.copy(trail.to);this.lift.y+=1.05;this.glows.add(this.lift,1.1*k,glow,.5*k,RING,.05,0,.6);}}
    for(const [fighter,fists]of this.fists){fists.count=this.fistCounts.get(fighter)??0;fists.instanceMatrix.needsUpdate=true;}
    let knifeCount=0;
    for(const actor of fighters.values()){
      const s=actor.state,elapsed=s.actionTime*s.actionDuration;
      const ender=Fighter.ender(s),thrown=(ender&&comboMove('dio',ender,!!s.awakened)||MOVES.dio.heavy).contacts[0];
      if(s.fighter!=='dio'||s.action!=='heavy'||!s.alive||ender&&!actor.slotClip(s,['Knife Throw'])||elapsed>=thrown||knifeCount+KNIVES>KNIVES*KNIFE_FLIGHTS)continue;
      const knives=this.knifeMesh(),hand=actor.joints.get('RightHand');
      const index=hand?.getObjectByName('RightHandIndex2'),middle=hand?.getObjectByName('RightHandMiddle2');
      this.knifePose.position.copy(actor.handR);
      if(index&&middle)this.knifePose.position.copy(index.getWorldPosition(this.knifeAim)).lerp(middle.getWorldPosition(this.knifeSide),.5);
      this.knifeAim.set(Math.sin(s.yaw),.7,Math.cos(s.yaw)).normalize();
      this.knifeSide.crossVectors(UP,this.knifeAim).normalize();
      const grip=this.knifeGrip.copy(this.knifePose.position);
      for(let k=0;k<KNIVES;k++){
        const spread=k-(KNIVES-1)/2;
        this.knifePose.position.copy(grip).addScaledVector(this.knifeSide,spread*.025).addScaledVector(this.knifeAim,.07);
        this.knifePose.quaternion.setFromUnitVectors(FORWARD,this.knifeAim);this.knifePose.updateMatrix();knives.setMatrixAt(knifeCount++,this.knifePose.matrix);
      }
    }
    for(const flight of FLIGHTS.values()){
      if(flight.fighter!=='dio'||flight.slot!=='heavy'||!flight.released||knifeCount>=KNIVES*KNIFE_FLIGHTS)continue;
      const knives=this.knifeMesh();
      this.knifeSide.crossVectors(UP,flight.heading).normalize();
      for(let k=0;k<KNIVES;k++){const spread=k-(KNIVES-1)/2;
        this.knifeAim.copy(flight.heading).addScaledVector(this.knifeSide,spread*KNIFE_FAN).normalize();
        this.knifePose.position.copy(flight.position).addScaledVector(this.knifeSide,spread*KNIFE_SPREAD).addScaledVector(UP,Math.abs(spread)*-.05);
        this.knifePose.quaternion.setFromUnitVectors(FORWARD,this.knifeAim);this.knifePose.updateMatrix();knives.setMatrixAt(knifeCount++,this.knifePose.matrix);}
    }
    if(this.knives){this.knives.count=knifeCount;this.knives.visible=knifeCount>0;if(knifeCount)this.knives.instanceMatrix.needsUpdate=true;}
    for(let i=this.fingers.length-1;i>=0;i--){
      const finger=this.fingers[i],e=finger.event,move=MOVES.jotaro.heavy,contact=move.contacts[0],age=time-e.serverTime,actor=fighters.get(e.actorId);
      const reach=SwordStandEffects.fingerReach(age,finger.hitAt);
      const spent=age>contact+.05&&reach<=0;
      if(spent||age>move.duration+.5||(age<contact&&chargeWasCancelled(e,contact,actor?.state,time))){this.removeFinger(finger);this.fingers.splice(i,1);continue;}
      finger.root.visible=age>=contact&&reach>0;
      if(!finger.root.visible)continue;
      const stand=this.stands.get(e.actorId);
      if(stand&&stand.group.visible)this.fingerFrom.copy(stand.handR);else if(actor)this.fingerFrom.copy(actor.handR);else this.fingerFrom.set(e.origin!.x,e.origin!.y,e.origin!.z);
      const target=finger.hitPoint??this.fingerTipAt.set(e.endpoint!.x,e.endpoint!.y,e.endpoint!.z);
      this.fingerDir.copy(target).sub(this.fingerFrom);if(this.fingerDir.lengthSq()<1e-6)this.fingerDir.set(Math.sin(e.origin!.y),0,Math.cos(e.origin!.y));this.fingerDir.normalize();
      finger.root.position.copy(this.fingerFrom);finger.root.quaternion.setFromUnitVectors(UP,this.fingerDir);
      const width=.075*(1-.35*Math.min(1,reach/move.range))*(stand&&stand.group.visible?stand.group.scale.x:1);
      finger.shaft.position.y=reach/2;finger.shaft.scale.set(width,Math.max(.01,reach),width);
      finger.core.position.y=reach/2;finger.core.scale.set(width*.45,Math.max(.01,reach),width*.45);
      finger.tip.position.y=reach;finger.tip.scale.setScalar(width*1.5);
      this.barrageFrom.copy(this.fingerFrom).addScaledVector(this.fingerDir,reach);this.bolts.segment(this.fingerFrom,this.barrageFrom,.16,STAND_GLOW.jotaro!,.8,.18);this.lights.add(this.barrageFrom,2.5,STAND_GLOW.jotaro!,.4);
    }
    for(const [id,stand]of this.stands)if(!fighters.has(id)&&!id.startsWith('warm-')){setLoomTop(id,0);stand.dispose();this.stands.delete(id);this.shells.get(id)?.dispose();this.shells.delete(id);this.looms.delete(id);const field=this.timeFields.get(id);if(field)this.removeField(field);this.timeFields.delete(id);this.rollerSet?.release(id);this.lastAt.delete(id);this.ghostAt.delete(id);}
    for(let i=this.slashes.length-1;i>=0;i--){const slash=this.slashes[i],e=slash.event,move=MOVES[e.fighter!][e.slot!],age=time-e.serverTime,contact=e.kind==='release'?0:move.contacts[0],actor=fighters.get(e.actorId),flight=move.style==='projectile',beam=move.style==='beam',duration=flight?contact+move.range/(move.speed??30):move.duration;
      if(age>duration+.15||(!slash.hitAt&&age<contact&&chargeWasCancelled(e,contact,actor?.state,time))){this.remove(slash);this.slashes.splice(i,1);continue;}
      const active=age>=contact-.12,progress=Math.max(0,age-contact);slash.root.visible=active;
      if(!active)continue;
      const yaw=Math.atan2(e.endpoint!.x-e.origin!.x,e.endpoint!.z-e.origin!.z);slash.root.rotation.set(0,yaw,0);
      if(flight){const distance=Math.min(move.range,progress*(move.speed??30));
        if(e.fighter==='mihawk'){
          const span=Math.hypot(e.endpoint!.x-e.origin!.x,e.endpoint!.z-e.origin!.z),t=Math.min(1,distance/Math.max(.01,span));
          slash.root.position.set(e.origin!.x+(e.endpoint!.x-e.origin!.x)*t,e.origin!.y+(e.endpoint!.y-e.origin!.y)*t,e.origin!.z+(e.endpoint!.z-e.origin!.z)*t);
          if(slash.hitPoint)slash.root.position.copy(slash.hitPoint);
          slash.root.scale.set(2.5,2.35,1);
        }else{slash.root.position.set(e.origin!.x+Math.sin(yaw)*distance,e.origin!.y+.65,e.origin!.z+Math.cos(yaw)*distance);slash.root.scale.setScalar(e.fighter==='zoro'?3.3:3.6);}
      }
      else if(beam){slash.root.position.set(e.origin!.x+Math.sin(yaw)*Math.min(move.range,progress*70),e.origin!.y+2.8,e.origin!.z+Math.cos(yaw)*Math.min(move.range,progress*70));slash.root.scale.set(6,7.5,1);}
      else if(actor){slash.root.position.copy(actor.group.position).add(this.knifeAim.set(Math.sin(yaw)*1.25,1.1,Math.cos(yaw)*1.25));slash.root.scale.setScalar(e.slot==='ultimate'?4.2:2);slash.root.rotation.z=progress*10;if(e.fighter==='zoro'&&e.slot==='heavy')slash.root.scale.y=.45;}
      const fade=slash.hitAt?1-THREE.MathUtils.smoothstep(time-slash.hitAt,0,.2):flight?1-THREE.MathUtils.smoothstep(age,duration-.15,duration+.15):1-THREE.MathUtils.smoothstep(progress,beam?.35:.08,beam?.85:.35);
      for(const m of slash.meshes){m.material.uniforms.uFade.value=fade;m.material.uniforms.uClock.value=time;}
      this.lights.add(slash.root.position,flight?4:beam?7:3,slash.light,fade*(beam?.55:flight?.6:.4));
    }
    this.lights.end();this.bolts.end();this.glows.end();
    this.cost[this.costAt]=spent;this.costAt=(this.costAt+1)%this.cost.length;
  }
  private dropRoller(id:string,owner:Fighter,fighters:ReadonlyMap<string,Fighter>,at:RollerPose,time:number,radius:number){
    const s=owner.state,roller=this.rollers.for(id),kit=this.vfx,glow=STAND_GLOW.dio!;
    if(!roller.live){
      roller.live=true;roller.landed=roller.broke=false;roller.yaw=s.yaw;roller.nextSmoke=0;
      const origin=this.timeFields.get(id)?.origin,primary=s.target?fighters.get(s.target):undefined;
      const caught=primary&&primary.state.alive&&(!origin||Math.hypot(primary.state.x-origin.x,primary.state.z-origin.z)<radius);
      const foe=caught?primary:this.victimOf(owner,fighters);
      roller.target=foe?.state.id;
      if(foe)roller.spot.copy(foe.group.position);else roller.spot.set(s.x+Math.sin(s.yaw)*2.6,s.y,s.z+Math.cos(s.yaw)*2.6);
    }
    if(at.since<0&&roller.target){const foe=fighters.get(roller.target);if(foe)roller.spot.copy(foe.group.position);}
    roller.group.visible=true;
    roller.pose(at,at.since>=0&&at.broken===0?.05*Math.exp(-at.since*4):0);
    const p=roller.spot;
    if(at.since<0&&at.height>.3&&(at.since<-ROLLER_TIMING.hold||at.since>-ROLLER_TIMING.slam))for(let k=0;k<7;k++){const a=k*.9;this.smearTail.set(p.x+Math.cos(a)*1.1,p.y+at.height+2.4+(k%3)*.4,p.z+Math.sin(a)*1.1);this.barrageFrom.copy(this.smearTail);this.barrageFrom.y+=1.4+(k%2)*.8;this.bolts.segment(this.smearTail,this.barrageFrom,.035,glow,.6,.2);}
    if(at.since>=0&&!roller.landed){roller.landed=true;
      kit.groundImpact(p.x,p.y,p.z,0,1,0,3,time,undefined,p.y);
      kit.dustRing(p.x,p.y,p.z,12,1.3,5.5,1.2,time,.9);
      kit.pulse(p.x,p.y+1.6,p.z,0xffc84a,9,9,time,.8,2);}
    if(at.since>=0&&at.since<.4){const k=1-at.since/.4;this.lift.set(p.x,p.y+1.5,p.z);this.glows.add(this.lift,3.6*k,glow,k,STAR,.2,7);this.glows.add(this.lift,2.4,glow,.7*k,RING,.05,0,.2+.8*(1-k));}
    if(at.since>=0&&at.broken<.4&&time>=roller.nextSmoke){roller.nextSmoke=time+.07/Math.max(.4,kit.density);
      const a=Math.random()*Math.PI*2,r=.4+Math.random()*.8;kit.smoke(p.x+Math.cos(a)*r,p.y+1.2+Math.random()*1.4,p.z+Math.sin(a)*r,Math.cos(a)*.4,1.4+Math.random(),Math.sin(a)*.4,.5+Math.random()*.4,time,.7);}
    if(at.broken>0&&!roller.broke){roller.broke=true;kit.debris.burst(kit.n(14,4),p.x,p.y+1,p.z,0,1,0,7,1.1,.14,p.y,2);this.lift.set(p.x,p.y+1.2,p.z);kit.pulse(p.x,p.y+1.2,p.z,0xffc84a,5,6,time,.4,1);}
  }
  private removeField(f:TimeField){for(const m of [f.dome,f.still]){m.removeFromParent();m.material.dispose();}if(f.graded!==undefined)SIGNATURE.screen?.timeStop?.(0);}
  private remove(s:Slash){s.root.removeFromParent();for(const m of s.meshes){m.material.uniforms.uFade.value=0;this.slashHolder.add(m);this.slashPool.push(m);}s.meshes.length=0;}
  reset(){clearLoomTops();this.bankai.reset();this.santoryu.reset();for(const s of this.slashes)this.remove(s);this.slashes=[];for(const f of this.fingers)this.removeFinger(f);this.fingers=[];this.seen.clear();for(const [id,s]of this.stands)if(!id.startsWith('warm-')){s.dispose();this.stands.delete(id);this.shells.get(id)?.dispose();this.shells.delete(id);this.looms.delete(id);}this.standFades.clear();for(const fists of this.fists.values())fists.count=0;if(this.knives)this.knives.count=0;for(const f of this.timeFields.values())this.removeField(f);this.timeFields.clear();this.bolts.begin();this.bolts.end();this.glows.begin(0);this.glows.end();this.rollerSet?.reset();this.lastAt.clear();this.ghostAt.clear();for(const trail of this.trails)trail.born=-Infinity;}
  dispose(){this.reset();this.bankai.dispose();this.santoryu.dispose();this.ghostWarm.dispose();for(const s of this.stands.values())s.dispose();this.stands.clear();this.looms.clear();for(const shell of this.shells.values())shell.dispose();this.shells.clear();for(const fists of this.fists.values()){fists.removeFromParent();fists.geometry.dispose();(fists.material as THREE.Material).dispose();fists.dispose();}this.fists.clear();if(this.knives){this.knives.removeFromParent();this.knives.dispose();this.knives=undefined;}this.knifeGeometry.dispose();this.knifeMaterial.dispose();this.rollerSet?.dispose();this.rollerSet=undefined;if(this.kit){this.kit.release();this.kit=undefined;}this.plane.dispose();for(const m of this.slashPool)m.material.dispose();this.slashPool=[];this.slashHolder.removeFromParent();this.lights.dispose();this.bolts.dispose();this.glows.dispose();this.fieldWarm.removeFromParent();this.stillMaterial.dispose();this.ringGeometry.dispose();this.domeMaterial.dispose();this.fingerGeometry.dispose();this.fingerTipGeometry.dispose();this.fingerMaterial.dispose();this.fingerCoreMaterial.dispose();}
}
