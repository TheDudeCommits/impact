import * as THREE from 'three';
import type {CombatEvent} from '../../game/types';
import type {Fighter} from '../Fighter';
import type {Flight} from '../CombatEffects';
import type {VfxKit} from '../vfx/VfxKit';
import {bodyCentre} from '../vfx/VfxKit';
import {SIGNATURE,involvesLocal} from './context';
import {armoryDraws} from '../vfx/armory/drawn';
import {GRIMMJOW_MOVES} from '../../game/fighters/grimmjow';
import {MoveStage,SHEEN,stageLook} from './MoveStage';
import {CastBook,Cuts,Rifts,arc,flare,jag,type Gather} from './StageCraft';
export const isGrimmjowPantera=(id:string|undefined)=>id==='grimmjow';
export const GRIMMJOW_PANTERA_LIMITS=Object.freeze({cores:64,rings:72,claws:144,sparks:160,impacts:24,finales:8});
const UP=new THREE.Vector3(0,1,0),Z=new THREE.Vector3(0,0,1),WHITE=new THREE.Color(0xf1ffff),CYAN=new THREE.Color(0x50d9ff),BLUE=new THREE.Color(0x147bbd);
const DIGITS=['Thumb','Index','Middle','Ring','Pinky']as const;
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const CERO=stageLook(0xf1ffff,0x50d9ff,0x147bbd,{sphere:{body:new THREE.Color(.04,.46,1.5),core:new THREE.Color(1.9,2.6,3),rimA:new THREE.Color(.4,1.6,2.6),rimB:new THREE.Color(1,2.1,2.9),spin:-1.2}});
const HOT_CYAN=new THREE.Color(.5,1.9,2.4),HOT_WHITE=new THREE.Color(2.1,2.4,2.5);
const HEAVY=GRIMMJOW_MOVES.heavy,SPECIAL=GRIMMJOW_MOVES.special,ULT=GRIMMJOW_MOVES.ultimate;
export const GRIMMJOW_PANTERA_BEATS=Object.freeze({opener:ULT.contacts[0],claws:1.4,rake:ULT.contacts[1],end:ULT.duration});
const CERO_LINGER=.5;
type Beam={actor:string;origin:THREE.Vector3;head:THREE.Vector3;born:number;seen:number;live:boolean};
class PantherBatch{
 mesh:THREE.InstancedMesh<THREE.BufferGeometry,THREE.ShaderMaterial>;count=0;private tint:THREE.InstancedBufferAttribute;private o=new THREE.Object3D();
 constructor(scene:THREE.Scene,name:string,g:THREE.BufferGeometry,private capacity:number,claw=false){
  this.tint=new THREE.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(THREE.DynamicDrawUsage);g.setAttribute('pantherTint',this.tint);
  const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide,uniforms:{clock:{value:0}},vertexShader:'attribute vec4 pantherTint;varying vec4 vTint;varying vec3 vNormal;varying vec3 vLocal;void main(){vTint=pantherTint;vLocal=position;vNormal=normalize(normalMatrix*mat3(instanceMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',fragmentShader:'uniform float clock;varying vec4 vTint;varying vec3 vNormal;varying vec3 vLocal;void main(){if(vTint.a<.005)discard;float shade=dot(normalize(vNormal),normalize(vec3(-.3,.7,1.)));float band=shade>.45?1.:(shade>-.2?.72:.28);float slash=sin(atan(vLocal.x,vLocal.z)*4.+vLocal.y*13.-clock*16.);vec3 color=mix(vTint.rgb*band,vec3(.91,1.,1.),smoothstep(.76,.94,slash)*.65);gl_FragColor=vec4(color,vTint.a);}'});
  if(claw){
   m.vertexShader='attribute vec4 pantherTint;varying vec4 vTint;varying vec2 vUv;void main(){vTint=pantherTint;vUv=uv;vec4 center=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);float sx=length(instanceMatrix[0].xyz);vec3 axis=(modelViewMatrix*instanceMatrix*vec4(0.,1.,0.,0.)).xyz;vec2 across=length(axis.xy)>.0001?normalize(vec2(axis.y,-axis.x)):vec2(1.,0.);center.xyz+=axis*position.y;center.xy+=across*position.x*sx;gl_Position=projectionMatrix*center;}';
   m.fragmentShader='varying vec4 vTint;varying vec2 vUv;void main(){float along=clamp(vUv.y,0.,1.);float center=.38+.24*pow(1.-along,2.);float width=.004+.105*pow(max(0.,sin(along*3.14159265)),1.35);float edge=abs(vUv.x-center)/width;if(edge>1.||vTint.a<.005)discard;vec3 color=edge>.78?vec3(.025,.12,.19):(edge>.48?vTint.rgb:vec3(.92,1.,1.));float a=vTint.a*(1.-smoothstep(.87,1.,edge));gl_FragColor=vec4(color,a);}';
  }
  m.forceSinglePass=true;this.mesh=new THREE.InstancedMesh(g,m,capacity);this.mesh.name='grimmjow-'+name;this.mesh.count=0;this.mesh.frustumCulled=false;this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(this.mesh);
 }
 begin(){this.count=0;}
 add(p:THREE.Vector3,q:THREE.Quaternion,x:number,y:number,z:number,color:THREE.Color,alpha:number){if(this.count>=this.capacity||alpha<.005||Math.min(x,y,z)<=0)return;this.o.position.copy(p);this.o.quaternion.copy(q);this.o.scale.set(x,y,z);this.o.updateMatrix();this.mesh.setMatrixAt(this.count,this.o.matrix);this.tint.setXYZW(this.count++,color.r,color.g,color.b,clamp(alpha));}
 end(){this.mesh.count=this.count;this.mesh.instanceMatrix.needsUpdate=true;this.tint.needsUpdate=true;}
 dispose(){this.mesh.removeFromParent();this.mesh.dispose();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
type Impact={actor:string;seq:number;born:number;point:THREE.Vector3;grade:number;seed:number;energy:boolean};
type Finale={actor:string;target:string;seq:number;point:THREE.Vector3;hit:boolean};
export class GrimmjowPantera{
 private cores:PantherBatch;private rings:PantherBatch;private claws:PantherBatch;private sparks:PantherBatch;private batches:PantherBatch[];
 private impacts:Impact[]=Array.from({length:GRIMMJOW_PANTERA_LIMITS.impacts},()=>({actor:'',seq:-1,born:0,point:new THREE.Vector3(),grade:0,seed:0,energy:false}));
 private finales:Finale[]=Array.from({length:GRIMMJOW_PANTERA_LIMITS.finales},()=>({actor:'',target:'',seq:-1,point:new THREE.Vector3(),hit:false}));
 private seen=new Float64Array(128).fill(-1);private seenAt=new Float64Array(128).fill(-1);private seenCursor=0;private hitCursor=0;private finaleCursor=0;private disposed=false;
 private fingerStart=new THREE.Vector3();private p=new THREE.Vector3();private a=new THREE.Vector3();private b=new THREE.Vector3();private dir=new THREE.Vector3();private forward=new THREE.Vector3();private side=new THREE.Vector3();private q=new THREE.Quaternion();private roll=new THREE.Quaternion();private flat=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
 private readonly stage:MoveStage;private readonly book=new CastBook('grimmjow',ULT.contacts.length);private readonly marks=new Cuts(20,CERO);private readonly gouges=new Rifts(8,CERO);
 private beams:Beam[]=Array.from({length:4},()=>({actor:'',origin:new THREE.Vector3(),head:new THREE.Vector3(),born:0,seen:-1e9,live:false}));
 private axis=new THREE.Vector3();private across=new THREE.Vector3();private c=new THREE.Vector3();private heading=new THREE.Vector3();
 constructor(scene:THREE.Scene,private kit:Pick<VfxKit,'budget'>&Partial<VfxKit>){this.stage=MoveStage.for(scene,kit);this.cores=new PantherBatch(scene,'cero-cores',new THREE.IcosahedronGeometry(1,1),GRIMMJOW_PANTERA_LIMITS.cores);this.rings=new PantherBatch(scene,'compression-rings',new THREE.TorusGeometry(1,.025,4,32),GRIMMJOW_PANTERA_LIMITS.rings);this.claws=new PantherBatch(scene,'desgarron-claws',new THREE.PlaneGeometry(1,1),GRIMMJOW_PANTERA_LIMITS.claws,true);this.sparks=new PantherBatch(scene,'pressure-streaks',new THREE.ConeGeometry(1,1,4),GRIMMJOW_PANTERA_LIMITS.sparks);this.batches=[this.cores,this.rings,this.claws,this.sparks];}
 load(_ids:readonly string[]){return Promise.resolve();}
 private socket(f:Fighter,name:string,out:THREE.Vector3){const body=f.shownBody??f,joint=body.joints?.get(name)??body.model?.getObjectByName(name);if(!joint)return false;joint.getWorldPosition(out);return true;}
 handle(e:CombatEvent,fighters?:ReadonlyMap<string,Fighter>){
  if(this.disposed)return;this.staged(e,fighters);if(e.kind==='eliminated'||e.kind==='respawn'){this.cancel(e.actorId,true);return;}if(!isGrimmjowPantera(e.fighter))return;if(e.kind==='whiff'||e.kind==='rejected'){this.cancel(e.actorId);return;}if(e.kind!=='hit'&&e.kind!=='confirm')return;
  const f=fighters?.get(e.actorId);if(!f?.state.alive)return;for(let i=0;i<this.seen.length;i++)if(this.seen[i]===e.id&&this.seenAt[i]===e.serverTime)return;const k=this.seenCursor++%this.seen.length;this.seen[k]=e.id;this.seenAt[k]=e.serverTime;const seq=e.actionSeq??f.state.actionSeq??-1;
  if(e.kind==='confirm'){if(e.slot==='ultimate'&&!e.branch&&e.targetId)Object.assign(this.finales[this.finaleCursor++%this.finales.length],{actor:e.actorId,target:e.targetId,seq,hit:false});return;}
  const victim=e.targetId?fighters?.get(e.targetId):undefined;if(!victim&&!e.endpoint)return;const final=e.slot==='ultimate'&&!e.branch&&e.contactIndex===1,h=this.impacts[this.hitCursor++%this.impacts.length];Object.assign(h,{actor:e.actorId,seq,born:e.serverTime,grade:final?3:e.slot==='heavy'||e.slot==='special'?2:1,seed:e.id,energy:e.slot==='special'||final});if(e.endpoint)h.point.set(e.endpoint.x,e.endpoint.y,e.endpoint.z);else bodyCentre(victim!,h.point);
  if(final){for(const fin of this.finales)if(fin.actor===e.actorId&&fin.seq===seq){fin.hit=true;fin.point.copy(h.point);}if(involvesLocal(e.actorId,e.targetId))SIGNATURE.screen?.impactFrame?.(.5,h.point);}
 }
 private staged(e:CombatEvent,fighters?:ReadonlyMap<string,Fighter>){
  const blow=this.book.take(e,fighters);if(!blow)return;
  const st=this.stage,{point,ground,dir,side,floor,t}=blow,tilt=e.id%2?1:-1;
  if(e.slot==='light'){st.burst(point,CERO,.4,t,{dir,floor,clean:true});this.claw(point,side,dir,.55*tilt,3,.7,.045,.17,t,.2);return;}
  if(e.slot==='heavy'){
   st.burst(point,CERO,e.branch?.8:.9,t,{dir,floor});this.claw(point,side,dir,1.05*tilt,5,1.5,.075,.2,t,.32);
   st.shock(ground,CERO,3.6,t,.4);
   return;
  }
  if(e.slot==='special'){
   if(e.branch==='airSpecial'){st.burst(point,CERO,2.1,t,{floor});st.shock(ground,CERO,3.6,t,.45);st.scar(ground,CERO,2.2,t+.05,1.8);return;}
   const big=e.branch?.75:1;
   st.burst(point,CERO,1.7*big,t,{dir,floor});st.dome(point,CERO,3.2*big,t,.42);st.shock(ground,CERO,4.6*big,t,.45);st.scar(ground,CERO,1.9*big,t+.05,1.9);
   return;
  }
  if(e.slot!=='ultimate'||e.branch)return;
  if(!blow.final){st.burst(point,CERO,1.3,t,{dir,floor});this.claw(point,side,dir,.6*tilt,5,1.4,.07,.2,t,.3);return;}
  this.claw(point,side,dir,.42*tilt,5,3.9,.14,.46,t,.55);
  for(let i=-2;i<=2;i++)this.gouges.add(this.c.copy(ground).addScaledVector(dir,-1.2).addScaledVector(side,i*.62),dir,8.5-Math.abs(i)*.9,CERO,t+Math.abs(i)*.02,2.3,2.2,.11,i===0);
  st.burst(point,CERO,2,t,{dir,floor});
  st.shatter(point,dir,CERO,4.6,t,.7);
  st.dome(point,CERO,3.6,t,.42);
  st.shock(ground,CERO,9,t,.6);
  st.scar(ground,CERO,2.9,t+.2,2);
 }
 private claw(point:THREE.Vector3,side:THREE.Vector3,dir:THREE.Vector3,lean:number,count:number,size:number,width:number,gap:number,at:number,life:number){
  this.axis.copy(side).multiplyScalar(Math.cos(lean)).addScaledVector(UP,Math.sin(lean)).normalize();this.across.crossVectors(this.axis,dir).normalize();
  for(let i=0;i<count;i++){const k=i-(count-1)/2;this.marks.add(this.c.copy(point).addScaledVector(this.across,k*gap),this.axis,undefined,size*(1-Math.abs(k)*.08),width,CERO,at+i*.012,life);}
 }
 private cancel(id:string,targetToo=false){for(const h of this.impacts)if(h.actor===id)h.actor='';for(const f of this.finales)if(f.actor===id||targetToo&&f.target===id&&!f.hit)f.actor='';}
 update(time:number,fighters:ReadonlyMap<string,Fighter>,flights:ReadonlyMap<string,Flight>){
  if(this.disposed)return;for(const b of this.batches){b.begin();b.mesh.material.uniforms.clock.value=time;}const detail=this.kit.budget>=.65,st=this.stage.open(time);
  for(const f of fighters.values()){
   const s=f.state;if(!isGrimmjowPantera(s.fighter)||!s.alive)continue;const age=s.actionTime*s.actionDuration;
   if(s.action==='awaken'){this.awaken(f,age,detail);continue;}if(s.whiffedAt!==undefined)continue;
   if(s.action==='ultimate'&&!s.branch&&s.confirmedAt!==undefined&&age>=.57&&age<.9)this.awaken(f,.657+(age-.57)*.7,detail);
   this.pose(f,time,age);
   if((s.action==='special'&&!s.branch||s.branch==='llls')&&s.actionTime>.18&&s.actionTime<.65&&this.socket(f,'RightHand',this.a)){
    const charge=clamp((s.actionTime-.18)/.44),size=.035+charge*.13;this.q.identity();this.cores.add(this.a,this.q,size,size,size,CYAN,.65);this.cores.add(this.a,this.q,size*.48,size*.48,size*.48,WHITE,.92);
    for(let i=0;i<(detail?3:2);i++){this.dir.set(Math.sin(i*2.1+time*2),Math.cos(i*2.1),Math.sin(time+i)).normalize();this.q.setFromUnitVectors(Z,this.dir);this.rings.add(this.a,this.q,size*(1.15+i*.15),size*(1.15+i*.15),size, i%2?WHITE:BLUE,.8);}
   }
  }
  for(const flight of flights.values()){
   if(!isGrimmjowPantera(flight.fighter)||flight.slot!=='special'||flight.branch||!flight.released||!flight.actorId)continue;
   let beam=this.beams.find(b=>b.live&&b.actor===flight.actorId);
   if(!beam){beam=this.beams.find(b=>!b.live)??this.beams[0];beam.actor=flight.actorId;beam.live=true;beam.born=time;const thrower=fighters.get(flight.actorId);if(flight.origin)beam.origin.copy(flight.origin);else if(thrower&&this.socket(thrower,'RightHand',this.a))beam.origin.copy(this.a);else beam.origin.copy(flight.position).addScaledVector(flight.heading,-1);}
   beam.head.copy(flight.position);beam.seen=time;
  }
  for(const beam of this.beams){
   if(!beam.live)continue;const gone=time-beam.seen;
   if(gone>CERO_LINGER||gone<-.5||!fighters.get(beam.actor)?.state.alive){beam.live=false;continue;}
   const span=beam.origin.distanceTo(beam.head);if(span<.4)continue;
   st.beam(beam.origin,beam.head,.5,CERO,gone<=0?Math.min(.5,.1+(time-beam.born)*2):.5+.5*gone/CERO_LINGER,beam.born*7,gone>0?1:.4);
  }
  for(const flight of flights.values()){
   if(!isGrimmjowPantera(flight.fighter)||flight.slot!=='special'||flight.branch||!flight.released||armoryDraws(flight.fighter,'special',undefined,flight.actorId))continue;this.q.setFromUnitVectors(UP,flight.heading);this.p.copy(flight.position).addScaledVector(flight.heading,.15);this.cores.add(this.p,this.q,.20,.55,.20,CYAN,.75);this.cores.add(this.p,this.q,.085,.6,.085,WHITE,.95);
   this.q.setFromUnitVectors(Z,flight.heading);for(let i=0;i<(detail?4:2);i++){this.p.copy(flight.position).addScaledVector(flight.heading,-i*.2);const r=.24-i*.035;this.rings.add(this.p,this.q,r,r,r,i%2?WHITE:BLUE,.74-i*.1);}
   this.q.setFromUnitVectors(UP,flight.heading);for(let i=0;i<(detail?7:3);i++){const t=i*2.399+time*5;this.p.copy(flight.position).addScaledVector(flight.heading,-.1-i*.1);this.p.x+=Math.cos(t)*.17;this.p.y+=Math.sin(t)*.17;this.sparks.add(this.p,this.q,.016,.19,.016,CYAN,.75-i*.065);}
  }
  for(const fin of this.finales){
   if(!fin.actor)continue;const f=fighters.get(fin.actor),victim=fighters.get(fin.target),s=f?.state;if(!f||!s?.alive||!victim?.state.alive&&!fin.hit||s.action!=='ultimate'||s.branch||(s.actionSeq??-1)!==fin.seq||s.whiffedAt!==undefined){fin.actor='';continue;}const age=s.actionTime*s.actionDuration;if(age>3.25){fin.actor='';continue;}if(age<1.4)continue;if(victim?.state.alive)bodyCentre(victim,fin.point);
   this.forward.set(Math.sin(s.yaw),0,Math.cos(s.yaw));this.side.crossVectors(UP,this.forward).normalize();const extension=clamp((age-2.24)/.40),fade=age<2.65?1:1-clamp((age-2.65)/.60),gather=clamp((age-1.4)/.45);
   for(let side=0;side<2;side++){
    const prefix=side?'Left':'Right';if(!this.socket(f,prefix+'Hand',this.a))continue;
    for(let finger=0;finger<5;finger++){
     const digit=DIGITS[finger];if(!this.socket(f,prefix+'Hand'+digit+'3',this.fingerStart))this.fingerStart.copy(this.a);
     const flank=side?-1:1,spread=flank*(.62+finger*.16);this.b.copy(fin.point).addScaledVector(this.forward,.55).addScaledVector(this.side,spread);this.b.y+=.20+(2-finger)*.22;
     this.dir.subVectors(this.b,this.fingerStart);const distance=this.dir.length();if(distance<.01)continue;this.dir.multiplyScalar(1/distance);
     this.p.copy(UP).multiplyScalar(.95+(2-finger)*.14).addScaledVector(this.side,flank*(.28+finger*.13)).addScaledVector(this.forward,.18).normalize();this.dir.lerp(this.p,1-extension).normalize();this.q.setFromUnitVectors(UP,this.dir);
     const length=(1.32+extension*(Math.min(distance,6)+.65-1.32))*gather;this.p.copy(this.fingerStart).addScaledVector(this.dir,length*.5);this.claws.add(this.p,this.q,.52+extension*.16,length,1,finger%2?HOT_WHITE:HOT_CYAN,fade*.90);
     const reach=length*(1.7+.5*extension);this.b.copy(this.fingerStart).addScaledVector(this.dir,reach);jag(st,this.fingerStart,this.b,.1,CERO.main,fade*.9,finger,0,3);
     this.b.copy(this.fingerStart).addScaledVector(this.dir,reach);jag(st,this.fingerStart,this.b,.034,CERO.core,fade*1.5,finger,0,3);
    }
   }
  }
  for(const h of this.impacts){if(!h.actor)continue;const age=time-h.born,s=fighters.get(h.actor)?.state,life=h.grade===3?.55:.3;if(!s?.alive||(s.actionSeq??-1)!==h.seq||s.whiffedAt!==undefined||age>=life){h.actor='';continue;}if(age<0)continue;const fade=1-age/life;
   for(let i=0;i<(detail?5:3)*h.grade;i++){const t=i*2.399+h.seed*.21;this.dir.set(Math.sin(t),.25+(i%3)*.30,Math.cos(t)).normalize();this.p.copy(h.point).addScaledVector(this.dir,age*(2+h.grade));this.q.setFromUnitVectors(UP,this.dir);this.sparks.add(this.p,this.q,.015*h.grade*fade,.18*h.grade*fade,.015*h.grade*fade,h.energy?CYAN:WHITE,fade);}
   if(h.energy){this.p.copy(h.point);this.q.identity();const r=.12+h.grade*.11+age*1.2;this.rings.add(this.p,this.q,r,r,1,CYAN,fade*.8);this.roll.setFromAxisAngle(UP,Math.PI/2);this.rings.add(this.p,this.roll,r,r,1,WHITE,fade*.65);}
  }
  this.book.each(fighters,GRIMMJOW_PANTERA_BEATS.end,this.gather);
  this.marks.draw(st,time);this.gouges.draw(st,time);
  for(const b of this.batches)b.end();st.close();
 }
 private pose(f:Fighter,time:number,elapsed:number){
  const st=this.stage,s=f.state;if(s.action!=='light'&&s.action!=='heavy'&&s.action!=='special'&&s.action!=='ultimate')return;
  const seed=(s.actionSeq??0)*4.7,yaw=s.yaw??f.group.rotation.y,heading=this.heading.set(Math.sin(yaw),0,Math.cos(yaw)),strike=this.c;this.side.set(heading.z,0,-heading.x);
  if(typeof f.strikePoint==='function')f.strikePoint(strike);else if(!this.socket(f,'RightHand',strike))strike.copy(f.group.position).setY(f.group.position.y+1.2);
  if(s.action==='light'){
   const k=Math.sin(clamp(s.actionTime)*Math.PI);
   for(let i=-1;i<=1;i++){this.a.copy(strike).addScaledVector(this.side,i*.09);this.b.copy(this.a).addScaledVector(heading,-.5*k);this.b.y+=.1+i*.06;st.streak(this.a,this.b,.04,CERO.main,.9*k);st.streak(this.a,this.b,.014,CERO.core,1.4*k);}
   st.glow(strike,.26,CERO.main,.5*k);st.light(strike,1.9,CERO,.2*k);return;
  }
  if(s.action==='heavy'||s.action==='ultimate'&&!s.branch&&s.confirmedAt===undefined&&elapsed<ULT.contacts[0]+.12){
   const contact=s.action==='ultimate'?ULT.contacts[0]:s.branch?s.actionDuration*.5:HEAVY.contacts[0];
   if(elapsed<contact){
    const k=clamp(elapsed/contact);st.charge(strike,CERO,.22,k,seed);
    for(let i=-2;i<=2;i++){this.b.copy(strike).addScaledVector(this.side,i*.17*(.4+.6*k)).addScaledVector(heading,.08);this.b.y+=(.35+.5*k)*(1-Math.abs(i)*.12);st.streak(strike,this.b,.05,CERO.main,.5+.5*k);st.streak(strike,this.b,.018,CERO.core,.8+.7*k);}
   }else if(s.action==='heavy'&&elapsed<contact+.2){
    const k=1-(elapsed-contact)/.2;
    for(let i=-2;i<=2;i++){this.a.copy(f.group.position).addScaledVector(this.side,i*.2);this.a.y+=1;arc(st,this.a,heading,UP,1.65-Math.abs(i)*.08,-.7,1.15,.07,CERO.main,.9*k);if(i%2===0)arc(st,this.a,heading,UP,1.65-Math.abs(i)*.08,-.7,1.15,.025,CERO.core,1.5*k);}
    st.light(this.a.copy(f.group.position).addScaledVector(heading,1.3).setY(f.group.position.y+1.3),3.8,CERO,.4*k);
   }
   return;
  }
  if(s.action==='special'){
   const release=s.branch?s.actionDuration*.5:SPECIAL.contacts[0];if(elapsed>=release)return;
   const k=clamp(elapsed/release);if(!this.socket(f,'RightHand',this.a))this.a.copy(strike);
   st.charge(this.a,CERO,.38,k,seed);
   if(!s.branch){st.ball(this.a,.1+.3*k*k,CERO,seed);st.disc(this.p.copy(f.group.position),2.2+1.8*k,CERO.main,.55*k,SHEEN,1);st.light(this.p.copy(f.group.position).setY(f.group.position.y+.5),3.4+2*k,CERO,.36*k);}
  }
 }
 private readonly gather=(actor:Fighter,g:Gather,elapsed:number)=>{
  const B=GRIMMJOW_PANTERA_BEATS;if(elapsed>=B.rake+.1)return;
  const st=this.stage,build=clamp((elapsed-B.opener)/(B.rake-B.opener)),rise=clamp((elapsed-B.opener)/.35),seed=g.seq*3.3,feet=this.c.copy(actor.group.position).setY(g.floor);
  st.dim(.3+.45*build,g.actor,g.target);
  flare(st,feet,1.5+.4*build,(1.8+3*build)*rise,CERO,.5+.5*build,seed,9,.1);
  st.pool(this.p.copy(feet),2.4+2.8*build,CERO,.3+.7*build,seed);
  if(actor.handR&&actor.handL&&elapsed<B.rake){st.charge(actor.handR,CERO,.26+.2*build,Math.max(.35*rise,build),seed);st.charge(actor.handL,CERO,.26+.2*build,Math.max(.35*rise,build),seed+1);}
  if(build>.75)st.speed(.5*(build-.75)/.25,g.actor,g.target);
 };
 private awaken(f:Fighter,age:number,detail:boolean){const release=.657,before=age<release,u=before?clamp(age/release):clamp((age-release)/.243),fade=before?.65:1-u;this.p.copy(f.group.position);this.p.y+=.035;const r=before?1.0-u*.65:.35+u*1.95;this.rings.add(this.p,this.flat,r,r,1,CYAN,fade*.8);if(detail)this.rings.add(this.p,this.flat,r*.82,r*.82,1,WHITE,fade*.65);
  for(let i=0;i<(detail?12:6);i++){const theta=i*2.399+age*1.5,rad=before?.56*(1-u*.5):.28+u*1.15;this.p.copy(f.group.position);this.p.x+=Math.sin(theta)*rad;this.p.z+=Math.cos(theta)*rad;this.p.y+=.25+(i%4)*.32;this.dir.set(Math.sin(theta)*.25,1,Math.cos(theta)*.25).normalize();this.q.setFromUnitVectors(UP,this.dir);this.sparks.add(this.p,this.q,.017,.30,.017,i%2?CYAN:WHITE,fade*.75);}
 }
 reset(){for(const h of this.impacts)h.actor='';for(const f of this.finales)f.actor='';this.seen.fill(-1);this.seenAt.fill(-1);this.seenCursor=this.hitCursor=this.finaleCursor=0;for(const b of this.batches){b.begin();b.end();}for(const b of this.beams)b.live=false;this.book.reset();this.marks.reset();this.gouges.reset();this.stage.reset();}
 dispose(){if(this.disposed)return;this.reset();this.disposed=true;for(const b of this.batches)b.dispose();this.stage.release();}
}
