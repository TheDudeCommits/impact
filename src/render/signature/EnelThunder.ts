import * as THREE from 'three';
import type {CombatEvent} from '../../game/types';
import type {Fighter} from '../Fighter';
import type {VfxKit} from '../vfx/VfxKit';
import {ENEL_MOVES} from '../../game/fighters/enel';
import {bodyCentre} from '../vfx/VfxKit';
import {SIGNATURE,involvesLocal} from './context';
import {STAR} from './GlowBatch';
import {MoveStage,SHEEN,stageLook,type StageLook} from './MoveStage';
import { blowFloor } from './blowFloor';

export const isEnelThunder=(id:string|undefined)=>id==='enel';
export const ENEL_THUNDER_LIMITS=Object.freeze({bolts:480,cores:48,rings:64,impacts:20,beams:8,storms:8});
export const ENEL_THUNDER_BEATS=Object.freeze({elThor:.75,stormRise:1.15,raigo:3.15,end:3.75,awakening:.54});
const UP=new THREE.Vector3(0,1,0),FRONT=new THREE.Vector3(0,0,1),WHITE=new THREE.Color(0xf5ffff),BLUE=new THREE.Color(0x39c7ff),GOLD=new THREE.Color(0xffd759),INK=new THREE.Color(0x151c39);
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
export const THUNDER:StageLook=stageLook(0xeaffff,0x70d9ff,0x1b3a8a,{heart:.5});
const lin=(r:number,g:number,b:number)=>new THREE.Color(r,g,b);
export const STORM:StageLook={core:lin(1.5,2.4,3.1),main:lin(.3,.85,1.9),rim:lin(.05,.16,.5),light:lin(.4,.75,1.2),element:THUNDER.element,shell:0x2a6ad8,edge:0x050a1c,flame:-1,dark:true,heart:.5,
 sphere:{body:lin(.012,.016,.04),core:lin(.1,.3,.62),rimA:lin(.8,2.1,2.9),rimB:lin(.35,1.1,2.3),spin:1.3}};
