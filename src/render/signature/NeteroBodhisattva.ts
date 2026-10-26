import * as THREE from 'three';
import {GLTFLoader,type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {CombatEvent} from '../../game/types';
import type {Fighter} from '../Fighter';
import type {Flight} from '../CombatEffects';
import type {VfxKit} from '../vfx/VfxKit';
import {bodyCentre} from '../vfx/VfxKit';
import {NeteroVisibility} from './NeteroVisibility';
import {SIGNATURE,involvesLocal} from './context';
import {NETERO_MOVES} from '../../game/fighters/netero';
import {MoveStage,stageLook} from './MoveStage';
import { blowFloor } from './blowFloor';

export const NETERO_BODHISATTVA_ASSETS=Object.freeze(['/assets/fighters/netero-bodhisattva1.glb']);
export const NETERO_BODHISATTVA_LIMITS=Object.freeze({owners:4,armsPerSide:6,flights:8,confirmations:16});
export const isNetero=(id:string|undefined)=>id==='netero';
const UP=new THREE.Vector3(0,1,0),FRONT=new THREE.Vector3(0,0,1),DOWN=new THREE.Vector3(0,-1,0),TAU=Math.PI*2;
const GOLD=stageLook(0xfffbe6,0xf2c14e,0x7a4a12);
const HEAVY=NETERO_MOVES.heavy,SPECIAL=NETERO_MOVES.special,ULT=NETERO_MOVES.ultimate,ULT_LAST=ULT.contacts[ULT.contacts.length-1];
const STATUE=Object.freeze({x:-1.25,y:.65,z:-.45,halo:2.5});
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const ease=(x:number)=>{x=clamp(x);return x*x*(3-2*x);};
const SIDES=['Left','Right']as const;
const PALM_BEATS=[1.394,1.886,2.46,3.444]as const;
const PART_NAMES=new Set(['BodhiTorso',...SIDES.flatMap(s=>['Upper','Fore','Hand'].map(p=>'Bodhi'+s+p))]);
type Part={name:string;mesh:THREE.InstancedMesh<THREE.BufferGeometry,THREE.MeshToonMaterial>;opacity:THREE.InstancedBufferAttribute;pivot:THREE.Vector3;centre:THREE.Vector3;palmVertex?:THREE.Vector3;count:number};
type Receipt={actor:string;target:string;seq:number;final:boolean;point:THREE.Vector3};
type PalmFrame={actor:string;target:string;fighter?:Fighter;seq:number;time:number;duration:number;beats:{count:number;matrices:THREE.Matrix4[];anchors:THREE.Vector3[]}[]};
const drawnPalms=new WeakMap<Fighter,NeteroBodhisattva>();
export function neteroDrawnPalmPoint(fighter:Fighter,contactIndex:number,out:THREE.Vector3,palmIndex=0):boolean{return drawnPalms.get(fighter)?.ultimatePalmPoint(fighter.state.id,contactIndex,out,palmIndex)??false;}
export function neteroDrawnPalmCount(fighter:Fighter,contactIndex:number):number{return drawnPalms.get(fighter)?.ultimatePalmCount(fighter.state.id,contactIndex)??0;}
export class NeteroBodhisattva{
 private visibility=new NeteroVisibility();
 private loading?:Promise<void>;private disposed=false;private source?:GLTF;
 private parts=new Map<string,Part>();private ownedGeometry:THREE.BufferGeometry[]=[];private ownedMaterials:THREE.Material[]=[];
 private receipts:Receipt[]=Array.from({length:NETERO_BODHISATTVA_LIMITS.confirmations},()=>({actor:'',target:'',seq:-1,final:false,point:new THREE.Vector3()}));private cursor=0;
 private seen=new Float64Array(64).fill(-1);private seenAt=new Float64Array(64).fill(-1);private seenCursor=0;
 private palmFrames:PalmFrame[]=Array.from({length:NETERO_BODHISATTVA_LIMITS.owners},()=>({actor:'',target:'',seq:-1,time:0,duration:0,beats:Array.from({length:4},()=>({count:0,matrices:[new THREE.Matrix4(),new THREE.Matrix4()],anchors:[new THREE.Vector3(),new THREE.Vector3()]}))}));
 private base=new THREE.Matrix4();private upper=new THREE.Matrix4();private fore=new THREE.Matrix4();private hand=new THREE.Matrix4();private temp=new THREE.Matrix4();private elongation=new THREE.Matrix4();
 private goalPoint=new THREE.Vector3();private routingPoint=new THREE.Vector3();private position=new THREE.Vector3();private target=new THREE.Vector3();private shoulder=new THREE.Vector3();private elbow=new THREE.Vector3();private wrist=new THREE.Vector3();private direction=new THREE.Vector3();private pole=new THREE.Vector3();private rest=new THREE.Vector3();private scale=new THREE.Vector3();private q=new THREE.Quaternion();private yaw=new THREE.Quaternion();
 private readonly stage:MoveStage;private hits=new Float64Array(64).fill(-1);private hitsAt=new Float64Array(64).fill(-1);private hitCursor=0;
 private a=new THREE.Vector3();private b=new THREE.Vector3();private c=new THREE.Vector3();private dir=new THREE.Vector3();private ground=new THREE.Vector3();private point=new THREE.Vector3();
 constructor(private scene:THREE.Scene,private kit:Pick<VfxKit,'budget'>&Partial<VfxKit>){this.stage=MoveStage.for(scene,kit);}
 load(ids:readonly string[]):Promise<void>{
  if(this.disposed||!ids.some(isNetero))return Promise.resolve();
  return this.loading??=new GLTFLoader().loadAsync(NETERO_BODHISATTVA_ASSETS[0]).then(gltf=>{
   if(this.disposed){this.disposeSource(gltf);return;}this.source=gltf;gltf.scene.updateMatrixWorld(true);
   for(const name of PART_NAMES){
    const node=gltf.scene.getObjectByName(name);if(!node)throw Error('Netero sculpture missing '+name);
    const pivot=node.getWorldPosition(new THREE.Vector3()),surfaces:THREE.BufferGeometry[]=[];let map:THREE.Texture|null=null;
    node.traverse(o=>{if(!(o instanceof THREE.Mesh)||o!==node&&PART_NAMES.has(o.name))return;
     let parent:THREE.Object3D|null=o===node?null:o.parent;while(parent&&parent!==node){if(PART_NAMES.has(parent.name))return;parent=parent.parent;}
     const old=(Array.isArray(o.material)?o.material[0]:o.material)as THREE.MeshStandardMaterial;
     const geo=o.geometry.clone().applyMatrix4(o.matrixWorld).translate(-pivot.x,-pivot.y,-pivot.z);
     for(const key of Object.keys(geo.attributes))if(!['position','normal','uv'].includes(key))geo.deleteAttribute(key);
     const n=geo.attributes.position.count;if(!geo.attributes.uv)geo.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(n*2),2));
     const caps=new Float32Array(n);if(!old.map)caps.fill(1);else map=old.map;
     geo.setAttribute('bodhiCap',new THREE.BufferAttribute(caps,1));surfaces.push(geo.index?geo.toNonIndexed():geo);if(geo.index)geo.dispose();
    });
    if(!surfaces.length)throw Error('Netero sculpture missing surfaces '+name);
    const geometry=mergeGeometries(surfaces,false);for(const g of surfaces)g.dispose();if(!geometry)throw Error('Netero sculpture geometry mismatch '+name);
    geometry.computeBoundingBox();const centre=geometry.boundingBox!.getCenter(new THREE.Vector3());let palmVertex:THREE.Vector3|undefined;
    if(name.endsWith('Hand')){centre.z=geometry.boundingBox!.max.z;const vertices=geometry.attributes.position,point=new THREE.Vector3();let nearest=Infinity;palmVertex=new THREE.Vector3();for(let i=0;i<vertices.count;i++){point.fromBufferAttribute(vertices,i);const distance=point.distanceToSquared(centre);if(Number.isFinite(distance)&&distance<nearest){nearest=distance;palmVertex.copy(point);}}if(!Number.isFinite(nearest))throw Error('Netero sculpture missing finite native palm '+name);}
    const capacity=name==='BodhiTorso'?NETERO_BODHISATTVA_LIMITS.owners:NETERO_BODHISATTVA_LIMITS.owners*NETERO_BODHISATTVA_LIMITS.armsPerSide+NETERO_BODHISATTVA_LIMITS.flights;
    const opacity=new THREE.InstancedBufferAttribute(new Float32Array(capacity),1).setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('bodhiPresence',opacity);
    const material=new THREE.MeshToonMaterial({map,color:0xffffff,emissive:0x35220b,emissiveIntensity:.10,side:THREE.DoubleSide});
    material.onBeforeCompile=shader=>{
     shader.vertexShader='attribute float bodhiPresence;attribute float bodhiCap;varying float vBodhiPresence;varying float vBodhiCap;\n'+shader.vertexShader;
     shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvBodhiPresence=bodhiPresence'+(name==='BodhiTorso'?'*smoothstep(0.0,0.28,position.y)':'')+';vBodhiCap=bodhiCap;');
     shader.fragmentShader='varying float vBodhiPresence;varying float vBodhiCap;\n'+shader.fragmentShader;
     shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(.60,.36,.07),vBodhiCap);');
     shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','#include <alphatest_fragment>\nfloat bodhiDither=fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233)))*43758.5453);if(bodhiDither>vBodhiPresence)discard;');
     this.visibility.compile(shader);
    };material.customProgramCacheKey=()=> 'netero-native-sculpture-v3-'+(name==='BodhiTorso'?'torso':'limb');
    const mesh=new THREE.InstancedMesh(geometry,material,capacity);mesh.name='netero-'+name;mesh.count=0;mesh.visible=false;mesh.castShadow=false;mesh.receiveShadow=false;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.scene.add(mesh);
    mesh.onBeforeRender=(renderer,_scene,camera)=>this.visibility.update(renderer,camera);
    this.parts.set(name,{name,mesh,opacity,pivot,centre,palmVertex,count:0});this.ownedGeometry.push(geometry);this.ownedMaterials.push(material);
   }
  }).catch(error=>{this.clearSurfaces();if(this.source)this.disposeSource(this.source);this.source=undefined;this.loading=undefined;throw error;});
 }
 private landed(e:CombatEvent,fighters?:ReadonlyMap<string,Fighter>){
  for(let i=0;i<this.hits.length;i++)if(this.hits[i]===e.id&&this.hitsAt[i]===e.serverTime)return;
  const actor=fighters?.get(e.actorId),target=e.targetId?fighters?.get(e.targetId):undefined;if(!target&&!e.endpoint)return;
  const index=this.hitCursor++%this.hits.length;this.hits[index]=e.id;this.hitsAt[index]=e.serverTime;
  const st=this.stage,t=e.serverTime,point=this.point,dir=this.dir;
  if(target)bodyCentre(target,point);else point.set(e.endpoint!.x,e.endpoint!.y,e.endpoint!.z);
  const floor=blowFloor(actor, target, point.y-1);
  if(actor){dir.subVectors(point,actor.group.position).setY(0);if(dir.lengthSq()<.01)dir.set(Math.sin(actor.group.rotation.y),0,Math.cos(actor.group.rotation.y));dir.normalize();}else dir.copy(FRONT);
  const ground=this.ground.set(point.x,floor,point.z);
  if(e.slot==='light'){st.burst(point,GOLD,.44,t,{dir,floor,clean:true});return;}
  if(e.slot==='heavy'){const big=e.branch?.85:1;st.burst(point,GOLD,.9*big,t,{dir,floor,clean:true});st.dome(this.a.copy(point).addScaledVector(dir,.35),GOLD,2*big,t,.36);return;}
  if(e.slot==='special'){
   if(e.branch==='airSpecial'){st.burst(point,GOLD,2,t,{floor});st.erupt(this.a.copy(ground).setY(floor+6),DOWN,GOLD,.6,6,t,.3);st.shock(ground,GOLD,5.2,t,.5);st.scar(ground,GOLD,2.2,t+.05,1.8);return;}
   if(e.branch){st.burst(point,GOLD,1.5,t,{dir,floor});return;}
   st.burst(point,GOLD,2,t,{dir,floor});st.dome(point,GOLD,2.4,t,.45);st.shock(ground,GOLD,5.6,t,.5);st.scar(ground,GOLD,2.3,t+.05,2.3);
   return;
  }
  if(e.slot!=='ultimate'||e.branch)return;
  const palm=e.contactIndex??0;
  if(palm===0){st.burst(point,GOLD,1.1,t,{dir,floor});return;}
  if(palm<4){
   st.erupt(this.a.copy(point).setY(floor+6.5),DOWN,GOLD,.5,6.5-(point.y-floor)*.5,t-.03,.3);
   st.burst(point,GOLD,1.1+.15*palm,t,{dir,floor});st.shock(ground,GOLD,4.2+.4*palm,t,.45);st.scar(ground,GOLD,1.2,t+.05,1.1);
   return;
  }
  if(involvesLocal(e.actorId,e.targetId))SIGNATURE.screen?.impactFrame?.(.46,point);
  st.burst(point,GOLD,2.7,t,{dir,floor});
  st.erupt(ground,UP,GOLD,1.3,11,t+.04,.8);
  st.dome(point,GOLD,4.8,t,.5);
  st.shock(ground,GOLD,9.5,t,.6);
  st.shatter(this.a.copy(ground).setY(floor+.06),UP,GOLD,6,t,1.2);
  st.scar(ground,GOLD,3.2,t+.2,2.2);
 }
 private prayer(f:Fighter,out:THREE.Vector3){return f.handL&&f.handR?out.copy(f.handL).lerp(f.handR,.5):out.copy(f.group.position).setY(f.group.position.y+1.2);}
 private staging(time:number,fighters:ReadonlyMap<string,Fighter>,flights:ReadonlyMap<string,Flight>){
  const st=this.stage;
  for(const f of fighters.values()){
   const s=f.state;if(!isNetero(s.fighter)||!s.alive||s.whiffedAt!==undefined)continue;
   const t=s.actionTime*s.actionDuration,seed=(s.actionSeq??0)*4.3,yaw=f.group.rotation.y;
   if((s.action==='light'||s.action==='heavy')&&typeof f.strikePoint==='function'){
    const power=Math.sin(Math.max(0,Math.min(1,s.actionTime))*Math.PI),limb=f.strikePoint(this.a);
    st.glow(limb,.3,GOLD.main,.45*power);st.glow(limb,.12,GOLD.core,.8*power);st.light(limb,1.9,GOLD,.2*power);
    if(s.action==='heavy'&&!s.branch&&t<HEAVY.contacts[0])st.charge(limb,GOLD,.2,clamp(t/HEAVY.contacts[0]),seed);
    continue;
   }
   let alpha=0,g=0;
   if(s.action==='special'&&!s.branch){
    alpha=ease((t-.24)/.17)*(1-ease((t-.9)/.34));
    if(t<SPECIAL.contacts[0])st.charge(this.prayer(f,this.a),GOLD,.32,clamp(t/SPECIAL.contacts[0]),seed);
   }else if(s.action==='ultimate'&&!s.branch){
    const r=this.receipts.find(r=>r.actor===s.id&&r.seq===(s.actionSeq??-1)),target=r?fighters.get(r.target):undefined;
    if(!r){if(s.confirmedAt===undefined&&t<ULT.contacts[0]+.1&&typeof f.strikePoint==='function')st.charge(f.strikePoint(this.a),GOLD,.28,clamp(t/ULT.contacts[0]),seed);continue;}
    if(!target?.state.alive&&!r.final)continue;
    alpha=ease((t-.62)/.33)*(1-ease((t-3.65)/.45));g=clamp((t-ULT.contacts[0])/(ULT_LAST-ULT.contacts[0]));
    if(t<ULT_LAST){st.dim(.3+.4*g,r.actor,r.target);st.pool(this.a.copy(f.group.position),2.2+2.4*g,GOLD,.3+.7*g,seed);if(g>.85)st.speed(.5*(g-.85)/.15,r.actor,r.target);}
   }
   if(alpha<=.02)continue;
   const halo=this.b.set(STATUE.x,STATUE.y+STATUE.halo,STATUE.z).applyAxisAngle(UP,yaw).add(f.group.position);
   st.glow(halo,1.5+.4*g,GOLD.main,.2*alpha);
   this.dir.set(Math.cos(yaw),0,-Math.sin(yaw));
   for(let i=0,n=st.n(12,6);i<n;i++){
    const ang=i*TAU/n+time*.35,cx=Math.cos(ang),sy=Math.sin(ang),inner=1,outer=1.6+.35*g+.2*Math.sin(time*3+i*1.7);
    this.a.copy(halo).addScaledVector(this.dir,cx*inner);this.a.y+=sy*inner;this.c.copy(halo).addScaledVector(this.dir,cx*outer);this.c.y+=sy*outer;
    st.streak(this.a,this.c,.05,GOLD.main,(.55+.25*g)*alpha);
   }
   st.light(this.a.copy(halo).setY(halo.y-1),5+g,GOLD,(.2+.1*g)*alpha);
  }
  for(const flight of flights.values()){
   if(!isNetero(flight.fighter)||flight.slot!=='special'||flight.branch||!flight.released)continue;
   st.glow(flight.position,1.5,GOLD.main,.6);st.glow(flight.position,.55,GOLD.core,.75);
   st.streak(this.a.copy(flight.position).addScaledVector(flight.heading,-2.4),flight.position,.3,GOLD.main,.5);
   st.light(this.a.copy(flight.position).setY(flight.position.y+.2),6,GOLD,.6);
  }
 }
 handle(event:CombatEvent,fighters?:ReadonlyMap<string,Fighter>){
  if(this.disposed)return;
  if(isNetero(event.fighter)&&event.kind==='hit')this.landed(event,fighters);
  if(event.kind==='eliminated'||event.kind==='respawn'){for(const r of this.receipts)if(r.actor===event.actorId||(r.target===event.actorId&&(event.kind==='respawn'||!r.final)))r.actor='';this.clearPalmFrames(event.actorId);return;}
  if(!isNetero(event.fighter))return;
  if(event.kind==='whiff'||event.kind==='rejected'){for(const r of this.receipts)if(r.actor===event.actorId)r.actor='';this.clearPalmFrames(event.actorId);return;}
  if(event.slot!=='ultimate'||event.branch||(event.kind!=='confirm'&&event.kind!=='hit'))return;
  for(let i=0;i<this.seen.length;i++)if(this.seen[i]===event.id&&this.seenAt[i]===event.serverTime)return;
  const index=this.seenCursor++%this.seen.length;this.seen[index]=event.id;this.seenAt[index]=event.serverTime;
  const seq=event.actionSeq??fighters?.get(event.actorId)?.state.actionSeq??-1;
  if(event.kind==='confirm'&&event.targetId)Object.assign(this.receipts[this.cursor++%this.receipts.length],{actor:event.actorId,target:event.targetId,seq,final:false});
  if(event.kind==='hit'&&event.contactIndex===4)for(const r of this.receipts)if(r.actor===event.actorId&&r.seq===seq){const f=event.targetId?fighters?.get(event.targetId):undefined;if(f)bodyCentre(f,r.point);else if(event.endpoint)r.point.set(event.endpoint.x,event.endpoint.y,event.endpoint.z);r.final=true;}
 }
 private put(name:string,matrix:THREE.Matrix4,alpha:number){const p=this.parts.get(name);if(!p||alpha<.015||p.count>=p.mesh.instanceMatrix.count)return -1;const index=p.count++;p.mesh.setMatrixAt(index,matrix);p.opacity.setX(index,clamp(alpha));return index;}
 private clearPalmFrames(actor?:string){for(const frame of this.palmFrames)if(actor===undefined||frame.actor===actor||frame.target===actor){if(frame.fighter&&drawnPalms.get(frame.fighter)===this)drawnPalms.delete(frame.fighter);frame.actor='';frame.fighter=undefined;for(const beat of frame.beats)beat.count=0;}}
 private palmBeat(actor:string,contactIndex:number){if(this.disposed||!Number.isInteger(contactIndex)||contactIndex<1||contactIndex>4)return;const frame=this.palmFrames.find(f=>f.actor===actor),s=frame?.fighter?.state;if(!frame||!s?.alive||!isNetero(s.fighter)||s.id!==actor||s.action!=='ultimate'||s.branch||s.whiffedAt!==undefined||(s.actionSeq??-1)!==frame.seq||s.actionTime!==frame.time||s.actionDuration!==frame.duration)return;return frame.beats[contactIndex-1];}
 ultimatePalmCount(actor:string,contactIndex:number):number{return this.palmBeat(actor,contactIndex)?.count??0;}
 ultimatePalmPoint(actor:string,contactIndex:number,out:THREE.Vector3,palmIndex=0):boolean{const beat=this.palmBeat(actor,contactIndex);if(!beat||!Number.isInteger(palmIndex)||palmIndex<0||palmIndex>=beat.count)return false;out.copy(beat.anchors[palmIndex]).applyMatrix4(beat.matrices[palmIndex]);return true;}
 prepareContact(event:CombatEvent,fighters:ReadonlyMap<string,Fighter>,flights:ReadonlyMap<string,Flight>){if(isNetero(event.fighter)&&event.kind==='hit'&&event.slot==='ultimate'&&!event.branch&&(event.contactIndex??0)>0)this.sculptures(event.serverTime,fighters,flights);}
 private axialStretch(axis:THREE.Vector3,stretch:number){const{x,y,z}=axis,k=stretch-1;return this.elongation.set(1+k*x*x,k*x*y,k*x*z,0,k*x*y,1+k*y*y,k*y*z,0,k*x*z,k*y*z,1+k*z*z,0,0,0,0,1);}
 private sculpture(f:Fighter,alpha:number,opening:number,time:number,goal?:THREE.Vector3,palmFrame?:PalmFrame){
  const yaw=f.group.rotation.y;this.yaw.setFromAxisAngle(UP,yaw);this.position.set(-1.25,.65,-.45).applyQuaternion(this.yaw).add(f.group.position);const size=.96;
  this.base.compose(this.position,this.yaw,this.scale.setScalar(size));this.put('BodhiTorso',this.base,alpha);
  const count=this.kit.budget<.65?3:6;
  for(const side of SIDES){const sign=side==='Left'?1:-1,u=this.parts.get('Bodhi'+side+'Upper')!,v=this.parts.get('Bodhi'+side+'Fore')!,h=this.parts.get('Bodhi'+side+'Hand')!;
   for(let i=0;i<count;i++){
    const fraction=i/(count-1),angle=sign*(-.30+fraction*2.5)*ease(opening);
    this.upper.copy(this.base).multiply(this.temp.makeTranslation(u.pivot.x,u.pivot.y,u.pivot.z)).multiply(this.temp.makeRotationZ(angle));
    this.rest.subVectors(v.pivot,u.pivot);this.fore.copy(this.upper).multiply(this.temp.makeTranslation(this.rest.x,this.rest.y,this.rest.z));
    this.rest.subVectors(h.pivot,v.pivot);this.hand.copy(this.fore).multiply(this.temp.makeTranslation(this.rest.x,this.rest.y,this.rest.z));
    let command=0,activeBeat=-1;
    if(goal){for(let beat=0;beat<PALM_BEATS.length;beat++){const owns=beat===3?i===0:sign===(beat%2?1:-1)&&i===Math.min(count-1,1+beat);if(!owns)continue;const age=time-PALM_BEATS[beat];if(age>-.25&&age<.22){const value=age<0?ease((age+.25)/.25):1-ease(age/.22);if(value>command){command=value;activeBeat=beat;}}}}
    if(command>0&&goal){
     this.target.copy(h.centre).applyMatrix4(this.hand).lerp(goal,command);
     if(i===0&&time>3.19)this.target.addScaledVector(this.rest.set(sign*.20,0,0).applyQuaternion(this.yaw),command);
     this.direction.copy(FRONT).applyQuaternion(this.yaw);
     this.q.setFromUnitVectors(FRONT,this.direction);this.wrist.copy(h.centre).multiplyScalar(size).applyQuaternion(this.q).negate().add(this.target);
     this.shoulder.copy(u.pivot).applyMatrix4(this.base);this.direction.subVectors(this.wrist,this.shoulder);const distance=this.direction.length();this.direction.normalize();
     const l1=u.pivot.distanceTo(v.pivot)*size,l2=v.pivot.distanceTo(h.pivot)*size,stretch=Math.max(1,Math.min(2.4,distance/(l1+l2)*1.03)),a=l1*stretch,b=l2*stretch;
     const along=Math.max(0,Math.min(a,(a*a-b*b+distance*distance)/(2*Math.max(.001,distance)))),height=Math.sqrt(Math.max(0,a*a-along*along));
     this.pole.set(sign,.4,0).applyQuaternion(this.yaw).addScaledVector(this.direction,-this.pole.dot(this.direction)).normalize();this.elbow.copy(this.shoulder).addScaledVector(this.direction,along).addScaledVector(this.pole,height);
     this.routingPoint.copy(this.elbow).sub(f.group.position).applyAxisAngle(UP,-yaw);
     this.routingPoint.x=Math.min(this.routingPoint.x,-.68);this.routingPoint.z=Math.max(this.routingPoint.z,.60);
     this.routingPoint.applyQuaternion(this.yaw).add(f.group.position);this.elbow.lerp(this.routingPoint,command);
     const upperStretch=this.shoulder.distanceTo(this.elbow)/l1,foreStretch=this.elbow.distanceTo(this.wrist)/l2;
     this.rest.subVectors(v.pivot,u.pivot).normalize();this.direction.subVectors(this.elbow,this.shoulder).normalize();this.q.setFromUnitVectors(this.rest,this.direction);this.upper.compose(this.shoulder,this.q,this.scale.setScalar(size)).multiply(this.axialStretch(this.rest,upperStretch));
     this.rest.subVectors(h.pivot,v.pivot).normalize();this.direction.subVectors(this.wrist,this.elbow).normalize();this.q.setFromUnitVectors(this.rest,this.direction);this.fore.compose(this.elbow,this.q,this.scale.setScalar(size)).multiply(this.axialStretch(this.rest,foreStretch));
     this.hand.compose(this.wrist,this.yaw,this.scale.setScalar(size));
    }
    this.put(u.name,this.upper,alpha);this.put(v.name,this.fore,alpha);const handIndex=this.put(h.name,this.hand,alpha);
    if(palmFrame&&activeBeat>=0&&handIndex>=0&&h.palmVertex){const beat=palmFrame.beats[activeBeat];if(beat.count<2){const index=beat.count;h.mesh.getMatrixAt(handIndex,beat.matrices[index]);h.mesh.updateWorldMatrix(true,false);beat.matrices[index].premultiply(h.mesh.matrixWorld);if(beat.matrices[index].elements.every(Number.isFinite)){beat.anchors[index].copy(h.palmVertex);beat.count++;}}}
   }
  }
 }
 update(time:number,fighters:ReadonlyMap<string,Fighter>,flights:ReadonlyMap<string,Flight>){
  if(this.disposed)return;
  const st=this.stage.open(time);this.staging(time,fighters,flights);st.close();
  this.sculptures(time,fighters,flights);
 }
 private sculptures(_time:number,fighters:ReadonlyMap<string,Fighter>,flights:ReadonlyMap<string,Flight>){
  this.visibility.reset();
  this.clearPalmFrames();if(this.disposed||!this.parts.size)return;for(const p of this.parts.values())p.count=0;let owners=0;
  for(const f of fighters.values()){
   const s=f.state;if(!isNetero(s.fighter)||!s.alive||owners>=NETERO_BODHISATTVA_LIMITS.owners)continue;
   const t=s.actionTime*s.actionDuration;let alpha=0,opening=1,goal:THREE.Vector3|undefined;
   if(s.action==='awaken'){alpha=ease((t-.23)/.18)*(1-ease((t-.77)/.13));opening=ease((t-.30)/.38);}
   else if(s.action==='special'&&!s.branch){alpha=ease((t-.24)/.17)*(1-ease((t-.9)/.34));opening=.65;}
   else if(s.action==='ultimate'&&!s.branch){const r=this.receipts.find(r=>r.actor===s.id&&r.seq===(s.actionSeq??-1)),target=r?fighters.get(r.target):undefined;
    if(r&&s.whiffedAt===undefined&&(target?.state.alive||r.final)){alpha=ease((t-.62)/.33)*(1-ease((t-3.65)/.45));if(!r.final&&target?.state.alive)bodyCentre(target,this.goalPoint);else this.goalPoint.copy(r.point);this.direction.subVectors(this.goalPoint,f.group.position).setY(0).normalize();this.goalPoint.addScaledVector(this.direction,-.25);goal=this.goalPoint;}
   }
   if(alpha>.015){let frame:PalmFrame|undefined;if(goal){const receipt=this.receipts.find(r=>r.actor===s.id&&r.seq===(s.actionSeq??-1));frame=this.palmFrames[owners];frame.actor=s.id;frame.target=receipt?.target??'';frame.fighter=f;frame.seq=s.actionSeq??-1;frame.time=s.actionTime;frame.duration=s.actionDuration;}this.visibility.protect(f);this.visibility.protect(fighters.get(frame?.target||s.target||''));this.sculpture(f,alpha,opening,t,goal,frame);if(frame)drawnPalms.set(f,this);owners++;}
  }
  for(const r of this.receipts){const s=fighters.get(r.actor)?.state;if(!s?.alive||s.action!=='ultimate'||s.branch||(s.actionSeq??-1)!==r.seq||s.whiffedAt!==undefined)r.actor='';}
  const hand=this.parts.get('BodhiRightHand');let count=0;
  if(hand)for(const flight of flights.values()){
   if(!isNetero(flight.fighter)||flight.slot!=='special'||flight.branch||!flight.released||count++>=NETERO_BODHISATTVA_LIMITS.flights)continue;
   this.q.setFromUnitVectors(FRONT,flight.heading);this.position.copy(hand.centre).multiplyScalar(1.2).applyQuaternion(this.q).negate().add(flight.position);this.temp.compose(this.position,this.q,this.scale.setScalar(1.2));this.put(hand.name,this.temp,1);
  }
  for(const p of this.parts.values()){p.mesh.count=p.count;p.mesh.visible=p.count>0;p.mesh.instanceMatrix.needsUpdate=true;p.opacity.needsUpdate=true;}
 }
 reset(){this.visibility.reset();this.clearPalmFrames();for(const r of this.receipts)r.actor='';this.cursor=this.seenCursor=this.hitCursor=0;this.seen.fill(-1);this.seenAt.fill(-1);this.hits.fill(-1);this.hitsAt.fill(-1);for(const p of this.parts.values()){p.count=p.mesh.count=0;p.mesh.visible=false;}this.stage.reset();}
 private clearSurfaces(){for(const p of this.parts.values()){p.mesh.removeFromParent();p.mesh.dispose();}for(const g of this.ownedGeometry)g.dispose();for(const m of this.ownedMaterials)m.dispose();this.parts.clear();this.ownedGeometry.length=this.ownedMaterials.length=0;}
 private disposeSource(gltf:GLTF){const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();gltf.scene.traverse(o=>{if(!(o instanceof THREE.Mesh))return;geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const v of Object.values(m))if(v instanceof THREE.Texture)textures.add(v);}});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();}
 dispose(){if(this.disposed)return;this.reset();this.disposed=true;this.clearSurfaces();if(this.source)this.disposeSource(this.source);this.source=undefined;this.stage.release();}
}
