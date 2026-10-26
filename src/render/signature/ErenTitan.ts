import {SignaturePoolUpload} from './SignaturePoolUpload';
import * as T from 'three';
import type {CombatEvent} from '../../game/types';
import type {Fighter} from '../Fighter';
import type {Flight} from '../CombatEffects';
import type {VfxKit} from '../vfx/VfxKit';
import {bodyCentre} from '../vfx/VfxKit';
import {SIGNATURE,involvesLocal} from './context';
import {EREN_TITAN_MOVES} from '../../game/fighters/eren';
import {ErenScout} from './ErenScout';
import {MoveStage,stageLook} from './MoveStage';
import {CastBook,Strikes,arc,bolt,flare,hash,jag,sheenAhead,type Gather} from './StageCraft';
export const EREN_TITAN_ASSETS:readonly string[]=Object.freeze([]);
export const EREN_TITAN_LIMITS=Object.freeze({lightning:128,steam:96,shards:96,pressure:64,impacts:24});
export const isErenTitan=(id:string|undefined)=>id==='eren';
const UP=new T.Vector3(0,1,0),FORWARD=new T.Vector3(0,0,1),WHITE=new T.Color(0xf2f7df),STEAM=new T.Color(0xc8d1c8),HARDENING=new T.Color(0x80bdad),AMBER=new T.Color(0xffc774),DUST=new T.Color(0xac9c86);
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const TITAN=stageLook(0xf2f7df,0xffc774,0xac9c86,{heart:.5});
const HOT_STEAM=new T.Color(1.25,1.28,1.2);
const HEAVY=EREN_TITAN_MOVES.heavy,SPECIAL=EREN_TITAN_MOVES.special,ULT=EREN_TITAN_MOVES.ultimate;
type Vent={at:T.Vector3;born:number;life:number;reach:number;count:number;seed:number;live:boolean};
class TitanBatch{
 readonly mesh:T.InstancedMesh<T.BufferGeometry,T.ShaderMaterial>;private count=0;private upload:SignaturePoolUpload;private tint:T.InstancedBufferAttribute;private o=new T.Object3D();
 constructor(scene:T.Scene,name:string,readonly capacity:number,kind:number){const g=new T.PlaneGeometry(1,1,1,kind===1?6:1);this.tint=new T.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(T.DynamicDrawUsage);g.setAttribute('titanTint',this.tint);const m=new T.ShaderMaterial({name:`Eren-${name}`,transparent:true,depthWrite:false,toneMapped:false,side:T.DoubleSide,uniforms:{clock:{value:0},kind:{value:kind}},vertexShader:`attribute vec4 titanTint;varying vec4 vTint;varying vec2 vUv;varying float vSeed;uniform float clock;uniform float kind;void main(){vTint=titanTint;vUv=uv;vSeed=instanceMatrix[3].x*11.31+instanceMatrix[3].z*7.19;vec3 p=position;if(kind>.5&&kind<1.5)p.x+=sin(uv.y*8.-clock*4.+vSeed)*.055*uv.y;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(p,1.);}`,fragmentShader:`varying vec4 vTint;varying vec2 vUv;varying float vSeed;uniform float clock;uniform float kind;void main(){vec2 p=vUv-.5;float a;if(kind>.5&&kind<1.5){float r=length(p*vec2(1.4,1.));float n=.88+.12*sin(vUv.y*15.+clock*3.+vSeed+sin(vUv.x*13.+vSeed));a=(1.-smoothstep(.07,.52,r/n))*.68;}else{float ends=pow(max(0.,sin(vUv.y*3.14159)),kind>1.5&&kind<2.5?.15:.65);a=(1.-smoothstep(kind>1.5&&kind<2.5?.28:.02,.5,abs(p.x)))*ends;}a*=vTint.a;if(a<.003)discard;gl_FragColor=vec4(vTint.rgb,a);\n#include <colorspace_fragment>\n}`});m.forceSinglePass=true;this.mesh=new T.InstancedMesh(g,m,capacity);this.mesh.name=`eren-titan-${name}`;this.mesh.count=0;this.mesh.frustumCulled=false;this.mesh.renderOrder=3;this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.upload=new SignaturePoolUpload(this.mesh,this.tint);scene.add(this.mesh);}
 begin(time:number){this.count=0;this.mesh.material.uniforms.clock.value=time;}
 add(p:T.Vector3,q:T.Quaternion,w:number,h:number,color:T.Color,alpha:number){if(this.count>=this.capacity||Math.min(w,h)<=0||alpha<.003)return;this.o.position.copy(p);this.o.quaternion.copy(q);this.o.scale.set(w,h,1);this.o.updateMatrix();this.mesh.setMatrixAt(this.count,this.o.matrix);this.tint.setXYZW(this.count++,color.r,color.g,color.b,clamp(alpha));}
 end(){this.upload.end(this.count);}
 dispose(){this.mesh.removeFromParent();this.mesh.dispose();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
type Impact={actor:string;seq:number;born:number;seed:number;grade:number;form:boolean;point:T.Vector3};
export class ErenTitan{
 private lightning:TitanBatch;private steam:TitanBatch;private shards:TitanBatch;private pressure:TitanBatch;private batches:TitanBatch[];
 private impacts:Impact[]=Array.from({length:24},()=>({actor:'',seq:-1,born:0,seed:0,grade:1,form:false,point:new T.Vector3()}));
 private seen=new Float64Array(128).fill(-1);private times=new Float64Array(128).fill(-1);private eventCursor=0;private impactCursor=0;private disposed=false;
 private a=new T.Vector3();private b=new T.Vector3();private p=new T.Vector3();private centre=new T.Vector3();private direction=new T.Vector3();private q=new T.Quaternion();private face=new T.Quaternion();private roll=new T.Quaternion();
 private readonly stage:MoveStage;private readonly book=new CastBook('eren',ULT.contacts.length);private readonly strikes=new Strikes(10,TITAN);
 private vents:Vent[]=Array.from({length:6},()=>({at:new T.Vector3(),born:0,life:0,reach:1,count:0,seed:0,live:false}));private ventCursor=0;
 private c=new T.Vector3();private m=new T.Vector3();private heading=new T.Vector3();private side=new T.Vector3();
 private readonly scout:ErenScout;
 constructor(scene:T.Scene,private kit:Pick<VfxKit,'budget'>&Partial<VfxKit>){this.stage=MoveStage.for(scene,kit);this.scout=new ErenScout(scene,kit);this.lightning=new TitanBatch(scene,'lightning',128,0);this.steam=new TitanBatch(scene,'steam',96,1);this.shards=new TitanBatch(scene,'hardening',96,3);this.pressure=new TitanBatch(scene,'pressure',64,1);this.batches=[this.lightning,this.steam,this.shards,this.pressure];}
 load(_ids:readonly string[]):Promise<void>{return Promise.resolve();}
 handle(e:CombatEvent,fighters?:ReadonlyMap<string,Fighter>){
  if(this.disposed)return;
  const lifecycle=e.kind==='eliminated'||e.kind==='respawn',titan=!!fighters?.get(e.actorId)?.state.awakened;
  if(lifecycle||!titan)this.scout.handle(e,fighters);
  if(!lifecycle&&!titan)return;
  this.staged(e,fighters);if(lifecycle){this.cancel(e.actorId);return;}if(!isErenTitan(e.fighter))return;
  if(e.kind==='rejected'||e.kind==='whiff'){this.cancel(e.actorId);return;}if(e.kind!=='hit')return;
  for(let i=0;i<128;i++)if(this.seen[i]===e.id&&this.times[i]===e.serverTime)return;
  const at=this.eventCursor++%128;this.seen[at]=e.id;this.times[at]=e.serverTime;
  const actor=fighters?.get(e.actorId),target=e.targetId?fighters?.get(e.targetId):undefined;if(!actor||(!target&&!e.endpoint))return;
  const h=this.impacts[this.impactCursor++%24],final=e.slot==='ultimate'&&!e.branch&&e.contactIndex===3;
  Object.assign(h,{actor:e.actorId,seq:e.actionSeq??actor.state.actionSeq??-1,born:e.serverTime,seed:e.id,grade:final?3:e.slot==='light'?1:2,form:!!actor.state.awakened});
  if(e.endpoint)h.point.set(e.endpoint.x,e.endpoint.y,e.endpoint.z);else if(target)bodyCentre(target,h.point);
  if(final&&involvesLocal(e.actorId,e.targetId))SIGNATURE.screen?.impactFrame?.(.42,h.point);
 }
 private cancel(id:string){for(const h of this.impacts)if(h.actor===id)h.actor='';}
 private staged(e:CombatEvent,fighters?:ReadonlyMap<string,Fighter>){
  const blow=this.book.take(e,fighters);if(!blow)return;
  const st=this.stage,{point,ground,dir,side,floor,t}=blow;
  if(e.slot==='light'){st.burst(point,TITAN,.4,t,{dir,floor,clean:true});this.vent(point,t,.4,.5,st.n(3,2));return;}
  if(e.slot==='heavy'){
   const big=e.branch?.85:1;
   st.burst(point,TITAN,.8*big,t,{dir,floor});this.strikes.add(this.c.copy(ground).addScaledVector(dir,1),6.5*big,.09,TITAN,t,.24);st.shock(this.c.copy(ground).addScaledVector(dir,1.5),TITAN,2.6*big,t,.4);this.vent(this.c.copy(point).addScaledVector(dir,1.1),t,.7,.9*big,st.n(5,3));
   return;
  }
  if(e.slot==='special'){
   if(e.branch==='airSpecial'){st.burst(point,TITAN,2.1,t,{floor});this.strikes.add(ground,7,.12,TITAN,t);st.shock(ground,TITAN,3.6,t,.45);st.scar(ground,TITAN,2.2,t+.05,1.8);this.vent(point,t,1,1.8,st.n(9,4));return;}
   const big=e.branch?.75:1;
   st.burst(point,TITAN,1.6*big,t,{dir,floor});st.shatter(this.c.copy(point).addScaledVector(dir,.5),dir,TITAN,2.4*big,t,.5);
   for(let i=0;i<3;i++)this.strikes.add(this.c.copy(ground).addScaledVector(side,(i-1)*1).addScaledVector(dir,i===1?.9:1.5),7*big,.11,TITAN,t+i*.07,.28,i===0);
   st.shock(ground,TITAN,4.6*big,t,.45);st.scar(this.c.copy(ground).addScaledVector(dir,.8),TITAN,2*big,t+.05,2);this.vent(this.c.copy(point).addScaledVector(dir,1.2),t,1.2,1.6*big,st.n(9,5));
   return;
  }
  if(e.slot!=='ultimate'||e.branch)return;
  if(!blow.final){st.burst(point,TITAN,1.2+.15*blow.index,t,{dir,floor});this.vent(point,t,.7,1.1,st.n(5,3));if(blow.index){this.strikes.add(ground,7,.11,TITAN,t);st.shock(ground,TITAN,3.8+.5*blow.index,t,.45);}return;}
  st.erupt(ground,UP,TITAN,1.1,13,t,.6);
  for(let i=0;i<4;i++){const ang=i*1.571+.4;this.strikes.add(this.c.set(ground.x+Math.cos(ang)*2.8,floor,ground.z+Math.sin(ang)*2.8),8.5,.13,TITAN,t+.04+i*.05,.3,i===0);}
  st.shatter(point,dir,TITAN,5.5,t,.8);
  st.burst(point,TITAN,2.4,t,{dir,floor});
  st.shock(ground,TITAN,9,t,.6);
  st.scar(ground,TITAN,3.1,t+.2,2.1);
  this.vent(point,t,1.7,3.6,st.n(14,6));
 }
 private vent(at:T.Vector3,born:number,life:number,reach:number,count:number){const v=this.vents[this.ventCursor++%this.vents.length];v.at.copy(at);v.born=born;v.life=life;v.reach=reach;v.count=count;v.seed=Math.abs(at.x*5.9+at.z*11.7+born*3.3)%43;v.live=true;}
 private cloud(at:T.Vector3,width:number,height:number,lean:number,alpha:number){this.q.copy(this.face);this.roll.setFromAxisAngle(FORWARD,lean);this.q.multiply(this.roll);this.steam.add(at,this.q,width,height,HOT_STEAM,alpha);}
 private line(batch:TitanBatch,a:T.Vector3,b:T.Vector3,w:number,color:T.Color,alpha:number){this.direction.subVectors(b,a);const n=this.direction.length();if(n<.001)return;this.q.setFromUnitVectors(UP,this.direction.multiplyScalar(1/n));this.centre.copy(a).add(b).multiplyScalar(.5);batch.add(this.centre,this.q,w,n,color,alpha);this.roll.setFromAxisAngle(UP,Math.PI/2);this.q.multiply(this.roll);batch.add(this.centre,this.q,w*.6,n,color,alpha*.6);}
 private entry(f:Fighter,u:number,detail:boolean){
  const alpha=Math.sin(clamp((u-.28)/.72)*Math.PI),height=u<.66?1.8:3.2;
  if(u>.28&&u<.87){for(let arc=0;arc<(detail?5:3);arc++){
   const theta=arc*2.39996+.3,reach=.55+(arc%3)*.21,startY=u<.66?1.30:1.78,endY=(arc===2||arc===4?.06:height*(.76+(arc%2)*.19));
   this.a.copy(f.group.position);this.a.y+=startY;
   for(let i=1;i<=5;i++){const k=i/5,jag=Math.sin(i*6.7+arc*2.1+Math.floor(u*23)*1.7)*.16*Math.sin(k*Math.PI);
    this.b.copy(f.group.position);this.b.x+=Math.cos(theta)*reach*k+Math.sin(theta)*jag;this.b.z+=Math.sin(theta)*reach*k-Math.cos(theta)*jag;this.b.y+=startY+(endY-startY)*k+Math.sin(i*3.2+arc)*.10*Math.sin(k*Math.PI);
    this.line(this.lightning,this.a,this.b,(.045-i*.005)*(arc===0?1.2:1),arc%2?AMBER:WHITE,alpha*(.78+(arc%2)*.18));
    if(detail&&i===3&&arc<3){this.p.copy(this.b);this.p.x+=Math.cos(theta+1.15)*.22;this.p.z+=Math.sin(theta+1.15)*.22;this.p.y+=arc%2?.24:-.19;this.line(this.lightning,this.b,this.p,.014,WHITE,alpha*.65);}
    this.a.copy(this.b);
   }
  }}
  if(u>.54){const age=(u-.54)/.46,fade=Math.sin(age*Math.PI);this.face.copy(f.group.quaternion);
   for(let i=0;i<(detail?18:10);i++){const theta=i*2.39996,r=.20+age*(.45+(i%3)*.16);this.p.copy(f.group.position);this.p.x+=Math.cos(theta)*r;this.p.z+=Math.sin(theta)*r;this.p.y+=.12+(i%6)*.34+age*.6;this.q.copy(this.face);this.roll.setFromAxisAngle(FORWARD,Math.sin(i*3.7)*.4);this.q.multiply(this.roll);this.steam.add(this.p,this.q,.23+age*.3,.54+age*.65,STEAM,fade*.29);}
  }
 }
 update(time:number,fighters:ReadonlyMap<string,Fighter>,_flights:ReadonlyMap<string,Flight>){
  if(this.disposed)return;for(const b of this.batches)b.begin(time);const detail=this.kit.budget>=.65,st=this.stage.open(time);
  for(const f of fighters.values()){const s=f.state;if(!isErenTitan(s.fighter)||!s.alive)continue;const u=clamp(s.actionTime);
   if(s.action==='awaken'){this.entry(f,u,detail);continue;}
   if(s.awakened&&s.whiffedAt===undefined&&['light','heavy','special','ultimate'].includes(s.action))this.pose(f,time,s.actionTime*s.actionDuration);
   if(!s.awakened||s.whiffedAt!==undefined||!['light','heavy','special','ultimate'].includes(s.action))continue;
   const flash=Math.sin(u*Math.PI);if(flash<.1)continue;const body=f.shownBody??f;
   for(const n of['LeftHand','RightHand']as const){const hand=body.joints?.get(n);if(!hand)continue;hand.getWorldPosition(this.a);this.face.copy(f.group.quaternion);
    for(let i=0;i<3;i++){this.p.copy(this.a);this.p.y+=(i-1)*.06;this.p.x+=Math.sin(i*2.4)*.07;this.q.copy(this.face);this.roll.setFromAxisAngle(FORWARD,(i-1)*.6);this.q.multiply(this.roll);this.shards.add(this.p,this.q,.035,.13+(i%2)*.07,HARDENING,flash*.55);}
   }
  }
  for(const h of this.impacts){if(!h.actor)continue;const f=fighters.get(h.actor),s=f?.state,age=time-h.born,life=h.grade===3?.58:.31;
   if(!s?.alive||s.whiffedAt!==undefined||(s.actionSeq??-1)!==h.seq||!['light','heavy','special','ultimate'].includes(s.action)||age>=life){h.actor='';continue;}if(age<0)continue;
   const fade=1-age/life;this.face.copy(f!.group.quaternion);const power=h.form?1.35:1;
   for(let i=0;i<(detail?6:3)*h.grade;i++){const theta=i*2.39996+h.seed;this.p.copy(h.point);this.p.x+=Math.sin(theta)*age*(1.7+h.grade)*power;this.p.z+=Math.cos(theta)*age*(1.7+h.grade)*power;this.p.y+=age*(i%4-1)*1.9-age*age*3;this.q.copy(this.face);this.roll.setFromAxisAngle(FORWARD,theta);this.q.multiply(this.roll);this.shards.add(this.p,this.q,(.025+(i%3)*.014)*fade,(.13+(i%4)*.04)*fade,h.form?HARDENING:WHITE,fade*.82);}
   if(h.grade>=2){for(let i=0;i<(detail?8:4);i++){const theta=i*2.39996+h.seed*.2;this.p.copy(h.point);this.p.x+=Math.cos(theta)*age*3;this.p.z+=Math.sin(theta)*age*3;this.p.y=Math.max(.05,h.point.y*.2)+age*.4;this.q.copy(this.face);this.roll.setFromAxisAngle(FORWARD,theta*.2);this.q.multiply(this.roll);this.pressure.add(this.p,this.q,(.19+age*.6)*power,(.4+age*.6)*power,DUST,fade*.30);}}
   if(h.grade===3){for(let i=0;i<7;i++){const theta=i*.8976+h.seed;this.a.copy(h.point);this.a.y=.045;this.b.copy(this.a);this.b.x+=Math.cos(theta)*(.22+age*1.8);this.b.z+=Math.sin(theta)*(.22+age*1.8);this.line(this.lightning,this.a,this.b,.018*fade,h.form?HARDENING:AMBER,fade*.64);}}
  }
  this.book.each(fighters,ULT.duration,this.gather);
  for(const v of this.vents){
   if(!v.live)continue;const age=time-v.born;if(age>=v.life){v.live=false;continue;}if(age<0)continue;
   const u=age/v.life,out=1-(1-Math.min(1,age/.14))**2,fade=(1-u)*(1-u*.3);this.face.identity();
   for(let i=0;i<v.count;i++){const ang=i*2.399963+v.seed,r=v.reach*(.3+.7*hash(v.seed+i*1.7))*out;this.p.set(v.at.x+Math.cos(ang)*r,v.at.y+(hash(v.seed+i*2.9)-.3)*v.reach*.6+u*v.reach*.9,v.at.z+Math.sin(ang)*r);this.q.setFromAxisAngle(UP,ang);this.steam.add(this.p,this.q,(.5+.5*hash(i+v.seed))*v.reach*(.6+.6*u),(.8+.6*hash(i*3+v.seed))*v.reach*(.6+.6*u),HOT_STEAM,.3*fade);}
  }
  this.strikes.draw(st,time);
  for(const b of this.batches)b.end();st.close();
  this.scout.update(time,fighters,_flights);
 }
 private crackle(at:T.Vector3,reach:number,count:number,k:number,seed:number){for(let i=0;i<count;i++){const az=seed*1.7+i*2.399963;this.b.set(at.x+Math.cos(az)*reach,at.y+Math.sin(seed+i*1.3)*reach*.8,at.z+Math.sin(az)*reach);jag(this.stage,at,this.b,.035,TITAN.main,k,seed+i*7,.28,3,.5);}}
 private venting(f:Fighter,k:number,time:number,seed:number,count:number){
  this.face.copy(f.group.quaternion);const feet=f.group.position;
  for(let i=0;i<count;i++){const rise=((hash(seed+i*1.9)+time*.6)%1),ang=i*2.399963+seed;this.p.set(feet.x+Math.cos(ang)*.75,feet.y+1.9+rise*1.9,feet.z+Math.sin(ang)*.75);this.cloud(this.p,.5+.5*rise,.9+.7*rise,Math.sin(i*3.7)*.4,.24*k*Math.sin(Math.PI*rise));}
 }
 private pose(f:Fighter,time:number,elapsed:number){
  const st=this.stage,s=f.state,base=(s.actionSeq??0)*4.7,seed=base+Math.floor(time*20)*13,yaw=s.yaw??f.group.rotation.y,heading=this.heading.set(Math.sin(yaw),0,Math.cos(yaw)),feet=f.group.position;
  const at=typeof f.strikePoint==='function'?f.strikePoint(this.c):f.handR?this.c.copy(f.handR):this.c.copy(feet).setY(feet.y+1.2);
  if(s.action==='light'){const k=Math.sin(clamp(s.actionTime)*Math.PI);this.crackle(at,.3,3,k,seed);st.glow(at,.22,TITAN.main,.5*k);st.light(at,1.8,TITAN,.2*k);return;}
  if(s.action==='heavy'||s.action==='ultimate'&&!s.branch&&s.confirmedAt===undefined&&elapsed<ULT.contacts[0]+.12){
   const contact=s.action==='ultimate'?ULT.contacts[0]:s.branch?s.actionDuration*.5:HEAVY.contacts[0];
   if(elapsed<contact){const k=clamp(elapsed/contact);st.charge(at,TITAN,.24,k,base);this.crackle(at,.3+.3*k,4,k,seed);this.venting(f,k,time,base,st.n(4,2));}
   else if(s.action==='heavy'&&elapsed<contact+.2){
    const k=1-(elapsed-contact)/.2;this.a.copy(feet).addScaledVector(heading,.3);this.a.y+=1;
    arc(st,this.a,heading,UP,1.35,-.8,1.5,.13,TITAN.main,.9*k,.5);st.light(this.b.copy(this.a).addScaledVector(heading,1.1),3.6,TITAN,.4*k);
   }
   return;
  }
  if(s.action==='special'){
   const release=s.branch?s.actionDuration*.5:SPECIAL.contacts[0];
   if(elapsed<release){
    const k=clamp(elapsed/release);st.glow(at,.2+.24*k,TITAN.main,.4+.3*k);st.glow(at,.08+.1*k,TITAN.core,.6+.4*k);st.light(at,2+1.2*k,TITAN,.24*k);this.crackle(at,.35+.35*k,4,k,seed);
    if(!s.branch){flare(st,feet,1.9+.2*k,1.3+2*k,TITAN,.45+.5*k,base,6,.06,.14,false);this.venting(f,k,time,base,st.n(5,3));sheenAhead(st,feet,heading,2+1.4*k,TITAN,.5*k);st.light(this.a.copy(feet).addScaledVector(heading,3.6).setY(feet.y+.6),2.5+.6*k,TITAN,.4*k);}
   }else if(elapsed<release+.22){const k=1-(elapsed-release)/.22;this.crackle(at,.9,5,k,seed);st.glow(at,.4,TITAN.core,.7*k);st.light(at,3.4,TITAN,.4*k);}
  }
 }
 private readonly gather=(actor:Fighter,g:Gather,elapsed:number,victim:Fighter|undefined)=>{
  const final=ULT.contacts[ULT.contacts.length-1];if(elapsed>=final+.1)return;
  const st=this.stage,time=st.time,opener=ULT.contacts[0],build=clamp((elapsed-opener)/(final-opener)),rise=clamp((elapsed-opener)/.3),seed=g.seq*3.1,feet=this.m.copy(actor.group.position).setY(g.floor);
  st.dim(.3+.45*build,g.actor,g.target);
  flare(st,feet,1.5+.4*build,(1.5+2.6*build)*rise,TITAN,.5+.5*build,seed,8,.08);
  this.venting(actor,.6+.4*build,time,seed,st.n(7,3));
  const centre=this.c.copy(actor.group.position);if(victim)centre.lerp(victim.group.position,.5);centre.y=g.floor;
  this.heading.subVectors(centre,feet).setY(0);if(this.heading.lengthSq()<.01)this.heading.set(Math.sin(actor.state.yaw??0),0,Math.cos(actor.state.yaw??0));this.heading.normalize();
  sheenAhead(st,feet,this.heading,2.4+2*build,TITAN,.45+.35*build,g.floor);st.light(this.a.copy(feet).addScaledVector(this.heading,3.6).setY(g.floor+1),2.6+.6*build,TITAN,.4+.3*build);
  const beat=(elapsed-opener)*(2.2+1.6*build),index=Math.floor(beat),u=beat-index;
  if(u<.5){const ang=hash(index*3.7+seed)*Math.PI*2,r=2.4+1.6*hash(index*1.9+seed);this.a.set(centre.x+Math.cos(ang)*r,g.floor,centre.z+Math.sin(ang)*r);bolt(st,this.a,8,.1,TITAN,(1-u/.5)*(.6+.4*build),seed+index*31+Math.floor(u*10)*7);}
  if(build>.8)st.speed(.5*(build-.8)/.2,g.actor,g.target);
 };
 reset(){this.scout.reset();for(const h of this.impacts)h.actor='';this.seen.fill(-1);this.times.fill(-1);this.eventCursor=this.impactCursor=0;for(const b of this.batches){b.begin(0);b.end();}for(const v of this.vents)v.live=false;this.book.reset();this.strikes.reset();this.stage.reset();}
 dispose(){if(this.disposed)return;this.reset();this.disposed=true;this.scout.dispose();for(const b of this.batches)b.dispose();this.stage.release();}
}
