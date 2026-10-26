import * as THREE from 'three';
import type {CombatEvent} from '../../game/types';
import type {Fighter} from '../Fighter';
import {bodyCentre,type VfxKit} from '../vfx/VfxKit';
import {MARK} from '../vfx/GroundMarks';
import {NANAMI_AWAKENING,NANAMI_MOVES} from '../../game/fighters/nanami';
import {armoryDraws} from '../vfx/armory/drawn';
import {SIGNATURE,involvesLocal} from './context';
import {RING,STAR} from './GlowBatch';
import {MoveStage,WAVE,stageLook} from './MoveStage';
import {blowFloor,floorUnder} from './blowFloor';
export const NANAMI_RATIO_ASSETS:readonly string[]=Object.freeze([]);
export const NANAMI_RATIO_LIMITS=Object.freeze({bars:160,arcs:48,shards:128,impacts:24,duels:8});
export const NANAMI_BLADE_EDGE=Object.freeze({base:[-.007240276070390525,.10857986669489031,.08146872907604652] as const,tip:[.06176850509720867,.13176414561625885,.3227385308651608] as const});
export const isNanamiRatio=(id:string|undefined)=>id==='nanami';
const UP=new THREE.Vector3(0,1,0),FORWARD=new THREE.Vector3(0,0,1),WHITE=new THREE.Color(0xf3fff4),GREEN=new THREE.Color(0x69c9a7),AMBER=new THREE.Color(0xecc77b),INK=new THREE.Color(0x1e332d);
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const hash=(x:number)=>{const v=Math.sin(x*12.9898+78.233)*43758.5453;return v-Math.floor(v);};
const RATIO=stageLook(0xf3fff4,0x69c9a7,0x1e332d,{heart:.5}),CRITICAL=stageLook(0xfff6e0,0xe3ad3c,0x1a1a1a);
const HEAVY=NANAMI_MOVES.heavy,SPECIAL=NANAMI_MOVES.special,ULT=NANAMI_MOVES.ultimate,TAU=Math.PI*2;
class RatioBatch{
 readonly mesh:THREE.InstancedMesh<THREE.BufferGeometry,THREE.ShaderMaterial>;
 private tint:THREE.InstancedBufferAttribute;private count=0;private transform=new THREE.Object3D();
 constructor(scene:THREE.Scene,name:string,geometry:THREE.BufferGeometry,readonly cap:number){
  this.tint=new THREE.InstancedBufferAttribute(new Float32Array(cap*4),4).setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('ratioTint',this.tint);
  const material=new THREE.ShaderMaterial({name:`Nanami-${name}`,transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,vertexShader:'attribute vec4 ratioTint;varying vec4 vTint;void main(){vTint=ratioTint;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',fragmentShader:'varying vec4 vTint;void main(){if(vTint.a<.003)discard;gl_FragColor=vTint;\n#include <colorspace_fragment>\n}'});material.forceSinglePass=true;
  this.mesh=new THREE.InstancedMesh(geometry,material,cap);this.mesh.name=`nanami-ratio-${name}`;this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.mesh.frustumCulled=false;this.mesh.renderOrder=3;this.mesh.count=0;scene.add(this.mesh);
 }
 begin(){this.count=0;}
 add(p:THREE.Vector3,q:THREE.Quaternion,x:number,y:number,z:number,color:THREE.Color,alpha:number){if(this.count>=this.cap||alpha<=.003||Math.min(x,y,z)<=0)return;this.transform.position.copy(p);this.transform.quaternion.copy(q);this.transform.scale.set(x,y,z);this.transform.updateMatrix();this.mesh.setMatrixAt(this.count,this.transform.matrix);this.tint.setXYZW(this.count++,color.r,color.g,color.b,clamp(alpha));}
 end(){this.mesh.count=this.count;this.mesh.instanceMatrix.needsUpdate=true;this.tint.needsUpdate=true;}
 dispose(){this.mesh.removeFromParent();this.mesh.dispose();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
type Hit={actor:string;seq:number;born:number;seed:number;grade:number;collapse:boolean;point:THREE.Vector3;yaw:number};
type Duel={actor:string;target:string;seq:number;finalHit:boolean;point:THREE.Vector3};
export class NanamiRatio{
 private readonly stage:MoveStage;private readonly full?:VfxKit;
 private c=new THREE.Vector3();private d=new THREE.Vector3();private heading=new THREE.Vector3();private ground=new THREE.Vector3();
 private bars:RatioBatch;private arcs:RatioBatch;private shards:RatioBatch;private batches:RatioBatch[];
 private hits:Hit[]=Array.from({length:NANAMI_RATIO_LIMITS.impacts},()=>({actor:'',seq:-1,born:0,seed:0,grade:0,collapse:false,point:new THREE.Vector3(),yaw:0}));
 private duels:Duel[]=Array.from({length:NANAMI_RATIO_LIMITS.duels},()=>({actor:'',target:'',seq:-1,finalHit:false,point:new THREE.Vector3()}));
 private seen=new Float64Array(128).fill(-1);private seenTime=new Float64Array(128).fill(-1);private eventCursor=0;private hitCursor=0;private duelCursor=0;private disposed=false;
 private p=new THREE.Vector3();private a=new THREE.Vector3();private b=new THREE.Vector3();private direction=new THREE.Vector3();private side=new THREE.Vector3();private q=new THREE.Quaternion();private face=new THREE.Quaternion();private flat=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
 constructor(scene:THREE.Scene,private kit:Pick<VfxKit,'budget'>&Partial<VfxKit>){this.bars=new RatioBatch(scene,'bars',new THREE.BoxGeometry(1,1,1),NANAMI_RATIO_LIMITS.bars);this.arcs=new RatioBatch(scene,'arcs',new THREE.RingGeometry(.94,1,36,1,0,Math.PI*2),NANAMI_RATIO_LIMITS.arcs);this.shards=new RatioBatch(scene,'shards',new THREE.OctahedronGeometry(.5,0),NANAMI_RATIO_LIMITS.shards);this.batches=[this.bars,this.arcs,this.shards];
  this.stage=MoveStage.for(scene,kit);this.full=kit.sparks&&kit.dust&&kit.marks&&kit.debris?kit as VfxKit:undefined;}
 load(_ids:readonly string[]):Promise<void>{return Promise.resolve();}
 handle(e:CombatEvent,fighters?:ReadonlyMap<string,Fighter>){
  if(this.disposed)return;if(e.kind==='eliminated'||e.kind==='respawn'){this.cancel(e.actorId,true);return;}if(!isNanamiRatio(e.fighter))return;if(e.kind==='whiff'||e.kind==='rejected'){this.cancel(e.actorId);return;}if(e.kind!=='hit'&&e.kind!=='confirm')return;
  for(let i=0;i<this.seen.length;i++)if(this.seen[i]===e.id&&this.seenTime[i]===e.serverTime)return;const index=this.eventCursor++%128;this.seen[index]=e.id;this.seenTime[index]=e.serverTime;
  const actor=fighters?.get(e.actorId),target=e.targetId?fighters?.get(e.targetId):undefined,seq=e.actionSeq??actor?.state.actionSeq??-1;
  if(e.kind==='confirm'){if(e.slot==='ultimate'&&!e.branch&&e.targetId)Object.assign(this.duels[this.duelCursor++%this.duels.length],{actor:e.actorId,target:e.targetId,seq,finalHit:false});return;}
  if(!target&&!e.endpoint)return;const final=e.slot==='ultimate'&&!e.branch&&e.contactIndex===3,h=this.hits[this.hitCursor++%this.hits.length];Object.assign(h,{actor:e.actorId,seq,born:e.serverTime,seed:e.id,grade:final?3:e.slot==='heavy'||e.slot==='special'?2:1,collapse:e.slot==='special'||e.branch==='llls'||e.branch==='airSpecial',yaw:actor?.group.rotation.y??0});if(target)bodyCentre(target,h.point);else h.point.set(e.endpoint!.x,e.endpoint!.y,e.endpoint!.z);
  if(final){for(const d of this.duels)if(d.actor===e.actorId&&d.target===e.targetId&&d.seq===seq){d.finalHit=true;d.point.copy(h.point);}if(involvesLocal(e.actorId,e.targetId))SIGNATURE.screen?.impactFrame?.(.38,h.point);}
  if(!armoryDraws(e.fighter,e.slot,e.branch,e.actorId))this.land(e,h.point,actor,target,final);
 }
 private land(e:CombatEvent,point:THREE.Vector3,actor:Fighter|undefined,target:Fighter|undefined,final:boolean){
  const st=this.stage,kit=this.full,t=e.serverTime,dir=this.heading,yaw=actor?.state.yaw??actor?.group.rotation.y??0;
  const floor=blowFloor(actor,target,point.y-1.05),ground=this.ground.set(point.x,floor,point.z);
  if(actor)dir.subVectors(point,actor.group.position).setY(0);if(!actor||dir.lengthSq()<.01)dir.set(Math.sin(yaw),0,Math.cos(yaw));dir.normalize();
  if(e.slot==='light'){st.burst(point,RATIO,.4,t,{dir,floor,clean:true});return;}
  if(e.slot==='special'||e.branch==='llls'||e.branch==='airSpecial'){
   const big=e.branch?.7:1;
   st.burst(point,RATIO,1.7*big,t,{dir,floor});
   st.shatter(this.c.copy(ground).setY(floor+.06),UP,RATIO,5.2*big,t,1.3);
   st.shatter(this.c.copy(ground).addScaledVector(dir,2.6*big).setY(floor+.06),UP,RATIO,3.2*big,t+.12,1.1);
   st.shock(ground,RATIO,6.5*big,t,.5);
   if(!kit)return;
   for(let i=0;i<4;i++){
    const ang=Math.atan2(dir.z,dir.x)+(i-1.5)*.7,r=(1.5+1.1*hash(i+e.id))*big;this.c.set(ground.x+Math.cos(ang)*r,floor,ground.z+Math.sin(ang)*r);
    kit.debris.burst(kit.n(7,3),this.c.x,floor,this.c.z,0,1,0,8,.7,.15,floor,2.2);
    if(kit.quality!=='low')kit.marks.mark(MARK.crack,this.c.x,floor,this.c.z,0,1,0,2.2,t+.05,3);
    kit.smoke(this.c.x+Math.cos(ang)*.8,floor+.5,this.c.z+Math.sin(ang)*.8,Math.cos(ang)*2.4,.9,Math.sin(ang)*2.4,.8,t+.05*i,.9);
   }
   return;
  }
  if(e.slot==='heavy'){
   const big=e.branch?.8:1;
   st.shatter(point,dir,CRITICAL,2.2*big,t,.38);
   st.burst(point,RATIO,.85*big,t,{dir,floor,clean:true});
   st.shock(ground,RATIO,4.2*big,t,.42);
   return;
  }
  if(e.slot!=='ultimate'||e.branch)return;
  const index=e.contactIndex??0;
  if(!final){
   st.shatter(point,dir,index===2?CRITICAL:RATIO,1.7+.3*index,t,.45);
   st.burst(point,RATIO,.9+.12*index,t,{dir,floor,clean:true});
   if(index)st.shock(ground,RATIO,3.6+index,t,.4);
   return;
  }
  st.shatter(point,dir,CRITICAL,6.5,t,.8);
  st.shatter(this.c.copy(ground).setY(floor+.06),UP,RATIO,8,t+.04,1.4);
  st.dome(point,CRITICAL,4.4,t,.45);
  st.burst(point,CRITICAL,2.3,t,{dir,floor});
  st.shock(ground,CRITICAL,9,t,.6);
  if(!kit)return;
  for(let i=0;i<4;i++){const ang=i*1.571+yaw+.5,r=2.4+hash(i+e.id);this.c.set(ground.x+Math.cos(ang)*r,floor,ground.z+Math.sin(ang)*r);kit.debris.burst(kit.n(7,3),this.c.x,floor,this.c.z,0,1,0,8,.8,.15,floor,2.2);if(kit.quality!=='low')kit.marks.mark(MARK.crack,this.c.x,floor,this.c.z,0,1,0,2.4,t+.05,3);}
 }
 private rule(point:THREE.Vector3,yaw:number,width:number,alpha:number,critical:number,time:number,flat=false){
  if(alpha<=.02||width<=.05)return;
  const st=this.stage,sx=flat?Math.sin(yaw):Math.cos(yaw),sz=flat?Math.cos(yaw):-Math.sin(yaw),tx=flat?Math.cos(yaw):0,ty=flat?0:1,tz=flat?-Math.sin(yaw):0;
  this.a.set(point.x-sx*width*.5,point.y,point.z-sz*width*.5);this.b.set(point.x+sx*width*.5,point.y,point.z+sz*width*.5);
  st.streak(this.a,this.b,.028+width*.004,RATIO.main,.9*alpha,RATIO.heart);
  for(let i=0;i<=10;i++){
   const seventh=i===7,h=width*(seventh?.15:i%5===0?.06:.035),u=i/10-.5;
   this.c.set(point.x+sx*width*u-tx*h,point.y-ty*h,point.z+sz*width*u-tz*h);this.d.set(point.x+sx*width*u+tx*h,point.y+ty*h,point.z+sz*width*u+tz*h);
   st.streak(this.c,this.d,seventh?.04+width*.006:.018+width*.003,seventh?CRITICAL.main:RATIO.main,(seventh?1.3:.7)*alpha,seventh?0:RATIO.heart);
  }
  this.c.set(point.x+sx*width*.2,point.y,point.z+sz*width*.2);
  if(critical>0&&!flat){st.glow(this.c,width*.2*(1.7-.7*critical),CRITICAL.core,.9*alpha*critical,RING,.05,0,.86);st.glow(this.c,.2+width*.05,CRITICAL.core,alpha*critical,STAR,.2,Math.floor(time*24));}
  st.light(this.c,1.6+width*.7,critical>0?CRITICAL:RATIO,.24*alpha);
 }
 private edge(f:Fighter){const bone=f.joints?.get('RightHand');if(bone){this.a.fromArray(NANAMI_BLADE_EDGE.base).applyMatrix4(bone.matrixWorld);this.b.fromArray(NANAMI_BLADE_EDGE.tip).applyMatrix4(bone.matrixWorld);return true;}if(!f.handR)return false;this.a.copy(f.handR);if(typeof f.strikePoint==='function')f.strikePoint(this.b);else this.b.copy(f.handR);return true;}
 private windup(f:Fighter,elapsed:number,time:number){
  const st=this.stage,s=f.state,seed=(s.actionSeq??0)*7.3,yaw=s.yaw??f.group.rotation.y;if(!this.edge(f))return;
  const base=this.c.copy(this.a),tip=this.d.copy(this.b),heading=this.heading.set(Math.sin(yaw),0,Math.cos(yaw));
  if(s.action==='light'){const k=Math.sin(clamp(s.actionTime)*Math.PI);st.streak(base,tip,.035,RATIO.main,.9*k,RATIO.heart);st.light(tip,1.7,RATIO,.16*k);return;}
  if(s.action==='heavy'){
   const contact=s.branch?s.actionDuration*.56:HEAVY.contacts[0];
   if(elapsed<contact){
    const k=clamp(elapsed/contact);st.streak(base,tip,.035+.03*k,RATIO.main,.6+.5*k,RATIO.heart);st.charge(tip,RATIO,.2,k,seed);
    this.p.copy(tip).addScaledVector(heading,.7);this.rule(this.p,yaw,.6+1.1*k,.75*k,k,time);
   }else if(elapsed<contact+.2){
    const flare=1-(elapsed-contact)/.2;this.p.copy(tip).addScaledVector(heading,.5);st.cracks(this.p,heading,1.2,CRITICAL,1,seed,flare);
   }
   return;
  }
  if(s.action==='special'&&!s.branch){
   const contact=SPECIAL.contacts[0];
   if(elapsed<contact){
    const k=clamp(elapsed/contact),reach=SPECIAL.range*(.4+.6*k);
    st.streak(base,tip,.035+.03*k,CRITICAL.main,.6+.5*k);st.charge(tip,CRITICAL,.28,k,seed);
    this.p.copy(f.group.position).addScaledVector(heading,.4+reach*.5);this.p.y+=.06;this.rule(this.p,yaw,reach,.8*k,0,time,true);
   }else if(elapsed<contact+.2){const flare=1-(elapsed-contact)/.2;this.p.copy(f.group.position).addScaledVector(heading,1.6);this.p.y+=.06;st.cracks(this.p,UP,1.5,RATIO,1,seed,flare);}
   return;
  }
  if(s.action==='ultimate'&&!s.branch&&s.confirmedAt===undefined&&elapsed<ULT.contacts[0]+.1){const k=clamp(elapsed/ULT.contacts[0]);st.streak(base,tip,.035+.03*k,CRITICAL.main,.6+.5*k);st.charge(tip,CRITICAL,.24,k,seed);}
 }
 private overtime(f:Fighter,d:Duel,t:number,time:number){
  const st=this.stage,g=clamp((t-ULT.contacts[0])/(ULT.contacts[3]-ULT.contacts[0])),yaw=f.state.yaw??f.group.rotation.y,floor=floorUnder(f.group.position.x,f.group.position.y,f.group.position.z),late=t>=2.65?clamp((t-2.65)/.45):0;
  st.dim(.3+.4*g,d.actor,d.target);
  this.rule(d.point,yaw,2.2+2.2*g,.55+.45*g,late,time);
  this.ground.set(d.point.x,floor,d.point.z);
  const inner=1.9+.3*g,outer=3+.5*g;
  st.disc(this.ground,outer/.9,RATIO.main,.7+.3*g,WAVE,.9,1);st.disc(this.ground,inner/.9,RATIO.main,.5+.3*g,WAVE,.9,2);
  for(let i=0;i<10;i++){
   const ang=i*TAU/10+time*.5,seventh=i===7;
   this.a.set(d.point.x+Math.cos(ang)*inner,floor+.05,d.point.z+Math.sin(ang)*inner);this.b.set(d.point.x+Math.cos(ang)*(seventh?outer+.6:outer),floor+.05,d.point.z+Math.sin(ang)*(seventh?outer+.6:outer));
   st.streak(this.a,this.b,seventh?.07:.035,seventh?CRITICAL.main:RATIO.main,(seventh?1.2:.6)*(.6+.4*g),seventh?0:RATIO.heart);
  }
  st.light(this.c.copy(this.ground).setY(floor+.4),outer*1.5+1,g>.75?CRITICAL:RATIO,.28+.2*g);
  if(this.edge(f)){this.c.copy(this.b);st.streak(this.a,this.b,.05+.03*g,CRITICAL.main,.8+.4*g);st.charge(this.c,CRITICAL,.24+.2*g,Math.max(.4,g),d.seq*3.1);}
  if(g>.8)st.speed(.5*(g-.8)/.2,d.actor,d.target);
 }
 private cancel(id:string,targetToo=false){for(const d of this.duels)if(d.actor===id||targetToo&&d.target===id&&!d.finalHit)d.actor='';for(const h of this.hits)if(h.actor===id)h.actor='';}
 private line(from:THREE.Vector3,to:THREE.Vector3,width:number,color:THREE.Color,alpha:number){this.direction.subVectors(to,from);const length=this.direction.length();if(length<.001)return;this.q.setFromUnitVectors(UP,this.direction.multiplyScalar(1/length));this.p.copy(from).lerp(to,.5);this.bars.add(this.p,this.q,width,length,width,color,alpha);}
 private blade(f:Fighter,width:number,color:THREE.Color,alpha:number){const bone=f.joints?.get('RightHand');if(!bone)return;this.a.fromArray(NANAMI_BLADE_EDGE.base).applyMatrix4(bone.matrixWorld);this.b.fromArray(NANAMI_BLADE_EDGE.tip).applyMatrix4(bone.matrixWorld);this.line(this.a,this.b,width,color,alpha);}
 private ratio(point:THREE.Vector3,yaw:number,width:number,alpha:number,critical:boolean){
  this.face.setFromAxisAngle(UP,yaw);this.side.set(1,0,0).applyQuaternion(this.face);this.a.copy(point).addScaledVector(this.side,-width*.5);this.b.copy(point).addScaledVector(this.side,width*.5);this.line(this.a,this.b,.016,WHITE,alpha*.8);
  for(let i=0;i<=10;i++){this.p.copy(point).addScaledVector(this.side,width*(i/10-.5));this.bars.add(this.p,this.face,i===7?.033:.015,i===7?.34:.11,.018,i===7?AMBER:GREEN,alpha*(i===7?1:.6));}
  if(critical){this.p.copy(point).addScaledVector(this.side,width*.2);this.q.copy(this.face);this.arcs.add(this.p,this.q,.3,.3,.3,AMBER,alpha);}
 }
 update(time:number,fighters:ReadonlyMap<string,Fighter>){
  if(this.disposed)return;for(const b of this.batches)b.begin();const detail=this.kit.budget>=.65,st=this.stage.open(time);
  for(const f of fighters.values()){
   const s=f.state;if(!isNanamiRatio(s.fighter)||!s.alive)continue;const elapsed=s.actionTime*s.actionDuration;
   if(s.action==='awaken'){this.awaken(f,elapsed,detail);continue;}
   if((s.action==='light'||s.action==='heavy'||s.action==='special')&&s.whiffedAt===undefined){const alpha=Math.sin(clamp(s.actionTime)*Math.PI);this.blade(f,s.awakened?.011:.007,s.awakened?AMBER:GREEN,alpha*.8);}
   if((s.action==='light'||s.action==='heavy'||s.action==='special'||s.action==='ultimate')&&s.whiffedAt===undefined&&!armoryDraws('nanami',s.action,s.branch,s.id))this.windup(f,elapsed,time);
  }
  for(const d of this.duels){
   if(!d.actor)continue;const f=fighters.get(d.actor),target=fighters.get(d.target),s=f?.state;
   if(!f||!s?.alive||!target?.state.alive&&!d.finalHit||s.action!=='ultimate'||s.branch||(s.actionSeq??-1)!==d.seq||s.whiffedAt!==undefined){d.actor='';continue;}
   const t=s.actionTime*s.actionDuration;if(t>3.55){d.actor='';continue;}
   if(target?.state.alive)bodyCentre(target,d.point);const alpha=t<3.1?clamp((t-.45)/.16)*.6:clamp((3.55-t)/.24);
   if(t>=.45)this.ratio(d.point,f.group.rotation.y,t>=2.65?1.65:1.0,alpha,t>=2.65);
   this.blade(f,t>=2.65?.014:.008,AMBER,alpha);
   if(!d.finalHit&&t<ULT.contacts[3]&&!armoryDraws('nanami','ultimate',undefined,d.actor))this.overtime(f,d,t,time);
   if(d.finalHit&&t>=3.1){this.a.copy(d.point);this.a.y-=.65;this.b.copy(d.point);this.b.y+=.65;this.a.addScaledVector(this.side,-.45);this.b.addScaledVector(this.side,.45);this.line(this.a,this.b,.018,WHITE,alpha*.9);}
  }
  for(const h of this.hits){
   if(!h.actor)continue;const f=fighters.get(h.actor),s=f?.state,age=time-h.born,life=h.grade===3?.42:.28;
   if(!s?.alive||(s.actionSeq??-1)!==h.seq||!['light','heavy','special','ultimate'].includes(s.action)||s.whiffedAt!==undefined||age>=life){h.actor='';continue;}if(age<0)continue;
   const fade=1-age/life;this.ratio(h.point,h.yaw,.7+age*(2+h.grade),fade,h.grade>=2);
   if(h.grade>=2&&!h.collapse&&!armoryDraws('nanami',s.action,s.branch,h.actor))this.rule(h.point,h.yaw,1.8+age*(4+h.grade*2),fade,1,time);this.face.setFromAxisAngle(UP,h.yaw);this.p.copy(h.point);this.arcs.add(this.p,this.face,.18+age*2.6,.18+age*2.6,1,h.grade===3?AMBER:GREEN,fade*.85);
   if(h.collapse){this.p.copy(h.point);this.p.y=f!.group.position.y+.03;this.arcs.add(this.p,this.flat,.5+age*4,.5+age*4,1,INK,fade*.9);}
   for(let i=0;i<(detail?5:2)*h.grade;i++){const angle=i*2.39996+h.seed;this.p.copy(h.point);this.p.x+=Math.sin(angle)*age*(2+h.grade);this.p.z+=Math.cos(angle)*age*(2+h.grade);this.p.y+=age*(i%3-1)*2-age*age*4;this.q.setFromAxisAngle(FORWARD,angle);const size=(h.collapse?.10:.035)*fade;this.shards.add(this.p,this.q,size,size*(h.collapse?1.1:3),size,h.collapse?INK:i%2?AMBER:GREEN,fade);}
  }
  for(const b of this.batches)b.end();st.close();
 }
 private awaken(f:Fighter,t:number,detail:boolean){const release=NANAMI_AWAKENING.beats.release;this.face.copy(f.group.quaternion);
  if(t<release){const alpha=clamp(t/release);this.p.copy(f.handL);this.arcs.add(this.p,this.face,.13,.13,.13,AMBER,alpha*.65);return;}
  const age=t-release,fade=clamp((.9-t)/.2);this.blade(f,.010,AMBER,fade);
  const count=detail?10:5;for(let i=0;i<count;i++){const angle=i/count*Math.PI*2;this.p.copy(f.group.position);this.p.x+=Math.sin(angle)*(.42+age*.4);this.p.z+=Math.cos(angle)*(.42+age*.4);this.p.y+=.3+((i*.19+age*1.8)%1.2);this.q.setFromAxisAngle(FORWARD,angle*.1);this.bars.add(this.p,this.q,.013,.14,.013,i%3?GREEN:AMBER,fade*.75);}
 }
 reset(){for(const d of this.duels)d.actor='';for(const h of this.hits)h.actor='';this.seen.fill(-1);this.seenTime.fill(-1);this.eventCursor=this.hitCursor=this.duelCursor=0;for(const b of this.batches){b.begin();b.end();}this.stage.reset();}
 dispose(){if(this.disposed)return;this.disposed=true;this.reset();for(const b of this.batches)b.dispose();this.stage.release();}
}
