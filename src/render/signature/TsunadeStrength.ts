import * as THREE from 'three';
import type {CombatEvent}from '../../game/types';
import type {Fighter}from '../Fighter';
import type {VfxKit}from '../vfx/VfxKit';
import {SIGNATURE,involvesLocal}from './context';
import {TSUNADE_MOVES}from '../../game/fighters/tsunade';
import {MoveStage,stageLook}from './MoveStage';
export const isTsunadeStrength=(id:string|undefined)=>id==='tsunade';
export const TSUNADE_STRENGTH_LIMITS=Object.freeze({cracks:384,shards:96,rings:64,impacts:24});
const UP=new THREE.Vector3(0,1,0),FORWARD=new THREE.Vector3(0,0,1),MINT=new THREE.Color(0x63efb3),WHITE=new THREE.Color(0xebfff7),STONE=new THREE.Color(0x55545d),INK=new THREE.Color(0x17151f);
const GLOW=new THREE.Color(.8,1.75,3),PALE=new THREE.Color(2.5,2.8,3);
const CHAKRA=stageLook(0xf3fbff,0x63b6ff,0x2a4fb0,{heart:.5}),SEAL=stageLook(0xf8ecff,0xb873f2,0x5b2c8a);
const HEAVY=TSUNADE_MOVES.heavy,SPECIAL=TSUNADE_MOVES.special,ULT=TSUNADE_MOVES.ultimate;
type Confirm={actor:string;target:string;seq:number;final:boolean};
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const MANUAL=new Set(['light','heavy','special','ultimate']);
class StrengthBatch{
 readonly mesh:THREE.InstancedMesh<THREE.BufferGeometry,THREE.ShaderMaterial>;
 private tint:THREE.InstancedBufferAttribute;private object=new THREE.Object3D();private count=0;
 constructor(scene:THREE.Scene,name:string,geometry:THREE.BufferGeometry,private capacity:number){
  this.tint=new THREE.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('strengthTint',this.tint);
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide,vertexShader:'attribute vec4 strengthTint;varying vec4 vTint;void main(){vTint=strengthTint;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',fragmentShader:'varying vec4 vTint;void main(){if(vTint.a<.004)discard;gl_FragColor=vTint;}'});material.forceSinglePass=true;
  this.mesh=new THREE.InstancedMesh(geometry,material,capacity);this.mesh.name='tsunade-'+name;this.mesh.frustumCulled=false;this.mesh.renderOrder=6;this.mesh.count=0;this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(this.mesh);
 }
 begin(){this.count=0;}
 add(p:THREE.Vector3,q:THREE.Quaternion,x:number,y:number,z:number,c:THREE.Color,alpha:number){if(this.count>=this.capacity||alpha<.004||Math.min(x,y,z)<=0)return;this.object.position.copy(p);this.object.quaternion.copy(q);this.object.scale.set(x,y,z);this.object.updateMatrix();this.mesh.setMatrixAt(this.count,this.object.matrix);this.tint.setXYZW(this.count++,c.r,c.g,c.b,clamp(alpha));}
 end(){this.mesh.count=this.count;this.mesh.instanceMatrix.needsUpdate=true;this.tint.needsUpdate=true;}
 dispose(){this.mesh.removeFromParent();this.mesh.dispose();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
type Impact={actor:string;seq:number;born:number;seed:number;grade:number;ground:boolean;point:THREE.Vector3;floor:number};
export class TsunadeStrength{
 private cracks:StrengthBatch;private shards:StrengthBatch;private rings:StrengthBatch;private batches:StrengthBatch[];
 private impacts:Impact[]=Array.from({length:TSUNADE_STRENGTH_LIMITS.impacts},()=>({actor:'',seq:-1,born:0,seed:0,grade:0,ground:false,point:new THREE.Vector3(),floor:0}));
 private seen=new Float64Array(128).fill(-1);private seenTime=new Float64Array(128).fill(-1);private cursor=0;private seenCursor=0;private disposed=false;
 private p=new THREE.Vector3();private a=new THREE.Vector3();private b=new THREE.Vector3();private d=new THREE.Vector3();private q=new THREE.Quaternion();private flat=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
 private readonly stage:MoveStage;private dir=new THREE.Vector3();private ground=new THREE.Vector3();private confirmCursor=0;
 private confirms:Confirm[]=Array.from({length:8},()=>({actor:'',target:'',seq:-1,final:false}));
 constructor(scene:THREE.Scene,private kit:Pick<VfxKit,'budget'>&Partial<VfxKit>){this.stage=MoveStage.for(scene,kit);this.cracks=new StrengthBatch(scene,'fractures',new THREE.BoxGeometry(1,1,1),TSUNADE_STRENGTH_LIMITS.cracks);this.shards=new StrengthBatch(scene,'stone',new THREE.IcosahedronGeometry(1,0),TSUNADE_STRENGTH_LIMITS.shards);this.rings=new StrengthBatch(scene,'chakra',new THREE.TorusGeometry(1,.028,4,32),TSUNADE_STRENGTH_LIMITS.rings);this.batches=[this.cracks,this.shards,this.rings];}
 load(_ids:readonly string[]):Promise<void>{return Promise.resolve();}
 handle(e:CombatEvent,fighters?:ReadonlyMap<string,Fighter>){
  if(this.disposed)return;
  if(e.kind==='eliminated'||e.kind==='respawn'||e.kind==='whiff'||e.kind==='rejected'){this.cancel(e.actorId);for(const c of this.confirms)if(c.actor===e.actorId||(e.kind==='eliminated'||e.kind==='respawn')&&c.target===e.actorId&&!c.final)c.actor='';return;}
  if(!isTsunadeStrength(e.fighter)||e.kind!=='hit'&&e.kind!=='confirm')return;
  for(let i=0;i<this.seen.length;i++)if(this.seen[i]===e.id&&this.seenTime[i]===e.serverTime)return;
  const f=fighters?.get(e.actorId);if(!f?.state.alive)return;const target=e.targetId?fighters?.get(e.targetId):undefined;
  if(e.kind==='confirm'){
   if(e.slot!=='ultimate'||e.branch||!e.targetId)return;
   const i=this.seenCursor++%this.seen.length;this.seen[i]=e.id;this.seenTime[i]=e.serverTime;
   const c=this.confirms[this.confirmCursor++%this.confirms.length];c.actor=e.actorId;c.target=e.targetId;c.seq=e.actionSeq??f.state.actionSeq??-1;c.final=false;
   return;
  }
  if(!e.endpoint&&!target)return;
  const i=this.seenCursor++%this.seen.length;this.seen[i]=e.id;this.seenTime[i]=e.serverTime;
  const floorSource=target&&target.state.grounded!==false?target:f.state.grounded!==false?f:undefined;
  const hit=this.impacts[this.cursor++%this.impacts.length];hit.actor=e.actorId;hit.seq=e.actionSeq??f.state.actionSeq??-1;hit.born=e.serverTime;hit.seed=e.id;hit.floor=(floorSource?.group.position.y??0)+.035;
  const final=e.slot==='ultimate'&&!e.branch&&e.contactIndex===2;hit.grade=final?3:e.slot==='heavy'||e.slot==='special'?2:1;hit.ground=!!floorSource&&(final||e.slot==='heavy'||e.branch==='airHeavy'||e.branch==='airSpecial'||e.slot==='special');
  if(e.endpoint)hit.point.set(e.endpoint.x,e.endpoint.y,e.endpoint.z);else hit.point.copy(target!.group.position).addScaledVector(UP,.9);
  if(final&&involvesLocal(e.actorId,e.targetId))SIGNATURE.screen?.impactFrame?.(.50,hit.point);
  if(final)for(const c of this.confirms)if(c.actor===e.actorId&&c.seq===hit.seq)c.final=true;
  const st=this.stage,t=e.serverTime,point=hit.point,dir=this.dir,floor=hit.floor-.035,grounded=hit.ground,yaw=f.state.yaw??f.group.rotation.y;
  dir.subVectors(point,f.group.position).setY(0);if(dir.lengthSq()<.01)dir.set(Math.sin(yaw),0,Math.cos(yaw));dir.normalize();
  const ground=this.ground.set(point.x,floor,point.z),broken=this.a.set(point.x,floor+.06,point.z);
  if(e.slot==='light'){st.burst(point,CHAKRA,.44,t,{dir,clean:true});return;}
  if(!grounded){st.burst(point,CHAKRA,e.slot==='heavy'?.9:1.5,t,{dir,clean:true});return;}
  if(e.slot==='heavy'){
   const big=e.branch?.85:1;
   st.burst(point,CHAKRA,.8*big,t,{dir,floor,clean:true});st.shatter(broken,UP,CHAKRA,2.2*big,t,.55);st.scar(ground,CHAKRA,1.3*big,t+.18,1.4);
   return;
  }
  if(e.slot==='special'){
   if(e.branch==='airSpecial'){st.burst(point,CHAKRA,2,t,{floor});st.shatter(broken,UP,CHAKRA,5,t,1.1);st.shock(ground,CHAKRA,6,t,.5);st.scar(ground,CHAKRA,2.4,t+.05,2);return;}
   const big=e.branch?.75:1;
   st.burst(this.b.copy(point).addScaledVector(dir,.8),CHAKRA,1.6*big,t,{dir,floor});
   st.erupt(this.b.copy(point).addScaledVector(dir,1),this.d.copy(dir).setY(.1).normalize(),CHAKRA,.3*big,4.2*big,t,.3);
   st.shatter(broken.addScaledVector(dir,1.4),UP,CHAKRA,3.5*big,t,1.1);
   ground.addScaledVector(dir,1.4);
   st.shock(ground,CHAKRA,5.2*big,t,.5);
   st.scar(ground,CHAKRA,2.2*big,t+.12,2.3);
   return;
  }
  if(e.slot!=='ultimate'||e.branch)return;
  if(!final){st.burst(point,CHAKRA,e.contactIndex?1.6:1.2,t,{dir,floor});if(e.contactIndex){st.shatter(broken,UP,CHAKRA,2.6,t,.7);st.shock(ground,CHAKRA,5,t,.5);}return;}
  st.burst(point,CHAKRA,2.3,t,{dir,floor});
  st.shatter(broken,UP,CHAKRA,6.5,t,1.4);
  st.dome(point,CHAKRA,4.2,t,.5);
  st.shock(ground,CHAKRA,10,t,.6);
  for(let i=0;i<3;i++){const ang=i*2.094+e.id;st.erupt(this.b.set(ground.x+Math.cos(ang)*2.6,floor,ground.z+Math.sin(ang)*2.6),UP,CHAKRA,.5,4.5+i*.6,t+.08+i*.07,.5);}
  st.scar(ground,CHAKRA,3.4,t+.15,2.2);
 }
 private cancel(id:string){for(const hit of this.impacts)if(hit.actor===id)hit.actor='';}
 update(time:number,fighters:ReadonlyMap<string,Fighter>){
  if(this.disposed)return;const st=this.stage.open(time);for(const batch of this.batches)batch.begin();const detail=this.kit.budget>=.65;
  for(const f of fighters.values()){
   const s=f.state;if(!isTsunadeStrength(s.fighter)||!s.alive)continue;const age=s.actionTime*s.actionDuration;
   if(s.action==='awaken'){
    const release=.504,charge=clamp(age/release),fade=clamp((.9-age)/.18);const head=f.joints.get('Head');
    if(head&&age<release){head.getWorldPosition(this.p);this.p.y+=.10;this.q.setFromAxisAngle(FORWARD,Math.PI/4);const size=.02+.025*charge;this.cracks.add(this.p,this.q,size,size,.012,MINT,.8);}
    if(age>=release){this.p.copy(f.group.position);this.p.y+=.04;const radius=.45+(age-release)*4;this.rings.add(this.p,this.flat,radius,radius,1,MINT,fade*.85);this.rings.add(this.p,this.flat,radius*.78,radius*.78,1,WHITE,fade*.55);}
    continue;
   }
   if(!MANUAL.has(s.action)||s.whiffedAt!==undefined||s.action==='ultimate'&&age>.6&&s.confirmedAt===undefined)continue;
   const strength=Math.sin(clamp(s.actionTime)*Math.PI);if(strength<=0)continue;
   f.strikePoint(this.p);this.q.setFromAxisAngle(UP,time*2);const r=.16;this.rings.add(this.p,this.q,r,r,r,GLOW,strength*.72);
   const seed=(s.actionSeq??0)*3.9,release=s.action==='heavy'?HEAVY.contacts[0]:s.action==='special'?SPECIAL.contacts[0]:s.action==='ultimate'?ULT.contacts[0]:0;
   st.glow(this.p,.3,CHAKRA.main,.45*strength);st.glow(this.p,.12,CHAKRA.core,.8*strength);st.light(this.p,1.9,CHAKRA,.2*strength);
   if(release>0&&!s.branch&&age<release&&(s.action!=='ultimate'||s.confirmedAt===undefined))st.charge(this.p,CHAKRA,s.action==='special'?.34:.18,clamp(age/release),seed);
  }
  for(const c of this.confirms){
   if(!c.actor)continue;const actor=fighters.get(c.actor),victim=fighters.get(c.target),s=actor?.state;
   if(!actor||!s?.alive||!victim?.state.alive&&!c.final||s.action!=='ultimate'||s.branch||(s.actionSeq??-1)!==c.seq||s.whiffedAt!==undefined){c.actor='';continue;}
   const age=s.actionTime*s.actionDuration;if(age>=ULT.contacts[2]){if(age>=ULT.duration)c.actor='';continue;}
   this.gather(actor,c,age,time);
  }
  for(const hit of this.impacts){
   if(!hit.actor)continue;const s=fighters.get(hit.actor)?.state,age=time-hit.born,life=hit.grade===3?.82:hit.ground?.53:.24;
   if(!s?.alive||!MANUAL.has(s.action)&&s.action!=='idle'||(s.actionSeq??-1)!==hit.seq||s.whiffedAt!==undefined||age>=life){hit.actor='';continue;}if(age<0)continue;const fade=1-age/life;
   this.p.copy(hit.point);this.q.setFromAxisAngle(UP,hit.seed*.2);const radius=.08+age*(2+hit.grade);this.rings.add(this.p,this.q,radius,radius,radius,WHITE,fade*.8);
   if(!hit.ground)continue;
   const reach=hit.grade===3?6:3,extent=reach*clamp(age/.13),count=detail?(hit.grade===3?14:9):6;
   for(let spoke=0;spoke<count;spoke++){
    const angle=spoke*Math.PI*2/count+hit.seed*.123;this.a.set(hit.point.x,hit.floor,hit.point.z);
    for(let part=0;part<3;part++){
     const r=extent*(part+1)/3,angle2=angle+Math.sin(spoke*5+part*3+hit.seed)*.12;this.b.set(hit.point.x+Math.sin(angle2)*r,hit.floor,hit.point.z+Math.cos(angle2)*r);this.p.copy(this.a).add(this.b).multiplyScalar(.5);this.d.subVectors(this.b,this.a);const length=this.d.length();if(length>.001){this.d.normalize();this.q.setFromUnitVectors(UP,this.d);this.cracks.add(this.p,this.q,(.11-part*.025)*fade,length,.015,INK,fade);this.cracks.add(this.p,this.q,(.035-part*.008)*fade,length,.021,GLOW,fade*.8);}this.a.copy(this.b);
    }
   }
   const rockCount=detail?(hit.grade===3?16:8):5;
   for(let rock=0;rock<rockCount;rock++){
    const angle=rock*2.39996+hit.seed*.17,launch=(4+(rock%4)*1.1)*(hit.grade===3?1.4:1);this.p.set(hit.point.x+Math.sin(angle)*(1+age*(2.2+rock%3)),hit.floor+Math.max(0,age*launch-age*age*9),hit.point.z+Math.cos(angle)*(1+age*(2.2+rock%3)));this.q.setFromAxisAngle(FORWARD,angle+age*4);const size=(.13+(rock%3)*.06)*(hit.grade===3?1.6:1)*(.4+.6*fade);this.shards.add(this.p,this.q,size,size*.8,size*1.3,STONE,Math.min(1,fade*3));
   }
   this.p.set(hit.point.x,hit.floor+.015,hit.point.z);this.rings.add(this.p,this.flat,extent,extent,1,PALE,fade*.55);
  }
  for(const batch of this.batches)batch.end();st.close();
 }
 private gather(actor:Fighter,c:Confirm,age:number,time:number){
  const st=this.stage,g=clamp((age-ULT.contacts[0])/(ULT.contacts[2]-ULT.contacts[0])),feet=actor.group.position,seed=c.seq*2.3;
  if(age<ULT.contacts[0])return;
  st.dim(.3+.45*g,c.actor,c.target);
  st.pool(this.p.copy(feet),2.2+2.6*g,SEAL,.3+.7*g,seed);
  for(let i=0;i<3;i++){const r=.5+(1.2+i*.9)*g+.25*i;this.p.copy(feet).setY(feet.y+.05);this.rings.add(this.p,this.flat,r,r,1,i%2?PALE:GLOW,.75-.15*i);}
  const yaw=actor.state.yaw??actor.group.rotation.y,hx=Math.sin(yaw),hz=Math.cos(yaw);
  for(let i=0,n=st.n(9,5);i<n;i++){
   const rise=(time*(1+.2*(i%3))+i*.37)%1,ang=i*2.399963+seed,r=1.7+.5*Math.sin(i*1.7)+.3*g,y=feet.y+.1+rise*(1.6+1.4*g);
   if(Math.cos(ang)*hx+Math.sin(ang)*hz<-.2)continue;
   this.a.set(feet.x+Math.cos(ang)*r,y,feet.z+Math.sin(ang)*r);this.b.copy(this.a).setY(y+.5+.5*g);
   st.streak(this.a,this.b,.06,i%3?CHAKRA.main:SEAL.main,Math.sin(Math.PI*rise)*(.6+.5*g));
  }
  actor.strikePoint(this.d);st.charge(this.d,CHAKRA,.18+.16*g,Math.max(.35,g),seed);
  st.light(this.p.copy(feet).setY(feet.y+.6),4.5,SEAL,.18+.14*g);
  if(g>.75)st.speed(.55*(g-.75)/.25,c.actor,c.target);
 }
 reset(){for(const hit of this.impacts)hit.actor='';for(const c of this.confirms)c.actor='';this.seen.fill(-1);this.seenTime.fill(-1);this.cursor=this.seenCursor=this.confirmCursor=0;for(const batch of this.batches){batch.begin();batch.end();}this.stage.reset();}
 dispose(){if(this.disposed)return;this.reset();this.disposed=true;for(const batch of this.batches)batch.dispose();this.stage.release();}
}
