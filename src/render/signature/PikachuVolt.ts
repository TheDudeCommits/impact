import * as THREE from 'three';
import type {CombatEvent} from '../../game/types';
import type {Fighter} from '../Fighter';
import type {Flight} from '../CombatEffects';
import {bodyCentre,type VfxKit} from '../vfx/VfxKit';
import {SIGNATURE,involvesLocal} from './context';
import {pikachuStrikeJoint,PIKACHU_CHEEK_SOCKET,PIKACHU_FRONT_SOCKET} from '../../game/fighters/pikachu';
export const isPikachuVolt=(id:string|undefined)=>id==='pikachu';
export const PIKACHU_VOLT_ASSETS:readonly string[]=Object.freeze([]);
export const PIKACHU_VOLT_LIMITS=Object.freeze({ribbons:640,flashes:32,impacts:24,confirms:8});
const BRANCH=Object.freeze({lh:'Tail Feint',llh:'Rising Spark',lllh:'Iron Tail Breaker',llls:'Volt Burst',airHeavy:'Falling Iron Tail',airSpecial:'Thunder Dive'});
export function pikachuStrikePoint(f:Fighter,out:THREE.Vector3,clip?:string,sourceTime?:number,index?:number){
 const s=f.state;if(!clip&&s.branch)clip=BRANCH[s.branch];if(!clip&&s.action==='light'&&s.chain)clip=`Rush ${s.chain}`;
 if(!clip)clip=s.action==='heavy'?'Iron Tail':s.action==='special'?'Thunderbolt':s.action==='ultimate'?'Volt Tackle':'Quick Attack';
 const t=sourceTime??s.actionTime*s.actionDuration,i=index??(t>2?2:t>.8?1:0),joint=pikachuStrikeJoint(clip,i);
 if(joint==='LeftHand'||joint==='RightHand')return out.copy(joint==='LeftHand'?f.handL:f.handR);
 const bone=f.bones?.get(joint.toLowerCase());if(bone){if(clip==='Thunderbolt'||clip==='Volt Burst'||clip==='Thunder Dive')return bone.localToWorld(out.set((PIKACHU_CHEEK_SOCKET.left[0]+PIKACHU_CHEEK_SOCKET.right[0])*.5,(PIKACHU_CHEEK_SOCKET.left[1]+PIKACHU_CHEEK_SOCKET.right[1])*.5,(PIKACHU_CHEEK_SOCKET.left[2]+PIKACHU_CHEEK_SOCKET.right[2])*.5));if(joint==='Head')return bone.localToWorld(out.set(PIKACHU_FRONT_SOCKET[0],PIKACHU_FRONT_SOCKET[1],PIKACHU_FRONT_SOCKET[2]));return bone.getWorldPosition(out);}
 return bodyCentre(f,out);
}
const UP=new THREE.Vector3(0,1,0),FRONT=new THREE.Vector3(0,0,1),RIGHT=new THREE.Vector3(1,0,0),CROSS_ROTATION=new THREE.Quaternion(0,Math.SQRT1_2,0,Math.SQRT1_2);
const WHITE=new THREE.Color(0xfffee8),GOLD=new THREE.Color(0xffb51f),BLUE=new THREE.Color(0x9fdcff);
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
class VoltBatch{
 readonly mesh:THREE.InstancedMesh<THREE.BufferGeometry,THREE.ShaderMaterial>;private tint:THREE.InstancedBufferAttribute;private object=new THREE.Object3D();private count=0;
 constructor(scene:THREE.Scene,name:string,geometry:THREE.BufferGeometry,private capacity:number){
  this.tint=new THREE.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('voltTint',this.tint);
  const material=new THREE.ShaderMaterial({name:`Pikachu-${name}`,transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,toneMapped:false,
   vertexShader:'attribute vec4 voltTint;varying vec4 vTint;varying vec2 vUv;void main(){vTint=voltTint;vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',
   fragmentShader:'varying vec4 vTint;varying vec2 vUv;void main(){float a=vTint.a;if(a<.005)discard;gl_FragColor=vec4(vTint.rgb,a);\n#include <colorspace_fragment>\n}'});
  this.mesh=new THREE.InstancedMesh(geometry,material,capacity);this.mesh.name=`pikachu-volt-${name}`;this.mesh.frustumCulled=false;this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.mesh.count=0;scene.add(this.mesh);
 }
 begin(){this.count=0;}
 get full(){return this.count>=this.capacity;}
 add(p:THREE.Vector3,q:THREE.Quaternion,x:number,y:number,z:number,color:THREE.Color,alpha:number){if(this.count>=this.capacity||alpha<=.005||Math.min(x,y,z)<=0)return;this.object.position.copy(p);this.object.quaternion.copy(q);this.object.scale.set(x,y,z);this.object.updateMatrix();this.mesh.setMatrixAt(this.count,this.object.matrix);this.tint.setXYZW(this.count++,color.r,color.g,color.b,clamp(alpha));}
 end(){this.mesh.count=this.count;this.mesh.instanceMatrix.needsUpdate=true;this.tint.needsUpdate=true;}
 dispose(){this.mesh.removeFromParent();this.mesh.dispose();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
type Impact={actor:string;born:number;seed:number;grade:number;point:THREE.Vector3};
type Confirm={actor:string;target:string;seq:number};
export class PikachuVolt{
 private ribbons:VoltBatch;private flashes:VoltBatch;private batches:VoltBatch[];
 private impacts:Impact[]=Array.from({length:24},()=>({actor:'',born:-1e9,seed:0,grade:0,point:new THREE.Vector3()}));
 private confirms:Confirm[]=Array.from({length:8},()=>({actor:'',target:'',seq:-1}));
 private seen=new Float64Array(128).fill(-1);private seenTime=new Float64Array(128).fill(-1);private cursor=0;private impactCursor=0;private confirmCursor=0;private disposed=false;
 private p=new THREE.Vector3();private a=new THREE.Vector3();private b=new THREE.Vector3();private c=new THREE.Vector3();private d=new THREE.Vector3();private from=new THREE.Vector3();private to=new THREE.Vector3();private stepA=new THREE.Vector3();private stepB=new THREE.Vector3();private direction=new THREE.Vector3();private axis=new THREE.Vector3();private cross=new THREE.Vector3();private forward=new THREE.Vector3();private side=new THREE.Vector3();private q=new THREE.Quaternion();private q2=new THREE.Quaternion();private face=new THREE.Quaternion();
 constructor(scene:THREE.Scene,private kit:Pick<VfxKit,'budget'>){
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,-.5,0,-.5,-.22,0,.5,-.13,0,-.5,-.22,0,.5,-.13,0,.37,.28,0,-.5,-.22,0,.37,.28,0,-.24,.19,0,-.24,.19,0,.37,.28,0,0,.5,0],3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(Array.from({length:24},(_,i)=>i%2?.5:1),2));
  this.ribbons=new VoltBatch(scene,'ribbons',geometry,640);this.flashes=new VoltBatch(scene,'flashes',new THREE.RingGeometry(.83,1,32,1),32);this.batches=[this.ribbons,this.flashes];
 }
 load(_ids:readonly string[]){return Promise.resolve();}
 private cancel(id:string){for(const c of this.confirms)if(c.actor===id||c.target===id)c.actor='';}
 handle(e:CombatEvent,fighters?:ReadonlyMap<string,Fighter>){
  if(this.disposed)return;if(e.kind==='eliminated'||e.kind==='respawn'){this.cancel(e.actorId);return;}if(!isPikachuVolt(e.fighter))return;if(e.kind==='whiff'||e.kind==='rejected'){this.cancel(e.actorId);return;}if(e.kind!=='hit'&&e.kind!=='confirm')return;
  for(let i=0;i<128;i++)if(this.seen[i]===e.id&&this.seenTime[i]===e.serverTime)return;const at=this.cursor++%128;this.seen[at]=e.id;this.seenTime[at]=e.serverTime;
  const f=fighters?.get(e.actorId),v=e.targetId?fighters?.get(e.targetId):undefined;
  if(e.kind==='confirm'){if(e.slot==='ultimate'&&!e.branch&&e.targetId){const c=this.confirms[this.confirmCursor++%8];c.actor=e.actorId;c.target=e.targetId;c.seq=e.actionSeq??f?.state.actionSeq??-1;}return;}
  if(!e.endpoint&&!v)return;const hit=this.impacts[this.impactCursor++%24];hit.actor=e.actorId;hit.born=e.serverTime;hit.seed=e.id;hit.grade=e.slot==='ultimate'&&!e.branch&&e.contactIndex===2?3:e.slot==='heavy'||e.slot==='special'?2:1;
  if(e.endpoint)hit.point.set(e.endpoint.x,e.endpoint.y,e.endpoint.z);else if(v)bodyCentre(v,hit.point);
  if(hit.grade===3&&involvesLocal(e.actorId,e.targetId))SIGNATURE.screen?.impactFrame?.(.43,hit.point);
 }
 private segment(a:THREE.Vector3,b:THREE.Vector3,width:number,color:THREE.Color,alpha:number){
  this.direction.subVectors(b,a);const length=this.direction.length();if(length<.001)return;width=Math.min(width,length*.25);this.q.setFromUnitVectors(UP,this.direction.multiplyScalar(1/length));this.p.copy(a).lerp(b,.5);this.ribbons.add(this.p,this.q,width,length,1,color,alpha);
  this.q2.copy(this.q).multiply(CROSS_ROTATION);this.ribbons.add(this.p,this.q2,width*.8,length,1,color,alpha*.8);
 }
 private bolt(start:THREE.Vector3,end:THREE.Vector3,width:number,alpha:number,seed:number,detail:boolean){
  if(this.ribbons.full)return;this.from.copy(start);this.to.copy(end);this.axis.subVectors(this.to,this.from);const length=this.axis.length();if(length<.002)return;this.axis.multiplyScalar(1/length);this.cross.crossVectors(this.axis,UP);if(this.cross.lengthSq()<.01)this.cross.crossVectors(this.axis,FRONT);this.cross.normalize();
  this.stepA.copy(this.from);const n=detail?7:4;for(let i=1;i<=n;i++){
   const u=i/n,jitter=i===n?0:Math.sin(i*5.19+seed)*Math.min(.12,length*.12);this.stepB.copy(this.from).lerp(this.to,u).addScaledVector(this.cross,jitter);
   this.segment(this.stepA,this.stepB,width*(.65+Math.sin(u*Math.PI)*.65),GOLD,alpha);this.segment(this.stepA,this.stepB,width*.28,WHITE,alpha);this.stepA.copy(this.stepB);
  }
 }
 private socket(f:Fighter,name:string,out:THREE.Vector3){const bone=f.bones?.get(name.toLowerCase());return bone?bone.getWorldPosition(out):bodyCentre(f,out);}
 private cheek(f:Fighter,left:boolean,out:THREE.Vector3){const bone=f.bones?.get('head'),p=left?PIKACHU_CHEEK_SOCKET.left:PIKACHU_CHEEK_SOCKET.right;return bone?bone.localToWorld(out.set(p[0],p[1],p[2])):bodyCentre(f,out);}
 update(time:number,fighters:ReadonlyMap<string,Fighter>,flights:ReadonlyMap<string,Flight>){
  if(this.disposed)return;for(const b of this.batches)b.begin();const detail=this.kit.budget>=.65,seed=Math.floor(time*24);
  for(const f of fighters.values()){
   const s=f.state;if(!isPikachuVolt(s.fighter)||!s.alive)continue;const phase=clamp(s.actionTime),t=phase*s.actionDuration;this.forward.set(Math.sin(s.yaw),0,Math.cos(s.yaw));this.side.set(this.forward.z,0,-this.forward.x);this.face.setFromUnitVectors(FRONT,this.forward);
   if(s.action==='awaken'){
    const fade=clamp(phase/.1)*clamp((1-phase)/.12);this.cheek(f,true,this.a);this.cheek(f,false,this.b);
    if(phase>.22){this.d.copy(this.a).addScaledVector(this.forward,.12);this.bolt(this.a,this.d,.023,fade,seed,detail);this.d.copy(this.b).addScaledVector(this.forward,.12);this.bolt(this.b,this.d,.023,fade,seed+3,detail);}
    if(phase>.48&&phase<.84){this.socket(f,'PikachuTailTip',this.a);this.b.copy(this.a);this.b.y+=.2+Math.sin((phase-.48)/.36*Math.PI)*.65;this.bolt(this.a,this.b,.036,fade,seed+9,detail);}
    if(phase>.75){this.c.copy(f.group.position);this.c.y+=.04;this.q.setFromAxisAngle(RIGHT,-Math.PI/2);const r=.35+(phase-.75)*2;this.flashes.add(this.c,this.q,r,r,1,GOLD,fade*.75);}continue;
   }
   if(s.whiffedAt!==undefined)continue;
   if(s.action==='ultimate'&&t>.56&&s.confirmedAt===undefined)continue;
   const power=Math.sin(phase*Math.PI);
   if(s.action==='heavy'||s.branch==='lh'||s.branch==='lllh'||s.branch==='airHeavy'||s.action==='ultimate'&&t>.85&&t<1.9){
    this.socket(f,'PikachuTail1',this.a);this.socket(f,'PikachuTailTip',this.b);this.bolt(this.a,this.b,.017,power,seed,detail);this.flashes.add(this.b,this.face,.10+power*.08,.10+power*.08,1,BLUE,power*.8);continue;
   }
   if(s.action==='special'||s.branch==='llls'||s.branch==='airSpecial'){
    if(phase>.18&&phase<.62){this.cheek(f,true,this.a);this.cheek(f,false,this.b);this.d.copy(this.a).lerp(this.b,.5).addScaledVector(this.forward,.09);this.bolt(this.a,this.d,.018,power,seed,detail);this.bolt(this.b,this.d,.018,power,seed+5,detail);}continue;
   }
   if(s.action==='light'||s.action==='ultimate'&&t<.72){f.strikePoint(this.c);this.a.copy(this.c).addScaledVector(this.forward,-.19);this.b.copy(this.c).addScaledVector(this.forward,.08);this.bolt(this.a,this.b,.012,power*.7,seed,detail);}
  }
  for(const f of flights.values()){
   if(!isPikachuVolt(f.fighter)||f.slot!=='special'||f.branch||!f.released||!f.origin)continue;
   this.forward.copy(f.heading).normalize();const distance=Math.max(0,this.direction.subVectors(f.position,f.origin).dot(this.forward)),length=Math.min(2.1,distance);if(length<.003)continue;
   this.a.copy(f.position).addScaledVector(this.forward,-length);this.b.copy(f.position);this.bolt(this.a,this.b,.055,.95,seed,detail);
   this.side.set(this.forward.z,0,-this.forward.x);for(let i=0;i<(detail?3:1);i++){const u=(i+1)/4;this.a.copy(f.position).addScaledVector(this.forward,-length*u);this.b.copy(this.a).addScaledVector(this.forward,-length*.12).addScaledVector(this.side,(i%2?1:-1)*Math.min(.16,length*.07));this.bolt(this.a,this.b,.020,.8,seed+i*8,detail);}
  }
  for(const c of this.confirms){
   if(!c.actor)continue;const f=fighters.get(c.actor),v=fighters.get(c.target),s=f?.state;if(!f||!v?.state.alive||!s?.alive||s.action!=='ultimate'||s.branch||(s.actionSeq??-1)!==c.seq||s.whiffedAt!==undefined){c.actor='';continue;}
   const t=s.actionTime*s.actionDuration;if(t<2.34||t>3.43)continue;const fade=clamp((t-2.34)/.22)*clamp((3.43-t)/.23);this.socket(f,'Head',this.c);this.socket(f,'PikachuTailTip',this.d);this.bolt(this.d,this.c,.03,fade,seed,detail);
   this.forward.set(Math.sin(s.yaw),0,Math.cos(s.yaw));this.side.set(this.forward.z,0,-this.forward.x);for(let i=0;i<(detail?3:2);i++){this.a.copy(this.c).addScaledVector(this.side,(i-1)*.19);this.a.y+=Math.sin(i*2.1)*.14;this.b.copy(this.a).addScaledVector(this.forward,-.45-fade*.40);this.b.y-=.1;this.bolt(this.a,this.b,.03,fade,seed+i*3,detail);}
  }
  for(const h of this.impacts){if(!h.actor)continue;const age=time-h.born,life=h.grade===3?.55:.25;if(age>=life){h.actor='';continue;}if(age<0)continue;const fade=1-age/life,n=(detail?4:2)*h.grade;for(let i=0;i<n;i++){const angle=i*2.39996+h.seed;this.a.copy(h.point);this.b.copy(h.point);const distance=.12+age*(h.grade===3?5:3.5);this.b.x+=Math.sin(angle)*distance;this.b.y+=Math.cos(angle)*distance;this.b.z+=Math.sin(angle*1.3)*distance*.55;this.bolt(this.a,this.b,.026*fade,fade,seed+i,detail);}if(h.grade===3){this.face.setFromAxisAngle(UP,.25);this.flashes.add(h.point,this.face,.2+age*2.5,.2+age*2.5,1,WHITE,fade*.7);}}
  for(const b of this.batches)b.end();
 }
 reset(){for(const i of this.impacts)i.actor='';for(const c of this.confirms)c.actor='';this.seen.fill(-1);this.seenTime.fill(-1);this.cursor=this.impactCursor=this.confirmCursor=0;for(const b of this.batches){b.begin();b.end();}}
 dispose(){if(this.disposed)return;this.disposed=true;this.reset();for(const b of this.batches)b.dispose();}
}
