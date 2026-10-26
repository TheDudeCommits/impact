import * as THREE from 'three';
import type { CombatEvent } from '../../game/types';
import { JINBE_MOVES, JINBE_AWAKENING } from '../../game/fighters/jinbe';
import type { Fighter } from '../Fighter';
import type { Flight } from '../CombatEffects';
import { bodyCentre, type VfxKit } from '../vfx/VfxKit';
import { SIGNATURE, involvesLocal } from './context';
import { STAR } from './GlowBatch';
import { BURN, MoveStage, SHEEN, stageLook, type StageLook } from './MoveStage';
import { blowFloor } from './blowFloor';

export const JINBE_KARATE_ASSETS: readonly string[] = Object.freeze([]);
export const JINBE_KARATE_LIMITS = Object.freeze({ drops: 96, jets: 24, rings: 96, sprays: 128, impacts: 24, drills: 8 });
export const JINBE_KARATE_BEATS = Object.freeze({ coil: 1.99, charge: 2.6, burst: 3.215, end: 3.63 });
export const isJinbeKarate = (id: string | undefined) => id === 'jinbe';
const UP=new THREE.Vector3(0,1,0),FORWARD=new THREE.Vector3(0,0,1),TAU=Math.PI*2;
const BLUE=new THREE.Color(.05,.55,1.05),CYAN=new THREE.Color(.5,1.7,2),FOAM=new THREE.Color(2,2.25,2.3);
export const SEA:StageLook=stageLook(0xe8fdff,0x42c4df,0x198bb5);
const DEEP=new THREE.Color(.06,.5,1.1);
const FLOOR:StageLook={...SEA,main:DEEP,light:new THREE.Color(.2,.5,.85)};
const HEAVY=JINBE_MOVES.heavy,SPECIAL=JINBE_MOVES.special,ULT=JINBE_MOVES.ultimate,FINAL=ULT.contacts.length-1;
const SPRAY_LIT=0xe8fdff,SPRAY_SHADE=0x5fb8d8;
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const attacking=(action:string)=>action==='light'||action==='heavy'||action==='special'||action==='ultimate';
class WaterBatch {
 readonly mesh:THREE.InstancedMesh<THREE.BufferGeometry,THREE.ShaderMaterial>;
 private tint:THREE.InstancedBufferAttribute;
 private object=new THREE.Object3D();private count=0;
 constructor(scene:THREE.Scene,name:string,geometry:THREE.BufferGeometry,readonly capacity:number,kind:number){
  this.tint=new THREE.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('waterTint',this.tint);
  const material=new THREE.ShaderMaterial({name:`Jinbe-${name}`,transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,uniforms:{kind:{value:kind},clock:{value:0}},
   vertexShader:`uniform float kind;uniform float clock;attribute vec4 waterTint;varying vec4 vTint;varying vec3 vP;varying vec3 vN;varying vec3 vEye;
    void main(){vTint=waterTint;vP=position;vec3 p=position;
     if(kind>.5&&kind<1.5){float wave=sin(p.y*23.-clock*17.+atan(p.z,p.x)*3.);p.xz*=1.+wave*.07;}
     vec4 v=modelViewMatrix*instanceMatrix*vec4(p,1.);vN=normalize(normalMatrix*mat3(instanceMatrix)*normal);vEye=normalize(-v.xyz);gl_Position=projectionMatrix*v;}`,
   fragmentShader:`uniform float kind;uniform float clock;varying vec4 vTint;varying vec3 vP;varying vec3 vN;varying vec3 vEye;
    void main(){if(vTint.a<.003)discard;float edge=pow(1.-abs(dot(normalize(vN),normalize(vEye))),2.);float flow=sin(atan(vP.z,vP.x)*5.+vP.y*24.-clock*13.)*.5+.5;
     vec3 c=mix(vTint.rgb,vec3(.86,.99,1.),clamp(edge*.7+smoothstep(.8,.97,flow)*.2,0.,.9));float a=vTint.a;
     if(kind>.5&&kind<1.5)a*=.38+.34*edge;
     gl_FragColor=vec4(c,a);}`});material.forceSinglePass=true;
  this.mesh=new THREE.InstancedMesh(geometry,material,capacity);this.mesh.name=`jinbe-karate-${name}`;this.mesh.frustumCulled=false;this.mesh.renderOrder=3;this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.mesh.count=0;scene.add(this.mesh);
 }
 begin(time:number){this.count=0;this.mesh.material.uniforms.clock.value=time;}
 add(p:THREE.Vector3,q:THREE.Quaternion,x:number,y:number,z:number,color:THREE.Color,alpha=1){if(this.count>=this.capacity||alpha<=.003||Math.min(x,y,z)<=0)return;this.object.position.copy(p);this.object.quaternion.copy(q);this.object.scale.set(x,y,z);this.object.updateMatrix();this.mesh.setMatrixAt(this.count,this.object.matrix);this.tint.setXYZW(this.count++,color.r,color.g,color.b,clamp(alpha));}
 end(){this.mesh.count=this.count;this.mesh.instanceMatrix.needsUpdate=true;this.tint.needsUpdate=true;}
 dispose(){this.mesh.removeFromParent();this.mesh.dispose();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
type Drill={actor:string;target:string;seq:number;finalHit:boolean;endpoint:THREE.Vector3};
type Impact={actor:string;seq:number;born:number;seed:number;grade:number;point:THREE.Vector3;projectile:boolean};
export class JinbeKarate {
 private readonly stage:MoveStage;private readonly full?:VfxKit;
 private blow=new THREE.Vector3();private ground=new THREE.Vector3();private fist=new THREE.Vector3();private heading=new THREE.Vector3();
 private drops:WaterBatch;private jets:WaterBatch;private rings:WaterBatch;private sprays:WaterBatch;private batches:WaterBatch[];
 private drills:Drill[]=Array.from({length:JINBE_KARATE_LIMITS.drills},()=>({actor:'',target:'',seq:-1,finalHit:false,endpoint:new THREE.Vector3()}));
 private impacts:Impact[]=Array.from({length:JINBE_KARATE_LIMITS.impacts},()=>({actor:'',seq:-1,born:0,seed:0,grade:0,point:new THREE.Vector3(),projectile:false}));
 private seen=new Float64Array(128).fill(-1);private seenTimes=new Float64Array(128).fill(-1);private eventCursor=0;private drillCursor=0;private impactCursor=0;private disposed=false;
 private p=new THREE.Vector3();private a=new THREE.Vector3();private b=new THREE.Vector3();private side=new THREE.Vector3();private direction=new THREE.Vector3();private q=new THREE.Quaternion();private flat=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
 constructor(scene:THREE.Scene,private kit:Pick<VfxKit,'budget'>&Partial<VfxKit>){
  this.stage=MoveStage.for(scene,kit);this.full=(kit as VfxKit).smoke&&(kit as VfxKit).dust?kit as VfxKit:undefined;
  this.drops=new WaterBatch(scene,'drops',new THREE.SphereGeometry(.5,14,10),JINBE_KARATE_LIMITS.drops,0);
  this.jets=new WaterBatch(scene,'jets',new THREE.CylinderGeometry(.40,.055,1,24,12,true),JINBE_KARATE_LIMITS.jets,1);
  this.rings=new WaterBatch(scene,'rings',new THREE.TorusGeometry(1,.035,4,36),JINBE_KARATE_LIMITS.rings,2);
  this.sprays=new WaterBatch(scene,'sprays',new THREE.SphereGeometry(.5,8,5),JINBE_KARATE_LIMITS.sprays,0);
  this.batches=[this.drops,this.jets,this.rings,this.sprays];
 }
 load(_ids:readonly string[]):Promise<void>{return Promise.resolve();}
 handle(e:CombatEvent,fighters?:ReadonlyMap<string,Fighter>){
  if(this.disposed)return;if(e.kind==='eliminated'||e.kind==='respawn'){this.cancel(e.actorId,true);return;}if(!isJinbeKarate(e.fighter))return;if(e.kind==='whiff'||e.kind==='rejected'){this.cancel(e.actorId);return;}if(e.kind!=='confirm'&&e.kind!=='hit')return;
  for(let i=0;i<this.seen.length;i++)if(this.seen[i]===e.id&&this.seenTimes[i]===e.serverTime)return;const index=this.eventCursor++%this.seen.length;this.seen[index]=e.id;this.seenTimes[index]=e.serverTime;
  const actor=fighters?.get(e.actorId),target=e.targetId?fighters?.get(e.targetId):undefined,seq=e.actionSeq??actor?.state.actionSeq??-1;
  if(e.kind==='confirm'){if(e.slot==='ultimate'&&!e.branch&&e.targetId)Object.assign(this.drills[this.drillCursor++%this.drills.length],{actor:e.actorId,target:e.targetId,seq,finalHit:false});return;}
  if(!target&&!e.endpoint)return;const final=e.slot==='ultimate'&&!e.branch&&e.contactIndex===2,impact=this.impacts[this.impactCursor++%this.impacts.length];Object.assign(impact,{actor:e.actorId,seq,born:e.serverTime,seed:e.id,grade:final?3:e.slot==='heavy'||e.slot==='special'?2:1,projectile:e.slot==='special'&&!e.branch});
  if(target)bodyCentre(target,impact.point);else impact.point.set(e.endpoint!.x,e.endpoint!.y,e.endpoint!.z);
  let confirmed=false;
  if(final){for(const drill of this.drills)if(drill.actor===e.actorId&&drill.seq===seq&&drill.target===e.targetId){drill.finalHit=true;drill.endpoint.copy(impact.point);confirmed=true;}if(involvesLocal(e.actorId,e.targetId))SIGNATURE.screen?.impactFrame?.(.42,impact.point);}
  const st=this.stage,t=e.serverTime,point=impact.point,floor=blowFloor(actor, target, point.y-1),dir=this.blow,big=actor?.state.awakened?1.15:1;
  if(actor){dir.subVectors(point,actor.group.position).setY(0);if(dir.lengthSq()<.01)dir.set(Math.sin(actor.group.rotation.y),0,Math.cos(actor.group.rotation.y));dir.normalize();}else dir.set(0,0,1);
  const ground=this.ground.set(point.x,floor,point.z);
  if(e.slot==='light'){st.burst(point,SEA,.42,t,{dir,floor,clean:true});st.dome(point,SEA,.9,t,.22);this.spray(point.x,point.y,point.z,3,.4,2,t,.3,dir);return;}
  if(e.slot==='heavy'){
   const k=(e.branch?.8:1)*big;
   st.burst(point,SEA,.85*k,t,{dir,floor});
   st.dome(point,SEA,2.2*k,t,.36);
   st.erupt(this.a.copy(point).addScaledVector(dir,.5),this.b.copy(dir).setY(.1).normalize(),SEA,.34*k,4*k,t,.3);
   st.shock(ground,SEA,4.6*k,t,.42);
   this.spray(point.x+dir.x*.6,point.y,point.z+dir.z*.6,4,.6*k,3,t,.4,dir);
   return;
  }
  if(e.slot==='special'){
   if(e.branch){st.burst(point,SEA,1.7,t,{dir,floor});st.dome(point,SEA,2.4,t,.4);st.shock(ground,SEA,4.4,t,.45);this.spray(point.x,point.y,point.z,6,.8,3,t,.5,dir);return;}
   st.burst(point,SEA,1.9*big,t,{dir,floor});
   st.dome(point,SEA,2.8*big,t,.42);
   st.erupt(ground,UP,SEA,.7*big,5*big,t+.03,.55);
   st.shock(ground,SEA,5.2*big,t,.45);
   st.scar(ground,FLOOR,2.3*big,t+.05,1.9);
   this.spray(point.x,floor+.4,point.z,9,1.1,3.4,t,.7);
   return;
  }
  if(e.slot!=='ultimate'||e.branch)return;
  if(!final){st.burst(point,SEA,e.contactIndex?1.25:.95,t,{dir,floor});st.dome(point,SEA,e.contactIndex?2.6:1.8,t,.4);if(e.contactIndex)st.shock(ground,SEA,5,t,.5);this.spray(point.x+dir.x*.5,point.y,point.z+dir.z*.5,4,.7,2.8,t,.45,dir);return;}
  if(!confirmed)return;
  st.dome(point,SEA,4.6,t,.45);
  st.erupt(this.a.copy(point).addScaledVector(dir,.6),this.b.copy(dir).setY(.08).normalize(),SEA,.9,8,t,.45);
  st.erupt(this.a.copy(ground).addScaledVector(dir,1.6),UP,SEA,.9,9,t+.08,.6);
  st.burst(point,SEA,2.2,t,{dir,floor});
  st.shock(ground,SEA,10,t,.6);
  st.scar(this.a.copy(ground).addScaledVector(dir,1.6),FLOOR,3,t+.1,2);
  this.spray(point.x,floor+.4,point.z,14,1.6,4.4,t,.9);
 }
 private spray(x:number,y:number,z:number,count:number,size:number,speed:number,born:number,life=.5,away?:THREE.Vector3){
  const kit=this.full;if(!kit)return;const ax=away?away.x:0,az=away?away.z:0,spread=away?.45:1;
  for(let i=0,n=kit.n(count,2);i<n;i++){const ang=i*2.399963+born*3.1,h=Math.abs(Math.sin(i*7.31+born)),c=Math.cos(ang)*spread,s=Math.sin(ang)*spread;
   kit.smoke(x+(c+ax*.6)*size*.3,y+h*size*.5,z+(s+az*.6)*size*.3,(c+ax)*speed,.6+h*speed*.7,(s+az)*speed,size*(.7+.5*h),born,life*(.75+.5*h),SPRAY_LIT,SPRAY_SHADE);}
 }
 private cancel(id:string,targetToo=false){for(const drill of this.drills)if(drill.actor===id||targetToo&&drill.target===id&&!drill.finalHit)drill.actor='';for(const impact of this.impacts)if(impact.actor===id)impact.actor='';}
 update(time:number,fighters:ReadonlyMap<string,Fighter>,flights:ReadonlyMap<string,Flight>){
  if(this.disposed)return;for(const batch of this.batches)batch.begin(time);const detail=this.kit.budget>=.65;
  const st=this.stage.open(time);
  for(const f of fighters.values()){
   const s=f.state;if(!isJinbeKarate(s.fighter)||!s.alive)continue;const elapsed=s.actionTime*s.actionDuration;
   this.swing(f,elapsed,time);
   if(s.action==='awaken')this.awakening(f,elapsed,detail);
   if((s.action==='light'||s.action==='heavy')&&s.whiffedAt===undefined){const k=Math.sin(clamp(s.actionTime)*Math.PI),r=s.action==='heavy'?.35:.22;f.strikePoint(this.p);this.q.setFromAxisAngle(UP,f.group.rotation.y);this.rings.add(this.p,this.q,r,r,r,FOAM,k*.85);if(detail)this.drops.add(this.p,this.q,r*.65,r*.65,r*.65,CYAN,k*.45);}
   if(s.action==='special'&&!s.branch&&s.whiffedAt===undefined&&elapsed<JINBE_MOVES.special.contacts[0]){const k=clamp(elapsed/JINBE_MOVES.special.contacts[0]);this.p.copy(f.handL);this.q.identity();this.drops.add(this.p,this.q,.12+.20*k,.12+.20*k,.12+.20*k,CYAN,.85);}
  }
  for(const f of flights.values()){
   if(!isJinbeKarate(f.fighter)||f.slot!=='special'||f.branch||!f.released)continue;
   this.direction.copy(f.heading);this.q.setFromUnitVectors(UP,this.direction);this.p.copy(f.position);
   const bead=f.awakened?2.3:2;this.drops.add(this.p,this.q,.33*bead,.58*bead,.33*bead,CYAN,1);this.drops.add(this.p,this.q,.15*bead,.38*bead,.15*bead,FOAM,.95);
   const floor=(f.actorId?fighters.get(f.actorId)?.group.position.y:undefined)??f.position.y-1.2;
   st.orb(f.position,f.heading,.62,SEA,f.since);
   st.bubble(f.position,.9,SEA,.7);
   st.disc(this.a.set(f.position.x,floor,f.position.z),2.3,DEEP,.6,SHEEN,1,f.since);
   if(st.tick&&this.full)this.full.smoke(f.position.x-f.heading.x*.6,f.position.y,f.position.z-f.heading.z*.6,-f.heading.x*2,1,-f.heading.z*2,.7,time,.35,SPRAY_LIT,SPRAY_SHADE);
   for(let i=1;i<=(detail?5:2);i++){this.p.copy(f.position).addScaledVector(this.direction,-i*.15);const size=.20-i*.026;this.sprays.add(this.p,this.q,size,size*2,size,CYAN,.7-i*.09);}
  }
  for(const drill of this.drills){
   if(!drill.actor)continue;const actor=fighters.get(drill.actor),victim=fighters.get(drill.target),s=actor?.state;
   if(!actor||!s?.alive||!victim?.state.alive&&!drill.finalHit||s.action!=='ultimate'||s.branch||(s.actionSeq??-1)!==drill.seq||s.whiffedAt!==undefined){drill.actor='';continue;}
   const elapsed=s.actionTime*s.actionDuration;if(elapsed>JINBE_KARATE_BEATS.end){drill.actor='';continue;}
   if(!drill.finalHit&&elapsed<ULT.contacts[FINAL])this.gather(actor,drill,elapsed,time,detail);
   if(elapsed<JINBE_KARATE_BEATS.coil)continue;
   this.a.copy(actor.handL);if(drill.finalHit&&!victim?.state.alive)this.b.copy(drill.endpoint);else bodyCentre(victim!,this.b);
   const charge=clamp((elapsed-JINBE_KARATE_BEATS.coil)/(JINBE_KARATE_BEATS.burst-JINBE_KARATE_BEATS.coil));this.p.copy(actor.group.position);this.p.y+=.045;const radius=.8+charge*.65;
   this.rings.add(this.p,this.flat,radius,radius,1,CYAN,.75);this.rings.add(this.p,this.flat,radius*.8,radius*.8,1,FOAM,.65);
   if(elapsed<JINBE_KARATE_BEATS.burst){this.p.copy(this.a);this.q.identity();this.drops.add(this.p,this.q,.16+charge*.24,.16+charge*.24,.16+charge*.24,CYAN,.7);continue;}
   const fade=clamp((JINBE_KARATE_BEATS.end-elapsed)/.17);this.direction.subVectors(this.b,this.a);const length=Math.min(10,this.direction.length());if(length<.05)continue;this.direction.normalize();this.q.setFromUnitVectors(UP,this.direction);this.p.copy(this.a).addScaledVector(this.direction,length*.5);
   this.jets.add(this.p,this.q,1.8,length,1.8,BLUE,fade);this.jets.add(this.p,this.q,.95,length,.95,CYAN,fade*.65);
   st.streak(this.a,this.b,.3,SEA.main,.6*fade);st.streak(this.a,this.b,.1,SEA.core,1.5*fade);st.light(this.p,Math.min(8,length*.5+3),SEA,.6*fade);
   this.q.setFromUnitVectors(FORWARD,this.direction);
   for(let i=0;i<(detail?7:4);i++){const t=(i/(detail?7:4)+(elapsed-JINBE_KARATE_BEATS.burst)*2)%1;this.p.copy(this.a).addScaledVector(this.direction,length*t);const r=.10+t*.7;this.rings.add(this.p,this.q,r,r,r,i%2?FOAM:CYAN,fade*(.55+.35*t));}
  }
  for(const impact of this.impacts){
   if(!impact.actor)continue;const s=fighters.get(impact.actor)?.state,age=time-impact.born,life=impact.grade===3?.48:.28;
   if(!s?.alive||!impact.projectile&&((s.actionSeq??-1)!==impact.seq||!attacking(s.action)||s.whiffedAt!==undefined)||age>=life){impact.actor='';continue;}if(age<0)continue;
   const fade=1-age/life;this.p.copy(impact.point);this.q.setFromAxisAngle(UP,impact.seed);const radius=.12+age*(2+impact.grade);this.rings.add(this.p,this.q,radius,radius,radius,FOAM,fade);
   for(let i=0;i<(detail?5:3)*impact.grade;i++){const theta=i*2.39996+impact.seed;this.p.copy(impact.point);this.p.x+=Math.sin(theta)*age*(2+impact.grade);this.p.z+=Math.cos(theta)*age*(2+impact.grade);this.p.y+=age*(i%3-1)*3-age*age*5;this.q.setFromAxisAngle(FORWARD,theta);const size=(.04+.015*impact.grade)*fade;this.sprays.add(this.p,this.q,size,size*2.4,size,i%3?CYAN:FOAM,fade);}
  }
  for(const batch of this.batches)batch.end();
  st.close();
 }
 private swing(f:Fighter,elapsed:number,time:number){
  const s=f.state,st=this.stage;
  if(s.whiffedAt!==undefined||!attacking(s.action))return;
  const seed=(s.actionSeq??0)*5.9,big=s.awakened?1.15:1,yaw=f.group.rotation.y,heading=this.heading.set(Math.sin(yaw),0,Math.cos(yaw));
  const fist=typeof f.strikePoint==='function'?f.strikePoint(this.fist):this.fist.copy(f.handL);
  if(s.action==='light'){
   const k=Math.sin(clamp(s.actionTime)*Math.PI);
   st.glow(fist,.3,SEA.main,.5*k);st.glow(fist,.32,SEA.core,.45*k,STAR,.2,Math.floor(time*24));st.light(fist,2.2,SEA,.22*k);
  }else if(s.action==='heavy'){
   const contact=s.branch?s.actionDuration*.5:HEAVY.contacts[0];
   if(elapsed<contact){const k=clamp(elapsed/contact);st.bubble(fist,(.24+.26*k)*big,SEA,.45+.55*k);st.charge(fist,SEA,.2,k,seed);}
   else if(elapsed<contact+.2){const u=(elapsed-contact)/.2;st.bubble(this.p.copy(fist).addScaledVector(heading,.3+.7*u),(.5+.8*u)*big,SEA,1-u);st.light(fist,3,SEA,.4*(1-u));}
  }else if(s.action==='special'&&!s.branch){
   const release=SPECIAL.contacts[0];
   if(elapsed<release){const k=clamp(elapsed/release);st.charge(f.handL,SEA,.36*big,k,seed);st.bubble(f.handL,(.22+.3*k)*big,SEA,.4+.5*k);st.disc(this.p.copy(f.group.position),1.6+1.6*k,DEEP,.5*k,SHEEN,1,seed);}
  }else if(s.action==='ultimate'&&!s.branch&&s.confirmedAt===undefined&&elapsed<ULT.contacts[0]+.1)st.charge(fist,SEA,.27,clamp(elapsed/ULT.contacts[0]),seed);
 }
 private gather(actor:Fighter,drill:Drill,elapsed:number,time:number,detail:boolean){
  const st=this.stage,g=clamp((elapsed-ULT.contacts[0])/(ULT.contacts[FINAL]-ULT.contacts[0])),seed=drill.seq*3.7,floor=actor.group.position.y;
  const feet=this.ground.copy(actor.group.position);
  st.dim(.3+.4*g,drill.actor,drill.target);
  st.disc(feet,(2.8+4*g)*(.6+.4*g),DEEP,.75,BURN,.3+.7*g,seed);
  st.disc(feet,3.2+4*g,DEEP,.16+.12*g,SHEEN,1,seed);
  for(let i=0,n=st.n(detail?14:8,6);i<n;i++){
   const ang=i*Math.PI*2/n+time*(1.6+2.4*g)+seed,r=2.1+.5*Math.sin(i*1.9)+.6*g,y=floor+.15+.5*g*Math.abs(Math.sin(i*2.3+time*2));
   this.a.set(feet.x+Math.cos(ang)*r,y,feet.z+Math.sin(ang)*r);this.b.set(feet.x+Math.cos(ang+.5)*r,y+.08,feet.z+Math.sin(ang+.5)*r);
   st.streak(this.a,this.b,.09,SEA.main,.4+.3*g);if(i%2===0)st.streak(this.a,this.b,.03,SEA.core,.9+.4*g);
  }
  if(st.tick&&this.full&&g>.15){const ang=time*7;this.full.smoke(feet.x+Math.cos(ang)*2.3,floor+.2,feet.z+Math.sin(ang)*2.3,-Math.sin(ang)*2,.9+g,Math.cos(ang)*2,.6+.3*g,time,.4,SPRAY_LIT,SPRAY_SHADE);}
  const fist=typeof actor.strikePoint==='function'?actor.strikePoint(this.fist):this.fist.copy(actor.handL);
  st.bubble(fist,.26+.34*g,SEA,.5+.5*g);st.charge(fist,SEA,.24+.2*g,Math.max(.4,g),seed);
  if(g>.8)st.speed(.5*(g-.8)/.2,drill.actor,drill.target);
 }
 private awakening(f:Fighter,elapsed:number,detail:boolean){
  const born=JINBE_AWAKENING.beats.release,fade=clamp((.9-elapsed)/.17),charge=clamp(elapsed/born);this.q.identity();
  if(elapsed<born){for(let side=0;side<2;side++){this.p.copy(side?f.handR:f.handL);this.drops.add(this.p,this.q,.12+charge*.13,.12+charge*.13,.12+charge*.13,CYAN,.65);}return;}
  const age=elapsed-born;this.p.copy(f.group.position);this.p.y+=.05;const radius=.8+age*5;
  this.rings.add(this.p,this.flat,radius,radius,1,CYAN,fade*.9);this.rings.add(this.p,this.flat,radius*.78,radius*.78,1,FOAM,fade*.8);
  if(detail)for(let i=0;i<12;i++){const theta=i*TAU/12;this.p.copy(f.group.position);this.p.x+=Math.sin(theta)*(.7+age*2);this.p.z+=Math.cos(theta)*(.7+age*2);this.p.y+=.15+Math.sin(age*5)*.7;this.q.identity();this.sprays.add(this.p,this.q,.075,.19,.075,i%3?CYAN:FOAM,fade);}
 }
 reset(){for(const drill of this.drills)drill.actor='';for(const impact of this.impacts)impact.actor='';this.seen.fill(-1);this.seenTimes.fill(-1);this.eventCursor=this.drillCursor=this.impactCursor=0;for(const batch of this.batches){batch.begin(0);batch.end();}this.stage.reset();}
 dispose(){if(this.disposed)return;this.disposed=true;this.reset();for(const batch of this.batches)batch.dispose();this.stage.release();}
}
