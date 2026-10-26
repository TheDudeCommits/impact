import * as THREE from 'three';
import type {CombatEvent} from '../../game/types';
import type {Fighter} from '../Fighter';
import type {Flight} from '../CombatEffects';
import {bodyCentre,type VfxKit} from '../vfx/VfxKit';
import {SIGNATURE,involvesLocal} from './context';
import {PAIN_MOVES} from '../../game/fighters/pain';
import {RING} from './GlowBatch';
import {SignaturePoolUpload} from './SignaturePoolUpload';
import {MoveStage,STAGE,WAVE,stageLook} from './MoveStage';
import { blowFloor } from './blowFloor';
export const isPainGravity=(id:string|undefined)=>id==='pain';
export function painStrikeJoint(action:string,clip?:string,contactIndex=0):'LeftHand'|'RightHand'{
 if(action==='ultimate'&&(!clip||clip==='Chibaku Tensei'))return contactIndex===0?'RightHand':'LeftHand';
 return ['Shinra Tensei','Bansho Tenin','Rush 2','Divine Rejection','Universal Pull','Heavenly Repulsion'].includes(clip??'')||(!clip&&(action==='heavy'||action==='special'))?'LeftHand':'RightHand';
}
export const PAIN_RECEIVER_TIP=Object.freeze([-0.6008820533752441,-0.01629497855901718,0.40872931480407715]as const);
export function painReceiverTip(fighter:Pick<Fighter,'drawnJoint'>,out:THREE.Vector3):boolean{const hand=fighter.drawnJoint('RightHand');if(!hand)return false;out.set(...PAIN_RECEIVER_TIP);hand.localToWorld(out);return true;}
export const PAIN_GRAVITY_LIMITS=Object.freeze({rings:160,rocks:96,streaks:144,impacts:24,cores:8});
const UP=new THREE.Vector3(0,1,0),FRONT=new THREE.Vector3(0,0,1),RIGHT=new THREE.Vector3(1,0,0);
const INK=new THREE.Color(0x181222),VIOLET=new THREE.Color(1.5,1.05,2.4),WHITE=new THREE.Color(2.5,2.4,2.8),ROCK=new THREE.Color(.5,.44,.56),SLATE=new THREE.Color(.2,.17,.26);
const FORCE=stageLook(0xffffff,0xd4c8f4,0x6a5aa0,{heart:.5}),PULL=stageLook(0xf3eefa,0xb193da,0x3c2a78),CORE=STAGE.dark;
const HEAVY=PAIN_MOVES.heavy,SPECIAL=PAIN_MOVES.special,ULT=PAIN_MOVES.ultimate;
export const PAIN_CHIBAKU=Object.freeze({rise:1.04,fall:3.14,height:3.3,radius:1.1});
const NO_FLIGHTS:ReadonlyMap<string,Flight>=new Map();
const clamp=(v:number)=>Math.max(0,Math.min(1,v)),easeOut=(v:number)=>1-(1-clamp(v))*(1-clamp(v));
class GravityBatch{
 readonly mesh:THREE.InstancedMesh<THREE.BufferGeometry,THREE.ShaderMaterial>;private tint:THREE.InstancedBufferAttribute;private pose=new THREE.Object3D();private count=0;private upload:SignaturePoolUpload;
 constructor(scene:THREE.Scene,name:string,geometry:THREE.BufferGeometry,private capacity:number){this.tint=new THREE.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('gravityTint',this.tint);const material=new THREE.ShaderMaterial({name:'PainGravity',transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,vertexShader:'attribute vec4 gravityTint;varying vec4 vTint;varying vec3 vNormal;void main(){vTint=gravityTint;vNormal=normalize(mat3(instanceMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',fragmentShader:'varying vec4 vTint;varying vec3 vNormal;void main(){if(vTint.a<.004)discard;float shade=.76+.24*abs(dot(normalize(vNormal),normalize(vec3(.4,1.,.5))));gl_FragColor=vec4(vTint.rgb*shade,vTint.a);}'});material.forceSinglePass=true;this.mesh=new THREE.InstancedMesh(geometry,material,capacity);this.mesh.name='pain-'+name;this.mesh.frustumCulled=false;this.mesh.renderOrder=6;this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.mesh.count=0;
  this.upload=new SignaturePoolUpload(this.mesh,this.tint);scene.add(this.mesh);}
 begin(){this.count=0;}
 add(p:THREE.Vector3,q:THREE.Quaternion,x:number,y:number,z:number,color:THREE.Color,alpha:number){if(this.count>=this.capacity||alpha<.004)return;this.pose.position.copy(p);this.pose.quaternion.copy(q);this.pose.scale.set(x,y,z);this.pose.updateMatrix();this.mesh.setMatrixAt(this.count,this.pose.matrix);this.tint.setXYZW(this.count++,color.r,color.g,color.b,Math.min(1,alpha));}
 end(){this.upload.end(this.count);}
 dispose(){this.mesh.removeFromParent();this.mesh.dispose();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
type Impact={actor:string;target:string;born:number;grade:number;seed:number;yaw:number;pull:boolean;push:boolean;point:THREE.Vector3;from:THREE.Vector3};
type Core={actor:string;target:string;seq:number;born:number};
export class PainGravity{
 private readonly stage:MoveStage;
 private rings:GravityBatch;private rocks:GravityBatch;private streaks:GravityBatch;private disposed=false;
 private impacts:Impact[]=Array.from({length:24},()=>({actor:'',target:'',born:-1e9,grade:0,seed:0,yaw:0,pull:false,push:false,point:new THREE.Vector3(),from:new THREE.Vector3()}));
 private cores:Core[]=Array.from({length:8},()=>({actor:'',target:'',seq:-1,born:-1e9}));private seen=new Float64Array(128).fill(-1);private seenTime=new Float64Array(128).fill(-1);private cursor=0;private coreCursor=0;private eventCursor=0;
 private a=new THREE.Vector3();private b=new THREE.Vector3();private p=new THREE.Vector3();private d=new THREE.Vector3();private q=new THREE.Quaternion();private spin=new THREE.Quaternion();private flat=new THREE.Quaternion().setFromAxisAngle(RIGHT,-Math.PI/2);
 private hand=new THREE.Vector3();private dir=new THREE.Vector3();private ground=new THREE.Vector3();private centre=new THREE.Vector3();
 constructor(scene:THREE.Scene,private kit:Pick<VfxKit,'budget'>&Partial<VfxKit>){this.stage=MoveStage.for(scene,kit);this.rings=new GravityBatch(scene,'gravity-rings',new THREE.RingGeometry(.9,1,32),160);this.rocks=new GravityBatch(scene,'gravity-stones',new THREE.IcosahedronGeometry(1,1),96);this.streaks=new GravityBatch(scene,'receiver-streaks',new THREE.BoxGeometry(1,1,1),144);}
 load(_ids:readonly string[]){return Promise.resolve();}
 private palm(f:Fighter,name:'LeftHand'|'RightHand',out:THREE.Vector3){const joint=typeof f.drawnJoint==='function'?f.drawnJoint(name):undefined;return joint?joint.getWorldPosition(out):out.copy(name==='LeftHand'?f.handL??f.group.position:f.handR??f.group.position);}
 handle(e:CombatEvent,fighters?:ReadonlyMap<string,Fighter>){
  if(this.disposed)return;
  if(['eliminated','respawn','whiff','rejected'].includes(e.kind)){for(const h of this.impacts)if(h.actor===e.actorId||h.target===e.actorId)h.actor='';for(const c of this.cores)if(c.actor===e.actorId||c.target===e.actorId)c.actor='';return;}
  if(!isPainGravity(e.fighter)||e.kind!=='hit'||!e.endpoint)return;for(let i=0;i<128;i++)if(this.seen[i]===e.id&&this.seenTime[i]===e.serverTime)return;const actor=fighters?.get(e.actorId);if(!actor)return;const i=this.eventCursor++%128;this.seen[i]=e.id;this.seenTime[i]=e.serverTime;
  const h=this.impacts[this.cursor++%24],ultimate=e.slot==='ultimate'&&!e.branch,target=e.targetId?fighters?.get(e.targetId):undefined;
  h.actor=e.actorId;h.target=e.targetId??'';h.born=e.serverTime;h.grade=ultimate?(e.contactIndex===3?3:1.5):e.slot==='heavy'?2:e.slot==='special'?1.5:.8;h.pull=e.slot==='special'&&e.branch!=='airSpecial';h.push=false;h.seed=e.id;h.yaw=actor.state.yaw;h.point.set(e.endpoint.x,e.endpoint.y,e.endpoint.z);
  if(ultimate&&e.contactIndex===0&&e.targetId){const c=this.cores.find(c=>c.actor===e.actorId)??this.cores[this.coreCursor++%8];c.actor=e.actorId;c.target=e.targetId;c.seq=actor.state.actionSeq??-1;c.born=e.serverTime;}
  if(h.grade===3&&involvesLocal(e.actorId,e.targetId))SIGNATURE.screen?.impactFrame?.(.46,h.point);
  const st=this.stage,t=e.serverTime,point=h.point,dir=this.dir,floor=blowFloor(actor,target,actor.group.position.y);
  dir.subVectors(point,actor.group.position).setY(0);if(dir.lengthSq()<.01)dir.set(Math.sin(actor.state.yaw??0),0,Math.cos(actor.state.yaw??0));dir.normalize();
  const ground=this.ground.set(point.x,floor,point.z);this.palm(actor,'LeftHand',h.from);
  if(e.slot==='light'){st.burst(point,PULL,.42,t,{dir,floor,clean:true});return;}
  if(e.slot==='heavy'){
   if(e.branch&&e.branch!=='llh'){st.burst(point,PULL,.9,t,{dir,floor});return;}
   this.push(this.centre.copy(actor.group.position).setY(actor.group.position.y+1.1).addScaledVector(dir,1.7),actor.group.position.y,e.branch?.8:1,t,h,this.b.copy(actor.group.position).addScaledVector(dir,1.3));
   st.burst(point,FORCE,.42,t,{dir,floor,clean:true});
   return;
  }
  if(e.slot==='special'){
   if(e.branch==='airSpecial'){this.push(this.centre.copy(point),floor,1,t,h);st.burst(point,FORCE,1.5,t,{floor});st.scar(ground,FORCE,2,t+.1,1.5);return;}
   const big=e.branch?.8:1;
   st.burst(point,PULL,1.6*big,t,{dir:this.d.copy(dir).multiplyScalar(-1),floor});st.shock(ground,PULL,4.6*big,t,.5);st.scar(ground,PULL,1.6*big,t+.05,1.6);
   return;
  }
  if(!ultimate)return;
  if(e.contactIndex!==3){st.burst(point,PULL,e.contactIndex?1.4:1.1,t,{dir,floor});if(e.contactIndex)st.shock(ground,PULL,4.5,t,.45);return;}
  st.burst(point,CORE,2.4,t,{dir,floor});
  st.dome(point,FORCE,4.6,t,.5);
  st.shock(ground,FORCE,9,t,.6);
  st.shatter(this.a.copy(ground).setY(floor+.06),UP,FORCE,5.5,t+.04,1.1);
  st.erupt(this.a.copy(ground).addScaledVector(dir,1.1),UP,CORE,.85,7.5,t+.12,.55);
  st.scar(ground,PULL,3.4,t+.1,2.2);
 }
 private push(centre:THREE.Vector3,floor:number,big:number,t:number,h:Impact,cracks?:THREE.Vector3){
  const st=this.stage,feet=h.from.set(centre.x,floor,centre.z);h.push=true;
  st.dome(centre,FORCE,2.4*big,t,.4);
  st.shatter(this.a.copy(cracks??feet).setY(floor+.06),UP,FORCE,2*big,t,.5);
 }
 update(time:number,fighters:ReadonlyMap<string,Fighter>,flights:ReadonlyMap<string,Flight>=NO_FLIGHTS){
  if(this.disposed)return;const st=this.stage.open(time);this.rings.begin();this.rocks.begin();this.streaks.begin();const detail=this.kit.budget>=.65;
  for(const f of fighters.values()){
   const s=f.state;if(!isPainGravity(s.fighter)||!s.alive||s.whiffedAt!==undefined)continue;const elapsed=s.actionTime*s.actionDuration,seed=(s.actionSeq??0)*5.3;
   if((s.action==='heavy'||s.action==='special')&&!s.branch){
    const hand=this.palm(f,'LeftHand',this.hand),release=s.action==='heavy'?HEAVY.contacts[0]:SPECIAL.contacts[0];
    if(elapsed>.19&&elapsed<(s.action==='heavy'?.61:.53)&&typeof f.drawnJoint==='function'&&f.drawnJoint('LeftHand')){this.q.setFromAxisAngle(UP,s.yaw);const u=(elapsed-.19)/.42,r=.07+u*.22;this.rings.add(hand,this.q,r,r,1,INK,.8);this.rings.add(hand,this.q,r*.80,r*.80,1,VIOLET,.8);}
    if(elapsed<release){const k=clamp(elapsed/release);st.charge(hand,s.action==='heavy'?FORCE:PULL,s.action==='heavy'?.15:.34,k,seed);}
   }else if(s.action==='light'){
    const power=Math.sin(clamp(s.actionTime)*Math.PI),hand=this.palm(f,'RightHand',this.hand);
    if(!painReceiverTip(f,this.a))this.a.copy(hand).addScaledVector(this.d.set(Math.sin(s.yaw??0),0,Math.cos(s.yaw??0)),.6);
    st.streak(hand,this.a,.035,PULL.main,1.2*power);st.glow(this.a,.2,PULL.main,.55*power);st.glow(this.a,.08,PULL.core,.8*power);st.light(this.a,1.8,PULL,.18*power);
   }else if(s.action==='ultimate'&&!s.branch&&s.confirmedAt===undefined&&elapsed<ULT.contacts[0]+.1){
    st.charge(this.palm(f,'RightHand',this.hand),CORE,.3,clamp(elapsed/ULT.contacts[0]),seed);
   }
   if(s.action==='awaken'&&s.actionTime>.15&&s.actionTime<.92){const u=(s.actionTime-.15)/.77,alpha=Math.sin(u*Math.PI);this.a.copy(f.group.position);this.a.y+=.025;for(let i=0;i<(detail?3:2);i++){const r=.25+u*(.80+i*.20);this.rings.add(this.a,this.flat,r,r,1,i%2?VIOLET:INK,alpha*.70);}const head=f.drawnJoint('Head');if(head){head.getWorldPosition(this.a);this.a.y+=.10;this.a.x+=Math.sin(s.yaw)*.09;this.a.z+=Math.cos(s.yaw)*.09;this.q.setFromAxisAngle(UP,s.yaw);this.rings.add(this.a,this.q,.14,.07,1,VIOLET,alpha*.48);}}
  }
  for(const f of flights.values()){if(!isPainGravity(f.fighter)||f.slot!=='special'||f.branch||!f.released)continue;this.q.setFromUnitVectors(FRONT,f.heading);for(let i=0;i<(detail?4:2);i++){this.a.copy(f.position).addScaledVector(f.heading,-i*.3);const r=.42+i*.1;this.rings.add(this.a,this.q,r,r,1,i%2?VIOLET:INK,1-i*.15);}
   st.orb(f.position,f.heading,.6,PULL,(f.since??0)*2.9);
  }
  for(const c of this.cores){
   if(!c.actor)continue;const actor=fighters.get(c.actor),target=fighters.get(c.target);if(!actor||!target||!actor.state.alive||!target.state.alive||actor.state.action!=='ultimate'||actor.state.whiffedAt!==undefined||(actor.state.actionSeq??-1)!==c.seq||actor.group.position.distanceToSquared(target.group.position)>64||time-c.born>4){c.actor='';continue;}
   const elapsed=actor.state.actionTime*actor.state.actionDuration,K=PAIN_CHIBAKU;if(elapsed<K.rise||elapsed>K.fall)continue;
   const u=clamp((elapsed-K.rise)/(K.fall-K.rise)),fade=Math.min(1,u*6)*Math.min(1,(K.fall-elapsed)*12),floor=target.group.position.y,seed=c.seq*1.9;
   const core=this.a.copy(target.group.position);core.y=floor+1.5+(K.height-1.5)*easeOut(u*1.6);
   const radius=.2+(K.radius-.2)*u;
   st.ball(core,radius,CORE,seed,fade);st.glow(core,radius*2.2,CORE.main,.4*fade);st.glow(core,radius*1.45,CORE.core,.7*fade,RING,.05,Math.floor(time*30),.84);
   this.q.setFromAxisAngle(RIGHT,.85);this.rings.add(core,this.q,radius*1.5,radius*1.5,1,VIOLET,fade*.8);
   st.light(this.p.copy(core),4+radius*2.5,CORE,.3*fade);
   const ground=this.ground.copy(target.group.position).setY(floor+.06);
   st.cracks(ground,UP,1.8+2.4*u,PULL,Math.min(1,u*2.2),seed,fade*.55);
   const count=detail?18:9,toHim=this.d.subVectors(actor.group.position,target.group.position).setY(0).normalize(),hx=toHim.x,hz=toHim.z;
   for(let i=0;i<count;i++){
    const rise=(time*(.3+.05*(i%3))+i*.137)%1,angle=i*2.39996+time*(i%2?1.5:-1.1)+rise*3.2,orbit=(2.9-1.9*rise)*(1+(i%3)*.12);
    if(rise<.7&&Math.cos(angle)*hx+Math.sin(angle)*hz>.25)continue;
    this.p.set(core.x+Math.cos(angle)*orbit,floor+.15+(core.y-floor-.15)*rise*rise,core.z+Math.sin(angle)*orbit);
    this.spin.setFromAxisAngle(UP,angle*2);const size=(.12+(i%4)*.05+u*.07)*(1-.35*rise);
    this.rocks.add(this.p,this.spin,size,size*.8,size*.9,i%3?ROCK:SLATE,fade*Math.min(1,rise*8)*Math.min(1,(1-rise)*5));
   }
   for(let i=0,n=st.n(7,4);i<n;i++){
    const phase=(time*1.3+i*.618)%1,angle=i*2.39996+seed,r=3.2*(1-phase*.75);
    if(Math.cos(angle)*hx+Math.sin(angle)*hz>.25)continue;
    this.p.set(core.x+Math.cos(angle)*r,floor+.1+(core.y-floor)*phase*.9,core.z+Math.sin(angle)*r);this.d.subVectors(core,this.p).normalize();
    st.streak(this.p,this.b.copy(this.p).addScaledVector(this.d,.9),.06,CORE.main,1.3*Math.sin(Math.PI*phase)*fade);
   }
  }
  for(const h of this.impacts){
   if(!h.actor)continue;const age=time-h.born;if(age<0)continue;if(age>.44){h.actor='';continue;}const fade=1-age/.44;const r=h.pull?(.72-age*1.4):(.16+age*(2.1+h.grade));this.q.setFromAxisAngle(UP,h.yaw);this.rings.add(h.point,this.q,r,r,1,INK,fade);this.rings.add(h.point,this.q,r*.94,r*.94,1,h.grade===3?WHITE:VIOLET,fade*.85);const count=detail?8:4;for(let i=0;i<count;i++){const angle=i*Math.PI*2/count+h.seed*.21;this.a.copy(h.point);this.a.x+=Math.cos(angle)*r;this.a.y+=Math.sin(angle)*r;this.b.copy(this.a);this.b.x+=Math.cos(angle)*.13*h.grade;this.b.y+=Math.sin(angle)*.13*h.grade;this.segment(this.a,this.b,.03,INK,fade);}
   if(h.push){const u=age/.44;st.disc(h.from,4.8,FORCE.core,1-u*.5,WAVE,.08+.92*easeOut(u),h.seed);st.light(this.a.copy(h.from).setY(h.from.y+.4),2+3.5*u,FORCE,.3*(1-u));}
   if(h.pull){
    st.bubble(h.point,2.4*(1-age/.44)+.3,PULL,fade);
    this.d.subVectors(h.from,h.point);const span=this.d.length();if(span>.5){this.d.divideScalar(span);
     for(let i=0,n=st.n(6,3);i<n;i++){const phase=(age/.44*1.6+i*.31)%1,ang=i*2.39996+h.seed,off=.9*(1-phase);
      this.a.copy(h.point).addScaledVector(this.d,span*phase*.8);this.a.x+=Math.cos(ang)*off;this.a.y+=Math.sin(ang)*off*.6;this.a.z+=Math.sin(ang*1.3)*off;
      st.streak(this.a,this.b.copy(this.a).addScaledVector(this.d,Math.min(1.1,span*.25)),.06,PULL.main,1.3*fade*Math.sin(Math.PI*phase));}}
   }
   if(h.grade===3){
    this.a.copy(h.point);this.a.y=Math.max(.035,this.a.y-.8);this.rings.add(this.a,this.flat,r*1.25,r*1.25,1,VIOLET,fade*.7);
    for(let i=0,n=detail?12:6;i<n;i++){const angle=i*2.39996+h.seed,far=.6+age*(7+(i%4)*1.5);this.p.set(h.point.x+Math.cos(angle)*far,Math.max(.1,h.point.y+.6+age*(4+i%3)-age*age*16),h.point.z+Math.sin(angle)*far);this.spin.setFromAxisAngle(UP,angle+age*9);const size=.14+(i%4)*.05;this.rocks.add(this.p,this.spin,size,size*.8,size*.9,i%3?ROCK:SLATE,fade);}
   }
  }
  this.rings.end();this.rocks.end();this.streaks.end();st.close();
 }
 private segment(a:THREE.Vector3,b:THREE.Vector3,width:number,color:THREE.Color,alpha:number){const length=a.distanceTo(b);if(length<1e-5)return;this.p.copy(a).add(b).multiplyScalar(.5);this.d.subVectors(b,a).normalize();this.q.setFromUnitVectors(UP,this.d);this.streaks.add(this.p,this.q,width,length,width,color,alpha);}
 reset(){for(const h of this.impacts)h.actor='';for(const c of this.cores)c.actor='';this.seen.fill(-1);this.seenTime.fill(-1);for(const b of[this.rings,this.rocks,this.streaks]){b.begin();b.end();}this.stage.reset();}
 dispose(){if(this.disposed)return;this.reset();this.disposed=true;this.rings.dispose();this.rocks.dispose();this.streaks.dispose();this.stage.release();}
}
