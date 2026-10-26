import * as T from 'three';
import type {CombatEvent} from '../../game/types';
import type {Fighter} from '../Fighter';
import type {Flight} from '../CombatEffects';
import type {VfxKit} from '../vfx/VfxKit';
import {bodyCentre} from '../vfx/VfxKit';
import {MIKASA_MOVES,MIKASA_SWORD_SOCKETS} from '../../game/fighters/mikasa';
import {SIGNATURE,involvesLocal} from './context';
import {MoveStage,STAGE,stageLook,type StageLook} from './MoveStage';
import {CastBook,Cuts,arc,hash,sheenAhead,type Gather} from './StageCraft';
export const MIKASA_ODM_ASSETS:readonly string[]=Object.freeze([]);
export const MIKASA_ODM_LIMITS=Object.freeze({steel:128,gas:96,cables:96,sparks:128,impacts:24,tethers:8});
export const isMikasaODM=(id:string|undefined)=>id==='mikasa';
const UP=new T.Vector3(0,1,0),FORWARD=new T.Vector3(0,0,1),WHITE=new T.Color(0xe8f6ff),STEEL=new T.Color(0x8babbc),WIRE=new T.Color(0x4a5861),GAS=new T.Color(0xcbd8df),GOLD=new T.Color(0xffdfa6);
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const BLADE=stageLook(0xffffff,0xdcebff,0x8babbc),SPEAR:StageLook={...STAGE.fire,heart:.5};
const HOT_GAS=new T.Color(1.2,1.26,1.3);
const HEAVY=MIKASA_MOVES.heavy,SPECIAL=MIKASA_MOVES.special,ULT=MIKASA_MOVES.ultimate;
type Haze={at:T.Vector3;born:number;life:number;reach:number;count:number;seed:number;live:boolean};
class ODMBatch{
 readonly mesh:T.InstancedMesh<T.BufferGeometry,T.ShaderMaterial>;private count=0;private tint:T.InstancedBufferAttribute;private o=new T.Object3D();
 constructor(scene:T.Scene,name:string,readonly capacity:number,kind:number){const g=new T.PlaneGeometry(1,1,1,kind===1?6:1);this.tint=new T.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(T.DynamicDrawUsage);g.setAttribute('odmTint',this.tint);const m=new T.ShaderMaterial({name:`Mikasa-${name}`,transparent:true,depthWrite:false,toneMapped:false,side:T.DoubleSide,uniforms:{clock:{value:0},kind:{value:kind}},vertexShader:`attribute vec4 odmTint;varying vec4 vTint;varying vec2 vUv;varying float vSeed;uniform float clock;uniform float kind;void main(){vTint=odmTint;vUv=uv;vSeed=instanceMatrix[3].x*11.31+instanceMatrix[3].z*7.19;vec3 p=position;if(kind>.5&&kind<1.5)p.x+=sin(uv.y*8.-clock*4.+vSeed)*.055*uv.y;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(p,1.);}`,fragmentShader:`varying vec4 vTint;varying vec2 vUv;varying float vSeed;uniform float clock;uniform float kind;void main(){vec2 p=vUv-.5;float a;if(kind>.5&&kind<1.5){float r=length(p*vec2(1.4,1.));float n=.88+.12*sin(vUv.y*15.+clock*3.+vSeed+sin(vUv.x*13.+vSeed));a=(1.-smoothstep(.07,.52,r/n))*.68;}else{float ends=pow(max(0.,sin(vUv.y*3.14159)),kind>1.5&&kind<2.5?.15:.65);a=(1.-smoothstep(kind>1.5&&kind<2.5?.28:.02,.5,abs(p.x)))*ends;}a*=vTint.a;if(a<.003)discard;gl_FragColor=vec4(vTint.rgb,a);\n#include <colorspace_fragment>\n}`});m.forceSinglePass=true;this.mesh=new T.InstancedMesh(g,m,capacity);this.mesh.name=`mikasa-odm-${name}`;this.mesh.count=0;this.mesh.frustumCulled=false;this.mesh.renderOrder=3;this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(this.mesh);}
 begin(time:number){this.count=0;this.mesh.material.uniforms.clock.value=time;}
 add(p:T.Vector3,q:T.Quaternion,w:number,h:number,color:T.Color,alpha:number){if(this.count>=this.capacity||Math.min(w,h)<=0||alpha<.003)return;this.o.position.copy(p);this.o.quaternion.copy(q);this.o.scale.set(w,h,1);this.o.updateMatrix();this.mesh.setMatrixAt(this.count,this.o.matrix);this.tint.setXYZW(this.count++,color.r,color.g,color.b,clamp(alpha));}
 end(){this.mesh.count=this.count;this.mesh.instanceMatrix.needsUpdate=true;this.tint.needsUpdate=true;}
 dispose(){this.mesh.removeFromParent();this.mesh.dispose();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
type Impact={actor:string;seq:number;born:number;seed:number;grade:number;point:T.Vector3};
type Tether={actor:string;target:string;seq:number;lastContact:number};
export class MikasaODM{
 private steel:ODMBatch;private gas:ODMBatch;private cables:ODMBatch;private sparks:ODMBatch;private batches:ODMBatch[];
 private impacts:Impact[]=Array.from({length:24},()=>({actor:'',seq:-1,born:0,seed:0,grade:1,point:new T.Vector3()}));
 private tethers:Tether[]=Array.from({length:8},()=>({actor:'',target:'',seq:-1,lastContact:-1}));
 private seen=new Float64Array(128).fill(-1);private times=new Float64Array(128).fill(-1);private eventCursor=0;private impactCursor=0;private tetherCursor=0;private disposed=false;
 private a=new T.Vector3();private b=new T.Vector3();private p=new T.Vector3();private center=new T.Vector3();private direction=new T.Vector3();private side=new T.Vector3();private end=new T.Vector3();private q=new T.Quaternion();private face=new T.Quaternion();private roll=new T.Quaternion();
 private readonly stage:MoveStage;private readonly book=new CastBook('mikasa',ULT.contacts.length);private readonly cuts=new Cuts(16,BLADE);
 private hazes:Haze[]=Array.from({length:6},()=>({at:new T.Vector3(),born:0,life:0,reach:1,count:0,seed:0,live:false}));private hazeCursor=0;
 private c=new T.Vector3();private m=new T.Vector3();private heading=new T.Vector3();private axis=new T.Vector3();private u=new T.Vector3();private v=new T.Vector3();private lat=new T.Vector3();
 constructor(scene:T.Scene,private kit:Pick<VfxKit,'budget'>&Partial<VfxKit>){this.stage=MoveStage.for(scene,kit);this.steel=new ODMBatch(scene,'steel',128,0);this.gas=new ODMBatch(scene,'gas',96,1);this.cables=new ODMBatch(scene,'cables',96,2);this.sparks=new ODMBatch(scene,'sparks',128,3);this.batches=[this.steel,this.gas,this.cables,this.sparks];}
 load(_ids:readonly string[]):Promise<void>{return Promise.resolve();}
 handle(e:CombatEvent,fighters?:ReadonlyMap<string,Fighter>){if(this.disposed)return;this.staged(e,fighters);if(e.kind==='eliminated'||e.kind==='respawn'){this.cancel(e.actorId,true);return;}if(!isMikasaODM(e.fighter))return;if(e.kind==='rejected'||e.kind==='whiff'){this.cancel(e.actorId);return;}if(e.kind!=='confirm'&&e.kind!=='hit')return;for(let i=0;i<128;i++)if(this.seen[i]===e.id&&this.times[i]===e.serverTime)return;const at=this.eventCursor++%128;this.seen[at]=e.id;this.times[at]=e.serverTime;const actor=fighters?.get(e.actorId),seq=e.actionSeq??actor?.state.actionSeq??-1,target=e.targetId?fighters?.get(e.targetId):undefined;
  if(e.kind==='confirm'){if(e.slot==='ultimate'&&!e.branch&&e.targetId)Object.assign(this.tethers[this.tetherCursor++%8],{actor:e.actorId,target:e.targetId,seq,lastContact:0});return;}if(!target&&!e.endpoint)return;
  const final=e.slot==='ultimate'&&!e.branch&&e.contactIndex===4,h=this.impacts[this.impactCursor++%24];Object.assign(h,{actor:e.actorId,seq,born:e.serverTime,seed:e.id,grade:final?3:e.slot==='light'?1:2});if(e.endpoint)h.point.set(e.endpoint.x,e.endpoint.y,e.endpoint.z);else if(target)bodyCentre(target,h.point);
  for(const t of this.tethers)if(t.actor===e.actorId&&t.seq===seq)t.lastContact=e.contactIndex??0;if(final&&involvesLocal(e.actorId,e.targetId))SIGNATURE.screen?.impactFrame?.(.40,h.point);
 }
 private staged(e:CombatEvent,fighters?:ReadonlyMap<string,Fighter>){
  const blow=this.book.take(e,fighters);if(!blow)return;
  const st=this.stage,{point,ground,dir,side,floor,t}=blow,tilt=e.id%2?1:-1;
  if(e.slot==='light'){st.burst(point,BLADE,.36,t,{dir,floor,clean:true});this.slash(point,side,dir,.5*tilt,.85,.06,t,.2);return;}
  if(e.slot==='heavy'){
   const big=e.branch?.85:1;
   st.burst(point,BLADE,.75*big,t,{dir,floor});this.slash(point,side,dir,.75,1.8*big,.12,t,.34);this.slash(point,side,dir,-.75,1.8*big,.12,t+.03,.34);this.haze(this.c.copy(point).addScaledVector(dir,1.2),t,.8,1.1*big,st.n(5,3));
   return;
  }
  if(e.slot==='special'){
   if(e.branch==='airSpecial'){st.burst(point,BLADE,2,t,{floor});st.shock(ground,BLADE,3.6,t,.45);this.haze(point,t,1,1.8,st.n(8,4));for(let i=0;i<3;i++)this.slash(point,side,dir,(i-1)*1.05,2,.13,t+i*.05,.34);return;}
   const big=e.branch?.75:1;
   const past=this.m.copy(point).addScaledVector(dir,.7);
   st.burst(this.c.copy(point).addScaledVector(dir,.4),BLADE,1.6*big,t,{dir,floor});
   for(let i=-1;i<=1;i+=2){this.axis.copy(dir);this.cuts.add(this.c.copy(point).addScaledVector(dir,3.2*big).addScaledVector(side,i*.3).setY(point.y+i*.2),this.axis,undefined,2.8*big,.1,BLADE,t+.02,.8);}
   this.slash(past,side,dir,.7,2.1*big,.15,t,.4);this.slash(past,side,dir,-.7,2.1*big,.15,t+.04,.4);this.slash(past,side,dir,.15,1.7*big,.11,t+.1,.34);this.slash(past,side,dir,-1.2,1.5*big,.1,t+.15,.34);
   st.shock(this.c.copy(ground).addScaledVector(dir,2.2),BLADE,3.2*big,t,.45);st.scar(this.c.copy(ground).addScaledVector(dir,2.6),BLADE,2.3*big,t+.05,2.4);this.haze(this.c.copy(point).addScaledVector(dir,1.6),t,1.4,1.9*big,st.n(10,5));
   return;
  }
  if(e.slot!=='ultimate'||e.branch)return;
  if(!blow.final){
   const n=blow.index;st.burst(point,BLADE,1.1+.15*n,t,{dir,floor});this.slash(point,side,dir,(n%2?.7:-.7),2.2+.3*n,.14,t,.34);if(n>=2)st.shock(ground,BLADE,3.6+.5*n,t,.45);this.haze(point,t,.8,1.2,st.n(5,3));
   return;
  }
  this.axis.copy(dir).setY(.1).normalize();
  st.erupt(this.c.copy(point).addScaledVector(dir,-.4),this.axis,SPEAR,.95,11,t,.55);
  st.burst(point,SPEAR,2.6,t,{dir,floor});
  st.shatter(point,dir,SPEAR,5.5,t,.75);
  this.cuts.add(point,this.axis.copy(side).multiplyScalar(.74).addScaledVector(UP,.67).normalize(),undefined,4.2,.22,BLADE,t,.5);this.cuts.add(point,this.axis.copy(side).multiplyScalar(.74).addScaledVector(UP,-.67).normalize(),undefined,4.2,.22,BLADE,t+.03,.5);
  st.shock(ground,SPEAR,9,t,.6);
  st.scar(ground,SPEAR,3,t+.2,2.1);
  st.scar(this.c.copy(ground).addScaledVector(dir,3.4),SPEAR,1.8,t+.25,1.7);
 }
 private slash(point:T.Vector3,side:T.Vector3,dir:T.Vector3,lean:number,size:number,width:number,at:number,life:number){this.cuts.add(point,this.axis.copy(side).multiplyScalar(Math.cos(lean)).addScaledVector(UP,Math.sin(lean)).normalize(),this.c.copy(dir).multiplyScalar(-size*.2),size,width,BLADE,at,life);}
 private haze(at:T.Vector3,born:number,life:number,reach:number,count:number){const h=this.hazes[this.hazeCursor++%this.hazes.length];h.at.copy(at);h.born=born;h.life=life;h.reach=reach;h.count=count;h.seed=Math.abs(at.x*6.7+at.z*12.3+born*2.7)%41;h.live=true;}
 private cancel(id:string,targetToo=false){for(const h of this.impacts)if(h.actor===id)h.actor='';for(const t of this.tethers)if(t.actor===id||targetToo&&t.target===id)t.actor='';}
 private line(batch:ODMBatch,a:T.Vector3,b:T.Vector3,width:number,color:T.Color,alpha:number){this.direction.subVectors(b,a);const n=this.direction.length();if(n<.001)return;this.q.setFromUnitVectors(UP,this.direction.multiplyScalar(1/n));this.center.copy(a).add(b).multiplyScalar(.5);batch.add(this.center,this.q,width,n,color,alpha);this.roll.setFromAxisAngle(UP,Math.PI/2);this.q.multiply(this.roll);batch.add(this.center,this.q,width*.72,n,color,alpha*.65);}
 private hip(f:Fighter,sign:number,out:T.Vector3){const body=f.shownBody??f,joint=body.joints?.get('Hips');if(joint)joint.getWorldPosition(out);else{out.copy(f.group.position);out.y+=.85;}this.side.set(sign*.25,-.10,-.06).applyQuaternion(f.group.quaternion);return out.add(this.side);}
 private blades(f:Fighter,alpha:number){const body=f.shownBody??f;for(const n of['LeftHand','RightHand']as const){const joint=body.joints?.get(n),socket=MIKASA_SWORD_SOCKETS[n];if(!joint)continue;this.a.fromArray(socket.heel).applyMatrix4(joint.matrixWorld);this.b.fromArray(socket.tip).applyMatrix4(joint.matrixWorld);this.line(this.steel,this.a,this.b,.035,WHITE,alpha);}}
 private boost(f:Fighter,u:number,alpha:number,detail:boolean){this.face.copy(f.group.quaternion);this.direction.set(0,0,-1).applyQuaternion(this.face);const count=detail?5:3;for(const sign of[-1,1]){this.hip(f,sign,this.a);for(let i=0;i<count;i++){const k=(i/count+u*1.4)%1;this.p.copy(this.a).addScaledVector(this.direction,.05+k*.72);this.p.y-=k*.17;this.side.set(sign*(.025+Math.sin(i*2.3)*.03),Math.sin(i*1.2)*.04,0).applyQuaternion(this.face);this.p.add(this.side);this.q.copy(this.face);this.roll.setFromAxisAngle(FORWARD,sign*(.35+k*.22));this.q.multiply(this.roll);this.gas.add(this.p,this.q,.10+k*.20,.22+k*.44,GAS,alpha*(1-k)*.58);}}}
 update(time:number,fighters:ReadonlyMap<string,Fighter>,_flights:ReadonlyMap<string,Flight>){if(this.disposed)return;for(const b of this.batches)b.begin(time);const detail=this.kit.budget>=.65,st=this.stage.open(time);
  for(const f of fighters.values()){const s=f.state;if(!isMikasaODM(s.fighter)||!s.alive)continue;const u=clamp(s.actionTime);if(s.action==='awaken'){const flash=Math.sin(clamp((u-.32)/.48)*Math.PI);this.blades(f,flash*.9);if(u>.60&&u<.90)this.boost(f,u,Math.sin((u-.60)/.30*Math.PI),detail);continue;}if(s.whiffedAt!==undefined)continue;if(['light','heavy','special','ultimate'].includes(s.action)){this.pose(f,time,s.actionTime*s.actionDuration);this.blades(f,Math.sin(u*Math.PI)*.75);if((s.action==='special'||s.action==='ultimate')&&u>.12&&u<.84)this.boost(f,u,Math.sin(u*Math.PI),detail);}}
  for(const t of this.tethers){if(!t.actor)continue;const f=fighters.get(t.actor),target=fighters.get(t.target),s=f?.state;if(!f||!s?.alive||!target?.state.alive||s.action!=='ultimate'||s.branch||s.whiffedAt!==undefined||(s.actionSeq??-1)!==t.seq){t.actor='';continue;}const elapsed=s.actionTime*s.actionDuration;if(elapsed<.64||elapsed>3.14)continue;bodyCentre(target,this.end);this.end.y+=.12;const alpha=Math.min(clamp((elapsed-.64)/.16),clamp((3.14-elapsed)/.18))*.80;
   for(const sign of[-1,1]){this.hip(f,sign,this.a);this.face.copy(f.group.quaternion);this.side.set(sign*.24,0,0).applyQuaternion(this.face);this.end.add(this.side);this.b.copy(this.a);for(let i=1;i<=4;i++){const k=i/4;this.p.copy(this.a).lerp(this.end,k);this.p.y-=Math.sin(k*Math.PI)*(.075+.035*Math.sin(elapsed*7));this.line(this.cables,this.b,this.p,.012,WIRE,alpha);this.b.copy(this.p);}this.end.sub(this.side);}}
  for(const h of this.impacts){if(!h.actor)continue;const f=fighters.get(h.actor),s=f?.state,age=time-h.born,life=h.grade===3?.45:.28;if(!s?.alive||s.whiffedAt!==undefined||(s.actionSeq??-1)!==h.seq||!['light','heavy','special','ultimate'].includes(s.action)||age>=life){h.actor='';continue;}if(age<0)continue;const fade=1-age/life;this.face.copy(f!.group.quaternion);
   if(h.grade===3){for(const sign of[-1,1]){this.q.copy(this.face);this.roll.setFromAxisAngle(FORWARD,sign*.72);this.q.multiply(this.roll);this.steel.add(h.point,this.q,.095*fade,1.65+age*1.7,WHITE,fade*.92);}}
   for(let i=0;i<(detail?6:3)*h.grade;i++){const theta=i*2.39996+h.seed;this.p.copy(h.point);this.p.x+=Math.sin(theta)*age*(2+h.grade);this.p.z+=Math.cos(theta)*age*(2+h.grade);this.p.y+=age*(i%4-1)*1.9-age*age*2;this.q.copy(this.face);this.roll.setFromAxisAngle(FORWARD,theta);this.q.multiply(this.roll);this.sparks.add(this.p,this.q,.012*fade,(.10+.045*(i%3))*fade,i%4?WHITE:GOLD,fade);}}
  this.book.each(fighters,ULT.duration,this.gather);
  for(const h of this.hazes){
   if(!h.live)continue;const age=time-h.born;if(age>=h.life){h.live=false;continue;}if(age<0)continue;
   const u=age/h.life,out=1-(1-Math.min(1,age/.14))**2,fade=(1-u)*(1-u*.3);
   for(let i=0;i<h.count;i++){const ang=i*2.399963+h.seed,r=h.reach*(.3+.7*hash(h.seed+i*1.7))*out;this.p.set(h.at.x+Math.cos(ang)*r,h.at.y+(hash(h.seed+i*2.9)-.4)*h.reach*.5+u*h.reach*.5,h.at.z+Math.sin(ang)*r);this.q.setFromAxisAngle(UP,ang);this.gas.add(this.p,this.q,(.5+.5*hash(i+h.seed))*h.reach*(.6+.6*u),(.7+.5*hash(i*3+h.seed))*h.reach*(.6+.6*u),HOT_GAS,.26*fade);}
  }
  this.cuts.draw(st,time);
  for(const b of this.batches)b.end();st.close();
 }
 private blade(f:Fighter,name:'LeftHand'|'RightHand',heel:T.Vector3,tip:T.Vector3){
  const joint=(f.shownBody??f).joints?.get(name),socket=MIKASA_SWORD_SOCKETS[name];
  if(joint){heel.fromArray(socket.heel).applyMatrix4(joint.matrixWorld);tip.fromArray(socket.tip).applyMatrix4(joint.matrixWorld);return;}
  heel.copy((name==='LeftHand'?f.handL:f.handR)??f.group.position);tip.copy(heel).addScaledVector(this.heading,.85);
 }
 private lit(f:Fighter,k:number,wide:number){for(const name of['LeftHand','RightHand']as const){this.blade(f,name,this.a,this.b);this.stage.streak(this.a,this.b,.05*wide,BLADE.main,.5*k);this.stage.streak(this.a,this.b,.018*wide,BLADE.core,1.1*k);}}
 private jets(f:Fighter,k:number,time:number,seed:number){
  const st=this.stage,heading=this.heading;this.face.copy(f.group.quaternion);
  for(const sign of[-1,1]){this.hip(f,sign,this.a);
   this.lat.set(heading.z,0,-heading.x);
   for(let i=0;i<3;i++){this.b.copy(this.a).addScaledVector(heading,-(1.1+1.5*k)*(.6+.4*hash(seed+i*2.3+sign))).addScaledVector(this.lat,-sign*(.35+.2*i));this.b.y+=(i-1)*.12-.1;st.streak(this.a,this.b,.03,BLADE.main,.7*k);}
   for(let i=0;i<2;i++){const along=((hash(seed+i*1.7+sign)+time*1.6)%1);this.p.copy(this.a).addScaledVector(heading,-.4-along*1.9).addScaledVector(this.lat,-sign*(.45+.5*along));this.p.y+=.1*along-.15;this.q.copy(this.face);this.roll.setFromAxisAngle(FORWARD,sign*.4);this.q.multiply(this.roll);this.gas.add(this.p,this.q,.3+.4*along,.45+.6*along,HOT_GAS,.2*k*(1-along));}
  }
 }
 private pose(f:Fighter,time:number,elapsed:number){
  const st=this.stage,s=f.state,seed=(s.actionSeq??0)*4.9,yaw=s.yaw??f.group.rotation.y,heading=this.heading.set(Math.sin(yaw),0,Math.cos(yaw)),feet=f.group.position;this.lat.set(heading.z,0,-heading.x);
  const centre=this.m.copy(feet);centre.y+=1.15;
  if(s.action==='light'){
   const k=Math.sin(clamp(s.actionTime)*Math.PI);this.lit(f,k,1);this.v.copy(this.lat).multiplyScalar(.9).addScaledVector(UP,.44);arc(st,centre,heading,this.v,1.45,-1+s.actionTime*.8,.2+s.actionTime*.8,.06,BLADE.main,.8*k);st.light(this.b.copy(centre).addScaledVector(heading,1),2,BLADE,.2*k);return;
  }
  if(s.action==='heavy'||s.action==='ultimate'&&!s.branch&&s.confirmedAt===undefined&&elapsed<ULT.contacts[0]+.12){
   const contact=s.action==='ultimate'?ULT.contacts[0]:s.branch?s.actionDuration*.5:HEAVY.contacts[0];
   if(elapsed<contact){const k=clamp(elapsed/contact);this.lit(f,.6+.4*k,1.3);this.blade(f,'RightHand',this.a,this.b);st.glow(this.b,.12+.14*k,BLADE.main,.4+.3*k);st.glow(this.b,.05+.06*k,BLADE.core,.6+.4*k);if(s.action==='heavy'){sheenAhead(st,feet,heading,1.6+.8*k,BLADE,.4*k);st.light(this.b.copy(feet).addScaledVector(heading,3.4).setY(feet.y+.8),2.4+.4*k,BLADE,.3*k);}}
   else if(s.action==='heavy'&&elapsed<contact+.2){
    const k=1-(elapsed-contact)/.2;
    for(let i=-1;i<=1;i+=2){this.v.copy(this.lat).multiplyScalar(.72).addScaledVector(UP,.69*i);arc(st,centre,heading,this.v,1.9,-1.05,1.05,.13,BLADE.main,.9*k);arc(st,centre,heading,this.v,1.9,-.9,.9,.045,BLADE.core,1.5*k);}
    st.light(this.b.copy(centre).addScaledVector(heading,1.4),3.8,BLADE,.4*k);
   }
   return;
  }
  if(s.action==='special'){
   const release=s.branch?s.actionDuration*.5:SPECIAL.contacts[0];
   if(elapsed<release){
    const k=clamp(elapsed/release);this.lit(f,.6+.4*k,1.3);this.jets(f,.4+.6*k,time,seed);
    if(!s.branch){
     for(const sign of[-1,1]){this.hip(f,sign,this.a);this.b.copy(feet).addScaledVector(heading,3+6*k).addScaledVector(this.lat,sign*.5);this.b.y+=1.6+1.2*k;st.streak(this.a,this.b,.022,BLADE.main,.8*Math.min(1,k*3));}
     sheenAhead(st,feet,heading,2.2+1.6*k,BLADE,.7*k);st.light(this.b.copy(feet).addScaledVector(heading,3.6).setY(feet.y+.8),2.5+.6*k,BLADE,.4*k);
    }
   }else if(elapsed<release+.24){
    const k=1-(elapsed-release)/.24,radius=s.branch?2:2.6;
    for(let i=-1;i<=1;i+=2){this.v.copy(this.lat).multiplyScalar(.8).addScaledVector(UP,.6*i);arc(st,centre,heading,this.v,radius,-1.15,1.15,.19,BLADE.main,.9*k);arc(st,centre,heading,this.v,radius,-1,1,.065,BLADE.core,1.6*k);}
    st.light(this.b.copy(centre).addScaledVector(heading,radius*.7),radius*1.5+1.5,BLADE,.45*k);
   }
  }
 }
 private readonly gather=(actor:Fighter,g:Gather,elapsed:number,victim:Fighter|undefined)=>{
  const final=ULT.contacts[ULT.contacts.length-1];if(elapsed>=final+.1)return;
  const st=this.stage,time=st.time,opener=ULT.contacts[0],build=clamp((elapsed-opener)/(final-opener)),rise=clamp((elapsed-opener)/.3),seed=g.seq*3.5;
  const yaw=actor.state.yaw??actor.group.rotation.y;this.heading.set(Math.sin(yaw),0,Math.cos(yaw));
  st.dim(.3+.4*build,g.actor,g.target);
  this.jets(actor,.5+.5*build,time,seed);
  if(!victim)return;
  const centre=bodyCentre(victim,this.m);
  for(const sign of[-1,1]){this.hip(actor,sign,this.a);st.streak(this.a,centre,.02,BLADE.main,.7*rise);}
  for(let i=0,n=st.n(5,3);i<n;i++){
   const turn=i*1.257+seed,tilt=.25+.5*Math.sin(i*2.3+seed),from=time*(5+6*build)*(i%2?1:-1)+i*1.7,r=(1.5+.5*i/n)*rise;
   this.u.set(Math.cos(turn),0,Math.sin(turn));this.v.set(-Math.sin(turn)*Math.sin(tilt),Math.cos(tilt),Math.cos(turn)*Math.sin(tilt));
   arc(st,centre,this.u,this.v,r,from,from+2.4,.08,BLADE.main,.5+.4*build);arc(st,centre,this.u,this.v,r,from+.3,from+2.1,.03,BLADE.core,1.3);
  }
  st.light(centre,4.2+2*build,BLADE,.36+.3*build);
  if(elapsed>final-.5){const k=clamp((elapsed-(final-.5))/.5);for(const sign of[-1,1]){this.hip(actor,sign,this.a);this.a.y+=.25;st.glow(this.a,.2+.2*k,SPEAR.core,.9*k);st.streak(this.a,this.b.copy(this.a).addScaledVector(this.heading,.9),.05,SPEAR.main,k);}st.light(actor.group.position,3.4,SPEAR,.4*k);}
  if(build>.8)st.speed(.5*(build-.8)/.2,g.actor,g.target);
 };
 reset(){for(const h of this.impacts)h.actor='';for(const t of this.tethers)t.actor='';this.seen.fill(-1);this.times.fill(-1);this.eventCursor=this.impactCursor=this.tetherCursor=0;for(const b of this.batches){b.begin(0);b.end();}for(const h of this.hazes)h.live=false;this.book.reset();this.cuts.reset();this.stage.reset();}
 dispose(){if(this.disposed)return;this.reset();this.disposed=true;for(const b of this.batches)b.dispose();this.stage.release();}
}
