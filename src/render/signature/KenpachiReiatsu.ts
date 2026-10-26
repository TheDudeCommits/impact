import * as THREE from 'three';
import type { CombatEvent } from '../../game/types';
import { KENPACHI_MOVES } from '../../game/fighters/kenpachi';
import type { Fighter } from '../Fighter';
import type { VfxKit } from '../vfx/VfxKit';
import { SIGNATURE,involvesLocal } from './context';
import { MoveStage, stageLook } from './MoveStage';
import { CastBook, Cuts, Rifts, arc, flare, jag, type Gather } from './StageCraft';
export const isKenpachiReiatsu=(id:string|undefined)=>id==='kenpachi';
export const KENPACHI_REIATSU_LIMITS=Object.freeze({strokes:192,arcs:64,sparks:128,skulls:16,hits:24,trails:16});
const UP=new THREE.Vector3(0,1,0),X=new THREE.Vector3(1,0,0),Z=new THREE.Vector3(0,0,1),GOLD=new THREE.Color(0xffbd27),PALE=new THREE.Color(0xffedba),INK=new THREE.Color(0x23170b),WHITE=new THREE.Color(0xffffff);
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const REIATSU = stageLook(0xfffbe0, 0xffd62a, 0x2a2008), SKULL = new THREE.Color(1.7, 1.45, .8);
const HEAVY = KENPACHI_MOVES.heavy, SPECIAL = KENPACHI_MOVES.special, ULT = KENPACHI_MOVES.ultimate;
export const KENPACHI_REIATSU_BEATS = Object.freeze({ opener: ULT.contacts[0], cut: ULT.contacts[1], end: ULT.duration });
class ReiatsuBatch{
 readonly mesh:THREE.InstancedMesh<THREE.BufferGeometry,THREE.ShaderMaterial>;private count=0;private tint:THREE.InstancedBufferAttribute;private pose=new THREE.Object3D();
 constructor(scene:THREE.Scene,name:string,geometry:THREE.BufferGeometry,private cap:number,sprite=false){
  this.tint=new THREE.InstancedBufferAttribute(new Float32Array(cap*4),4).setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('reiatsuTint',this.tint);
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,uniforms:{map:{value:null},ready:{value:0}},vertexShader:'attribute vec4 reiatsuTint;varying vec4 vTint;void main(){vTint=reiatsuTint;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',fragmentShader:'varying vec4 vTint;void main(){if(vTint.a<.01)discard;gl_FragColor=vTint;}'});
  if(sprite){material.vertexShader='attribute vec4 reiatsuTint;varying vec4 vTint;varying vec2 vUv;void main(){vTint=reiatsuTint;vUv=uv;vec4 p=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);p.xy+=position.xy*vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));gl_Position=projectionMatrix*p;}';material.fragmentShader='uniform sampler2D map;uniform float ready;varying vec4 vTint;varying vec2 vUv;void main(){if(ready<.5)discard;vec4 c=texture2D(map,vUv);float a=c.a*vTint.a;if(a<.02)discard;gl_FragColor=vec4(c.rgb*vTint.rgb,a);}';}
  material.forceSinglePass=true;this.mesh=new THREE.InstancedMesh(geometry,material,cap);this.mesh.name='kenpachi-'+name;this.mesh.count=0;this.mesh.frustumCulled=false;this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);if(sprite)this.mesh.renderOrder=6;scene.add(this.mesh);
 }
 begin(){this.count=0;}
 add(p:THREE.Vector3,q:THREE.Quaternion,x:number,y:number,z:number,color:THREE.Color,alpha:number){if(this.count>=this.cap||alpha<.01||Math.min(x,y,z)<=0)return;this.pose.position.copy(p);this.pose.quaternion.copy(q);this.pose.scale.set(x,y,z);this.pose.updateMatrix();this.mesh.setMatrixAt(this.count,this.pose.matrix);this.tint.setXYZW(this.count++,color.r,color.g,color.b,clamp(alpha));}
 end(){this.mesh.count=this.count;this.mesh.instanceMatrix.needsUpdate=true;this.tint.needsUpdate=true;}
 dispose(){this.mesh.removeFromParent();this.mesh.dispose();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
type Hit={actor:string;seq:number;point:THREE.Vector3;born:number;grade:number;yaw:number;seed:number};type Trail={actor:string;seq:number;seen:number;tip:THREE.Vector3};
export class KenpachiReiatsu{
 private strokes:ReiatsuBatch;private arcs:ReiatsuBatch;private sparks:ReiatsuBatch;private skulls:ReiatsuBatch;private batches:ReiatsuBatch[];private disposed=false;private texture?:THREE.Texture;private loading?:Promise<void>;
 private hits:Hit[]=Array.from({length:KENPACHI_REIATSU_LIMITS.hits},()=>({actor:'',seq:-1,point:new THREE.Vector3(),born:0,grade:0,yaw:0,seed:0}));private trails:Trail[]=Array.from({length:KENPACHI_REIATSU_LIMITS.trails},()=>({actor:'',seq:-1,seen:-1e9,tip:new THREE.Vector3()}));private hc=0;private sc=0;private seen=new Float64Array(128).fill(-1);private seenAt=new Float64Array(128).fill(-1);
 private a=new THREE.Vector3();private b=new THREE.Vector3();private p=new THREE.Vector3();private d=new THREE.Vector3();private q=new THREE.Quaternion();private spin=new THREE.Quaternion();private flat=new THREE.Quaternion().setFromAxisAngle(X,-Math.PI/2);
 private readonly stage:MoveStage;private readonly book=new CastBook('kenpachi',ULT.contacts.length);private readonly cuts=new Cuts(12,REIATSU);private readonly rifts=new Rifts(6,REIATSU);
 private m=new THREE.Vector3();private heading=new THREE.Vector3();private side=new THREE.Vector3();private axis=new THREE.Vector3();private c=new THREE.Vector3();
 constructor(scene:THREE.Scene,private kit:Pick<VfxKit,'budget'>&Partial<VfxKit>){this.stage=MoveStage.for(scene,kit);this.strokes=new ReiatsuBatch(scene,'blade-wakes',new THREE.CylinderGeometry(.35,.6,1,5,1,true),KENPACHI_REIATSU_LIMITS.strokes);this.arcs=new ReiatsuBatch(scene,'pressure-cuts',new THREE.RingGeometry(.91,1,32,1,.14,Math.PI*1.16),KENPACHI_REIATSU_LIMITS.arcs);this.sparks=new ReiatsuBatch(scene,'sparks',new THREE.ConeGeometry(1,1,4),KENPACHI_REIATSU_LIMITS.sparks);this.skulls=new ReiatsuBatch(scene,'skull-pressure',new THREE.PlaneGeometry(1,1),KENPACHI_REIATSU_LIMITS.skulls,true);this.batches=[this.strokes,this.arcs,this.sparks,this.skulls];}
 load(ids:readonly string[]):Promise<void>{if(this.disposed||!ids.includes('kenpachi'))return Promise.resolve();return this.loading??=new THREE.TextureLoader().loadAsync('/assets/vfx/kenpachi-reiatsu-skull.webp').then(t=>{if(this.disposed){t.dispose();return;}t.colorSpace=THREE.SRGBColorSpace;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;this.texture=t;this.skulls.mesh.material.uniforms.map.value=t;this.skulls.mesh.material.uniforms.ready.value=1;}).catch(e=>{this.loading=undefined;throw e;});}
 handle(e:CombatEvent,fighters?:ReadonlyMap<string,Fighter>){
  if(this.disposed)return;
  this.staged(e,fighters);
  if(e.kind==='eliminated'||e.kind==='respawn'||e.kind==='whiff'||e.kind==='rejected'){for(const h of this.hits)if(h.actor===e.actorId)h.actor='';for(const t of this.trails)if(t.actor===e.actorId)t.actor='';return;}
  if(!isKenpachiReiatsu(e.fighter)||e.kind!=='hit'||!e.endpoint)return;const f=fighters?.get(e.actorId);if(!f?.state.alive)return;for(let i=0;i<this.seen.length;i++)if(this.seen[i]===e.id&&this.seenAt[i]===e.serverTime)return;const n=this.sc++%128;this.seen[n]=e.id;this.seenAt[n]=e.serverTime;
  const h=this.hits[this.hc++%this.hits.length];Object.assign(h,{actor:e.actorId,seq:e.actionSeq??f.state.actionSeq??-1,born:e.serverTime,grade:e.slot==='ultimate'&&!e.branch&&(e.contactIndex??0)===1?3:e.slot==='heavy'||e.slot==='special'?2:1,yaw:f.state.yaw,seed:e.id});h.point.set(e.endpoint.x,e.endpoint.y,e.endpoint.z);if(h.grade===3&&involvesLocal(e.actorId,e.targetId))SIGNATURE.screen?.impactFrame?.(.56,h.point);
 }
 private staged(e:CombatEvent,fighters?:ReadonlyMap<string,Fighter>){
  const blow=this.book.take(e,fighters);if(!blow)return;
  const st=this.stage,{point,ground,dir,side,floor,t}=blow,tilt=e.id%2?1:-1;
  const slash=(lean:number,size:number,width:number,at:number,life:number)=>this.cuts.add(point,this.axis.copy(side).multiplyScalar(Math.cos(lean)).addScaledVector(UP,Math.sin(lean)*tilt).normalize(),undefined,size,width,REIATSU,at,life);
  if(e.slot==='light'){st.burst(point,REIATSU,.4,t,{dir,floor,clean:true});slash(.5,.8,.06,t,.2);return;}
  if(e.slot==='heavy'){
   st.burst(point,REIATSU,e.branch?.8:.9,t,{dir,floor});slash(.35,1.7,.13,t,.3);
   this.rifts.add(this.c.copy(ground).addScaledVector(dir,.4),dir,e.branch?2.6:3.8,REIATSU,t,1.5,1.1);
   return;
  }
  if(e.slot==='special'){
   if(e.branch==='airSpecial'){st.burst(point,REIATSU,2.1,t,{floor});st.shock(ground,REIATSU,3.6,t,.45);st.scar(ground,REIATSU,2.4,t+.05,2);for(let i=0;i<3;i++){const ang=i*2.094+.6;this.rifts.add(ground,this.axis.set(Math.cos(ang),0,Math.sin(ang)),3.2,REIATSU,t+i*.03,1.5,1);}return;}
   const big=e.branch?.8:1;
   st.burst(point,REIATSU,2*big,t,{dir,floor});slash(.4,2.3*big,.17,t,.42);slash(-.75,1.6*big,.12,t+.06,.36);
   st.shock(ground,REIATSU,4.6*big,t,.45);
   this.rifts.add(this.c.copy(ground).addScaledVector(dir,-.8),dir,6.5*big,REIATSU,t,2.1,1.8,.12);
   st.scar(ground,REIATSU,2*big,t+.05,2.2);
   return;
  }
  if(e.slot!=='ultimate'||e.branch)return;
  if(!blow.final){st.burst(point,REIATSU,1.3,t,{dir,floor});slash(.3,1.6,.12,t,.3);return;}
  st.erupt(ground,UP,REIATSU,1.2,13,t,.75);
  this.cuts.add(this.c.copy(point).setY(floor+4.2),UP,undefined,4.6,.3,REIATSU,t,.55);
  this.rifts.add(this.c.copy(ground).addScaledVector(dir,-3.2),dir,15,REIATSU,t,2.5,2.8,.17);
  st.shatter(point,dir,REIATSU,6,t,.8);
  st.burst(point,REIATSU,2.6,t,{dir,floor});
  st.shock(ground,REIATSU,9,t,.6);
  for(let i=1;i<=2;i++)st.erupt(this.c.copy(ground).addScaledVector(dir,i*3.6),UP,REIATSU,.75-i*.12,7.5-i*1.8,t+.08+i*.07,.6);
  st.scar(ground,REIATSU,3.1,t+.2,2.2);
 }
 private joint(f:Fighter,name:string){const shown=f.shownBody??f;return shown.joints?.get(name)??shown.model?.getObjectByName(name);}
 update(time:number,fighters:ReadonlyMap<string,Fighter>){
  if(this.disposed)return;for(const b of this.batches)b.begin();const detail=this.kit.budget>=.65,st=this.stage.open(time);
  for(const f of fighters.values()){
   const s=f.state;if(!isKenpachiReiatsu(s.fighter)||!s.alive||s.whiffedAt!==undefined)continue;const phase=s.actionTime;
   if(s.action==='awaken'&&phase>.35&&phase<.93){const fade=Math.sin(clamp((phase-.35)/.58)*Math.PI),head=this.joint(f,'Head');if(head){head.getWorldPosition(this.p);this.p.y+=.89;this.q.identity();this.skulls.add(this.p,this.q,1.5,1.5,1,WHITE,fade*.86);}this.p.copy(f.group.position);this.p.y+=.045;for(let i=0;i<(detail?3:2);i++){const r=.6+phase*.75+i*.18;this.arcs.add(this.p,this.flat,r,r,1,i===0?INK:GOLD,fade*(.66-i*.13));}for(let i=0;i<(detail?14:7);i++){const angle=i*2.399+phase*3,r=.35+(i%3)*.14;this.p.copy(f.group.position);this.p.x+=Math.sin(angle)*r;this.p.z+=Math.cos(angle)*r;this.p.y+=.2+((phase*2+i*.137)%1)*1.8;this.q.identity();this.sparks.add(this.p,this.q,.024,.18,.024,i%3?GOLD:PALE,fade*.75);}continue;}
   const allowed=(s.action==='light'||s.action==='heavy'||s.action==='special'||s.action==='ultimate')&&(s.action!=='ultimate'||s.confirmedAt!==undefined||phase<.30);if(!allowed)continue;const joint=this.joint(f,'Sword');
   const yaw=s.yaw??f.group.rotation.y,heading=this.heading.set(Math.sin(yaw),0,Math.cos(yaw));
   if(joint){this.a.set(.122843742,-.000042491,.034716472).applyMatrix4(joint.matrixWorld);this.b.set(1.599313259,.048008710,.451476395).applyMatrix4(joint.matrixWorld);}
   else if(f.handR){this.a.copy(f.handR);this.b.copy(f.handR).addScaledVector(heading,1.45);this.b.y+=.12;}else continue;
   const fade=Math.sin(Math.PI*clamp(phase)),gold=s.action==='heavy'||s.action==='special'||s.action==='ultimate';
   if(joint){this.segment(this.a,this.b,gold?.027:.016,gold?PALE:WHITE,.30+.42*fade);
   let trail=this.trails.find(t=>t.actor===s.id);if(!trail)trail=this.trails.find(t=>!t.actor||time-t.seen>.25);if(trail){const seq=s.actionSeq??-1;if(trail.actor===s.id&&trail.seq===seq&&time>=trail.seen&&time-trail.seen<.08&&trail.tip.distanceToSquared(this.b)<2.2){const distance=trail.tip.distanceTo(this.b);if(distance>.02)this.segment(trail.tip,this.b,detail?.075:.035,gold?GOLD:PALE,Math.min(.75,distance*3));}trail.actor=s.id;trail.seq=seq;trail.seen=time;trail.tip.copy(this.b);}}
   if(s.action==='ultimate'&&s.confirmedAt!==undefined&&phase>.3&&phase<.76){const head=this.joint(f,'Head');if(head){const k=Math.sin((phase-.3)/.46*Math.PI),size=2.4+1.6*(phase-.3)/.46;head.getWorldPosition(this.p);this.p.y+=.6+size*.5;this.q.identity();this.skulls.add(this.p,this.q,size,size,1,SKULL,k*.8);}}
   this.pose(f,time,s.actionTime*s.actionDuration,heading);
  }
  for(const t of this.trails)if(time-t.seen>.25)t.actor='';
  for(const h of this.hits){if(!h.actor)continue;const age=time-h.born,s=fighters.get(h.actor)?.state,life=h.grade===3?.48:.28;if(!s?.alive||s.whiffedAt!==undefined||(s.actionSeq??-1)!==h.seq||age>=life){h.actor='';continue;}if(age<0)continue;const fade=1-age/life;this.q.setFromAxisAngle(UP,h.yaw);this.spin.setFromAxisAngle(Z,h.grade===3?0:(h.seed%2?-.6:.6));this.q.multiply(this.spin);const size=.32+h.grade*.18+age*2.0;this.arcs.add(h.point,this.q,size*.7,size*1.6,1,INK,fade);this.arcs.add(h.point,this.q,size*.65,size*1.5,1,GOLD,fade*.94);
   if(h.grade===3){this.a.copy(h.point);this.a.y+=1.45;this.b.copy(h.point);this.b.y-=.8;this.segment(this.a,this.b,.095*fade,PALE,fade*.9);this.p.copy(h.point);this.p.y=Math.max(.035,this.p.y-1.0);this.arcs.add(this.p,this.flat,.8+age*3.3,.8+age*3.3,1,GOLD,fade*.72);}
   for(let i=0;i<(detail?6:3)*h.grade;i++){const theta=i*2.399+h.seed*.19;this.d.set(Math.sin(theta),.20+(i%4)*.14,Math.cos(theta)).normalize();this.p.copy(h.point).addScaledVector(this.d,age*(2+h.grade));this.q.setFromUnitVectors(UP,this.d);this.sparks.add(this.p,this.q,.020*h.grade*fade,.17*h.grade*fade,.020*h.grade*fade,i%3?GOLD:PALE,fade);}
  }
  this.book.each(fighters,KENPACHI_REIATSU_BEATS.end,this.gather);
  this.cuts.draw(st,time);this.rifts.draw(st,time);
  for(const b of this.batches)b.end();st.close();
 }
 private pose(f:Fighter,time:number,elapsed:number,heading:THREE.Vector3){
  const st=this.stage,s=f.state,seed=(s.actionSeq??0)*6.1+Math.floor(time*14),mid=this.m.copy(this.a).lerp(this.b,.55),feet=f.group.position;
  if(s.action==='light'){const k=Math.sin(clamp(s.actionTime)*Math.PI);this.lit(k,1);st.glow(this.b,.3,REIATSU.main,.5*k);st.light(mid,1.9,REIATSU,.2*k);return;}
  if(s.action==='heavy'){
   const contact=s.branch?s.actionDuration*.5:HEAVY.contacts[0];
   if(elapsed<contact){const k=clamp(elapsed/contact);this.lit(.6+.4*k,1.2);this.torn(k,.55+.6*k,seed,heading);st.charge(mid,REIATSU,.24,k,seed);}
   else if(elapsed<contact+.2)this.sweep(feet,heading,2.1,.16,1-(elapsed-contact)/.2);
   return;
  }
  if(s.action==='special'){
   const release=s.branch?s.actionDuration*.5:SPECIAL.contacts[0];
   if(elapsed<release){
    const k=clamp(elapsed/release);
    this.lit(.6+.4*k,1.3);this.torn(k,.7+.8*k,seed,heading);
    if(!s.branch){flare(st,feet,1.3+.25*k,1.5+2.6*k,REIATSU,.5+.5*k,(s.actionSeq??0)*6.1,9,.1);st.pool(this.p.copy(feet),2.1+1.7*k,REIATSU,k,(s.actionSeq??0)*6.1);}
    st.charge(mid,REIATSU,.34,k,seed);
   }else if(elapsed<release+.24)this.sweep(feet,heading,s.branch?2.2:2.9,.22,1-(elapsed-release)/.24);
   return;
  }
  if(s.action==='ultimate'&&!s.branch&&s.confirmedAt===undefined&&elapsed<ULT.contacts[0]+.12){const k=clamp(elapsed/ULT.contacts[0]);this.lit(.6+.4*k,1.2);this.torn(k,.5+.6*k,seed,heading);st.charge(mid,REIATSU,.3,k,seed);}
 }
 private lit(k:number,wide:number){this.stage.streak(this.a,this.b,.085*wide,REIATSU.main,.5*k);this.stage.streak(this.a,this.b,.028*wide,REIATSU.core,1.15*k);}
 private torn(k:number,reach:number,seed:number,heading:THREE.Vector3){for(let i=0;i<3;i++){this.p.copy(this.a).lerp(this.b,.3+.3*i);this.d.copy(this.p).addScaledVector(heading,-.25*reach);this.d.y+=reach*(.7+.3*i);jag(this.stage,this.p,this.d,.07,REIATSU.main,k,seed+i*7,.2,3);}}
 private sweep(feet:THREE.Vector3,heading:THREE.Vector3,radius:number,width:number,k:number){
  const st=this.stage;this.side.set(heading.z,0,-heading.x);this.c.copy(feet);this.c.y+=1.25;
  arc(st,this.c,heading,this.side,radius,-1.15,1.15,width,REIATSU.main,.9*k);arc(st,this.c,heading,this.side,radius,-1.15,1.15,width*.36,REIATSU.core,1.6*k);
  st.light(this.p.copy(this.c).addScaledVector(heading,radius*.7),radius*1.5+1.5,REIATSU,.4*k);
 }
 private readonly gather=(actor:Fighter,g:Gather,elapsed:number)=>{
  const B=KENPACHI_REIATSU_BEATS;if(elapsed>=B.cut)return;
  const st=this.stage,build=clamp((elapsed-B.opener)/(B.cut-B.opener)),rise=clamp((elapsed-B.opener)/.35),seed=g.seq*4.3,feet=this.c.copy(actor.group.position).setY(g.floor);
  st.dim(.3+.45*build,g.actor,g.target);
  flare(st,feet,1.55+.5*build,(2+3.8*build)*rise,REIATSU,.55+.45*build,seed,10,.12);
  st.pool(this.p.copy(feet),2.6+3*build,REIATSU,.3+.7*build,seed);
  const hands=this.m.copy(actor.handR??feet),head=this.joint(actor,'Head'),top=this.d;if(actor.handL)hands.lerp(actor.handL,.5);top.copy(hands);
  if(head){head.getWorldPosition(this.p);top.y=Math.max(top.y,this.p.y+.35);}else top.y=Math.max(top.y,g.floor+2.5);
  st.column(top,UP,.34+.3*build,(2.5+7.5*build)*rise,REIATSU,.55+.45*build,seed);
  st.charge(hands,REIATSU,.36+.3*build,Math.max(.4*rise,build),seed);
  if(build>.7)st.speed(.5*(build-.7)/.3,g.actor,g.target);
 };
 private segment(a:THREE.Vector3,b:THREE.Vector3,w:number,color:THREE.Color,alpha:number){const length=a.distanceTo(b);if(length<1e-5)return;this.p.copy(a).add(b).multiplyScalar(.5);this.d.subVectors(b,a).normalize();this.q.setFromUnitVectors(UP,this.d);this.strokes.add(this.p,this.q,w,length,w,color,alpha);}
 reset(){for(const h of this.hits)h.actor='';for(const t of this.trails)t.actor='';this.seen.fill(-1);this.seenAt.fill(-1);this.hc=this.sc=0;for(const b of this.batches){b.begin();b.end();}this.book.reset();this.cuts.reset();this.rifts.reset();this.stage.reset();}
 dispose(){if(this.disposed)return;this.reset();this.disposed=true;for(const b of this.batches)b.dispose();this.texture?.dispose();this.texture=undefined;this.stage.release();}
}
