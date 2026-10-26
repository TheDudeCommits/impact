import * as THREE from 'three';
import type {CombatEvent} from '../../game/types';
import {MAKIMA_MOVES} from '../../game/fighters/makima';
import type {Fighter} from '../Fighter';
import type {Flight} from '../CombatEffects';
import {bodyCentre,type VfxKit} from '../vfx/VfxKit';
import {MARK} from '../vfx/GroundMarks';
import {armoryDraws} from '../vfx/armory/drawn';
import {SIGNATURE,involvesLocal} from './context';
import {RING} from './GlowBatch';
import {MoveStage,stageLook} from './MoveStage';
import {blowFloor,floorUnder} from './blowFloor';

export const isMakimaControl=(id:string|undefined)=>id==='makima';
export function makimaStrikeJoint(action:string,clip?:string,contactIndex=0):'LeftHand'|'RightHand'{
 if(action==='ultimate'&&(!clip||clip==='Absolute Control'))return contactIndex===1?'LeftHand':'RightHand';
 return clip==='Come Here'||clip==='Rush 2'?'LeftHand':'RightHand';
}
const fingerA=new THREE.Vector3(),fingerB=new THREE.Vector3();
export function makimaCommandPoint(f:Pick<Fighter,'bones'|'drawnJoint'>,out:THREE.Vector3,side:'Left'|'Right'='Right'){
 const tip=f.bones?.get((side+'HandIndex3').toLowerCase()),middle=f.bones?.get((side+'HandIndex2').toLowerCase());
 if(tip&&middle){tip.getWorldPosition(fingerA);middle.getWorldPosition(fingerB);out.copy(fingerA).addScaledVector(fingerA.sub(fingerB),.65);return true;}
 const hand=f.drawnJoint(side+'Hand');if(!hand)return false;hand.getWorldPosition(out);return true;
}
export const MAKIMA_CONTROL_LIMITS=Object.freeze({rings:192,links:288,strokes:96,impacts:24,bindings:12});
const UP=new THREE.Vector3(0,1,0),FRONT=new THREE.Vector3(0,0,1),RIGHT=new THREE.Vector3(1,0,0);
const GOLD=new THREE.Color(0xd69b47),RED=new THREE.Color(0xd75336),INK=new THREE.Color(0x211616),WHITE=new THREE.Color(0xffedce);
const NO_FLIGHTS:ReadonlyMap<string,Flight>=new Map();
const CHAIN=new THREE.Color(1.75,.98,.3),DOWN=new THREE.Vector3(0,-1,0),TAU=Math.PI*2;
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const hash=(x:number)=>{const v=Math.sin(x*12.9898+78.233)*43758.5453;return v-Math.floor(v);};
const CONTROL=stageLook(0xffedce,0xd69b47,0x7d1d16),BLOOD=stageLook(0xffe1d6,0xd75336,0x3a0a08),FORCE=stageLook(0xffffff,0xf1e7dc,0x7d1d16);
const HEAVY=MAKIMA_MOVES.heavy,SPECIAL=MAKIMA_MOVES.special,ULT=MAKIMA_MOVES.ultimate;
class ControlBatch{
 readonly mesh:THREE.InstancedMesh<THREE.BufferGeometry,THREE.ShaderMaterial>;
 private tint:THREE.InstancedBufferAttribute;private pose=new THREE.Object3D();private count=0;
 constructor(scene:THREE.Scene,name:string,geometry:THREE.BufferGeometry,private capacity:number,feather=false){
  this.tint=new THREE.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('controlTint',this.tint);
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
   uniforms:{feather:{value:feather?1:0}},
   vertexShader:'attribute vec4 controlTint;varying vec4 vTint;varying vec2 vUv;void main(){vUv=uv;vTint=controlTint;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',
   fragmentShader:'uniform float feather;varying vec4 vTint;varying vec2 vUv;void main(){float edge=smoothstep(0.,.2,vUv.x)*smoothstep(0.,.2,1.-vUv.x)*smoothstep(0.,.15,vUv.y)*smoothstep(0.,.2,1.-vUv.y);float a=vTint.a*mix(1.,edge,feather);if(a<.004)discard;gl_FragColor=vec4(vTint.rgb,a);}'});
  material.forceSinglePass=true;this.mesh=new THREE.InstancedMesh(geometry,material,capacity);this.mesh.name='makima-'+name;this.mesh.frustumCulled=false;this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.mesh.count=0;scene.add(this.mesh);
 }
 begin(){this.count=0;}
 add(p:THREE.Vector3,q:THREE.Quaternion,x:number,y:number,z:number,color:THREE.Color,alpha:number){
  if(this.count>=this.capacity||alpha<.004)return;this.pose.position.copy(p);this.pose.quaternion.copy(q);this.pose.scale.set(x,y,z);this.pose.updateMatrix();this.mesh.setMatrixAt(this.count,this.pose.matrix);this.tint.setXYZW(this.count++,color.r,color.g,color.b,Math.min(1,alpha));
 }
 end(){this.mesh.count=this.count;this.mesh.instanceMatrix.needsUpdate=true;this.tint.needsUpdate=true;}
 dispose(){this.mesh.removeFromParent();this.mesh.dispose();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
export function makimaPressureStrokeGeometry(){
 const vertices:number[]=[],uv:number[]=[],indices:number[]=[];
 const rows=[[-.5,0],[-.30,.38],[.02,.5],[.30,.25],[.5,0]];
 for(let plane=0;plane<2;plane++){
  const start=vertices.length/3;
  for(const [y,w] of rows)for(const side of[-1,1]){vertices.push(plane?0:side*w,y,plane?side*w:0);uv.push((side+1)*.5,y+.5);}
  for(let i=0;i<rows.length-1;i++){const a=start+i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);return geometry;
}
type Impact={actor:string;target:string;born:number;grade:number;seed:number;yaw:number;point:THREE.Vector3};
type Binding={actor:string;target:string;born:number;seq:number;side:'Left'|'Right';point:THREE.Vector3};
type Control={actor:string;target:string;seq:number;final:boolean};
export class MakimaControl{
 private readonly stage:MoveStage;private readonly full?:VfxKit;
 private controls:Control[]=Array.from({length:6},()=>({actor:'',target:'',seq:-1,final:false}));private controlCursor=0;
 private c=new THREE.Vector3();private e=new THREE.Vector3();private heading=new THREE.Vector3();private ground=new THREE.Vector3();
 private rings:ControlBatch;private links:ControlBatch;private strokes:ControlBatch;private disposed=false;
 private impacts:Impact[]=Array.from({length:24},()=>({actor:'',target:'',born:-1e9,grade:0,seed:0,yaw:0,point:new THREE.Vector3()}));
 private bindings:Binding[]=Array.from({length:12},()=>({actor:'',target:'',born:-1e9,seq:-1,side:'Right',point:new THREE.Vector3()}));
 private seen=new Float64Array(128).fill(-1);private seenTime=new Float64Array(128).fill(-1);private impactCursor=0;private bindingCursor=0;private seenCursor=0;
 private a=new THREE.Vector3();private b=new THREE.Vector3();private p=new THREE.Vector3();private d=new THREE.Vector3();private q=new THREE.Quaternion();private spin=new THREE.Quaternion();private flat=new THREE.Quaternion().setFromAxisAngle(RIGHT,-Math.PI/2);
 constructor(scene:THREE.Scene,private kit:Pick<VfxKit,'budget'>&Partial<VfxKit>){
  this.stage=MoveStage.for(scene,kit);this.full=kit.sparks&&kit.dust&&kit.marks&&kit.debris?kit as VfxKit:undefined;
  this.rings=new ControlBatch(scene,'pressure-rings',new THREE.RingGeometry(.89,1,28),192);
  this.links=new ControlBatch(scene,'control-links',new THREE.RingGeometry(.71,1,12),288);
  this.strokes=new ControlBatch(scene,'pressure-strokes',makimaPressureStrokeGeometry(),96,true);
 }
 load(_ids:readonly string[]){return Promise.resolve();}
 handle(e:CombatEvent,fighters?:ReadonlyMap<string,Fighter>){
  if(this.disposed)return;
  if(e.kind==='eliminated'||e.kind==='respawn'||e.kind==='whiff'||e.kind==='rejected'){
   for(const h of this.impacts)if(h.actor===e.actorId||h.target===e.actorId)h.actor='';
   for(const t of this.bindings)if(t.actor===e.actorId||t.target===e.actorId)t.actor='';
   const gone=e.kind==='eliminated'||e.kind==='respawn';for(const c of this.controls)if(c.actor===e.actorId||gone&&c.target===e.actorId&&!c.final)c.actor='';return;
  }
  if(isMakimaControl(e.fighter)&&e.kind==='confirm'){
   const seq=e.actionSeq??fighters?.get(e.actorId)?.state.actionSeq??-1;
   if(e.slot==='ultimate'&&!e.branch&&e.targetId&&!armoryDraws(e.fighter,e.slot,e.branch,e.actorId)&&!this.controls.some(c=>c.actor===e.actorId&&c.seq===seq))Object.assign(this.controls[this.controlCursor++%this.controls.length],{actor:e.actorId,target:e.targetId,seq,final:false});
   return;
  }
  if(!isMakimaControl(e.fighter)||e.kind!=='hit'||!e.endpoint)return;
  for(let i=0;i<128;i++)if(this.seen[i]===e.id&&this.seenTime[i]===e.serverTime)return;
  const actor=fighters?.get(e.actorId);if(!actor)return;const index=this.seenCursor++%128;this.seen[index]=e.id;this.seenTime[index]=e.serverTime;
  const ultimate=e.slot==='ultimate'&&!e.branch,h=this.impacts[this.impactCursor++%24];
  h.actor=e.actorId;h.target=e.targetId??'';h.born=e.serverTime;h.grade=ultimate?(e.contactIndex===3?3:2):e.slot==='special'?1.8:e.slot==='heavy'?1.4:.8;h.seed=e.id;h.yaw=actor.state.yaw;h.point.set(e.endpoint.x,e.endpoint.y,e.endpoint.z);
  if(ultimate&&e.targetId){const t=this.bindings.find(t=>t.actor===e.actorId&&t.target===e.targetId)??this.bindings[this.bindingCursor++%12];t.actor=e.actorId;t.target=e.targetId;t.born=e.serverTime;t.seq=actor.state.actionSeq??-1;t.side=e.contactIndex===1?'Left':'Right';t.point.copy(h.point);}
  if(h.grade===3&&involvesLocal(e.actorId,e.targetId))SIGNATURE.screen?.impactFrame?.(.44,h.point);
  if(!armoryDraws(e.fighter,e.slot,e.branch,e.actorId))this.land(e,h.point,actor,e.targetId?fighters?.get(e.targetId):undefined);
 }
 private land(e:CombatEvent,point:THREE.Vector3,actor:Fighter,target:Fighter|undefined){
  const st=this.stage,kit=this.full,t=e.serverTime,dir=this.heading,yaw=actor.state.yaw??actor.group.rotation.y;
  const floor=blowFloor(actor,target,point.y-1.05),ground=this.ground.set(point.x,floor,point.z);
  dir.subVectors(point,actor.group.position).setY(0);if(dir.lengthSq()<.01)dir.set(Math.sin(yaw),0,Math.cos(yaw));dir.normalize();
  if(e.slot==='light'){st.burst(point,CONTROL,.4,t,{dir,floor,clean:true});return;}
  if(e.slot==='heavy'){
   const big=e.branch?.85:1;
   st.erupt(this.c.copy(point).setY(point.y+4.2*big),DOWN,FORCE,.3*big,3.6*big,t,.16);
   st.burst(this.c.copy(ground).addScaledVector(dir,.6).setY(floor+.3),BLOOD,.55*big,t,{floor,clean:true});
   st.shatter(this.c.copy(ground).addScaledVector(dir,1).setY(floor+.06),UP,BLOOD,2.2*big,t,.5);
   return;
  }
  if(e.slot==='special'){
   if(e.branch==='airSpecial'){st.burst(point,BLOOD,2,t,{floor});st.dome(point,FORCE,3,t,.45);st.shock(ground,CONTROL,4.6,t,.45);st.scar(ground,BLOOD,2.2,t+.05,2);return;}
   const big=e.branch?.7:1;
   st.burst(point,BLOOD,1.8*big,t,{dir,floor});
   st.shatter(point,dir,FORCE,2.7*big,t,.5);
   st.dome(point,FORCE,3.2*big,t,.48);
   st.erupt(this.c.copy(point).addScaledVector(dir,.5),this.e.copy(dir).setY(.06).normalize(),FORCE,.42*big,6.2*big,t,.38);
   st.shock(ground,CONTROL,5.6*big,t,.5);
   st.scar(this.c.copy(ground).addScaledVector(dir,1.2),BLOOD,2*big,t+.05,2.2);
   return;
  }
  if(e.slot!=='ultimate'||e.branch)return;
  const index=e.contactIndex??0;
  if(index<3){
   st.burst(point,index%2?BLOOD:CONTROL,.6+.08*index,t,{dir,floor,clean:true});
   st.dome(point,FORCE,1.2+.3*index,t,.28);
   if(index)st.shock(ground,CONTROL,3.6+index,t,.4);
   return;
  }
  for(const c of this.controls)if(c.actor===e.actorId&&c.target===e.targetId)c.final=true;
  st.erupt(this.c.copy(point).setY(point.y+6.4),DOWN,FORCE,.8,6.4,t,.36);
  st.burst(point,BLOOD,2,t,{dir,floor});
  st.dome(point,FORCE,4,t,.45);
  st.shatter(this.c.copy(ground).addScaledVector(dir,1.2).setY(floor+.06),UP,BLOOD,5.6,t+.04,1);
  st.shock(ground,CONTROL,10,t,.6);
  st.scar(this.c.copy(ground).addScaledVector(dir,1.2),BLOOD,2.5,t+.2,2);
  if(!kit)return;
  for(let i=0;i<4;i++){const ang=i*1.571+yaw+.6,r=2.3+hash(i+e.id);this.c.set(ground.x+Math.cos(ang)*r,floor,ground.z+Math.sin(ang)*r);kit.debris.burst(kit.n(6,2),this.c.x,floor,this.c.z,0,1,0,8,.8,.14,floor,2.1);if(kit.quality!=='low')kit.marks.mark(MARK.crack,this.c.x,floor,this.c.z,0,1,0,2.4,t+.05,3);}
 }
 update(time:number,fighters:ReadonlyMap<string,Fighter>,flights:ReadonlyMap<string,Flight>=NO_FLIGHTS){
  if(this.disposed)return;this.rings.begin();this.links.begin();this.strokes.begin();const detail=this.kit.budget>=.65,st=this.stage.open(time);
  for(const f of fighters.values()){
   const s=f.state;if(!isMakimaControl(s.fighter)||!s.alive||s.whiffedAt!==undefined)continue;const elapsed=s.actionTime*s.actionDuration;
   if((s.action==='light'||s.action==='heavy'||s.action==='special'||s.action==='ultimate')&&!armoryDraws('makima',s.action,s.branch,s.id))this.windup(f,elapsed,fighters,detail);
   if(s.action==='special'&&!s.branch&&elapsed>.18&&elapsed<.52&&makimaCommandPoint(f,this.a)){
    const u=(elapsed-.18)/.34;this.q.setFromAxisAngle(UP,s.yaw);this.eye(this.a,this.q,.026+u*.085,Math.sin(u*Math.PI)*.8,detail?3:2);
   }
   if(s.action==='awaken'&&s.actionTime>.58/2.2&&s.actionTime<1.87/2.2){
    const u=(s.actionTime*2.2-.58)/1.29,fade=Math.sin(u*Math.PI);this.a.copy(f.group.position);this.a.y+=1.49;this.a.x+=Math.sin(s.yaw)*.12;this.a.z+=Math.cos(s.yaw)*.12;this.q.setFromAxisAngle(UP,s.yaw);this.eye(this.a,this.q,.22+u*.20,fade*.55,detail?4:3);
    this.p.copy(f.group.position);this.p.y+=.035;this.rings.add(this.p,this.flat,.28+u*.52,.28+u*.52,1,GOLD,fade*.35);
   }
  }
  for(const flight of flights.values()){
   if(!isMakimaControl(flight.fighter)||flight.slot!=='special'||flight.branch||!flight.released)continue;
   this.q.setFromUnitVectors(FRONT,flight.heading);this.eye(flight.position,this.q,.16+.015*Math.sin(time*23),.85,detail?3:2);
   const travel=flight.origin?Math.max(0,this.d.subVectors(flight.position,flight.origin).dot(flight.heading)):0;
   this.a.copy(flight.position).addScaledVector(flight.heading,-Math.min(.62,travel));this.segment(this.a,flight.position,.036,INK,.5);this.segment(this.a,flight.position,.021,WHITE,.8);
   if(armoryDraws('makima','special',undefined,flight.actorId))continue;
   st.glow(flight.position,1,CONTROL.main,.7);st.glow(flight.position,.36,FORCE.core,1);
   for(let i=0;i<3;i++){this.p.copy(flight.position).addScaledVector(flight.heading,-i*.8);st.glow(this.p,.7+i*.45,i%2?BLOOD.main:CONTROL.core,.95-i*.25,RING,.05,0,.86);}
   if(flight.origin){st.streak(flight.origin,flight.position,.12,CONTROL.main,.5);st.streak(flight.origin,flight.position,.035,FORCE.core,1.2);st.light(this.p.copy(flight.origin).lerp(flight.position,.5).setY(flight.origin.y+.2),5,CONTROL,.45);}
   st.light(this.p.copy(flight.position).setY(flight.position.y+.2),7,CONTROL,.7);
  }
  for(const c of this.controls){
   if(!c.actor)continue;const actor=fighters.get(c.actor),victim=fighters.get(c.target),s=actor?.state;
   if(!actor||!s?.alive||!victim?.state.alive&&!c.final||s.action!=='ultimate'||s.branch||(s.actionSeq??-1)!==c.seq||s.whiffedAt!==undefined){c.actor='';continue;}
   const elapsed=s.actionTime*s.actionDuration;
   if(!c.final&&victim&&elapsed<ULT.contacts[3])this.control(actor,victim,c,elapsed,time,detail);
  }
  for(const t of this.bindings){
   if(!t.actor)continue;const age=time-t.born,actor=fighters.get(t.actor),target=fighters.get(t.target);if(age<0)continue;
   if(age>.42||!actor||!target||!actor.state.alive||!target.state.alive||actor.state.action!=='ultimate'||actor.state.whiffedAt!==undefined||(actor.state.actionSeq??-1)!==t.seq||actor.group.position.distanceToSquared(target.group.position)>64){t.actor='';continue;}
   if(!makimaCommandPoint(actor,this.a,t.side))continue;this.chain(this.a,t.point,1-age/.42,detail?12:7);
  }
  for(const h of this.impacts){
   if(!h.actor)continue;const age=time-h.born;if(age<0)continue;if(age>.40){h.actor='';continue;}const fade=1-age/.40,r=.14+h.grade*.14+age*1.1;
   this.q.setFromAxisAngle(UP,h.yaw);this.eye(h.point,this.q,r,fade,detail?4:3);
   if(h.grade===3){this.a.copy(h.point);this.a.y=Math.max(.04,this.a.y-.85);this.rings.add(this.a,this.flat,r*1.8,r*1.8,1,INK,fade*.8);this.rings.add(this.a,this.flat,r*1.64,r*1.64,1,GOLD,fade*.7);}
   for(let i=0;i<(detail?6:3);i++){const theta=i*Math.PI*2/(detail?6:3)+h.seed*.2;this.a.copy(h.point);this.a.x+=Math.cos(theta)*r;this.a.y+=Math.sin(theta)*r;this.b.copy(this.a);this.b.x+=Math.cos(theta)*(.08+age*.4);this.b.y+=Math.sin(theta)*(.08+age*.4);this.segment(this.a,this.b,.016,i%2?RED:WHITE,fade);}
  }
  this.rings.end();this.links.end();this.strokes.end();st.close();
 }
 private windup(f:Fighter,elapsed:number,fighters:ReadonlyMap<string,Fighter>,detail:boolean){
  const st=this.stage,s=f.state,seed=(s.actionSeq??0)*7.3;if(!makimaCommandPoint(f,this.c)&&!(f.handR&&this.c.copy(f.handR)))return;
  if(s.action==='light'){const k=Math.sin(clamp(s.actionTime)*Math.PI);st.glow(this.c,.2,CONTROL.main,.5*k);st.glow(this.c,.08,CONTROL.core,.6*k);st.light(this.c,1.7,CONTROL,.16*k);return;}
  if(s.action==='heavy'){
   const contact=s.branch?s.actionDuration*.58:HEAVY.contacts[0];if(elapsed>=contact)return;
   const k=clamp(elapsed/contact),victim=s.target?fighters.get(s.target):undefined;
   st.charge(this.c,CONTROL,.2,k,seed);
   if(victim?.state.alive&&victim.group.position.distanceToSquared(f.group.position)<16){this.e.copy(victim.group.position);this.e.y+=2.9;this.eye(this.e,this.flat,.5+.5*(1-k),.7*k,detail?3:2);st.light(this.e,2.6,CONTROL,.2*k);}
   return;
  }
  if(s.action==='special'&&!s.branch){if(elapsed<SPECIAL.contacts[0])st.charge(this.c,CONTROL,.3,elapsed/SPECIAL.contacts[0],seed);return;}
  if(s.action==='ultimate'&&!s.branch&&s.confirmedAt===undefined&&elapsed<ULT.contacts[0]+.1)st.charge(this.c,CONTROL,.24,elapsed/ULT.contacts[0],seed);
 }
 private control(actor:Fighter,victim:Fighter,c:Control,elapsed:number,time:number,detail:boolean){
  const st=this.stage,g=clamp((elapsed-ULT.contacts[0])/(ULT.contacts[3]-ULT.contacts[0])),centre=bodyCentre(victim,this.ground),floor=floorUnder(victim.group.position.x,victim.group.position.y,victim.group.position.z),yaw=actor.state.yaw??actor.group.rotation.y,seed=c.seq*3.1;
  st.dim(.3+.4*g,c.actor,c.target);
  this.e.set(centre.x,floor,centre.z);st.pool(this.e,2+2.2*g,BLOOD,.3+.7*g,seed);
  this.q.setFromAxisAngle(UP,yaw);this.e.copy(centre).addScaledVector(this.heading.set(Math.sin(yaw),0,Math.cos(yaw)),.9);this.eye(this.e,this.q,2.3-.9*g,.35+.3*g,detail?4:3);
  const chains=detail?6:4,links=detail?10:7;
  for(let i=0;i<chains;i++){
   const ang=i*TAU/chains+seed,grown=clamp((g-i*.07)/.5),sway=.12*Math.sin(time*5+i*1.7);
   if(grown<=0)continue;
   this.a.set(centre.x+Math.cos(ang)*4.3,floor+2.6+1.5*hash(i*3.3+seed),centre.z+Math.sin(ang)*4.3);
   this.b.copy(this.a).lerp(centre,grown*.94);this.b.y+=sway*(1-grown);
   this.bind(this.a,this.b,.9,Math.max(3,Math.round(links*grown)));
   st.glow(this.b,.22,CONTROL.core,.7);
  }
  st.light(this.e.copy(centre).setY(floor+.6),4+1.4*g,BLOOD,.24+.2*g);
  if(makimaCommandPoint(actor,this.c))st.charge(this.c,CONTROL,.14+.12*g,Math.max(.3,g*.7),seed);
  if(g>.75)st.speed(.5*(g-.75)/.25,c.actor,c.target);
 }
 private bind(a:THREE.Vector3,b:THREE.Vector3,alpha:number,steps:number){
  this.d.subVectors(b,a);if(this.d.lengthSq()<1e-5)return;this.d.normalize();this.q.setFromUnitVectors(UP,this.d);
  for(let i=0;i<steps;i++){this.p.copy(a).lerp(b,(i+.5)/steps);this.spin.setFromAxisAngle(UP,i%2?Math.PI/2:0);this.spin.premultiply(this.q);this.links.add(this.p,this.spin,.17,.24,1,i%2?CHAIN:INK,alpha);}
 }
 private eye(p:THREE.Vector3,q:THREE.Quaternion,r:number,alpha:number,count:number){
  for(let i=0;i<count;i++){const scale=r*(1-i/(count+1));this.rings.add(p,q,scale,scale,1,i%2?RED:GOLD,alpha*(1-i*.11));}
 }
 private chain(a:THREE.Vector3,b:THREE.Vector3,alpha:number,steps:number){
  this.d.subVectors(b,a);if(this.d.lengthSq()<1e-5)return;this.d.normalize();this.q.setFromUnitVectors(UP,this.d);
  for(let i=0;i<steps;i++){this.p.copy(a).lerp(b,(i+.5)/steps);this.spin.setFromAxisAngle(UP,i%2?Math.PI/2:0);this.spin.premultiply(this.q);this.links.add(this.p,this.spin,.055,.078,1,i%2?GOLD:INK,alpha*.85);}
 }
 private segment(a:THREE.Vector3,b:THREE.Vector3,width:number,color:THREE.Color,alpha:number){
  const length=a.distanceTo(b);if(length<1e-5)return;this.p.copy(a).add(b).multiplyScalar(.5);this.d.subVectors(b,a).normalize();this.q.setFromUnitVectors(UP,this.d);this.strokes.add(this.p,this.q,width,length,width,color,alpha);
 }
 reset(){for(const h of this.impacts)h.actor='';for(const t of this.bindings)t.actor='';for(const c of this.controls)c.actor='';this.seen.fill(-1);this.seenTime.fill(-1);for(const batch of[this.rings,this.links,this.strokes]){batch.begin();batch.end();}this.stage.reset();}
 dispose(){if(this.disposed)return;this.reset();this.disposed=true;this.rings.dispose();this.links.dispose();this.strokes.dispose();this.stage.release();}
}
