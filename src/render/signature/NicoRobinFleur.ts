import {SignaturePoolUpload} from './SignaturePoolUpload';
import * as T from 'three';
import {GLTFLoader,type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import type {CombatEvent} from '../../game/types';
import type {Fighter} from '../Fighter';
import type {Flight} from '../CombatEffects';
import {bodyCentre,type VfxKit} from '../vfx/VfxKit';
import {SIGNATURE,involvesLocal} from './context';
import {nicoRobinArmPose,robinArmPose,robinPlaceArm,ROBIN_COMMANDS,robinClamp,type RobinArmPose} from './NicoRobinBloomPose';
import {NICO_ROBIN_MOVES} from '../../game/fighters/nico-robin';
import {BURN,MoveStage,SHEEN,stageLook,type StageLook} from './MoveStage';
import { blowFloor } from './blowFloor';

export const isNicoRobinFleur=(id:string|undefined)=>id==='nico-robin';
export const NICO_ROBIN_FLEUR_ASSETS=Object.freeze(['/assets/fighters/nico-robin-grown-arm1.glb']);
export const NICO_ROBIN_FLEUR_LIMITS=Object.freeze({arms:24,petals:256,collars:24,receipts:16,impacts:24});
const UP=new T.Vector3(0,1,0),Z=new T.Vector3(0,0,1),PINK=new T.Color(0xf8b7de),PLUM=new T.Color(0x834985),PALE=new T.Color(0xffeaf7);
export const FLEUR:StageLook=stageLook(0xffeaf7,0xf8b7de,0x834985);
const PETAL=new T.Color(2.1,1.15,1.7),PETAL_PALE=new T.Color(2.2,2,2.1),ROSE=new T.Color(1,.2,.62);
const FLOOR:StageLook={...FLEUR,main:ROSE,light:new T.Color(.7,.32,.55)};
const HEAVY=NICO_ROBIN_MOVES.heavy,SPECIAL=NICO_ROBIN_MOVES.special,ULT=NICO_ROBIN_MOVES.ultimate,FINAL=ULT.contacts.length-1;
const GIGANTESCO=3.4;
const wristsOf=(f:Fighter,out:T.Vector3)=>f.handL&&f.handR?out.copy(f.handL).lerp(f.handR,.5):out.copy(f.group.position).setY(f.group.position.y+1.15);
type Bloom={live:boolean;born:number;life:number;seed:number;count:number;speed:number;size:number;at:T.Vector3};
type Gather={actor:string;target:string;seq:number;floor:number;final:boolean};
class Petals{
 readonly mesh:T.InstancedMesh<T.BufferGeometry,T.ShaderMaterial>;private color:T.InstancedBufferAttribute;private object=new T.Object3D();private count=0;private upload:SignaturePoolUpload;
 constructor(scene:T.Scene,name:string,geometry:T.BufferGeometry,private capacity:number){
  this.color=new T.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(T.DynamicDrawUsage);geometry.setAttribute('fleurTint',this.color);
  const material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false,vertexShader:'attribute vec4 fleurTint;varying vec4 vTint;void main(){vTint=fleurTint;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',fragmentShader:'varying vec4 vTint;void main(){if(vTint.a<.005)discard;gl_FragColor=vTint;\n#include <colorspace_fragment>\n}'});material.forceSinglePass=true;
  this.mesh=new T.InstancedMesh(geometry,material,capacity);this.mesh.name='nico-robin-'+name;this.mesh.count=0;this.mesh.frustumCulled=false;this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.upload=new SignaturePoolUpload(this.mesh,this.color);scene.add(this.mesh);
 }
 begin(){this.count=0;}
 add(p:T.Vector3,q:T.Quaternion,x:number,y:number,z:number,color:T.Color,alpha:number){if(this.count>=this.capacity||alpha<.005||Math.min(x,y,z)<=0)return;this.object.position.copy(p);this.object.quaternion.copy(q);this.object.scale.set(x,y,z);this.object.updateMatrix();this.mesh.setMatrixAt(this.count,this.object.matrix);this.color.setXYZW(this.count++,color.r,color.g,color.b,robinClamp(alpha));}
 end(){this.upload.end(this.count);}
 dispose(){this.mesh.removeFromParent();this.mesh.dispose();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
function petalGeometry(){const shape=new T.Shape();shape.moveTo(0,-.5);shape.bezierCurveTo(.40,-.10,.28,.37,0,.5);shape.bezierCurveTo(-.28,.37,-.40,-.10,0,-.5);return new T.ShapeGeometry(shape,4);}
type Receipt={actor:string;target:string;seq:number;final:boolean;point:T.Vector3;head:T.Vector3};
type Impact={actor:string;target:string;seq:number;born:number;seed:number;grade:number;point:T.Vector3};
type Displayed=Fighter&{readonly displayedClipName?:string;readonly displayedClipTime?:number};

export class NicoRobinFleur{
 private readonly stage:MoveStage;
 private blooms:Bloom[]=Array.from({length:10},()=>({live:false,born:0,life:1,seed:0,count:0,speed:1,size:.1,at:new T.Vector3()}));private bloomCursor=0;
 private gathers:Gather[]=Array.from({length:6},()=>({actor:'',target:'',seq:-1,floor:0,final:false}));private gatherCursor=0;
 private blow=new T.Vector3();private ground=new T.Vector3();private wrists=new T.Vector3();
 private source?:GLTF;private loading?:Promise<void>;private armSource?:T.Mesh;private arms?:T.InstancedMesh<T.BufferGeometry,T.MeshToonMaterial>;
 private armUpload?:SignaturePoolUpload;private petals:Petals;private collars:Petals;private armCount=0;private disposed=false;
 private receipts:Receipt[]=Array.from({length:16},()=>({actor:'',target:'',seq:-1,final:false,point:new T.Vector3(),head:new T.Vector3()}));
 private impacts:Impact[]=Array.from({length:24},()=>({actor:'',target:'',seq:-1,born:0,seed:0,grade:0,point:new T.Vector3()}));
 private cancelled=Array.from({length:24},()=>({actor:'',seq:-1}));private cancelCursor=0;private receiptCursor=0;private impactCursor=0;
 private seen=new Float64Array(128).fill(-1);private seenTime=new Float64Array(128).fill(-1);private seenCursor=0;
 private pose=robinArmPose();private p=new T.Vector3();private a=new T.Vector3();private b=new T.Vector3();private center=new T.Vector3();private head=new T.Vector3();private forward=new T.Vector3();private side=new T.Vector3();private dir=new T.Vector3();private scale=new T.Vector3();private q=new T.Quaternion();private spin=new T.Quaternion();private orientation=new T.Quaternion();
 constructor(private scene:T.Scene,private kit:Pick<VfxKit,'budget'>&Partial<VfxKit>){
  this.stage=MoveStage.for(scene,kit);
  this.petals=new Petals(scene,'fleur-petals',petalGeometry(),256);this.collars=new Petals(scene,'fleur-births',new T.CircleGeometry(1,10),24);
 }
 load(ids:readonly string[]):Promise<void>{
  if(this.disposed||!ids.some(isNicoRobinFleur))return Promise.resolve();
  return this.loading??=new GLTFLoader().loadAsync(NICO_ROBIN_FLEUR_ASSETS[0]).then(gltf=>{
   if(this.disposed){this.disposeSource(gltf);return;}this.source=gltf;
   const source=gltf.scene.getObjectByName('Robin_Grown_Arm');if(!(source instanceof T.Mesh)||source.geometry.morphAttributes.position?.length!==7)throw Error('Robin native grown-arm contract is missing');
   this.armSource=source;const original=(Array.isArray(source.material)?source.material[0]:source.material)as T.MeshStandardMaterial;
   const material=new T.MeshToonMaterial({map:original.map,color:0xffffff,side:T.FrontSide});
   this.arms=new T.InstancedMesh(source.geometry,material,24);this.arms.name='nico-robin-grown-arms';this.arms.frustumCulled=false;this.arms.castShadow=false;this.arms.receiveShadow=false;this.arms.instanceMatrix.setUsage(T.DynamicDrawUsage);
   source.morphTargetInfluences!.fill(0);for(let i=0;i<24;i++)this.arms.setMorphAt(i,source);this.arms.morphTexture!.needsUpdate=true;this.arms.count=0;this.armUpload=new SignaturePoolUpload(this.arms);this.scene.add(this.arms);
  }).catch(error=>{this.loading=undefined;if(this.source){this.disposeSource(this.source);this.source=undefined;}throw error;});
 }
 private blocked(f:Fighter){return this.cancelled.some(c=>c.actor===f.state.id&&c.seq===(f.state.actionSeq??-1));}
 private cancel(id:string,targetToo:boolean,seq=-1){
  for(const r of this.receipts)if(r.actor===id||targetToo&&r.target===id)r.actor='';for(const h of this.impacts)if(h.actor===id||targetToo&&h.target===id)h.actor='';
  for(const g of this.gathers)if(g.actor===id||targetToo&&g.target===id&&!g.final)g.actor='';
  if(seq>=0)Object.assign(this.cancelled[this.cancelCursor++%24],{actor:id,seq});
 }
 handle(e:CombatEvent,fighters?:ReadonlyMap<string,Fighter>){
  if(this.disposed)return;const actor=fighters?.get(e.actorId),seq=e.actionSeq??actor?.state.actionSeq??-1;
  if(e.kind==='eliminated'||e.kind==='respawn'){this.cancel(e.actorId,true,seq);return;}if(!isNicoRobinFleur(e.fighter))return;
  if(e.kind==='whiff'||e.kind==='rejected'){this.cancel(e.actorId,false,seq);return;}if(e.kind!=='confirm'&&e.kind!=='hit'||!actor?.state.alive)return;
  for(let i=0;i<128;i++)if(this.seen[i]===e.id&&this.seenTime[i]===e.serverTime)return;const key=this.seenCursor++%128;this.seen[key]=e.id;this.seenTime[key]=e.serverTime;
  if(e.kind==='confirm'){
   if(e.slot==='ultimate'&&!e.branch&&e.targetId){Object.assign(this.gathers[this.gatherCursor++%this.gathers.length],{actor:e.actorId,target:e.targetId,seq,final:false,floor:blowFloor(actor,fighters?.get(e.targetId),actor.group.position.y)});const r=this.receipts[this.receiptCursor++%16];Object.assign(r,{actor:e.actorId,target:e.targetId,seq,final:false});const victim=fighters?.get(e.targetId);if(victim){bodyCentre(victim,r.point);const head=victim.drawnJoint?.('Head')??victim.joints?.get('Head');if(head)head.getWorldPosition(r.head);else r.head.copy(r.point).addScaledVector(UP,.57);}}return;
  }
  const victim=e.targetId?fighters?.get(e.targetId):undefined;if(!e.endpoint&&!victim)return;const h=this.impacts[this.impactCursor++%24],final=e.slot==='ultimate'&&!e.branch&&e.contactIndex===2;
  Object.assign(h,{actor:e.actorId,target:e.targetId??'',seq,born:e.serverTime,seed:e.id,grade:final?3:e.slot==='light'?1:2});if(e.endpoint)h.point.set(e.endpoint.x,e.endpoint.y,e.endpoint.z);else bodyCentre(victim!,h.point);
  if(final){for(const r of this.receipts)if(r.actor===e.actorId&&r.seq===seq){r.final=true;r.point.copy(h.point);}if(involvesLocal(e.actorId,e.targetId))SIGNATURE.screen?.impactFrame?.(.44,h.point);}
  const st=this.stage,t=e.serverTime,point=h.point,dir=this.blow,big=actor.state.awakened?1.15:1;let floor=blowFloor(actor,victim,actor.group.position.y);
  dir.subVectors(point,actor.group.position).setY(0);if(dir.lengthSq()<.01)dir.set(Math.sin(actor.state.yaw??0),0,Math.cos(actor.state.yaw??0));dir.normalize();
  const ground=this.ground.set(point.x,floor,point.z);
  if(e.slot==='light'){st.burst(point,FLEUR,.4,t,{dir,floor,clean:true});this.bloom(point,t,8,2.4,.07,.5);return;}
  if(e.slot==='heavy'){const k=(e.branch?.8:1)*big;st.burst(point,FLEUR,.85*k,t,{dir,floor});st.shock(ground,FLEUR,4.2*k,t,.42);this.bloom(point,t,20,4,.1,.8);return;}
  if(e.slot==='special'){
   if(e.branch){st.burst(point,FLEUR,1.6,t,{dir,floor});st.shock(ground,FLEUR,4.2,t,.45);this.bloom(point,t,22,4.5,.1,.9);return;}
   st.burst(point,FLEUR,2*big,t,{dir,floor});st.dome(point,FLEUR,2.8*big,t,.42);st.shock(ground,FLEUR,5.2*big,t,.45);st.scar(ground,FLOOR,2.3*big,t+.05,1.9);
   this.bloom(point,t,40,6,.13,1.1);return;
  }
  if(e.slot!=='ultimate'||e.branch)return;
  if(!final){st.burst(point,FLEUR,e.contactIndex?1.2:.95,t,{dir,floor});this.bloom(point,t,e.contactIndex?22:14,4,.1,.8);if(e.contactIndex)st.shock(ground,FLEUR,5,t,.5);return;}
  let confirmed=false;for(const g of this.gathers)if(g.actor===e.actorId&&g.seq===seq){g.final=true;floor=g.floor;confirmed=true;}
  if(!confirmed)return;ground.y=floor;
  st.shatter(point,dir,FLEUR,6.5,t,.7);st.dome(point,FLEUR,4.6,t,.45);st.erupt(ground,UP,FLEUR,.8,9,t+.03,.5);st.burst(point,FLEUR,2.2,t,{dir,floor});st.shock(ground,FLEUR,9.5,t,.6);st.scar(ground,FLOOR,3,t+.1,2);
  this.bloom(point,t,70,7.5,.15,1.4);
 }
 private bloom(at:T.Vector3,born:number,count:number,speed:number,size:number,life:number){const b=this.blooms[this.bloomCursor++%this.blooms.length];b.live=true;b.born=born;b.life=life;b.count=count;b.speed=speed;b.size=size;b.seed=Math.abs(at.x*13.1+at.z*7.7+born*5.3)%97;b.at.copy(at);}
 private addArm(pose:RobinArmPose,detail:boolean){
  if(!this.arms||!this.armSource||pose.presence<.012||this.armCount>=24)return;
  this.arms.setMatrixAt(this.armCount,pose.matrix);for(let i=0;i<7;i++)this.armSource.morphTargetInfluences![i]=pose.weights[i];this.arms.setMorphAt(this.armCount++,this.armSource);
  pose.matrix.decompose(this.a,this.orientation,this.scale);this.dir.set(0,0,1).applyQuaternion(this.orientation);this.q.setFromUnitVectors(Z,this.dir);const radius=.078*pose.scale*pose.presence;
  this.collars.add(pose.root,this.q,radius,radius,1,PLUM,pose.presence*.82);
  for(let i=0;i<(detail?6:4);i++){const theta=i*Math.PI*2/(detail?6:4);this.p.set(Math.sin(theta)*radius*.8,Math.cos(theta)*radius*.8,0).applyQuaternion(this.q).add(pose.root);this.spin.setFromAxisAngle(Z,-theta);this.spin.premultiply(this.q);this.petals.add(this.p,this.spin,radius*.80,radius*1.8,1,i%2?PINK:PALE,pose.presence*.95);}
 }
 update(time:number,fighters:ReadonlyMap<string,Fighter>,flights:ReadonlyMap<string,Flight>){
  if(this.disposed)return;this.armCount=0;this.petals.begin();this.collars.begin();const detail=this.kit.budget>=.65;
  const st=this.stage.open(time);
  for(const f of fighters.values()){
   const s=f.state;if(!isNicoRobinFleur(s.fighter)||!s.alive||s.whiffedAt!==undefined||this.blocked(f))continue;
   if(!['light','heavy','special','ultimate','awaken'].includes(s.action))continue;
   this.swing(f,time,detail);
   const shown=f as Displayed,clip=shown.displayedClipName??(s.action==='awaken'?'Gigante Fleur':s.action==='light'?'Dos Fleur':s.action==='heavy'?'Cuatro Fleur Clutch':s.action==='special'?'Gigantesco Mano':'Gran Jacuzzi Clutch'),command=ROBIN_COMMANDS[clip];if(!command)continue;
   const seconds=shown.displayedClipTime??s.actionTime*command.duration;
   if(clip==='Gigantesco Mano'&&seconds>=command.duration*command.peak)continue;
   if(s.action==='ultimate'&&!s.branch&&s.actionTime*s.actionDuration>=.78)continue;
   const count=detail?command.count:Math.min(command.count,4);
   for(let i=0;i<count;i++){nicoRobinArmPose(f,this.pose,clip,seconds,i);this.addArm(this.pose,detail);}
  }
  for(const flight of flights.values()){
   if(!isNicoRobinFleur(flight.fighter)||flight.slot!=='special'||flight.branch||!flight.released)continue;
   const travel=Math.max(0,this.a.subVectors(flight.position,flight.origin??flight.position).dot(flight.heading));
   const reach=Math.min(GIGANTESCO*(flight.awakened?1.15:1),travel);
   this.a.copy(flight.position).addScaledVector(flight.heading,-reach);robinPlaceArm(this.pose,this.a,flight.position,1,1,0);this.addArm(this.pose,detail);
   if(reach>.3){
    const floor=(flight.actorId?fighters.get(flight.actorId)?.group.position.y:undefined)??flight.position.y-1.2;
    st.glow(flight.position,1.3,FLEUR.main,.42);st.glow(flight.position,.5,FLEUR.core,.5);
    for(let i=0,n=detail?14:8;i<n;i++){
     const phase=(time*1.6+i*.618)%1,back=reach*(.1+.9*((i*.37)%1)),ang=i*2.399963+time*3;
     this.p.copy(flight.position).addScaledVector(flight.heading,-back);this.p.x+=Math.cos(ang)*(.3+.9*phase);this.p.y+=Math.sin(ang)*(.3+.7*phase)+.2*phase;this.p.z+=Math.sin(ang*1.3)*(.3+.9*phase);
     this.q.setFromAxisAngle(UP,ang);this.spin.setFromAxisAngle(Z,ang*2+time*5);this.q.multiply(this.spin);
     this.petals.add(this.p,this.q,.09,.18,1,i%3?PETAL:PETAL_PALE,Math.sin(Math.PI*phase)*.95);
    }
    st.light(this.p.copy(flight.position).setY(flight.position.y+.2),6.2,FLEUR,.85);st.light(this.p.copy(flight.position).addScaledVector(flight.heading,-reach*.6).setY(floor+.6),4.5,FLEUR,.45);
    st.disc(this.p.set(flight.position.x,floor,flight.position.z),2.3,ROSE,.6,SHEEN,1,flight.since);
   }
  }
  for(const g of this.gathers){
   if(!g.actor)continue;const f=fighters.get(g.actor),v=fighters.get(g.target),s=f?.state;
   if(!f||!s?.alive||!v?.state.alive&&!g.final||s.action!=='ultimate'||s.branch||(s.actionSeq??-1)!==g.seq||s.whiffedAt!==undefined||this.blocked(f)){g.actor='';continue;}
   const t=s.actionTime*s.actionDuration;if(t>ULT.duration){g.actor='';continue;}
   if(!g.final&&t<ULT.contacts[FINAL]&&v)this.gather(f,v,g,t,time,detail);
  }
  for(const b of this.blooms){
   if(!b.live)continue;const age=time-b.born;if(age>=b.life){b.live=false;continue;}if(age<0)continue;
   const u=age/b.life,fade=u<.6?1:1-(u-.6)/.4,out=b.speed*(1-Math.exp(-age*4))/4,count=detail?b.count:Math.ceil(b.count*.6);
   for(let i=0;i<count;i++){
    const ang=i*2.399963+b.seed,lift=Math.sin(i*4.31+b.seed),r=out*(.5+.5*Math.abs(Math.sin(i*1.7+b.seed)));
    this.p.set(b.at.x+Math.cos(ang)*r,b.at.y+lift*r*.7+.4*age-1.1*age*age,b.at.z+Math.sin(ang)*r);
    this.q.setFromAxisAngle(UP,ang+age*3);this.spin.setFromAxisAngle(Z,i+age*(4+i%3));this.q.multiply(this.spin);
    this.petals.add(this.p,this.q,b.size,b.size*2,1,i%3?PETAL:PETAL_PALE,fade*.95);
   }
  }
  for(const r of this.receipts){
   if(!r.actor)continue;const f=fighters.get(r.actor),v=fighters.get(r.target),s=f?.state;
   if(!f||!s?.alive||!v?.state.alive||s.action!=='ultimate'||s.branch||(s.actionSeq??-1)!==r.seq||s.whiffedAt!==undefined||this.blocked(f)){r.actor='';continue;}
   const t=s.actionTime*s.actionDuration;if(t<.78)continue;if(t>3.72){r.actor='';continue;}if(!r.final)bodyCentre(v,r.point);
   this.forward.set(Math.sin(s.yaw),0,Math.cos(s.yaw));this.side.crossVectors(UP,this.forward).normalize();this.center.copy(r.point);
   if(!r.final){const headJoint=v.drawnJoint?.('Head')??v.joints?.get('Head');if(headJoint)headJoint.getWorldPosition(r.head);else r.head.copy(this.center).addScaledVector(UP,.57);}
   this.head.copy(r.head);
   const grow=robinClamp((t-.78)/.44),close=robinClamp((t-2.43)/.64),fade=1-robinClamp((t-3.15)/.55),count=detail?8:4;
   for(let i=0;i<count;i++){
    if(i===0){const shown=f as Displayed;nicoRobinArmPose(f,this.pose,'Gran Jacuzzi Clutch',shown.displayedClipTime??t,0);this.addArm(this.pose,detail);continue;}
    const side=i%2?1:-1,row=Math.floor((i-1)/2);
    const rootY=row===0?-.22:row===1?-.30:row===2?.06:.10;
    const palmY=row===0?.42:row===1?.02:row===2?.68:.54;
    const rootX=row===3?0:side*.19,palmX=row===3?-.08:side*(row===1?.44:.35-.035*close);
    this.a.copy(this.center).addScaledVector(this.side,rootX).addScaledVector(UP,rootY).addScaledVector(this.forward,-.10);
    this.b.copy(this.center).addScaledVector(this.side,palmX).addScaledVector(UP,palmY).addScaledVector(this.forward,-.28-.04*close);
    if(i<=2){
     this.a.copy(this.head).addScaledVector(this.side,side*(.35+.035*close)).addScaledVector(UP,-.52).addScaledVector(this.forward,.16);
     this.b.copy(this.head).addScaledVector(this.side,side*(.15-.015*close)).addScaledVector(UP,-.025).addScaledVector(this.forward,-.055);
    }
    if(i===3&&close>0){
     this.p.copy(this.center).addScaledVector(this.side,.30).addScaledVector(UP,-.31).addScaledVector(this.forward,.10);this.a.lerp(this.p,close);
     this.p.copy(this.center).addScaledVector(this.side,-.20).addScaledVector(UP,-.05).addScaledVector(this.forward,-.21);this.b.lerp(this.p,close);
    }
    const retract=robinClamp((t-2.35)/.48),hierarchy=i>=4?1-retract*retract*(3-2*retract):1;
    robinPlaceArm(this.pose,this.a,this.b,grow,grow*fade*hierarchy,close);this.addArm(this.pose,detail);
   }
  }
  for(const h of this.impacts){
   if(!h.actor)continue;const f=fighters.get(h.actor),s=f?.state,age=time-h.born;
   if(!s?.alive||this.blocked(f!)||age>.38||(s.actionSeq??-1)!==h.seq||s.whiffedAt!==undefined){h.actor='';continue;}if(age<0)continue;const fade=1-age/.38,count=(detail?6:3)*h.grade;
   for(let i=0;i<count;i++){const angle=i*2.399+h.seed*.137;this.p.copy(h.point);this.p.x+=Math.sin(angle)*age*(1.8+h.grade*.3);this.p.y+=Math.cos(angle)*age*1.2+age*.8;this.p.z+=Math.sin(angle*1.73)*age;this.q.setFromAxisAngle(UP,angle+age*4);this.spin.setFromAxisAngle(Z,angle);this.q.multiply(this.spin);this.petals.add(this.p,this.q,.035*fade,.070*fade,1,i%3?PINK:PALE,fade*.8);}
  }
  if(this.armUpload?.end(this.armCount)&&this.arms?.morphTexture)this.arms.morphTexture.needsUpdate=true;this.petals.end();this.collars.end();
  st.close();
 }
 private swing(f:Fighter,time:number,detail:boolean){
  const s=f.state,st=this.stage;if(s.action==='awaken')return;
  const elapsed=s.actionTime*s.actionDuration,seed=(s.actionSeq??0)*5.1,big=s.awakened?1.15:1,wrists=wristsOf(f,this.wrists);
  if(s.action==='light'){
   const k=Math.sin(robinClamp(s.actionTime)*Math.PI),at=typeof f.strikePoint==='function'?f.strikePoint(this.p):this.p.copy(wrists);
   st.glow(at,.3,FLEUR.main,.5*k);st.light(at,2.2,FLEUR,.2*k);
  }else if(s.action==='heavy'){
   const contact=s.branch?s.actionDuration*.5:HEAVY.contacts[0];
   if(elapsed<contact)st.charge(wrists,FLEUR,.22*big,robinClamp(elapsed/contact),seed);
  }else if(s.action==='special'&&!s.branch){
   const release=SPECIAL.contacts[0];
   if(elapsed<release){
    const k=robinClamp(elapsed/release);st.charge(wrists,FLEUR,.36*big,k,seed);
    for(let i=0,n=detail?16:9;i<n;i++){
     const ang=i*Math.PI*2/n+time*2.6,r=1.1+.5*Math.sin(i*1.9),y=f.group.position.y+.3+((time*.7+i*.37)%1)*2;
     this.p.set(f.group.position.x+Math.cos(ang)*r,y,f.group.position.z+Math.sin(ang)*r);
     this.q.setFromAxisAngle(UP,-ang);this.spin.setFromAxisAngle(Z,ang*2+time*4);this.q.multiply(this.spin);
     this.petals.add(this.p,this.q,.07+.03*k,.14+.06*k,1,i%3?PETAL:PETAL_PALE,k*.9);
    }
    st.disc(this.p.copy(f.group.position),1.6+1.6*k,ROSE,.5*k,SHEEN,1,seed);
   }
  }else if(s.action==='ultimate'&&!s.branch&&s.confirmedAt===undefined&&elapsed<ULT.contacts[0]+.1)st.charge(wrists,FLEUR,.27,robinClamp(elapsed/ULT.contacts[0]),seed);
 }
 private gather(f:Fighter,v:Fighter,g:Gather,elapsed:number,time:number,detail:boolean){
  const st=this.stage,k=robinClamp((elapsed-ULT.contacts[0])/(ULT.contacts[FINAL]-ULT.contacts[0])),seed=g.seq*3.3;
  const mid=this.ground.copy(f.group.position).lerp(v.group.position,.5).setY(g.floor);
  st.dim(.3+.4*k,g.actor,g.target);
  st.disc(mid,(3+3.6*k)*(.6+.4*k),ROSE,.75,BURN,.3+.7*k,seed);
  st.disc(mid,3.4+3.6*k,ROSE,.16+.12*k,SHEEN,1,seed);
  for(let i=0,n=Math.round((detail?26:14)*(.5+.5*k));i<n;i++){
   const phase=(time*(.55+.3*k)+i*.618)%1,ang=i*2.399963+seed+time*.4,r=2.5+.9*Math.sin(i*1.7);
   this.p.set(mid.x+Math.cos(ang)*r,g.floor+.2+phase*(2.2+2*k),mid.z+Math.sin(ang)*r);
   this.q.setFromAxisAngle(UP,-ang);this.spin.setFromAxisAngle(Z,i+time*(2+i%3));this.q.multiply(this.spin);
   this.petals.add(this.p,this.q,.08+.04*k,.16+.08*k,1,i%3?PETAL:PETAL_PALE,Math.sin(Math.PI*phase)*(.6+.4*k));
  }
  st.charge(wristsOf(f,this.wrists),FLEUR,.26+.2*k,Math.max(.4,k),seed);
  if(k>.8)st.speed(.5*(k-.8)/.2,g.actor,g.target);
 }
 reset(){for(const r of this.receipts)r.actor='';for(const h of this.impacts)h.actor='';for(const c of this.cancelled)c.actor='';for(const b of this.blooms)b.live=false;for(const g of this.gathers)g.actor='';this.seen.fill(-1);this.seenTime.fill(-1);this.armCount=this.cancelCursor=this.receiptCursor=this.impactCursor=this.seenCursor=this.bloomCursor=this.gatherCursor=0;this.armUpload?.end(0);this.petals.begin();this.petals.end();this.collars.begin();this.collars.end();this.stage.reset();}
 private disposeSource(source:GLTF){const geometry=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();source.scene.traverse(o=>{if(!(o instanceof T.Mesh))return;geometry.add(o.geometry);for(const m of(Array.isArray(o.material)?o.material:[o.material])){materials.add(m);const t=(m as T.MeshStandardMaterial).map;if(t)textures.add(t);}});for(const g of geometry)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();}
 dispose(){if(this.disposed)return;this.reset();this.disposed=true;this.arms?.removeFromParent();this.arms?.dispose();this.arms?.material.dispose();this.petals.dispose();this.collars.dispose();if(this.source)this.disposeSource(this.source);this.source=undefined;this.stage.release();}
}
