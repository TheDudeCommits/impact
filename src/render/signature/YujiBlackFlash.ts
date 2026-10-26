import * as THREE from 'three';
import type { CombatEvent } from '../../game/types';
import { YUJI_MOVES } from '../../game/fighters/yuji';
import type { Fighter } from '../Fighter';
import type { VfxKit } from '../vfx/VfxKit';
import { armoryDraws } from '../vfx/armory/drawn';
import { SIGNATURE, involvesLocal } from './context';
import { MoveStage, stageLook, type StageLook } from './MoveStage';
import { blowFloor } from './blowFloor';

export const isYujiBlackFlash = (id: string | undefined) => id === 'yuji';
export function yujiStrikeJoint(action:string,clip?:string,contactIndex=0):'LeftHand'|'RightHand'{
 if(clip==='Soul Jab'||action==='light'&&!clip)return 'LeftHand';
 if(action==='ultimate'&&(!clip||clip==='Eightfold Black Flash'))return contactIndex%2?'LeftHand':'RightHand';
 return 'RightHand';
}

export const YUJI_FLASH_LIMITS = Object.freeze({ bolts: 384, cores: 64, rings: 48, impacts: 20, folds: 6 });
export const YUJI_FLASH_BEATS = Object.freeze({ palms: .20, focus: .43, ignition: .58 });
export const YUJI_DIVERGENT_DELAY = .14;
const FORWARD=new THREE.Vector3(0,0,1),UP=new THREE.Vector3(0,1,0),INK=new THREE.Color(0x170b16),RED=new THREE.Color(0xef193c),WHITE=new THREE.Color(0xffebee);
const EDGE=new THREE.Color(1.9,.1,.2);
const MANUAL=new Set(['light','heavy','special','ultimate']);
const CURSED=stageLook(0xeaf6ff,0x4aa3ff,0x0b2a6b),FLASH=stageLook(0xfff0f2,0xff1a3c,0x280308),BLOOD=stageLook(0xffd9d9,0xd3122c,0x3a0308);
const BROKEN:StageLook={...FLASH,core:FLASH.main};
const HEAVY=YUJI_MOVES.heavy,SPECIAL=YUJI_MOVES.special,ULT=YUJI_MOVES.ultimate,FIRST=ULT.contacts[0],LAST=ULT.contacts[7];
const clamp=(v:number)=>Math.max(0,Math.min(1,v)),TAU=Math.PI*2;
const hash=(x:number)=>{const v=Math.sin(x*12.9898+78.233)*43758.5453;return v-Math.floor(v);};
class FlashBatch {
 readonly mesh: THREE.InstancedMesh<THREE.BufferGeometry,THREE.ShaderMaterial>;
 private tint: THREE.InstancedBufferAttribute;
 private pose=new THREE.Object3D(); private count=0;
 constructor(scene:THREE.Scene,name:string,geometry:THREE.BufferGeometry,private capacity:number){
  this.tint=new THREE.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('flashTint',this.tint);
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
   vertexShader:'attribute vec4 flashTint;varying vec4 vTint;void main(){vTint=flashTint;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',
   fragmentShader:'varying vec4 vTint;void main(){if(vTint.a<.004)discard;gl_FragColor=vTint;}'});
  this.mesh=new THREE.InstancedMesh(geometry,material,capacity);this.mesh.name='yuji-'+name;this.mesh.frustumCulled=false;this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.pose.scale.setScalar(0);this.pose.updateMatrix();this.mesh.setMatrixAt(0,this.pose.matrix);this.mesh.count=1;scene.add(this.mesh);
 }
 begin(){this.count=0;}
 add(p:THREE.Vector3,q:THREE.Quaternion,x:number,y:number,z:number,c:THREE.Color,a:number){
  if(this.count>=this.capacity||a<.004)return;
  this.pose.position.copy(p);this.pose.quaternion.copy(q);this.pose.scale.set(x,y,z);this.pose.updateMatrix();this.mesh.setMatrixAt(this.count,this.pose.matrix);this.tint.setXYZW(this.count++,c.r,c.g,c.b,Math.min(1,a));
 }
 end(){this.mesh.count=this.count;this.mesh.instanceMatrix.needsUpdate=true;this.tint.needsUpdate=true;}
 dispose(){this.mesh.removeFromParent();this.mesh.dispose();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
type Impact={actor:string;born:number;seed:number;grade:number;delay:number;shrine:boolean;life:number;p:THREE.Vector3};
type Fold={actor:string;target:string;seq:number;final:boolean};
export class YujiBlackFlash {
 private bolts:FlashBatch;private cores:FlashBatch;private rings:FlashBatch;private disposed=false;
 private readonly stage:MoveStage;
 private impacts:Impact[]=Array.from({length:YUJI_FLASH_LIMITS.impacts},()=>({actor:'',born:-1e9,seed:0,grade:0,delay:0,shrine:false,life:.3,p:new THREE.Vector3()}));
 private folds:Fold[]=Array.from({length:YUJI_FLASH_LIMITS.folds},()=>({actor:'',target:'',seq:-1,final:false}));
 private seen=new Float64Array(128).fill(-1);private seenTime=new Float64Array(128).fill(-1);private cursor=0;private seenCursor=0;private foldCursor=0;
 private origin=new THREE.Vector3();private a=new THREE.Vector3();private b=new THREE.Vector3();private p=new THREE.Vector3();private d=new THREE.Vector3();private q=new THREE.Quaternion();private identity=new THREE.Quaternion();
 private dir=new THREE.Vector3();private ground=new THREE.Vector3();private h=new THREE.Vector3();
 constructor(scene:THREE.Scene,private kit:Pick<VfxKit,'budget'>&Partial<VfxKit>){
  this.bolts=new FlashBatch(scene,'flash-veins',new THREE.BoxGeometry(1,1,1),YUJI_FLASH_LIMITS.bolts);this.cores=new FlashBatch(scene,'flash-cores',new THREE.IcosahedronGeometry(1,1),YUJI_FLASH_LIMITS.cores);this.rings=new FlashBatch(scene,'blood-rings',new THREE.TorusGeometry(1,.045,4,24),YUJI_FLASH_LIMITS.rings);
  this.bolts.mesh.renderOrder=6;this.cores.mesh.renderOrder=6;
  this.stage=MoveStage.for(scene,kit);
 }
 load(_ids:readonly string[]){return Promise.resolve();}
 private hand(f:Fighter,left:boolean,out:THREE.Vector3){
  const joint=f.joints?.get(left?'LeftHand':'RightHand');
  if(joint){joint.getWorldPosition(out);return true;}
  const socket=left?f.handL:f.handR;if(!socket)return false;
  out.copy(socket);return true;
 }
 handle(event:CombatEvent,fighters?:ReadonlyMap<string,Fighter>){
  if(this.disposed)return;
  if(event.kind==='eliminated'||event.kind==='respawn'){for(const hit of this.impacts)if(hit.actor===event.actorId)hit.actor='';for(const fold of this.folds)if(fold.actor===event.actorId||fold.target===event.actorId&&!fold.final)fold.actor='';return;}
  if(!isYujiBlackFlash(event.fighter))return;
  if(event.kind==='whiff'||event.kind==='rejected'){for(const fold of this.folds)if(fold.actor===event.actorId)fold.actor='';return;}
  const actor=fighters?.get(event.actorId),seq=event.actionSeq??actor?.state.actionSeq??-1;
  if(event.kind==='confirm'){
   if(event.slot!=='ultimate'||event.branch||!event.targetId||armoryDraws(event.fighter,event.slot,event.branch,event.actorId)||this.folds.some(f=>f.actor===event.actorId&&f.seq===seq))return;
   Object.assign(this.folds[this.foldCursor++%this.folds.length],{actor:event.actorId,target:event.targetId,seq,final:false});
   return;
  }
  if(event.kind!=='hit')return;
  for(let i=0;i<this.seen.length;i++)if(this.seen[i]===event.id&&this.seenTime[i]===event.serverTime)return;
  const ix=this.seenCursor++%this.seen.length;this.seen[ix]=event.id;this.seenTime[ix]=event.serverTime;
  if(!actor)return;
  const hit=this.impacts[this.cursor++%this.impacts.length];const clip=actor.motionEvidence?.().clip;const fallbackClip=event.slot==='light'&&((event.chain??0)>0||actor.state.grounded===false)?'Rush':undefined;const hand=actor.joints?.get(yujiStrikeJoint(event.slot??'',clip??fallbackClip,event.contactIndex??0));
  if(!hand&&!event.endpoint)return;
  if(event.endpoint)hit.p.set(event.endpoint.x,event.endpoint.y,event.endpoint.z);else hand!.getWorldPosition(hit.p);hit.actor=event.actorId;hit.born=event.serverTime;hit.seed=event.id;hit.delay=event.slot==='heavy'?.07:0;hit.shrine=event.branch==='llls';
  hit.grade=event.slot==='ultimate'&&!event.branch?((event.contactIndex??0)===7?3:2):event.slot==='special'?1.6:event.slot==='heavy'?1:.55;
  hit.life=hit.grade===3?.62:.3;
  if(hit.grade===3&&involvesLocal(event.actorId,event.targetId))SIGNATURE.screen?.impactFrame?.(.65,hit.p);
  if(!armoryDraws(event.fighter,event.slot,event.branch,event.actorId))this.land(event,hit.p,actor,event.targetId?fighters?.get(event.targetId):undefined,seq);
 }
 private land(e:CombatEvent,p:THREE.Vector3,actor:Fighter,target:Fighter|undefined,seq:number){
  const st=this.stage,t=e.serverTime,dir=this.dir,floor=blowFloor(actor,target,p.y-1.2),ground=this.ground.set(p.x,floor,p.z);
  dir.subVectors(p,actor.group.position).setY(0);if(dir.lengthSq()<.01)dir.set(Math.sin(actor.state.yaw??0),0,Math.cos(actor.state.yaw??0));dir.normalize();
  if(e.slot==='light'){st.burst(p,CURSED,.42,t,{dir,floor,clean:true});return;}
  if(e.slot==='heavy'){
   if(e.branch){st.burst(p,CURSED,.95,t,{dir,floor});st.shock(ground,CURSED,3.6,t,.4);return;}
   const late=t+YUJI_DIVERGENT_DELAY;
   st.burst(p,CURSED,.55,t,{dir,floor,clean:true});
   st.burst(this.b.copy(p).addScaledVector(dir,.6),CURSED,.95,late,{dir,floor,clean:true});
   st.dome(this.b.copy(p).addScaledVector(dir,.6),CURSED,1.2,late,.34);
   st.erupt(this.b.copy(p).addScaledVector(dir,.45),this.d.copy(dir).setY(.12).normalize(),CURSED,.3,3.1,late,.3);
   return;
  }
  if(e.slot==='special'){
   if(e.branch==='airSpecial'){st.burst(p,BLOOD,2,t,{floor});st.shock(ground,BLOOD,4.2,t,.45);st.scar(ground,BLOOD,2.2,t+.05,2);return;}
   const big=e.branch?.7:1;
   st.burst(this.b.copy(p).addScaledVector(dir,.5),BLOOD,1.7*big,t,{dir,floor});
   st.erupt(this.b.copy(p).addScaledVector(dir,.3),this.d.copy(dir).setY(.06).normalize(),BLOOD,.34*big,6.5*big,t,.42);
   st.shock(ground,BLOOD,5.5*big,t,.45);
   st.scar(this.b.copy(ground).addScaledVector(dir,1.6),BLOOD,1.9*big,t+.05,2.2);
   if(!e.branch)st.scar(this.b.copy(ground).addScaledVector(dir,4.2),BLOOD,1.3,t+.1,1.8);
   return;
  }
  if(e.slot!=='ultimate'||e.branch)return;
  const index=e.contactIndex??0;
  if(index<7){
   st.burst(p,FLASH,.8+.04*index,t,{dir,floor,clean:true});
   if(index%2)st.shock(ground,FLASH,3.4+.3*index,t,.36);
   return;
  }
  for(const fold of this.folds)if(fold.actor===e.actorId&&fold.seq===seq)fold.final=true;
  st.shatter(p,dir,BROKEN,5.2,t,.7);
  st.dome(p,FLASH,4,t,.42);
  st.burst(p,FLASH,2.1,t,{dir,floor});
  st.shock(ground,FLASH,9,t,.6);
  st.scar(ground,FLASH,3,t+.1,2);
 }
 update(time:number,fighters:ReadonlyMap<string,Fighter>){
  if(this.disposed)return;this.bolts.begin();this.cores.begin();this.rings.begin();const detail=this.kit.budget>=.65,st=this.stage.open(time);
  for(const f of fighters.values()){
   const s=f.state;if(!isYujiBlackFlash(s.fighter)||!s.alive)continue;const age=s.actionTime*s.actionDuration;
   const manual=MANUAL.has(s.action)&&s.whiffedAt===undefined&&(s.action!=='ultimate'||s.confirmedAt!==undefined||age<.46);
   const awakening=s.action==='awaken'&&age>=YUJI_FLASH_BEATS.ignition?Math.max(0,1-(age-YUJI_FLASH_BEATS.ignition)/.28):0;
   if(!manual&&!awakening)continue;
   for(let side=0;side<2;side++){
    if(s.action==='light'&&!awakening){const wanted=yujiStrikeJoint(s.action,(s.chain??0)>0||!s.grounded?'Rush':'Soul Jab');if((side?'LeftHand':'RightHand')!==wanted)continue;}
    if(!this.hand(f,!!side,this.a))continue;
    const blood=s.action==='special';const strength=awakening||((s.action==='ultimate'||blood)?.55:.22);
    this.q.setFromAxisAngle(UP,time*3+side);this.rings.add(this.a,this.q,.11,.11,.11,RED,strength);
    if(awakening)this.burst(this.a,(age-YUJI_FLASH_BEATS.ignition)*.8,awakening,side+4,detail?5:3,.30,2,true);
   }
   if(manual&&!armoryDraws('yuji',s.action,s.branch,s.id))this.windup(f,age);
  }
  for(const fold of this.folds){
   if(!fold.actor)continue;
   const actor=fighters.get(fold.actor),victim=fighters.get(fold.target),s=actor?.state;
   if(!actor||!s?.alive||!victim?.state.alive&&!fold.final||s.action!=='ultimate'||s.branch||(s.actionSeq??-1)!==fold.seq||s.whiffedAt!==undefined){fold.actor='';continue;}
   const elapsed=s.actionTime*s.actionDuration;
   if(!fold.final&&elapsed<LAST)this.zone(actor,fold,elapsed,time);
  }
  for(const hit of this.impacts){if(!hit.actor)continue;const age=time-hit.born-hit.delay;if(age<0)continue;if(age>hit.life){hit.actor='';continue;}
   const fade=1-age/hit.life;const radius=.10+hit.grade*.045;this.cores.add(hit.p,this.identity,radius,radius,radius,INK,fade);
   if(age<.07)this.cores.add(hit.p,this.identity,radius*.62,radius*.62,radius*.62,WHITE,fade);
   if(hit.shrine){for(let cut=0;cut<2;cut++){this.q.setFromAxisAngle(FORWARD,cut?-.72:.72);this.bolts.add(hit.p,this.q,.025,.55+age*2,.025,WHITE,fade);}}
   if(hit.grade>=2)this.burst(hit.p,age,fade,hit.seed+Math.floor(age*24)*13,detail?(hit.grade===3?14:10):5,hit.grade===3?2.2:.85,hit.grade===3?5.5:2.4);
   else this.burst(hit.p,age,fade,hit.seed,detail?7:4,.22+hit.grade*.17);
   if(hit.grade>=1){this.q.setFromAxisAngle(UP,hit.seed*.1);const scale=.12+age*(1.8+hit.grade*.4);this.rings.add(hit.p,this.q,scale,scale,scale,RED,fade*.85);}
  }
  this.bolts.end();this.cores.end();this.rings.end();st.close();
 }
 private windup(f:Fighter,age:number){
  const st=this.stage,s=f.state,seed=(s.actionSeq??0)*7.3,hand=this.h;
  if(s.action==='light'){
   if(!this.hand(f,yujiStrikeJoint(s.action,(s.chain??0)>0||!s.grounded?'Rush':'Soul Jab')==='LeftHand',hand))return;
   const k=Math.sin(clamp(s.actionTime)*Math.PI);
   st.glow(hand,.22,CURSED.main,.55*k);st.glow(hand,.09,CURSED.core,.7*k);st.light(hand,1.8,CURSED,.2*k);
  }else if(s.action==='heavy'&&!s.branch){
   if(!this.hand(f,false,hand))return;
   const contact=HEAVY.contacts[0];
   if(age<contact)st.charge(hand,CURSED,.24,age/contact,seed);
   else if(age<contact+.2){const flare=1-(age-contact)/.2;st.glow(hand,.5,CURSED.main,.8*flare);st.glow(hand,.2,CURSED.core,flare);st.light(hand,2.6,CURSED,.3*flare);}
  }else if(s.action==='special'&&!s.branch){
   if(age<SPECIAL.contacts[0]&&this.hand(f,false,hand))st.charge(hand,BLOOD,.34,age/SPECIAL.contacts[0],seed);
  }else if(s.action==='ultimate'&&!s.branch&&s.confirmedAt===undefined){
   if(this.hand(f,false,hand))st.charge(hand,FLASH,.26,age/FIRST,seed);
  }
 }
 private zone(actor:Fighter,fold:Fold,elapsed:number,time:number){
  const st=this.stage,g=clamp((elapsed-FIRST)/(LAST-FIRST)),feet=actor.group.position,seed=fold.seq*3.1,flick=Math.floor(time*20);
  st.dim(.3+.45*g,fold.actor,fold.target);
  st.pool(this.p.copy(feet),2+2.2*g,FLASH,.3+.7*g,seed);
  for(let i=0,n=st.n(g>.5?7:5,3);i<n;i++){
   const ang=hash(i*7.1+flick*3.3+seed)*TAU,r=1.9+1.2*hash(i*2.3+flick),height=(1.1+1.9*hash(i*5.9+flick))*(.6+.4*g),width=.04+.035*g;
   this.a.set(feet.x+Math.cos(ang)*r,feet.y,feet.z+Math.sin(ang)*r);
   for(let part=0;part<4;part++){
    this.b.set(feet.x+Math.cos(ang)*r+(hash(i+part*3.7+flick)-.5)*.7,feet.y+height*(part+1)/4,feet.z+Math.sin(ang)*r+(hash(i*1.9+part*5.3+flick)-.5)*.7);
    this.strike(this.a,this.b,width*(1-part*.18),1);this.a.copy(this.b);
   }
  }
  for(let side=0;side<2;side++)if(this.hand(actor,!!side,this.h)){st.glow(this.h,.3+.12*g,FLASH.main,.6);st.glow(this.h,.12,FLASH.core,.5+.4*g);}
  st.light(this.p.copy(feet).setY(feet.y+.6),3.6+1.4*g,FLASH,.22+.2*g);
  if(g>.7)st.speed(.5*(g-.7)/.3,fold.actor,fold.target);
 }
 private strike(a:THREE.Vector3,b:THREE.Vector3,width:number,alpha:number){
  const segment=a.distanceTo(b);if(segment<.01)return;
  this.p.copy(a).add(b).multiplyScalar(.5);this.d.subVectors(b,a).divideScalar(segment);this.q.setFromUnitVectors(UP,this.d);
  this.bolts.add(this.p,this.q,width*2.1,segment,width*2.1,EDGE,alpha);this.bolts.add(this.p,this.q,width,segment+.002,width,INK,alpha);
 }
 private burst(origin:THREE.Vector3,age:number,alpha:number,seed:number,count:number,reach:number,grow=2,entrance=false){
  this.origin.copy(origin);
  for(let i=0;i<count;i++){
   const phi=i*2.39996+seed*.17;const y=1-2*(i+.5)/count;const h=Math.sqrt(1-y*y);this.d.set(Math.cos(phi)*h,y,Math.sin(phi)*h);this.a.copy(this.origin);
   const dx=this.d.x,dy=this.d.y,dz=this.d.z;
   for(let part=0;part<3;part++){
    const length=(part+1)/3*(reach+age*grow);this.b.set(this.origin.x+dx*length,this.origin.y+dy*length,this.origin.z+dz*length);this.b.x+=Math.sin(seed+i*7+part*3)*reach*.14;this.b.z+=Math.cos(seed+i*4+part*7)*reach*.14;
    if(entrance){const segment=this.a.distanceTo(this.b),width=(.025+reach*.025)*alpha;if(segment>.01){this.p.copy(this.a).add(this.b).multiplyScalar(.5);this.d.subVectors(this.b,this.a).divideScalar(segment);this.q.setFromUnitVectors(UP,this.d);this.bolts.add(this.p,this.q,width*2.5,segment,width*2.5,INK,alpha);this.bolts.add(this.p,this.q,width,segment+.002,width,RED,alpha);}}
    else this.strike(this.a,this.b,(.035+Math.min(2.4,reach)*.035)*alpha,alpha);
    this.a.copy(this.b);
   }
  }
 }
 reset(){for(const hit of this.impacts)hit.actor='';for(const fold of this.folds)fold.actor='';this.seen.fill(-1);this.seenTime.fill(-1);this.bolts.begin();this.cores.begin();this.rings.begin();this.bolts.end();this.cores.end();this.rings.end();this.stage.reset();}
 dispose(){if(this.disposed)return;this.reset();this.disposed=true;this.bolts.dispose();this.cores.dispose();this.rings.dispose();this.stage.release();}
}
