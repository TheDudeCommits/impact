import * as THREE from 'three';
import type {CombatEvent} from '../../game/types';
import type {Fighter} from '../Fighter';
import type {Flight} from '../CombatEffects';
import {bodyCentre,type VfxKit} from '../vfx/VfxKit';
import {AOKIJI_MOVES,AOKIJI_AWAKENING,AOKIJI_SABER_SOCKET,aokijiMeshState} from '../../game/fighters/aokiji';
import {SIGNATURE,involvesLocal} from './context';
import {AokijiFrost} from './AokijiFrost';
export const AOKIJI_ICE_ASSETS:readonly string[]=Object.freeze([]);
export const AOKIJI_ICE_LIMITS=Object.freeze({facets:192,lines:128,rings:64,birds:16,crystals:96,impacts:24,ages:8});
export const AOKIJI_SABER_EDGE=AOKIJI_SABER_SOCKET;
export const isAokijiIce=(id:string|undefined)=>id==='aokiji';
const UP=new THREE.Vector3(0,1,0),FORWARD=new THREE.Vector3(0,0,1),ICE=new THREE.Color(0x83c7e7),DEEP=new THREE.Color(0x306b9e),WHITE=new THREE.Color(0xe9faff),TAU=Math.PI*2;
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
class IceBatch{
 readonly mesh:THREE.InstancedMesh<THREE.BufferGeometry,THREE.ShaderMaterial>;
 private tint:THREE.InstancedBufferAttribute;private cursor=0;private object=new THREE.Object3D();
 constructor(scene:THREE.Scene,name:string,geometry:THREE.BufferGeometry,readonly cap:number){
  this.tint=new THREE.InstancedBufferAttribute(new Float32Array(cap*4),4).setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('iceTint',this.tint);
  if(!geometry.hasAttribute('iceFrost'))geometry.setAttribute('iceFrost',new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count).fill(1),1));
  const material=new THREE.ShaderMaterial({name:`Aokiji-${name}`,transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
   vertexShader:'attribute vec4 iceTint;attribute float iceFrost;varying vec4 vTint;varying vec3 vN;varying vec3 vEye;varying float vFrost;void main(){vTint=iceTint;vFrost=iceFrost;vec4 p=modelViewMatrix*instanceMatrix*vec4(position,1.);vN=normalize(normalMatrix*mat3(instanceMatrix)*normal);vEye=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',
   fragmentShader:'varying vec4 vTint;varying vec3 vN;varying vec3 vEye;varying float vFrost;void main(){if(vTint.a<.003)discard;float edge=pow(1.-abs(dot(normalize(vN),normalize(vEye))),2.);float light=.72+.28*max(0.,dot(normalize(vN),normalize(vec3(.3,.9,.6))));vec3 body=mix(vTint.rgb*light,vec3(.83,.96,1.),max(0.,vFrost-1.)*.8)*min(1.,vFrost);gl_FragColor=vec4(mix(body,vec3(.92,.98,1.),edge*.65),vTint.a);\n#include <colorspace_fragment>\n}'});material.forceSinglePass=true;
  this.mesh=new THREE.InstancedMesh(geometry,material,cap);this.mesh.name=`aokiji-ice-${name}`;this.mesh.frustumCulled=false;this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.mesh.renderOrder=3;this.mesh.count=0;scene.add(this.mesh);
 }
 begin(){this.cursor=0;}
 add(p:THREE.Vector3,q:THREE.Quaternion,x:number,y:number,z:number,color:THREE.Color,alpha:number){if(this.cursor>=this.cap||Math.min(x,y,z)<=0||alpha<.003)return;this.object.position.copy(p);this.object.quaternion.copy(q);this.object.scale.set(x,y,z);this.object.updateMatrix();this.mesh.setMatrixAt(this.cursor,this.object.matrix);this.tint.setXYZW(this.cursor++,color.r,color.g,color.b,clamp(alpha));}
 end(){this.mesh.count=this.cursor;this.mesh.instanceMatrix.needsUpdate=true;this.tint.needsUpdate=true;}
 dispose(){this.mesh.removeFromParent();this.mesh.dispose();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
function pheasantGeometry(){
 const v:number[]=[];const tri=(a:number[],b:number[],c:number[])=>v.push(...a,...b,...c);
 const oct=(x:number,y:number,z:number,sx:number,sy:number,sz:number)=>{const p=[[x+sx,y,z],[x-sx,y,z],[x,y+sy,z],[x,y-sy,z],[x,y,z+sz],[x,y,z-sz]];for(const f of [[0,2,4],[4,2,1],[1,2,5],[5,2,0],[0,4,3],[4,1,3],[1,5,3],[5,0,3]])tri(p[f[0]],p[f[1]],p[f[2]]);};
 oct(0,0,0,.21,.18,.58);oct(0,.13,.44,.12,.18,.23);oct(0,.23,.61,.13,.13,.17);oct(0,.20,.80,.052,.06,.21);
 for(let side=-1;side<=1;side+=2){
  const outline=[[.12,.08,.25],[.45,.18,.18],[.82,.27,.05],[1.28,.24,-.28],[1.12,.14,-.50],[.85,.07,-.65],[.48,.015,-.48],[.14,0,-.25]].map(([x,y,z])=>[x*side,y,z]);
  const top=[.53*side,.19,-.16],bottom=[.53*side,.10,-.16];
  for(let i=0;i<outline.length;i++){tri(top,outline[i],outline[(i+1)%outline.length]);tri(bottom,outline[(i+1)%outline.length],outline[i]);}
  for(let i=0;i<6;i++){const x=side*(.42+i*.14),z=-.22-i*.035,y=.075+i*.018;
   const rootA=[x-side*.105,y,z],rootB=[x+side*.09,y+.01,z-.045],point=[x+side*.08,y-.035,z-.45+i*.02],ridge=[x,y+.04,z-.18];tri(rootA,ridge,point);tri(ridge,rootB,point);tri(rootB,rootA,point);}
 }
 for(let i=-1;i<=1;i++){const root=[i*.06,0,-.32],left=[i*.07-.045,.015,-.48],right=[i*.07+.045,.015,-.48],tip=[i*.18,-.025,-1.15+Math.abs(i)*.16];tri(root,left,tip);tri(root,tip,right);tri(left,right,tip);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.computeVertexNormals();return g;
}
function seaShardGeometry(){
 const v:number[]=[],frost:number[]=[];let face=0;
 const tri=(a:number[],b:number[],c:number[])=>{v.push(...a,...b,...c);const f=[.68,1.04,1.30,.83,1.18,.94,1.42][face++%7];frost.push(f,f,f);};
 const ring=(cx:number,cy:number,cz:number,r:number,height:number[],radii:number[],turn=0)=>height.map((h,i)=>{const a=turn+i*TAU/height.length;return[cx+Math.cos(a)*r*radii[i],cy+h,cz+Math.sin(a)*r*radii[i]];});
 const join=(a:number[][],b:number[][])=>{for(let i=0;i<a.length;i++){const j=(i+1)%a.length;tri(a[i],b[i],a[j]);tri(a[j],b[i],b[j]);}};
 const foot=ring(0,0,0,.62,[0,0,0,0,0,0,0],[1,.86,1.18,.82,1.04,.77,1.1]);
 const shoulder=ring(.05,.30,-.025,.45,[.01,.13,-.07,.09,-.035,.15,.02],[1,.91,.71,1.14,.89,1.04,.8],.06);
 const chip=ring(.16,.62,.05,.28,[.08,-.05,.15,-.10,.05,-.025,.1],[.86,1.12,.70,1.04,.80,1.15,.84],-.10);
 join(foot,shoulder);join(shoulder,chip);
 const point=[.32,1,.10];for(let i=0;i<7;i++)tri(chip[i],point,chip[(i+1)%7]);
 for(const [cx,cz,h,r,dx,dz]of [[-.36,.17,.56,.21,-.19,.12],[.25,-.35,.42,.20,.17,-.21],[.42,.26,.31,.17,.14,.15]]){
  const root=ring(cx,0,cz,r,[0,0,0,0,0],[1,.82,1.1,.76,.95],.23),crown=ring(cx+dx*.3,h*.53,cz+dz*.3,r*.57,[.01,-.03,.04,-.02,.015],[1,.9,.7,1,.8],.06),tip=[cx+dx,h,cz+dz];join(root,crown);for(let i=0;i<5;i++)tri(crown[i],tip,crown[(i+1)%5]);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setAttribute('iceFrost',new THREE.Float32BufferAttribute(frost,1));g.computeVertexNormals();return g;
}
type Age={actor:string;target:string;seq:number;finalHit:boolean;point:THREE.Vector3};
type Impact={actor:string;seq:number;born:number;seed:number;grade:number;projectile:boolean;point:THREE.Vector3};
export class AokijiIce{
 readonly frost:AokijiFrost;
 private facets:IceBatch;private lines:IceBatch;private rings:IceBatch;private birds:IceBatch;private crystals:IceBatch;private batches:IceBatch[];
 private ages:Age[]=Array.from({length:AOKIJI_ICE_LIMITS.ages},()=>({actor:'',target:'',seq:-1,finalHit:false,point:new THREE.Vector3()}));
 private impacts:Impact[]=Array.from({length:AOKIJI_ICE_LIMITS.impacts},()=>({actor:'',seq:-1,born:0,seed:0,grade:0,projectile:false,point:new THREE.Vector3()}));
 private sabers=new WeakMap<THREE.Object3D,THREE.Object3D|null>();
 private seen=new Float64Array(128).fill(-1);private seenTimes=new Float64Array(128).fill(-1);private eventCursor=0;private ageCursor=0;private hitCursor=0;private disposed=false;
 private p=new THREE.Vector3();private a=new THREE.Vector3();private b=new THREE.Vector3();private local=new THREE.Vector3();private direction=new THREE.Vector3();private q=new THREE.Quaternion();private face=new THREE.Quaternion();private flat=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
 constructor(scene:THREE.Scene,private kit:Pick<VfxKit,'budget'>&Partial<VfxKit>){this.frost=new AokijiFrost(scene,kit);this.facets=new IceBatch(scene,'facets',new THREE.OctahedronGeometry(.5,0),AOKIJI_ICE_LIMITS.facets);this.lines=new IceBatch(scene,'lines',new THREE.BoxGeometry(1,1,1),AOKIJI_ICE_LIMITS.lines);this.rings=new IceBatch(scene,'rings',new THREE.RingGeometry(.975,1,32),AOKIJI_ICE_LIMITS.rings);this.birds=new IceBatch(scene,'birds',pheasantGeometry(),AOKIJI_ICE_LIMITS.birds);this.crystals=new IceBatch(scene,'crystals',seaShardGeometry(),AOKIJI_ICE_LIMITS.crystals);this.batches=[this.facets,this.lines,this.rings,this.birds,this.crystals];}
 load(_ids:readonly string[]):Promise<void>{return Promise.resolve();}
 handle(e:CombatEvent,fighters?:ReadonlyMap<string,Fighter>){
  if(this.disposed)return;this.frost.handle(e,fighters);if(e.kind==='eliminated'||e.kind==='respawn'){this.cancel(e.actorId,true);return;}if(!isAokijiIce(e.fighter))return;if(e.kind==='whiff'||e.kind==='rejected'){this.cancel(e.actorId);return;}if(e.kind!=='confirm'&&e.kind!=='hit')return;
  for(let i=0;i<this.seen.length;i++)if(this.seen[i]===e.id&&this.seenTimes[i]===e.serverTime)return;const index=this.eventCursor++%128;this.seen[index]=e.id;this.seenTimes[index]=e.serverTime;
  const f=fighters?.get(e.actorId),target=e.targetId?fighters?.get(e.targetId):undefined,seq=e.actionSeq??f?.state.actionSeq??-1;
  if(e.kind==='confirm'){if(e.slot==='ultimate'&&!e.branch&&e.targetId)Object.assign(this.ages[this.ageCursor++%this.ages.length],{actor:e.actorId,target:e.targetId,seq,finalHit:false});return;}
  if(!target&&!e.endpoint)return;const final=e.slot==='ultimate'&&!e.branch&&e.contactIndex===2,h=this.impacts[this.hitCursor++%this.impacts.length];Object.assign(h,{actor:e.actorId,seq,born:e.serverTime,seed:e.id,grade:final?3:e.slot==='heavy'||e.slot==='special'?2:1,projectile:e.slot==='special'&&!e.branch});if(target)bodyCentre(target,h.point);else h.point.set(e.endpoint!.x,e.endpoint!.y,e.endpoint!.z);
  if(final){for(const age of this.ages)if(age.actor===e.actorId&&age.target===e.targetId&&age.seq===seq){age.finalHit=true;age.point.copy(h.point);}if(involvesLocal(e.actorId,e.targetId))SIGNATURE.screen?.impactFrame?.(.42,h.point);}
 }
 private cancel(id:string,targetToo=false){for(const age of this.ages)if(age.actor===id||targetToo&&age.target===id&&!age.finalHit)age.actor='';for(const h of this.impacts)if(h.actor===id)h.actor='';}
 private line(from:THREE.Vector3,to:THREE.Vector3,width:number,color:THREE.Color,alpha:number){this.direction.subVectors(to,from);const length=this.direction.length();if(length<.001)return;this.q.setFromUnitVectors(UP,this.direction.multiplyScalar(1/length));this.p.copy(from).lerp(to,.5);this.lines.add(this.p,this.q,width,length,width,color,alpha);}
 private saberVisible(f:Fighter){if(!f.model)return aokijiMeshState(f.state.action,f.state.actionTime*f.state.actionDuration).saber;if(!this.sabers.has(f.model))this.sabers.set(f.model,f.model.getObjectByName('Aokiji_Ice_Saber')??null);return this.sabers.get(f.model)?.visible??false;}
 private blade(f:Fighter,alpha:number){const joint=f.joints.get('AokijiSaber');if(!joint)return;this.a.fromArray(AOKIJI_SABER_EDGE.base).applyMatrix4(joint.matrixWorld);this.b.fromArray(AOKIJI_SABER_EDGE.tip).applyMatrix4(joint.matrixWorld);this.line(this.a,this.b,.011,WHITE,alpha);}
 private bird(position:THREE.Vector3,heading:THREE.Vector3,time:number,detail:boolean){
  this.face.setFromUnitVectors(FORWARD,this.direction.copy(heading).normalize());this.p.copy(position);this.birds.add(this.p,this.face,1,1,1,ICE,.90);
  for(let i=0;i<(detail?4:2);i++){this.local.set(Math.sin(i*2.4+time*3)*.15,Math.cos(i*1.7)*.06,-1.2-i*.18).applyQuaternion(this.face);this.p.copy(position).add(this.local);this.facets.add(this.p,this.face,.035,.025,.13,WHITE,.6-i*.10);}
 }
 update(time:number,fighters:ReadonlyMap<string,Fighter>,flights:ReadonlyMap<string,Flight>,all:ReadonlyMap<string,Flight>=flights){
  if(this.disposed)return;this.frost.update(time,fighters,all);for(const b of this.batches)b.begin();const detail=this.kit.budget>=.65;
  for(const f of fighters.values()){
   const s=f.state;if(!isAokijiIce(s.fighter)||!s.alive)continue;const elapsed=s.actionTime*s.actionDuration;
   if(s.action==='awaken'){this.awakening(f,elapsed,detail);continue;}
   if((s.action==='light'||s.action==='heavy')&&s.whiffedAt===undefined){const alpha=Math.sin(clamp(s.actionTime)*Math.PI);f.strikePoint(this.p);this.face.copy(f.group.quaternion);this.rings.add(this.p,this.face,.18,.18,.18,WHITE,alpha*.7);if(this.saberVisible(f)&&s.action==='light')this.blade(f,alpha*.6);else if(!this.saberVisible(f)&&elapsed<.18){const fade=1-elapsed/.18;for(let i=0;i<4;i++){this.p.copy(f.handR);this.p.x+=Math.sin(i*2.4)*elapsed*.7;this.p.z+=Math.cos(i*2.4)*elapsed*.7;this.p.y-=elapsed*(.5+i*.12);this.facets.add(this.p,this.face,.022,.06,.022,ICE,fade*.6);}}}
   if(s.action==='special'&&!s.branch&&s.whiffedAt===undefined&&elapsed<AOKIJI_MOVES.special.contacts[0]){const t=clamp(elapsed/AOKIJI_MOVES.special.contacts[0]);this.p.copy(f.handR);this.q.copy(f.group.quaternion);this.facets.add(this.p,this.q,.16+t*.12,.12+t*.12,.16+t*.12,ICE,.6);}
  }
  for(const flight of flights.values())if(isAokijiIce(flight.fighter)&&flight.slot==='special'&&!flight.branch&&flight.released)this.bird(flight.position,flight.heading,time,detail);
  for(const age of this.ages){
   if(!age.actor)continue;const f=fighters.get(age.actor),target=fighters.get(age.target),s=f?.state;
   if(!f||!s?.alive||!target?.state.alive&&!age.finalHit||s.action!=='ultimate'||s.branch||(s.actionSeq??-1)!==age.seq||s.whiffedAt!==undefined){age.actor='';continue;}
   const elapsed=s.actionTime*s.actionDuration;if(elapsed>3.65){age.actor='';continue;}if(elapsed<2.3)continue;
   if(target?.state.alive)bodyCentre(target,age.point);const fade=clamp((3.65-elapsed)/.25),charge=clamp((elapsed-2.3)/.7);this.a.copy(age.point);this.a.y=f.group.position.y+.035;
   this.rings.add(this.a,this.flat,.6+charge*.45,.6+charge*.45,1,ICE,.55*fade);
   const count=detail?9:6;
   for(let i=0;i<count;i++){
    const theta=i*2.39996+.3+Math.sin(i*7.17)*.38,radius=.72+charge*(.23+(Math.sin(i*3.71)+1)*.52);this.b.copy(this.a);this.b.x+=Math.sin(theta)*radius;this.b.z+=Math.cos(theta)*radius;
    this.local.copy(this.a);this.local.x+=Math.sin(theta+.2)*radius*.48;this.local.z+=Math.cos(theta+.2)*radius*.48;this.line(this.a,this.local,.014,ICE,.55*fade);this.line(this.local,this.b,.019,WHITE,.6*fade);
    if(age.finalHit&&elapsed>=3){const t=clamp((elapsed-3-(i%3)*.014)/.11),height=(.72+(Math.sin(i*2.91+.8)+1)*.74)*t;this.p.copy(this.b);this.q.setFromAxisAngle(UP,theta+Math.sin(i*4.37)*.9);this.crystals.add(this.p,this.q,.43+(Math.cos(i*2.17)+1)*.15,height,.38+(Math.sin(i*5.13)+1)*.17,i%3===0?DEEP:ICE,fade*.90);}
   }
  }
  for(const h of this.impacts){
   if(!h.actor)continue;const s=fighters.get(h.actor)?.state,elapsed=time-h.born,life=h.grade===3?.46:.26;
   if(!s?.alive||!h.projectile&&((s.actionSeq??-1)!==h.seq||!['light','heavy','special','ultimate'].includes(s.action)||s.whiffedAt!==undefined)||elapsed>=life){h.actor='';continue;}if(elapsed<0)continue;
   const fade=1-elapsed/life;this.q.identity();this.p.copy(h.point);this.rings.add(this.p,this.q,.12+elapsed*3,.12+elapsed*3,1,WHITE,fade*.75);
   for(let i=0;i<(detail?5:3)*h.grade;i++){const theta=i*2.39996+h.seed;this.p.copy(h.point);this.p.x+=Math.sin(theta)*elapsed*(2+h.grade);this.p.z+=Math.cos(theta)*elapsed*(2+h.grade);this.p.y+=elapsed*(i%3-1)*2-elapsed*elapsed*4;this.q.setFromAxisAngle(FORWARD,theta);const k=.05*fade;this.facets.add(this.p,this.q,k,k*3,k,i%3?ICE:WHITE,fade*.85);}
  }
  for(const b of this.batches)b.end();
 }
 private awakening(f:Fighter,t:number,detail:boolean){const release=AOKIJI_AWAKENING.beats.release;if(t<release)return;const age=t-release,fade=clamp((.9-t)/.18);this.blade(f,fade*.8);this.p.copy(f.group.position);this.p.y+=.028;this.rings.add(this.p,this.flat,.6+age*2,.6+age*2,1,ICE,fade*.6);
  for(let i=0;i<(detail?10:5);i++){const theta=i*2.39996;this.p.copy(f.group.position);this.p.x+=Math.sin(theta)*(.4+age*.4);this.p.z+=Math.cos(theta)*(.4+age*.4);this.p.y+=.2+(i%4)*.31+age*.35;this.q.setFromAxisAngle(FORWARD,theta);this.facets.add(this.p,this.q,.045,.13,.04,i%3?ICE:WHITE,fade*.65);}
 }
 reset(){for(const age of this.ages)age.actor='';for(const h of this.impacts)h.actor='';this.seen.fill(-1);this.seenTimes.fill(-1);this.eventCursor=this.ageCursor=this.hitCursor=0;for(const b of this.batches){b.begin();b.end();}this.frost.reset();}
 dispose(){if(this.disposed)return;this.disposed=true;this.reset();for(const b of this.batches)b.dispose();this.frost.dispose();}
}
