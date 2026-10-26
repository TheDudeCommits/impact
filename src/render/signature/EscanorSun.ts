import * as T from 'three';
import type {CombatEvent} from '../../game/types';
import type {Fighter} from '../Fighter';
import type {Flight} from '../CombatEffects';
import type {VfxKit} from '../vfx/VfxKit';
import {bodyCentre} from '../vfx/VfxKit';
import {ESCANOR_MOVES,ESCANOR_AWAKENING,ESCANOR_RHITTA_EDGE,escanorRhittaVisible} from '../../game/fighters/escanor';
import {SIGNATURE,involvesLocal} from './context';
import {FIRE} from './FlameSprites';
import {MoveStage,stageLook} from './MoveStage';
import { blowFloor } from './blowFloor';
export const ESCANOR_SUN_ASSETS:readonly string[]=Object.freeze([]);
export const ESCANOR_SUN_LIMITS=Object.freeze({suns:20,rays:160,rings:64,embers:128,impacts:24,duels:8});
export const isEscanorSun=(id:string|undefined)=>id==='escanor';
const UP=new T.Vector3(0,1,0),FORWARD=new T.Vector3(0,0,1),TAU=Math.PI*2;
const GOLD=new T.Color(3,1.75,.4),WHITE=new T.Color(3,2.7,1.9),ORANGE=new T.Color(2.7,.75,.12);
const SUN=stageLook(0xfffbe8,0xffb21f,0xc4410e,{flame:FIRE});
const HEAVY=ESCANOR_MOVES.heavy,SPECIAL=ESCANOR_MOVES.special,ULT=ESCANOR_MOVES.ultimate;
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
function solarCutGeometry():T.BufferGeometry{
 const profile:[number,number][]=[[0,-.5],[.30,-.39],[.47,-.10],[.40,.28],[0,.5],[-.27,.34],[-.50,.04],[-.33,-.32]];
 const vertices:number[]=[];
 for(let plane=0;plane<2;plane++)for(let i=0;i<profile.length;i++){
  const a=profile[i],b=profile[(i+1)%profile.length];
  vertices.push(0,0,0,plane?0:a[0],a[1],plane?a[0]:0,plane?0:b[0],b[1],plane?b[0]:0);
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.computeVertexNormals();return g;
}
class SunBatch{
 readonly mesh:T.InstancedMesh<T.BufferGeometry,T.ShaderMaterial>;
 private tint:T.InstancedBufferAttribute;private count=0;private object=new T.Object3D();
 constructor(scene:T.Scene,name:string,geometry:T.BufferGeometry,readonly cap:number,solar=false,cut=false){
  this.tint=new T.InstancedBufferAttribute(new Float32Array(cap*4),4).setUsage(T.DynamicDrawUsage);geometry.setAttribute('sunTint',this.tint);
  const material=new T.ShaderMaterial({name:`Escanor-${name}`,transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false,vertexShader:'attribute vec4 sunTint;varying vec4 vTint;varying vec3 vN;varying vec3 vEye;varying vec3 vP;void main(){vTint=sunTint;vP=position;vec4 p=modelViewMatrix*instanceMatrix*vec4(position,1.);vN=normalize(normalMatrix*mat3(instanceMatrix)*normal);vEye=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',fragmentShader:solar?'varying vec4 vTint;varying vec3 vN;varying vec3 vEye;varying vec3 vP;void main(){if(vTint.a<.003)discard;float rim=pow(1.-abs(dot(normalize(vN),normalize(vEye))),1.7);float grain=.94+.06*sin(vP.x*34.+sin(vP.z*28.)*4.+vP.y*31.);vec3 c=mix(vec3(2.9,2.75,2.1),vTint.rgb,rim*.87)*grain;gl_FragColor=vec4(c,vTint.a);\n#include <colorspace_fragment>\n}':cut?'varying vec4 vTint;varying vec3 vP;void main(){float side=max(abs(vP.x),abs(vP.z))*2.;float endFade=1.-smoothstep(.34,.50,abs(vP.y));float irregular=.90+.10*sin(vP.y*83.+sin(vP.y*31.)*2.);float feather=pow(1.-smoothstep(.04,.98,side/irregular),1.7);float a=vTint.a*feather*endFade;if(a<.003)discard;vec3 c=mix(vTint.rgb,vec3(1.,.985,.91),pow(1.-side,5.)*.55);gl_FragColor=vec4(c,a);\n#include <colorspace_fragment>\n}':'varying vec4 vTint;void main(){if(vTint.a<.003)discard;gl_FragColor=vTint;\n#include <colorspace_fragment>\n}'});material.forceSinglePass=true;
  this.mesh=new T.InstancedMesh(geometry,material,cap);this.mesh.name=`escanor-sun-${name}`;this.mesh.frustumCulled=false;this.mesh.count=0;this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.mesh.renderOrder=6;scene.add(this.mesh);
 }
 begin(){this.count=0;}
 add(p:T.Vector3,q:T.Quaternion,x:number,y:number,z:number,color:T.Color,alpha:number){if(this.count>=this.cap||alpha<=.003||Math.min(x,y,z)<=0)return;this.object.position.copy(p);this.object.quaternion.copy(q);this.object.scale.set(x,y,z);this.object.updateMatrix();this.mesh.setMatrixAt(this.count,this.object.matrix);this.tint.setXYZW(this.count++,color.r,color.g,color.b,clamp(alpha));}
 end(){this.mesh.count=this.count;this.mesh.instanceMatrix.needsUpdate=true;this.tint.needsUpdate=true;}
 dispose(){this.mesh.removeFromParent();this.mesh.dispose();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
type Impact={actor:string;seq:number;born:number;seed:number;grade:number;projectile:boolean;point:T.Vector3};
type Duel={actor:string;target:string;seq:number;finalHit:boolean;point:T.Vector3};
export class EscanorSun{
 private suns:SunBatch;private rays:SunBatch;private rings:SunBatch;private embers:SunBatch;private batches:SunBatch[];
 private hits:Impact[]=Array.from({length:ESCANOR_SUN_LIMITS.impacts},()=>({actor:'',seq:-1,born:0,seed:0,grade:0,projectile:false,point:new T.Vector3()}));
 private duels:Duel[]=Array.from({length:ESCANOR_SUN_LIMITS.duels},()=>({actor:'',target:'',seq:-1,finalHit:false,point:new T.Vector3()}));
 private seen=new Float64Array(128).fill(-1);private seenTime=new Float64Array(128).fill(-1);private eventCursor=0;private hitCursor=0;private duelCursor=0;private disposed=false;
 private mid=new T.Vector3();private sunCentre=new T.Vector3();private p=new T.Vector3();private a=new T.Vector3();private b=new T.Vector3();private direction=new T.Vector3();private side=new T.Vector3();private q=new T.Quaternion();private face=new T.Quaternion();private flat=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-Math.PI/2);
 private readonly stage:MoveStage;private dir=new T.Vector3();private ground=new T.Vector3();private c=new T.Vector3();
 constructor(scene:T.Scene,private kit:Pick<VfxKit,'budget'>&Partial<VfxKit>){this.stage=MoveStage.for(scene,kit);this.suns=new SunBatch(scene,'suns',new T.IcosahedronGeometry(.5,2),ESCANOR_SUN_LIMITS.suns,true);this.rays=new SunBatch(scene,'rays',solarCutGeometry(),ESCANOR_SUN_LIMITS.rays,false,true);this.rings=new SunBatch(scene,'rings',new T.RingGeometry(.965,1,40),ESCANOR_SUN_LIMITS.rings);this.embers=new SunBatch(scene,'embers',new T.OctahedronGeometry(.5,0),ESCANOR_SUN_LIMITS.embers);this.batches=[this.suns,this.rays,this.rings,this.embers];}
 load(_ids:readonly string[]):Promise<void>{return Promise.resolve();}
 handle(e:CombatEvent,fighters?:ReadonlyMap<string,Fighter>){
  if(this.disposed)return;if(e.kind==='eliminated'||e.kind==='respawn'){this.cancel(e.actorId,true);return;}if(!isEscanorSun(e.fighter))return;if(e.kind==='whiff'||e.kind==='rejected'){this.cancel(e.actorId);return;}if(e.kind!=='confirm'&&e.kind!=='hit')return;
  for(let i=0;i<this.seen.length;i++)if(this.seen[i]===e.id&&this.seenTime[i]===e.serverTime)return;const index=this.eventCursor++%128;this.seen[index]=e.id;this.seenTime[index]=e.serverTime;
  const actor=fighters?.get(e.actorId),target=e.targetId?fighters?.get(e.targetId):undefined,seq=e.actionSeq??actor?.state.actionSeq??-1;
  if(e.kind==='confirm'){if(e.slot==='ultimate'&&!e.branch&&e.targetId)Object.assign(this.duels[this.duelCursor++%this.duels.length],{actor:e.actorId,target:e.targetId,seq,finalHit:false});return;}
  if(!target&&!e.endpoint)return;const final=e.slot==='ultimate'&&!e.branch&&e.contactIndex===2,h=this.hits[this.hitCursor++%this.hits.length];Object.assign(h,{actor:e.actorId,seq,born:e.serverTime,seed:e.id,grade:final?3:e.slot==='heavy'||e.slot==='special'?2:1,projectile:e.slot==='special'&&!e.branch});if(target)bodyCentre(target,h.point);else h.point.set(e.endpoint!.x,e.endpoint!.y,e.endpoint!.z);
  if(final){for(const d of this.duels)if(d.actor===e.actorId&&d.target===e.targetId&&d.seq===seq){d.finalHit=true;d.point.copy(h.point);}if(involvesLocal(e.actorId,e.targetId))SIGNATURE.screen?.impactFrame?.(.44,h.point);}
  const st=this.stage,t=e.serverTime,point=h.point,dir=this.dir,floor=blowFloor(actor, target, point.y-1);
  if(actor){dir.subVectors(point,actor.group.position).setY(0);if(dir.lengthSq()<.01)dir.set(Math.sin(actor.group.rotation.y),0,Math.cos(actor.group.rotation.y));dir.normalize();}else dir.copy(FORWARD);
  const ground=this.ground.set(point.x,floor,point.z);
  if(e.slot==='light'){st.burst(point,SUN,.46,t,{dir,floor,clean:true});return;}
  if(e.slot==='heavy'){
   const big=e.branch?.85:1;
   st.burst(point,SUN,.85*big,t,{dir,floor});st.erupt(this.a.copy(point).addScaledVector(dir,.45),this.b.copy(dir).setY(.12).normalize(),SUN,.3*big,3.6*big,t,.32);st.scar(this.a.copy(ground).addScaledVector(dir,1.1),SUN,1.3*big,t+.05,1.5);
   return;
  }
  if(e.slot==='special'){
   if(e.branch==='airSpecial'){st.burst(point,SUN,2.2,t,{floor});st.shock(ground,SUN,5.5,t,.5);st.scar(ground,SUN,2.6,t+.05,2.2);return;}
   if(e.branch){st.burst(point,SUN,1.5,t,{dir,floor});st.scar(ground,SUN,1.5,t+.05,1.6);return;}
   st.burst(point,SUN,2.2,t,{dir,floor});
   st.erupt(ground,UP,SUN,.9,5,t+.03,.8);
   st.shock(ground,SUN,5.6,t,.5);
   st.scar(ground,SUN,2.5,t+.05,2.4);
   if(actor)for(let i=1;i<=2;i++){const back=Math.min(i*2.3,ground.distanceTo(actor.group.position)-1.4);if(back>.8)st.scar(this.a.copy(ground).addScaledVector(dir,-back),SUN,1.1-i*.15,t,1.6);}
   return;
  }
  if(e.slot!=='ultimate'||e.branch)return;
  if(!final){st.burst(point,SUN,e.contactIndex?1.8:1.3,t,{dir,floor});if(e.contactIndex)st.shock(ground,SUN,5,t,.5);return;}
  st.burst(point,SUN,2.8,t,{dir,floor});
  st.erupt(ground,UP,SUN,1.4,12,t+.05,.8);
  this.b.set(dir.z,0,-dir.x);
  for(let i=-1;i<=1;i+=2)st.erupt(this.a.copy(ground).addScaledVector(this.b,i*2.7).addScaledVector(dir,1),UP,SUN,.7,6.5,t+.14+(i>0?.06:0),.7);
  st.shock(ground,SUN,9,t,.6);
  st.scar(ground,SUN,3.2,t+.2,2.1);st.scar(this.a.copy(ground).addScaledVector(dir,3.6),SUN,2,t+.25,1.8);
 }
 private cancel(id:string,targetToo=false){for(const d of this.duels)if(d.actor===id||targetToo&&d.target===id&&!d.finalHit)d.actor='';for(const h of this.hits)if(h.actor===id)h.actor='';}
 private line(from:T.Vector3,to:T.Vector3,width:number,color:T.Color,alpha:number){this.direction.subVectors(to,from);const len=this.direction.length();if(len<.001)return;this.q.setFromUnitVectors(UP,this.direction.multiplyScalar(1/len));this.mid.copy(from).add(to).multiplyScalar(.5);this.rays.add(this.mid,this.q,width,len,width,color,alpha);}
 private blade(f:Fighter,alpha:number){const body=f.shownBody??f,joint=body.joints.get('RightHand');if(!joint)return;const edge=body!==f?ESCANOR_RHITTA_EDGE.form:ESCANOR_RHITTA_EDGE.base;this.a.fromArray(edge.top).applyMatrix4(joint.matrixWorld);this.b.fromArray(edge.middle).applyMatrix4(joint.matrixWorld);this.line(this.a,this.b,.012,GOLD,alpha);this.a.copy(this.b);this.b.fromArray(edge.bottom).applyMatrix4(joint.matrixWorld);this.line(this.a,this.b,.012,GOLD,alpha);}
 private sun(center:T.Vector3,size:number,alpha:number,time:number,detail:boolean){this.sunCentre.copy(center);center=this.sunCentre;this.face.identity();this.suns.add(center,this.face,size,size,size,GOLD,alpha);this.rings.add(center,this.face,size*.57,size*.57,1,ORANGE,alpha*.7);this.q.setFromAxisAngle(UP,Math.PI/2);this.rings.add(center,this.q,size*.54,size*.54,1,GOLD,alpha*.6);
  for(let i=0;i<(detail?12:6);i++){const angle=i/(detail?12:6)*TAU+time*.24;this.a.copy(center);this.a.x+=Math.sin(angle)*size*.52;this.a.y+=Math.cos(angle)*size*.52;this.b.copy(center);this.b.x+=Math.sin(angle)*size*(.63+.035*Math.sin(i+time*4));this.b.y+=Math.cos(angle)*size*(.63+.035*Math.sin(i+time*4));this.line(this.a,this.b,.014*size,GOLD,alpha*.8);}}
 update(time:number,fighters:ReadonlyMap<string,Fighter>,flights:ReadonlyMap<string,Flight>){
  if(this.disposed)return;const st=this.stage.open(time);for(const b of this.batches)b.begin();const detail=this.kit.budget>=.65;
  for(const f of fighters.values()){
   const s=f.state;if(!isEscanorSun(s.fighter)||!s.alive)continue;const t=s.actionTime*s.actionDuration,body=f.shownBody??f,seed=(s.actionSeq??0)*4.9;
   if(s.action==='awaken'){this.awaken(f,t,detail);continue;}
   if((s.action==='light'||s.action==='heavy'||s.action==='ultimate'&&s.confirmedAt===undefined&&t<ULT.contacts[0]+.1)&&s.whiffedAt===undefined){
    const power=Math.sin(clamp(s.actionTime)*Math.PI),edge=f.strikePoint(this.c);
    st.glow(edge,.36,SUN.main,.5*power);st.glow(edge,.14,SUN.core,.8*power);st.light(edge,2.1,SUN,.22*power);
    st.tongue(this.p.copy(edge).setY(edge.y+.2),UP,.34,.45+.6*power,SUN,.3+.7*power,seed);
    if(s.action!=='light'&&!s.branch){const release=s.action==='heavy'?HEAVY.contacts[0]:ULT.contacts[0];if(t<release)st.charge(edge,SUN,s.action==='heavy'?.24:.3,clamp(t/release),seed);}
   }
   if((s.action==='light'||s.action==='heavy')&&s.whiffedAt===undefined&&escanorRhittaVisible(s.action,t)){this.blade(f,Math.sin(clamp(s.actionTime)*Math.PI)*.75);}
   if(s.action==='special'&&!s.branch&&s.whiffedAt===undefined&&t<ESCANOR_MOVES.special.contacts[0]){const k=clamp(t/ESCANOR_MOVES.special.contacts[0]),over=this.c.copy(body.handL);over.y+=.12;this.sun(over,.16+k*.74,.9*k,time,detail);
    st.glow(over,.5+.7*k,SUN.main,.45*k);st.light(over,2.5+3.5*k,SUN,.2+.4*k);
    for(let i=0,n=st.n(8,4);i<n;i++){const phase=(time*1.6+i*.618)%1,az=i*2.399963+seed,far=.6+2.6*(1-phase)*(1-phase);this.side.set(Math.cos(az),-.2+.9*Math.sin(az*1.7),Math.sin(az)).normalize();st.streak(this.p.copy(over).addScaledVector(this.side,far),this.a.copy(over).addScaledVector(this.side,Math.max(.3,far-.5)),.05,SUN.main,Math.sin(Math.PI*phase)*k);}}
  }
  for(const flight of flights.values())if(isEscanorSun(flight.fighter)&&flight.slot==='special'&&!flight.branch&&flight.released){this.sun(flight.position,1.5,.96,time,detail);
   st.orb(flight.position,flight.heading,.95,SUN,(flight.since??0)*3.9);this.face.setFromUnitVectors(FORWARD,this.direction.copy(flight.heading).normalize());for(let i=0;i<(detail?6:3);i++){this.p.copy(flight.position).addScaledVector(flight.heading,-.6-i*.20);this.p.y+=Math.sin(time*4+i)*.065;this.embers.add(this.p,this.face,.055,.055,.22,ORANGE,.7-i*.07);}}
  for(const d of this.duels){
   if(!d.actor)continue;const f=fighters.get(d.actor),target=fighters.get(d.target),s=f?.state;if(!f||!s?.alive||!target?.state.alive&&!d.finalHit||s.action!=='ultimate'||s.branch||(s.actionSeq??-1)!==d.seq||s.whiffedAt!==undefined){d.actor='';continue;}
   const t=s.actionTime*s.actionDuration;if(t>3.78){d.actor='';continue;}if(target?.state.alive)bodyCentre(target,d.point);
   if(t<ULT.contacts[2])this.gather(f,d,t,time,detail);
   if(t<2.25)continue;const fade=clamp((3.78-t)/.30),charge=clamp((t-2.25)/.80);this.face.copy(f.group.quaternion);f.strikePoint(this.a);this.rings.add(this.a,this.face,.16+charge*.14,.16+charge*.14,1,GOLD,fade*.8);
   if(d.finalHit&&t>=3.05){const age=t-3.05,width=.2+age*.1;this.a.copy(d.point);this.a.y=f.group.position.y+.02;this.b.copy(this.a);this.b.y+=4.8;this.line(this.a,this.b,width,WHITE,fade*.9);this.line(this.a,this.b,width*3.1,GOLD,fade*.45);this.p.copy(this.a);this.rings.add(this.p,this.flat,.6+age*4,.6+age*4,1,GOLD,fade*.7);}
  }
  for(const h of this.hits){
   if(!h.actor)continue;const f=fighters.get(h.actor),s=f?.state,age=time-h.born,life=h.grade===3?.50:.34;
   if(!s?.alive||!h.projectile&&((s.actionSeq??-1)!==h.seq||!['light','heavy','special','ultimate'].includes(s.action))||s.whiffedAt!==undefined||age>=life){h.actor='';continue;}if(age<0)continue;const fade=1-age/life;this.face.copy(f!.group.quaternion);this.rings.add(h.point,this.face,.15+age*(3+h.grade),.15+age*(3+h.grade),1,GOLD,fade*.8);
   if(h.projectile)this.sun(h.point,.4+age*4.5,fade*.8,time,detail);
   for(let i=0;i<(detail?5:2)*h.grade;i++){const a=i*2.39996+h.seed;this.p.copy(h.point);this.p.x+=Math.sin(a)*age*(3+h.grade);this.p.z+=Math.cos(a)*age*(3+h.grade);this.p.y+=age*(i%4-1)*1.4-age*age*3;this.q.setFromAxisAngle(FORWARD,a);const size=.09*fade;this.embers.add(this.p,this.q,size,size*2.7,size,i%2?GOLD:ORANGE,fade);}
  }
  for(const b of this.batches)b.end();st.close();
 }
 private gather(f:Fighter,d:Duel,t:number,time:number,detail:boolean){
  const st=this.stage,g=clamp((t-ULT.contacts[0])/(ULT.contacts[2]-ULT.contacts[0])),feet=f.group.position,seed=d.seq*3.1;
  if(t<ULT.contacts[0])return;
  st.dim(.3+.5*g,d.actor,d.target);
  const noon=this.c.copy(feet).setY(feet.y+2.7+.6*g),size=.7+1.6*g;
  this.sun(noon,size,.95,time,detail);st.glow(noon,size*1.2,SUN.main,.42);st.light(noon,5+3*g,SUN,.26+.2*g);
  st.ring(feet,2.2+.4*g,.8+1.4*g,SUN,.55+.45*g,seed,8);
  st.pool(this.p.copy(feet),2.2+2.2*g,SUN,.3+.7*g,seed);
  f.strikePoint(this.a);st.charge(this.a,SUN,.26+.2*g,Math.max(.35,g),seed);
  if(g>.75)st.speed(.55*(g-.75)/.25,d.actor,d.target);
 }
 private awaken(f:Fighter,t:number,detail:boolean){const release=ESCANOR_AWAKENING.beats.release,fade=clamp((.9-t)/.16);this.face.copy(f.group.quaternion);this.a.copy(f.group.position);this.a.y+=1.35;const radius=t<release?.30+.35*clamp(t/release):.65+(t-release)*.8;
  this.rings.add(this.a,this.face,radius,radius,1,GOLD,fade*.5);const count=detail?12:6;for(let i=0;i<count;i++){const a=i/count*TAU;this.side.set(Math.sin(a),Math.cos(a),0).applyQuaternion(this.face);this.b.copy(this.a).addScaledVector(this.side,radius);this.p.copy(this.a).addScaledVector(this.side,radius+.10);this.line(this.b,this.p,.014,GOLD,fade*.65);}
  if(t>=release){this.p.copy(f.group.position);this.p.y+=.035;this.rings.add(this.p,this.flat,.5+(t-release)*3,.5+(t-release)*3,1,ORANGE,fade*.5);for(let i=0;i<(detail?10:5);i++){const a=i*2.39996;this.p.copy(f.group.position);this.p.x+=Math.sin(a)*.40;this.p.z+=Math.cos(a)*.40;this.p.y+=.2+((i*.18+(t-release)*1.8)%1.7);this.embers.add(this.p,this.face,.025,.13,.025,GOLD,fade*.6);}}
 }
 reset(){for(const h of this.hits)h.actor='';for(const d of this.duels)d.actor='';this.seen.fill(-1);this.seenTime.fill(-1);this.eventCursor=this.hitCursor=this.duelCursor=0;for(const b of this.batches){b.begin();b.end();}this.stage.reset();}
 dispose(){if(this.disposed)return;this.reset();this.disposed=true;for(const b of this.batches)b.dispose();this.stage.release();}
}
