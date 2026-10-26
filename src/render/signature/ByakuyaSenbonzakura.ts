import * as THREE from 'three';
import type {CombatEvent} from '../../game/types';
import type {Fighter} from '../Fighter';
import type {Flight} from '../CombatEffects';
import {bodyCentre,type VfxKit} from '../vfx/VfxKit';
import {BYAKUYA_MOVES} from '../../game/fighters/byakuya';
import {SIGNATURE,involvesLocal} from './context';
import {MoveStage,SHEEN,stageLook} from './MoveStage';
import {CastBook,Cuts,arc,hash,jag,type Gather} from './StageCraft';
export const isByakuyaSenbonzakura=(id:string|undefined)=>id==='byakuya';
export const BYAKUYA_PETAL_LIMITS=Object.freeze({petals:512,blades:128,rings:32,impacts:24});
const UP=new THREE.Vector3(0,1,0),FORWARD=new THREE.Vector3(0,0,1),PINK=new THREE.Color(0xf794ca),PALE=new THREE.Color(0xffdbea),WHITE=new THREE.Color(0xf5f6ff);
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const PETAL=stageLook(0xfff5fa,0xff8db5,0xa8325e),HAKUTEI=stageLook(0xffffff,0xffe9f3,0xe0b8cc);
const HOT=new THREE.Color(2.2,.62,1.12),HOT_PALE=new THREE.Color(2.4,1.45,1.8),HOT_WHITE=new THREE.Color(2.5,2.4,2.6);
const HEAVY=BYAKUYA_MOVES.heavy,SPECIAL=BYAKUYA_MOVES.special,ULT=BYAKUYA_MOVES.ultimate;
export const BYAKUYA_SENBONZAKURA_BEATS=Object.freeze({opener:ULT.contacts[0],close:ULT.contacts[1],final:ULT.contacts[2],end:ULT.duration});
const SCATTER=0,VORTEX=1;
type Flurry={kind:number;at:THREE.Vector3;born:number;life:number;reach:number;count:number;seed:number;white:boolean;live:boolean};
const manual=(action:string)=>action==='light'||action==='heavy'||action==='special'||action==='ultimate';
export const BYAKUYA_BLADE={root:[0,.085,0],tip:[-.05817198056684819,1.0146408727799212,-.11819259418722794]}as const;
export function byakuyaBlade(f:Fighter,root:THREE.Vector3,tip:THREE.Vector3):boolean{
 const body=f.shownBody??f,bone=body.model?.getObjectByName('Sword');if(!bone)return false;
 root.fromArray(BYAKUYA_BLADE.root).applyMatrix4(bone.matrixWorld);tip.fromArray(BYAKUYA_BLADE.tip).applyMatrix4(bone.matrixWorld);return true;
}
function petalGeometry(){
 const shape=new THREE.Shape();shape.moveTo(0,-.5);shape.bezierCurveTo(-.44,-.21,-.47,.24,-.12,.5);shape.quadraticCurveTo(0,.40,.12,.5);shape.bezierCurveTo(.47,.24,.44,-.21,0,-.5);return new THREE.ShapeGeometry(shape,3);
}
class PetalBatch{
 readonly mesh:THREE.InstancedMesh<THREE.BufferGeometry,THREE.ShaderMaterial>;
 private tint:THREE.InstancedBufferAttribute;private object=new THREE.Object3D();private count=0;
 constructor(scene:THREE.Scene,name:string,geometry:THREE.BufferGeometry,private capacity:number){
  this.tint=new THREE.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('petalTint',this.tint);
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide,vertexShader:'attribute vec4 petalTint;varying vec4 vTint;varying vec3 vNormal;void main(){vTint=petalTint;vNormal=normalize(mat3(modelMatrix)*mat3(instanceMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',fragmentShader:'varying vec4 vTint;varying vec3 vNormal;void main(){if(vTint.a<.004)discard;float light=abs(dot(normalize(vNormal),normalize(vec3(-.3,.7,.5))));gl_FragColor=vec4(vTint.rgb*(light>.35?1.:.68),vTint.a);}'});material.forceSinglePass=true;
  this.mesh=new THREE.InstancedMesh(geometry,material,capacity);this.mesh.name='byakuya-'+name;this.mesh.frustumCulled=false;this.mesh.count=0;this.mesh.renderOrder=6;this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(this.mesh);
 }
 begin(){this.count=0;}
 add(p:THREE.Vector3,q:THREE.Quaternion,x:number,y:number,z:number,c:THREE.Color,alpha:number){if(this.count>=this.capacity||alpha<.004||Math.min(x,y,z)<=0)return;this.object.position.copy(p);this.object.quaternion.copy(q);this.object.scale.set(x,y,z);this.object.updateMatrix();this.mesh.setMatrixAt(this.count,this.object.matrix);this.tint.setXYZW(this.count++,c.r,c.g,c.b,clamp(alpha));}
 end(){this.mesh.count=this.count;this.mesh.instanceMatrix.needsUpdate=true;this.tint.needsUpdate=true;}
 dispose(){this.mesh.removeFromParent();this.mesh.dispose();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
type Impact={actor:string;seq:number;born:number;seed:number;grade:number;point:THREE.Vector3};
export class ByakuyaSenbonzakura{
 private petals:PetalBatch;private blades:PetalBatch;private rings:PetalBatch;private batches:PetalBatch[];
 private impacts:Impact[]=Array.from({length:BYAKUYA_PETAL_LIMITS.impacts},()=>({actor:'',seq:-1,born:0,seed:0,grade:0,point:new THREE.Vector3()}));
 private seen=new Float64Array(128).fill(-1);private seenTime=new Float64Array(128).fill(-1);private cursor=0;private seenCursor=0;private disposed=false;
 private p=new THREE.Vector3();private a=new THREE.Vector3();private b=new THREE.Vector3();private d=new THREE.Vector3();private q=new THREE.Quaternion();private q2=new THREE.Quaternion();private flat=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
 private readonly stage:MoveStage;private readonly book=new CastBook('byakuya',ULT.contacts.length);private readonly cuts=new Cuts(16,PETAL);
 private flurries:Flurry[]=Array.from({length:8},()=>({kind:SCATTER,at:new THREE.Vector3(),born:0,life:0,reach:1,count:0,seed:0,white:false,live:false}));private flurryCursor=0;
 private root=new THREE.Vector3();private tip=new THREE.Vector3();private heading=new THREE.Vector3();private side=new THREE.Vector3();private axis=new THREE.Vector3();private c=new THREE.Vector3();private m=new THREE.Vector3();
 constructor(scene:THREE.Scene,private kit:Pick<VfxKit,'budget'>&Partial<VfxKit>){
  this.stage=MoveStage.for(scene,kit);
  this.petals=new PetalBatch(scene,'petal-cloud',petalGeometry(),BYAKUYA_PETAL_LIMITS.petals);
  this.blades=new PetalBatch(scene,'senkei-blades',new THREE.ConeGeometry(.055,1,4,1),BYAKUYA_PETAL_LIMITS.blades);
  this.rings=new PetalBatch(scene,'release-rings',new THREE.RingGeometry(.97,1,40),BYAKUYA_PETAL_LIMITS.rings);this.batches=[this.petals,this.blades,this.rings];
 }
 load(_ids:readonly string[]):Promise<void>{return Promise.resolve();}
 handle(e:CombatEvent,fighters?:ReadonlyMap<string,Fighter>){
  if(this.disposed)return;
  this.staged(e,fighters);
  if(['eliminated','respawn','whiff','rejected'].includes(e.kind)){for(const h of this.impacts)if(h.actor===e.actorId)h.actor='';return;}
  if(!isByakuyaSenbonzakura(e.fighter)||e.kind!=='hit')return;
  for(let i=0;i<this.seen.length;i++)if(this.seen[i]===e.id&&this.seenTime[i]===e.serverTime)return;
  const f=fighters?.get(e.actorId),target=e.targetId?fighters?.get(e.targetId):undefined;if(!f?.state.alive||!e.endpoint&&!target)return;
  const slot=this.seenCursor++%this.seen.length;this.seen[slot]=e.id;this.seenTime[slot]=e.serverTime;
  const hit=this.impacts[this.cursor++%this.impacts.length];hit.actor=e.actorId;hit.seq=e.actionSeq??f.state.actionSeq??-1;hit.born=e.serverTime;hit.seed=e.id;hit.grade=e.slot==='ultimate'&&!e.branch&&e.contactIndex===2?3:e.slot==='heavy'||e.slot==='special'?2:1;
  if(e.endpoint)hit.point.set(e.endpoint.x,e.endpoint.y,e.endpoint.z);else hit.point.copy(target!.group.position).addScaledVector(UP,.9);
  if(hit.grade===3&&involvesLocal(e.actorId,e.targetId))SIGNATURE.screen?.impactFrame?.(.42,hit.point);
 }
 private swirl(center:THREE.Vector3,radius:number,alpha:number,time:number,count:number,white=false,size=1,hot=false){
  for(let i=0;i<count;i++){const theta=i*2.39996+time*.9,h=(i*.618034)%1;this.p.copy(center);this.p.x+=Math.sin(theta)*radius*(.5+h*.5);this.p.z+=Math.cos(theta)*radius*(.5+h*.5);this.p.y+=(h-.5)*radius*.9;this.q.setFromAxisAngle(UP,theta);this.q2.setFromAxisAngle(FORWARD,time*3+i);this.q.multiply(this.q2);const w=(.055+(i%3)*.018)*size;this.petals.add(this.p,this.q,w,w*1.6,1,white?hot?HOT_WHITE:WHITE:i%3?hot?HOT:PINK:hot?HOT_PALE:PALE,alpha);}
 }
 private staged(e:CombatEvent,fighters?:ReadonlyMap<string,Fighter>){
  const blow=this.book.take(e,fighters);if(!blow)return;
  const st=this.stage,{point,ground,dir,side,floor,t}=blow,tilt=e.id%2?1:-1;
  if(e.slot==='light'){st.burst(point,PETAL,.4,t,{dir,floor,clean:true});this.slash(point,side,.5*tilt,.8,.06,t,.2);this.flurry(SCATTER,point,t,.4,.9,14);return;}
  if(e.slot==='heavy'){
   st.burst(point,PETAL,e.branch?.85:1,t,{dir,floor});this.slash(point,side,.7,1.7,.12,t,.34);this.slash(point,side,-.7,1.7,.12,t+.03,.34);
   this.flurry(SCATTER,point,t,.7,2.2,st.n(44,16));
   return;
  }
  if(e.slot==='special'){
   if(e.branch==='airSpecial'){st.burst(point,PETAL,2.1,t,{floor});st.shock(ground,PETAL,3.6,t,.45);st.scar(ground,PETAL,2.2,t+.05,1.8);this.flurry(SCATTER,point,t,.9,3.4,st.n(90,30));return;}
   const big=e.branch?.75:1;
   st.burst(point,PETAL,1.9*big,t,{dir,floor});
   for(let i=0;i<4;i++)this.slash(point,side,(i*1.1-1.6)*tilt,(1.2+.25*i)*big,.1,t+i*.07,.3);
   st.shock(ground,PETAL,4.2*big,t,.45);st.scar(ground,PETAL,1.9*big,t+.05,1.9);
   this.flurry(VORTEX,ground,t,1.15,1.35*big,st.n(120,40));
   return;
  }
  if(e.slot!=='ultimate'||e.branch)return;
  if(!blow.final){
   st.burst(point,PETAL,blow.index?1.5:1.2,t,{dir,floor});this.slash(point,side,.6*tilt,1.6,.12,t,.32);
   if(blow.index){this.slash(point,side,-.6*tilt,1.6,.12,t+.03,.32);st.shock(ground,PETAL,5,t,.5);this.flurry(SCATTER,point,t,.8,3,st.n(70,24));}
   return;
  }
  st.erupt(ground,UP,HAKUTEI,.9,12,t,.7);
  st.dome(point,HAKUTEI,4.4,t,.45);
  st.shatter(point,dir,PETAL,6,t,.8);
  st.burst(point,HAKUTEI,2.1,t,{dir,floor});
  st.shock(ground,PETAL,9,t,.6);
  this.cuts.add(this.c.copy(point),this.axis.copy(side).multiplyScalar(.82).addScaledVector(UP,.57*tilt).normalize(),undefined,4.6,.26,HAKUTEI,t,.5);
  st.scar(ground,PETAL,3,t+.2,2);
  this.flurry(SCATTER,point,t,1.1,6,st.n(100,36),true);
 }
 private slash(point:THREE.Vector3,side:THREE.Vector3,lean:number,size:number,width:number,at:number,life:number){this.cuts.add(point,this.axis.copy(side).multiplyScalar(Math.cos(lean)).addScaledVector(UP,Math.sin(lean)).normalize(),undefined,size,width,PETAL,at,life);}
 private flurry(kind:number,at:THREE.Vector3,born:number,life:number,reach:number,count:number,white=false){const f=this.flurries[this.flurryCursor++%this.flurries.length];f.kind=kind;f.at.copy(at);f.born=born;f.life=life;f.reach=reach;f.count=count;f.white=white;f.seed=(Math.abs(at.x*17.3+at.z*9.1+born*4.7))%61;f.live=true;}
 private drawFlurries(time:number){
  for(const f of this.flurries){
   if(!f.live)continue;const age=time-f.born;if(age>=f.life){f.live=false;continue;}if(age<0)continue;
   const u=age/f.life,fade=Math.min(1,age/.05)*(1-u*u);
   for(let i=0;i<f.count;i++){
    const h=hash(f.seed+i*1.37),h2=hash(f.seed*2.1+i*3.7);
    if(f.kind===VORTEX){
     const turn=i*2.39996+time*7*(.6+.4*h),r=f.reach*(1.1-.55*u)*(.55+.45*h2),y=((h+age*.9)%1)*3.1;
     this.p.set(f.at.x+Math.cos(turn)*r,f.at.y+.1+y,f.at.z+Math.sin(turn)*r);
    }else{
     const az=i*2.39996+f.seed,lift=-.25+1.15*h,out=f.reach*(1-(1-u)*(1-u))*(.35+.65*h2);
     this.p.set(f.at.x+Math.cos(az)*out,f.at.y+lift*out*.7-u*u*.5,f.at.z+Math.sin(az)*out);
    }
    this.q.setFromAxisAngle(UP,i+time*4);this.q2.setFromAxisAngle(FORWARD,time*6+i*2.1);this.q.multiply(this.q2);
    const w=.11+.08*h;this.petals.add(this.p,this.q,w,w*1.7,1,f.white?i%3?HOT_WHITE:HOT_PALE:i%3?HOT:HOT_PALE,fade*.95);
   }
   this.stage.light(this.p.copy(f.at).setY(f.at.y+(f.kind===VORTEX?1.4:.2)),f.reach*1.6+1.6,f.white?HAKUTEI:PETAL,.42*fade);
  }
 }
 update(time:number,fighters:ReadonlyMap<string,Fighter>,flights:ReadonlyMap<string,Flight>){
  if(this.disposed)return;for(const batch of this.batches)batch.begin();const detail=this.kit.budget>=.65,st=this.stage.open(time);
  for(const f of fighters.values()){
   const s=f.state;if(!isByakuyaSenbonzakura(s.fighter)||!s.alive)continue;const u=clamp(s.actionTime),age=u*s.actionDuration;
   if(s.action==='awaken'){
    const release=clamp((u-.304)/.224),fade=clamp((1-u)/.208);this.a.copy(f.group.position);this.a.y+=.025;
    this.rings.add(this.a,this.flat,.25+release*1.35,.25+release*1.35,1,PINK,release*fade*.68);
    if(release>0){const count=detail?12:8;for(let i=0;i<count;i++){const side=i%2?1:-1,depth=Math.floor(i/2)*.35-.8;this.p.copy(f.group.position);const x=side*(1.08+Math.floor(i/2)*.07),z=depth;this.p.x+=x*Math.cos(s.yaw)+z*Math.sin(s.yaw);this.p.z+=z*Math.cos(s.yaw)-x*Math.sin(s.yaw);const height=1.3*release;this.p.y+=height*.5;this.q.identity();this.blades.add(this.p,this.q,1,height,1,PALE,fade*.7*(1-clamp((u-.688)/.176)));}this.a.y+=.8;this.swirl(this.a,.45+release*1.1,fade*.8,time,detail?45:22);}
    continue;
   }
   if(!manual(s.action)||s.whiffedAt!==undefined||s.action==='ultimate'&&age>.72&&s.confirmedAt===undefined)continue;
   const strength=Math.sin(u*Math.PI);f.strikePoint(this.a);this.swirl(this.a,.2+.2*strength,strength*.9,time,detail?12:5,false,2.2,true);
   this.pose(f,time,age);
   if(s.action==='ultimate'&&u>.57){
    const wing=clamp((u-.57)/.13)*clamp((.94-u)/.09);this.a.copy(f.group.position);this.a.y+=1.36;
    const count=detail?8:5;for(const side of[-1,1])for(let i=0;i<count;i++){const k=i/(count-1),x=side*(.3+k*1.25),z=-.14-k*.5;this.p.copy(this.a);this.p.x+=x*Math.cos(s.yaw)+z*Math.sin(s.yaw);this.p.z+=z*Math.cos(s.yaw)-x*Math.sin(s.yaw);this.p.y+=.42-k*.5;this.d.set(side*.58*Math.cos(s.yaw),.72,-side*.58*Math.sin(s.yaw)).normalize();this.q.setFromUnitVectors(UP,this.d);this.blades.add(this.p,this.q,1.5,(.9+1.1*Math.sin(k*Math.PI))*wing,1.5,HOT_WHITE,wing*.92);}
    st.glow(this.p.copy(this.a).setY(this.a.y+.5),1.5,HAKUTEI.main,.42*wing);st.light(this.a,4.2,HAKUTEI,.42*wing);
    f.strikePoint(this.a);this.swirl(this.a,.3,strength*.85,time,detail?14:6,true,2.2,true);
   }
  }
  for(const flight of flights.values()){
   if(!isByakuyaSenbonzakura(flight.fighter)||flight.slot!=='special'||flight.branch||!flight.released)continue;
   this.q.setFromUnitVectors(UP,flight.heading);this.p.copy(flight.position).addScaledVector(flight.heading,.24);this.blades.add(this.p,this.q,.45,.95,.45,HOT_PALE,.6);
   const head=flight.position,along=flight.heading;this.side.set(along.z,0,-along.x);if(this.side.lengthSq()<1e-4)this.side.set(1,0,0);this.side.normalize();this.d.crossVectors(this.side,along).normalize();
   const count=st.n(110,36);for(let i=0;i<count;i++){const k=i/count,theta=i*2.39996+time*8,r=(.16+.62*k)*(.55+.45*hash(i*1.7));this.p.copy(head).addScaledVector(along,-k*3.6).addScaledVector(this.side,Math.sin(theta)*r).addScaledVector(this.d,Math.cos(theta)*r);this.q.setFromAxisAngle(UP,time*5+i);this.q2.setFromAxisAngle(FORWARD,theta);this.q.multiply(this.q2);const w=.1+.07*hash(i*2.3);this.petals.add(this.p,this.q,w,w*1.7,1,i%3?HOT:HOT_PALE,.95-k*.5);}
   st.glow(head,1.05,PETAL.main,.8);st.glow(head,.4,PETAL.core,1);
   for(let i=1;i<=3;i++)st.glow(this.p.copy(head).addScaledVector(along,-i*.95),1.1-i*.18,PETAL.main,.5-i*.1);
   st.light(this.p.copy(head).setY(head.y+.2),6.2,PETAL,1.05);st.light(this.p.copy(head).addScaledVector(along,-2.6),4.6,PETAL,.6);
  }
  for(const h of this.impacts){if(!h.actor)continue;const s=fighters.get(h.actor)?.state,age=time-h.born,life=h.grade===3?.62:.36;if(!s?.alive||(s.actionSeq??-1)!==h.seq||s.whiffedAt!==undefined||age>=life){h.actor='';continue;}if(age<0)continue;const fade=1-age/life;this.swirl(h.point,.10+age*(h.grade===3?4.5:2.5),fade,time+h.seed,detail?(h.grade===3?58:24):12,h.grade===3);if(h.grade===3){this.q.setFromAxisAngle(UP,time);this.rings.add(h.point,this.q,.1+age*3.5,.1+age*3.5,1,WHITE,fade*.75);}}
  this.book.each(fighters,BYAKUYA_SENBONZAKURA_BEATS.end,this.gather);
  this.drawFlurries(time);this.cuts.draw(st,time);
  for(const batch of this.batches)batch.end();st.close();
 }
 private pose(f:Fighter,time:number,elapsed:number){
  const st=this.stage,s=f.state,seed=(s.actionSeq??0)*5.3,strike=this.a,yaw=s.yaw??f.group.rotation.y,heading=this.heading.set(Math.sin(yaw),0,Math.cos(yaw));
  if(!byakuyaBlade(f,this.root,this.tip)){this.tip.copy(strike);this.root.copy(strike).addScaledVector(heading,-.9);}
  const mid=this.m.copy(this.root).lerp(this.tip,.6);
  if(s.action==='light'){const k=Math.sin(clamp(s.actionTime)*Math.PI);this.lit(k,1);st.glow(this.tip,.28,PETAL.main,.5*k);st.light(mid,1.9,PETAL,.2*k);return;}
  if(s.action==='heavy'){
   const contact=s.branch?s.actionDuration*.5:HEAVY.contacts[0];
   if(elapsed<contact){const k=clamp(elapsed/contact);this.lit(.6+.4*k,1.2);st.charge(mid,PETAL,.24,k,seed);this.swirl(mid,.55-.3*k,.5+.5*k,time,st.n(16,6),false,2.4,true);}
   else if(elapsed<contact+.2){
    const k=1-(elapsed-contact)/.2;this.c.copy(f.group.position).addScaledVector(heading,.3);this.c.y+=1.2;this.side.set(heading.z,0,-heading.x);
    for(let i=-1;i<=1;i+=2){this.axis.copy(this.side).multiplyScalar(.74).addScaledVector(UP,.67*i).normalize();arc(st,this.c,heading,this.axis,1.9,-1,1,.13,PETAL.main,.9*k);arc(st,this.c,heading,this.axis,1.9,-1,1,.045,PETAL.core,1.6*k);}
    st.light(this.p.copy(this.c).addScaledVector(heading,1.4),4,PETAL,.4*k);
   }
   return;
  }
  if(s.action==='special'){
   const release=s.branch?s.actionDuration*.5:SPECIAL.contacts[0];if(elapsed>=release)return;
   const k=clamp(elapsed/release);this.lit(1-.6*k,1.2);st.charge(strike,PETAL,.34,k,seed);
   if(!s.branch){this.swirl(strike,.35+.6*k,.55+.45*k,time,st.n(36,12),false,1.9,true);st.disc(this.p.copy(f.group.position),2.2+1.6*k,PETAL.main,.5*k,SHEEN,1);st.light(this.p.copy(f.group.position).setY(f.group.position.y+.5),3.4+1.8*k,PETAL,.34*k);}
   return;
  }
  if(s.action==='ultimate'&&!s.branch&&s.confirmedAt===undefined&&elapsed<ULT.contacts[0]+.12){const k=clamp(elapsed/ULT.contacts[0]);this.lit(.6+.4*k,1.2);st.charge(mid,PETAL,.3,k,seed);}
 }
 private lit(k:number,wide:number){this.stage.streak(this.root,this.tip,.07*wide,PETAL.main,.5*k);this.stage.streak(this.root,this.tip,.024*wide,PETAL.core,1.15*k);}
 private readonly gather=(actor:Fighter,g:Gather,elapsed:number,victim:Fighter|undefined)=>{
  const B=BYAKUYA_SENBONZAKURA_BEATS;if(elapsed>=B.final+.1)return;
  const st=this.stage,time=st.time,build=clamp((elapsed-B.opener)/(B.final-B.opener)),rows=clamp((elapsed-B.opener)/.3)*(1-clamp((elapsed-B.close)/.3)),close=clamp((elapsed-B.close)/(B.final-B.close-.12)),seed=g.seq*3.9;
  const feet=this.c.copy(actor.group.position).setY(g.floor),dir=this.heading;
  if(victim)dir.subVectors(victim.group.position,actor.group.position).setY(0);else dir.set(0,0,0);
  if(dir.lengthSq()<.01){const yaw=actor.state.yaw??0;dir.set(Math.sin(yaw),0,Math.cos(yaw));}dir.normalize();this.side.set(dir.z,0,-dir.x);
  st.dim(.3+.4*build,g.actor,g.target);
  if(rows>.02){
   for(let r=-1;r<=1;r+=2){
    for(let i=0;i<5;i++){
     const h=(2.7+1.4*hash(seed+i*3+r))*rows;
     this.p.copy(feet).addScaledVector(dir,-.7+i*1.3).addScaledVector(this.side,r*(2.3+.1*i));this.d.copy(this.p);this.d.y+=h;
     jag(st,this.p,this.d,.14,PETAL.main,.95*rows,i,0,3);
     this.p.copy(feet).addScaledVector(dir,-.7+i*1.3).addScaledVector(this.side,r*(2.3+.1*i));this.d.copy(this.p);this.d.y+=h;
     jag(st,this.p,this.d,.048,PETAL.core,1.6*rows,i,0,3);
    }
    st.light(this.p.copy(feet).addScaledVector(dir,1.9).addScaledVector(this.side,r*2.3).setY(g.floor+1.2),4.6,PETAL,.5*rows);
   }
   st.disc(this.p.copy(feet).addScaledVector(dir,1.9),4.6,PETAL.main,.55*rows,SHEEN,1);
  }
  if(close>0&&victim){
   const centre=bodyCentre(victim,this.m),radius=3.3-1.9*close,count=st.n(110,40);
   st.bubble(centre,radius,PETAL,.45+.4*close);
   for(let i=0;i<count;i++){const y=1-2*(i+.5)/count,rr=Math.sqrt(1-y*y),phi=i*2.39996+time*2.4;this.p.set(centre.x+Math.cos(phi)*rr*radius,centre.y+y*radius,centre.z+Math.sin(phi)*rr*radius);this.q.setFromAxisAngle(UP,phi);this.q2.setFromAxisAngle(FORWARD,time*5+i);this.q.multiply(this.q2);const w=.1+.06*hash(i*1.9);this.petals.add(this.p,this.q,w,w*1.7,1,i%3?HOT:HOT_PALE,.9);}
  }
  if(build>.45){const k=clamp((build-.45)/.55);actor.strikePoint(this.p);st.charge(this.p,HAKUTEI,.3+.3*k,k,seed);}
  if(build>.8)st.speed(.5*(build-.8)/.2,g.actor,g.target);
 };
 reset(){for(const h of this.impacts)h.actor='';this.seen.fill(-1);this.seenTime.fill(-1);this.cursor=this.seenCursor=0;for(const b of this.batches){b.begin();b.end();}for(const f of this.flurries)f.live=false;this.flurryCursor=0;this.book.reset();this.cuts.reset();this.stage.reset();}
 dispose(){if(this.disposed)return;this.reset();this.disposed=true;for(const b of this.batches)b.dispose();this.stage.release();}
}