const GOLD_HOT=lin(2.3,1.75,.5);
const HEAVY=ENEL_MOVES.heavy,ULT=ENEL_MOVES.ultimate,FINAL=ULT.contacts.length-1;
type Strike={live:boolean;born:number;life:number;seed:number;size:number;at:THREE.Vector3};
export function enelRaigoStage(age:number,out={radius:0,height:0,fall:0}){
 const grow=clamp((age-1.15)/1.20),fall=clamp((age-2.68)/.47);
 out.radius=(.14+grow*.61)*(1-fall*.30);out.height=1.52-fall*.80;out.fall=fall;return out;
}
class ThunderBatch {
 readonly mesh:THREE.InstancedMesh<THREE.BufferGeometry,THREE.ShaderMaterial>;
 private tint:THREE.InstancedBufferAttribute;private pose=new THREE.Object3D();private count=0;
 constructor(scene:THREE.Scene,name:string,geometry:THREE.BufferGeometry,private capacity:number,cel=false){
  this.tint=new THREE.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('thunderTint',this.tint);
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,uniforms:{cel:{value:cel?1:0}},
   vertexShader:'attribute vec4 thunderTint;varying vec4 vTint;varying float face;void main(){vTint=thunderTint;face=dot(normalize(mat3(modelMatrix)*mat3(instanceMatrix)*normal),normalize(vec3(-.3,.9,.4)));gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',
   fragmentShader:'uniform float cel;varying vec4 vTint;varying float face;void main(){if(vTint.a<.004)discard;float band=face>.4?1.:(face>-.15?.72:.4);gl_FragColor=vec4(vTint.rgb*mix(1.,band,cel),vTint.a);}'});
  this.mesh=new THREE.InstancedMesh(geometry,material,capacity);this.mesh.name='enel-'+name;this.mesh.frustumCulled=false;this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.pose.scale.setScalar(0);this.pose.updateMatrix();this.mesh.setMatrixAt(0,this.pose.matrix);this.mesh.count=1;scene.add(this.mesh);
 }
 begin(){this.count=0;}
 add(p:THREE.Vector3,q:THREE.Quaternion,x:number,y:number,z:number,c:THREE.Color,a:number){if(this.count>=this.capacity||a<.004)return;this.pose.position.copy(p);this.pose.quaternion.copy(q);this.pose.scale.set(x,y,z);this.pose.updateMatrix();this.mesh.setMatrixAt(this.count,this.pose.matrix);this.tint.setXYZW(this.count++,c.r,c.g,c.b,clamp(a));}
 end(){this.mesh.count=this.count;this.mesh.instanceMatrix.needsUpdate=true;this.tint.needsUpdate=true;}
 dispose(){this.mesh.removeFromParent();this.mesh.dispose();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
type Impact={actor:string;born:number;grade:number;seed:number;p:THREE.Vector3};
type Beam={actor:string;born:number;seed:number;from:THREE.Vector3;to:THREE.Vector3};
type Storm={actor:string;target:string;seq:number;finalHit:boolean;finalAt:number;point:THREE.Vector3};
export class EnelThunder {
 private readonly stage:MoveStage;
 private strikes:Strike[]=Array.from({length:12},()=>({live:false,born:0,life:.25,seed:0,size:1,at:new THREE.Vector3()}));private strikeCursor=0;
 private blow=new THREE.Vector3();private ground=new THREE.Vector3();private tip=new THREE.Vector3();private hand=new THREE.Vector3();
 private bolts:ThunderBatch;private cores:ThunderBatch;private rings:ThunderBatch;private disposed=false;
 private impacts:Impact[]=Array.from({length:20},()=>({actor:'',born:-1e9,grade:0,seed:0,p:new THREE.Vector3()}));
 private beams:Beam[]=Array.from({length:8},()=>({actor:'',born:-1e9,seed:0,from:new THREE.Vector3(),to:new THREE.Vector3()}));
 private storms:Storm[]=Array.from({length:8},()=>({actor:'',target:'',seq:-1,finalHit:false,finalAt:-1e9,point:new THREE.Vector3()}));
 private seen=new Float64Array(128).fill(-1);private seenTime=new Float64Array(128).fill(-1);private cursor=0;private beamCursor=0;private stormCursor=0;private eventCursor=0;
 private raigoStage={radius:0,height:0,fall:0};
 private origin=new THREE.Vector3();private end=new THREE.Vector3();private a=new THREE.Vector3();private b=new THREE.Vector3();private p=new THREE.Vector3();private d=new THREE.Vector3();private q=new THREE.Quaternion();private identity=new THREE.Quaternion();private flat=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
 constructor(scene:THREE.Scene,private kit:Pick<VfxKit,'budget'>&Partial<VfxKit>){this.stage=MoveStage.for(scene,kit);this.bolts=new ThunderBatch(scene,'lightning',new THREE.BoxGeometry(1,1,1),480);this.cores=new ThunderBatch(scene,'thunder-cores',new THREE.IcosahedronGeometry(1,2),48,true);this.rings=new ThunderBatch(scene,'drum-rings',new THREE.RingGeometry(.9,1,32),64);}
 load(_ids:readonly string[]){return Promise.resolve();}
 handle(e:CombatEvent,fighters?:ReadonlyMap<string,Fighter>){
  if(this.disposed)return;
  if(e.kind==='eliminated'||e.kind==='respawn'){this.cancel(e.actorId,true);return;}
  if(!isEnelThunder(e.fighter))return;
  if(e.kind==='whiff'||e.kind==='rejected'){this.cancel(e.actorId);return;}
  if(e.kind!=='hit'&&e.kind!=='confirm'&&e.kind!=='release')return;
  for(let i=0;i<128;i++)if(this.seen[i]===e.id&&this.seenTime[i]===e.serverTime)return;
  const seen=this.eventCursor++%128;this.seen[seen]=e.id;this.seenTime[seen]=e.serverTime;
  const actor=fighters?.get(e.actorId),victim=e.targetId?fighters?.get(e.targetId):undefined;const seq=e.actionSeq??actor?.state.actionSeq??-1;
  if(e.kind==='confirm'){if(e.slot==='ultimate'&&!e.branch&&e.targetId)Object.assign(this.storms[this.stormCursor++%8],{actor:e.actorId,target:e.targetId,seq,finalHit:false,finalAt:-1e9});return;}
  if(e.kind==='release'){
   if(e.slot==='special'&&!e.branch&&e.origin&&e.endpoint){const b=this.beams[this.beamCursor++%8];Object.assign(b,{actor:e.actorId,born:e.serverTime,seed:e.id});b.from.set(e.origin.x,e.origin.y,e.origin.z);b.to.set(e.endpoint.x,e.endpoint.y,e.endpoint.z);}
   return;
  }
  if(!e.endpoint&&!victim)return;
  const final=e.slot==='ultimate'&&!e.branch&&e.contactIndex===2;const h=this.impacts[this.cursor++%20];Object.assign(h,{actor:e.actorId,born:e.serverTime,grade:final?3:e.slot==='special'||e.slot==='heavy'?2:1,seed:e.id});
  if(e.endpoint)h.p.set(e.endpoint.x,e.endpoint.y,e.endpoint.z);else h.p.copy(victim!.group.position).addScaledVector(UP,1);
  let confirmed=false;
  if(final){for(const s of this.storms)if(s.actor===e.actorId&&s.target===e.targetId&&s.seq===seq){s.finalHit=true;s.finalAt=e.serverTime;s.point.copy(h.p);confirmed=true;}if(involvesLocal(e.actorId,e.targetId))SIGNATURE.screen?.impactFrame?.(.5,h.p);}
  const st=this.stage,t=e.serverTime,point=this.p,floor=blowFloor(actor, victim, h.p.y-1),dir=this.blow,big=actor?.state.awakened?1.15:1;
  if(victim)bodyCentre(victim,point);else point.copy(h.p);
  if(actor){dir.subVectors(point,actor.group.position).setY(0);if(dir.lengthSq()<.01)dir.set(Math.sin(actor.group.rotation.y),0,Math.cos(actor.group.rotation.y));dir.normalize();}else dir.set(0,0,1);
  const ground=this.ground.set(point.x,floor,point.z);
  if(e.slot==='light'){st.burst(point,THUNDER,.42,t,{dir,floor,clean:true});return;}
  if(e.slot==='heavy'){
   const k=(e.branch?.8:1)*big;
   this.strike(ground,t,1.1*k,.26);
   st.burst(point,THUNDER,.85*k,t,{dir,floor});
   st.erupt(ground,UP,THUNDER,.3*k,7*k,t,.3);
   st.shock(ground,THUNDER,4.4*k,t,.42);
   return;
  }
  if(e.slot==='special'){
   if(e.branch==='airSpecial'){this.strike(ground,t,1.4,.3);st.burst(point,THUNDER,2,t,{floor});st.shock(ground,THUNDER,4.5,t,.45);st.scar(ground,THUNDER,2.4,t+.05,1.8);return;}
   st.shock(ground,THUNDER,5*big,t,.45);
   st.scar(ground,THUNDER,2.3*big,t+.1,2);
   return;
  }
  if(e.slot!=='ultimate'||e.branch)return;
  if(!final){this.strike(ground,t,e.contactIndex?1.3:1,.26);st.burst(point,THUNDER,e.contactIndex?1.25:.95,t,{dir,floor});if(e.contactIndex)st.shock(ground,THUNDER,5,t,.5);return;}
  if(!confirmed)return;
  this.strike(ground,t,2.2,.4);
  st.erupt(ground,UP,THUNDER,1.2,14,t,.6);
  st.shatter(point,dir,THUNDER,7,t,.7);
  st.dome(point,THUNDER,4.6,t,.45);
  st.burst(point,THUNDER,2.3,t,{dir,floor});
  st.shock(ground,THUNDER,10,t,.6);
  st.scar(ground,THUNDER,3.2,t+.1,2.2);
 }
 private strike(at:THREE.Vector3,born:number,size:number,life:number){const s=this.strikes[this.strikeCursor++%this.strikes.length];s.live=true;s.born=born;s.life=life;s.size=size;s.seed=Math.abs(at.x*17.3+at.z*9.1+born*7.7)%97;s.at.copy(at);}
 private fork(fromX:number,fromY:number,fromZ:number,to:THREE.Vector3,seed:number,width:number,intensity:number,segments:number,jitter:number){
  const st=this.stage;let x=fromX,y=fromY,z=fromZ;
  for(let i=1;i<=segments;i++){const u=i/segments,j=i===segments?0:Math.sin(u*Math.PI)*jitter,nx=fromX+(to.x-fromX)*u+Math.sin(seed*1.3+i*4.7)*j,ny=fromY+(to.y-fromY)*u+Math.cos(seed*.7+i*3.8)*j*.4,nz=fromZ+(to.z-fromZ)*u+Math.sin(seed*.9+i*6.1)*j;
   st.streak(this.a.set(x,y,z),this.b.set(nx,ny,nz),width,THUNDER.main,intensity,.5);x=nx;y=ny;z=nz;}
 }
 private cancel(id:string,target=false){for(const s of this.storms)if(s.actor===id||target&&s.target===id&&!s.finalHit)s.actor='';for(const h of this.impacts)if(h.actor===id)h.actor='';for(const b of this.beams)if(b.actor===id)b.actor='';}
 update(time:number,fighters:ReadonlyMap<string,Fighter>){
  if(this.disposed)return;this.bolts.begin();this.cores.begin();this.rings.begin();const detail=this.kit.budget>=.65;
  const st=this.stage.open(time);
  for(const f of fighters.values()){
   const s=f.state;if(!isEnelThunder(s.fighter)||!s.alive)continue;const age=s.actionTime*s.actionDuration;
   this.swing(f,age,time);
   const manual=(s.action==='light'||s.action==='heavy'||s.action==='special'||s.action==='ultimate')&&s.whiffedAt===undefined&&(s.action!=='ultimate'||s.confirmedAt!==undefined||age<.58);
   const awakening=s.action==='awaken';if(!manual&&!awakening)continue;
   const right=f.joints?.get('RightHand');if(!right)continue;right.getWorldPosition(this.origin);
   const alpha=awakening?Math.sin(clamp(age/.9)*Math.PI):.25+Math.sin(clamp(s.actionTime)*Math.PI)*.5;
   if(s.action==='special'&&!s.branch&&age<.75){const k=clamp(age/.75);this.cores.add(this.origin,this.identity,.07+k*.12,.07+k*.12,.07+k*.12,WHITE,alpha);}
   if(awakening||s.action==='heavy'||s.action==='special'){
    const head=f.joints?.get('Head');if(head){head.getWorldPosition(this.end);this.end.y+=.3;this.lightning(this.origin,this.end,Math.floor(age*24),alpha*.7,.018,detail?6:3);}
    this.q.setFromAxisAngle(FRONT,time*2);this.rings.add(this.origin,this.q,.18,.18,1,GOLD_HOT,alpha);
   }
   if(awakening&&age>=ENEL_THUNDER_BEATS.awakening){this.p.copy(f.group.position);this.p.y+=.05;const u=clamp((age-.54)/.36),r=.4+u*2.4;this.rings.add(this.p,this.flat,r,r,1,BLUE,1-u);}
  }
  for(const beam of this.beams){if(!beam.actor)continue;const age=time-beam.born;if(age<0)continue;if(age>.36){beam.actor='';continue;}const fade=1-age/.36;this.lightning(beam.from,beam.to,beam.seed+Math.floor(age*30),fade,.055,detail?16:8);this.q.identity();this.cores.add(beam.to,this.q,.30,.30,.30,WHITE,fade);}
  for(const storm of this.storms){if(!storm.actor)continue;const f=fighters.get(storm.actor),victim=fighters.get(storm.target),s=f?.state;
   if(!s||!s.alive||s.action!=='ultimate'||s.whiffedAt!==undefined||s.actionSeq!==storm.seq||(!victim?.state.alive&&!storm.finalHit)){storm.actor='';continue;}
   const age=s.actionTime*s.actionDuration;if(age>ENEL_THUNDER_BEATS.end){storm.actor='';continue;}if(age<1.15)continue;
   if(storm.finalHit)this.origin.copy(storm.point);else this.origin.copy(victim!.group.position).addScaledVector(UP,1);
   if(storm.finalHit){
    const impactAge=time-storm.finalAt;if(impactAge<0)continue;if(impactAge>.42){storm.actor='';continue;}
    const u=clamp(impactAge/.42),fade=(1-u)*(1-u),r=.25+Math.sin(u*Math.PI)*.60;
    this.cores.add(this.origin,this.identity,r,r*.80,r,BLUE,fade*.65);
    this.cores.add(this.origin,this.identity,r*.52,r*.75,r*.52,WHITE,fade);
    this.end.copy(this.origin);this.end.y+=.72*(1-u);this.lightning(this.end,this.origin,storm.seq+Math.floor(impactAge*36),fade,.09,detail?7:4);
    this.p.copy(this.origin);this.p.y=Math.max(f!.group.position.y+.05,this.origin.y-.9);
    this.rings.add(this.p,this.flat,.38+u*2.5,.38+u*2.5,1,BLUE,fade);
    this.q.identity();this.rings.add(this.origin,this.q,.28+u*1.25,.28+u*1.25,1,WHITE,fade*.8);
    continue;
   }
   this.cloud(f!,storm,age,time);
   const stage=enelRaigoStage(age,this.raigoStage),radius=stage.radius;
   this.end.copy(this.origin);this.end.y+=stage.height;
   this.cores.add(this.end,this.identity,radius,radius*.72,radius,INK,.94);
   this.q.setFromAxisAngle(UP,age*.7);this.rings.add(this.end,this.q,radius*1.04,radius*.78,1,BLUE,.92);
   for(let i=0;i<(detail?4:2);i++){
    const angle=i*Math.PI*.5+age;this.a.copy(this.end);this.a.x+=Math.cos(angle)*radius;this.a.z+=Math.sin(angle)*radius;this.b.copy(this.a);this.b.y-=radius*.65;
    this.lightning(this.a,this.b,i+Math.floor(age*15),.8,.017,4);
   }
   this.p.copy(this.origin);this.p.y=Math.max(f!.group.position.y+.045,this.origin.y-.95);
   this.rings.add(this.p,this.flat,.38+stage.fall*.22,.38+stage.fall*.22,1,BLUE,.24+stage.fall*.2);

  }
  for(const h of this.impacts){if(!h.actor)continue;const age=time-h.born;if(age<0)continue;if(age>.34){h.actor='';continue;}const fade=1-age/.34,r=.08+h.grade*.07;this.cores.add(h.p,this.identity,r,r,r,WHITE,fade);this.q.identity();this.rings.add(h.p,this.q,r+age*3,r+age*3,1,BLUE,fade);
   const n=detail?6:3;for(let i=0;i<n;i++){const angle=i*6.28318/n+h.seed;this.a.copy(h.p);this.b.copy(h.p);this.b.x+=Math.sin(angle)*(.35+age*3);this.b.y+=Math.cos(angle)*(.35+age*3);this.b.z+=(i%2?1:-1)*.15;this.lightning(this.a,this.b,h.seed+i,fade,.018+h.grade*.008,3);}
  }
  for(const k of this.strikes){
   if(!k.live)continue;const age=time-k.born;if(age>=k.life){k.live=false;continue;}if(age<0)continue;
   const fade=1-age/k.life,roll=k.seed+Math.floor(age*30),top=k.at.y+9*k.size;
   this.fork(k.at.x+Math.sin(roll)*1.2,top,k.at.z+Math.cos(roll*1.3)*1.2,k.at,roll,.09*k.size,1.5*fade,7,.7*k.size);
   this.fork(k.at.x+Math.sin(roll*1.7)*2,top,k.at.z+Math.cos(roll*.6)*2,k.at,roll+11,.05*k.size,1.1*fade,6,1*k.size);
   st.glow(this.p.copy(k.at).setY(k.at.y+.5),1.1*k.size,THUNDER.core,.9*fade,STAR,.2,roll);
   st.light(this.p.copy(k.at).setY(k.at.y+1),4+2.5*k.size,THUNDER,.6*fade);
  }
  this.bolts.end();this.cores.end();this.rings.end();
  st.close();
 }
 private swing(f:Fighter,age:number,time:number){
  const s=f.state,st=this.stage;
  if(s.whiffedAt!==undefined||s.action!=='light'&&s.action!=='heavy'&&s.action!=='special'&&s.action!=='ultimate')return;
  const joint=f.joints?.get('RightHand'),hand=this.hand;if(joint)joint.getWorldPosition(hand);else if(f.handR)hand.copy(f.handR);else return;
  const seed=(s.actionSeq??0)*6.3,big=s.awakened?1.15:1,tip=typeof f.strikePoint==='function'?f.strikePoint(this.tip):this.tip.copy(hand);
  if(s.action==='light'){
   const k=Math.sin(clamp(s.actionTime)*Math.PI);
   st.glow(tip,.3,THUNDER.main,.55*k);st.glow(tip,.34,THUNDER.core,.5*k,STAR,.2,Math.floor(time*24));st.light(tip,2.2,THUNDER,.22*k);
  }else if(s.action==='heavy'){
   const contact=s.branch?s.actionDuration*.5:HEAVY.contacts[0];
   if(age<contact)st.charge(tip,THUNDER,.23*big,clamp(age/contact),seed);
   else if(age<contact+.2){const flare=1-(age-contact)/.2,roll=seed+Math.floor(age*30);this.p.copy(tip);this.p.y=f.group.position.y+.05;this.fork(tip.x,tip.y+1.6,tip.z,this.p,roll,.07,1.5*flare,5,.4);st.glow(tip,.55,THUNDER.core,.7*flare,STAR,.2,roll);st.light(tip,3,THUNDER,.42*flare);}
  }else if(s.action==='special'&&!s.branch){
   if(age<ENEL_THUNDER_BEATS.elThor){const k=clamp(age/ENEL_THUNDER_BEATS.elThor),roll=seed+Math.floor(age*24);
    st.charge(hand,THUNDER,.36*big,k,seed);
    for(let i=0;i<2;i++){const ang=roll*2.1+i*3.1;this.fork(hand.x+Math.cos(ang)*(1.2+k),hand.y+1.6+k,hand.z+Math.sin(ang)*(1.2+k),hand,roll+i*7,.045,1.1*k,5,.35);}
    st.disc(this.p.copy(f.group.position),1.6+1.6*k,THUNDER.main,.5*k,SHEEN,1,seed);}
  }else if(s.action==='ultimate'&&!s.branch&&s.confirmedAt===undefined&&age<ULT.contacts[0]+.1)st.charge(tip,THUNDER,.27,clamp(age/ULT.contacts[0]),seed);
 }
 private cloud(f:Fighter,storm:Storm,age:number,time:number){
  const st=this.stage,g=clamp((age-ENEL_THUNDER_BEATS.stormRise)/(ENEL_THUNDER_BEATS.raigo-ENEL_THUNDER_BEATS.stormRise)),fall=clamp((age-2.68)/.47),seed=storm.seq*3.3;
  const floor=Math.min(f.group.position.y,this.origin.y-.95),radius=.5+1.1*Math.min(1,g*1.5),height=floor+5.2-1.9*fall*fall;
  st.dim(.3+.45*g,storm.actor,storm.target);
  const cloud=this.tip.set(this.origin.x,height,this.origin.z);
  st.ball(cloud,radius*(1+.04*Math.sin(time*23)),STORM,seed,Math.min(1,g*4));
  st.glow(cloud,radius*1.9,STORM.main,.5);st.glow(cloud,radius*1.3,STORM.core,.55,undefined,.0001,Math.floor(time*30));
  for(let i=0,n=st.n(3,2);i<n;i++){
   const clock=time*(5+3*g)+i*.37,cycle=Math.floor(clock),phase=clock-cycle;if(phase>.55)continue;
   const h=cycle*7.31+i*3.7+seed,ang=h*2.399963,r=1.5+2.3*Math.abs(Math.sin(h*1.9));
   this.ground.set(this.origin.x+Math.cos(ang)*r,floor+.03,this.origin.z+Math.sin(ang)*r);
   this.fork(cloud.x+Math.cos(ang)*radius*.6,cloud.y-radius*.5,cloud.z+Math.sin(ang)*radius*.6,this.ground,h+Math.floor(phase*6),.05+.03*g,1.5*(1-phase/.55),6,.5);
   st.glow(this.ground,.4+.3*g,THUNDER.core,.8*(1-phase/.55),STAR,.2,cycle);
   if(i===0)st.light(this.p.copy(this.ground).setY(floor+.6),3.5+1.5*g,THUNDER,.5*(1-phase/.55));
  }
  st.disc(this.p.set(this.origin.x,floor,this.origin.z),2.4+2*g,THUNDER.main,.3+.3*g,SHEEN,1,seed);
  st.light(this.p.copy(cloud).setY(cloud.y-radius),radius*3+2,STORM,.5+.3*g);
  const joint=f.joints?.get('RightHand');if(joint)st.charge(joint.getWorldPosition(this.hand),THUNDER,.24+.14*g,Math.max(.4,g),seed);else if(f.handR)st.charge(f.handR,THUNDER,.24+.14*g,Math.max(.4,g),seed);
  if(g>.8)st.speed(.5*(g-.8)/.2,storm.actor,storm.target);
 }
 private lightning(from:THREE.Vector3,to:THREE.Vector3,seed:number,alpha:number,width:number,segments:number){
  const fx=from.x,fy=from.y,fz=from.z,tx=to.x,ty=to.y,tz=to.z;let x=fx,y=fy,z=fz;
  for(let i=1;i<=segments;i++){const u=i/segments,j=i===segments?0:Math.sin(u*Math.PI)*.13,nx=fx+(tx-fx)*u+Math.sin(seed*1.3+i*4.7)*j,ny=fy+(ty-fy)*u+Math.cos(seed*.7+i*3.8)*j,nz=fz+(tz-fz)*u+Math.sin(seed*.9+i*6.1)*j;
   this.d.set(nx-x,ny-y,nz-z);const length=this.d.length();if(length>.0001){this.d.multiplyScalar(1/length);this.q.setFromUnitVectors(UP,this.d);this.p.set((x+nx)*.5,(y+ny)*.5,(z+nz)*.5);this.bolts.add(this.p,this.q,width*2.5,length,width*2.5,BLUE,alpha*.8);this.bolts.add(this.p,this.q,width,length+.002,width,WHITE,alpha);}x=nx;y=ny;z=nz;
  }
 }
 reset(){for(const h of this.impacts)h.actor='';for(const b of this.beams)b.actor='';for(const s of this.storms)s.actor='';for(const k of this.strikes)k.live=false;this.seen.fill(-1);this.seenTime.fill(-1);this.bolts.begin();this.cores.begin();this.rings.begin();this.bolts.end();this.cores.end();this.rings.end();this.stage.reset();}
 dispose(){if(this.disposed)return;this.reset();this.disposed=true;this.bolts.dispose();this.cores.dispose();this.rings.dispose();this.stage.release();}
}
