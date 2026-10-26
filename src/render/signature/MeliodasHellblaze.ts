import * as THREE from 'three';
import type {CombatEvent} from '../../game/types';
import type {Fighter} from '../Fighter';
import type {Flight} from '../CombatEffects';
import type {VfxKit} from '../vfx/VfxKit';
import {SIGNATURE,involvesLocal} from './context';
import {MELIODAS_MOVES} from '../../game/fighters/meliodas';
import {MoveStage,POOL,STAGE,stageLook} from './MoveStage';
import { blowFloor } from './blowFloor';
export const isMeliodasHellblaze=(id:string|undefined)=>id==='meliodas';
export function meliodasStrikeJoint(action:string,clip?:string):'LeftHand'|'RightHand'{return clip==='Enchant Hellblaze'||clip==='Hellblaze Drive'||action==='special'&&!clip?'RightHand':'LeftHand';}
export const MELIODAS_HELLBLAZE_LIMITS=Object.freeze({flames:160,strokes:144,crescents:64,impacts:24,trails:16});
const UP=new THREE.Vector3(0,1,0),FRONT=new THREE.Vector3(0,0,1),RIGHT=new THREE.Vector3(1,0,0),INK=new THREE.Color(0x130d20),VIOLET=new THREE.Color(1.5,.5,2.9),MAGENTA=new THREE.Color(2.3,1,3.1),WHITE=new THREE.Color(0xf7eaff);
const HELL=STAGE.dark,COUNTER=stageLook(0xffffff,0xd9a8ff,0x7a3fd0,{heart:.5});
const EDGE=stageLook(0xf0d8ff,0xb060ff,0x5a1fa0);
const HEAVY=MELIODAS_MOVES.heavy,SPECIAL=MELIODAS_MOVES.special,ULT=MELIODAS_MOVES.ultimate,ULT_LAST=ULT.contacts[ULT.contacts.length-1];
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
type Confirm={actor:string;target:string;seq:number;final:boolean;floor:number};
const NO_FLIGHTS:ReadonlyMap<string,Flight>=new Map();
const ROOT=new THREE.Vector3(.107978,-.002969,-.239428),TIP=new THREE.Vector3(.066096,.004871,.280593),FORM_ROOT=new THREE.Vector3(.048711,.067633,-.258463),FORM_TIP=new THREE.Vector3(.006830,.075473,.261558);
export function meliodasBladePoint(f:Pick<Fighter,'drawnJoint'|'shownBody'>,out:THREE.Vector3,tip=true){const hand=f.drawnJoint('LeftHand');if(!hand)return false;out.copy(f.shownBody!==f?(tip?FORM_TIP:FORM_ROOT):(tip?TIP:ROOT)).applyMatrix4(hand.matrixWorld);return true;}
export function meliodasFlameGeometry(){
 const positions:number[]=[],uvs:number[]=[],indices:number[]=[],steps=12;
 for(let sheet=0;sheet<2;sheet++){
  const angle=sheet*Math.PI/2,c=Math.cos(angle),sn=Math.sin(angle),base=positions.length/3;
  for(let i=0;i<=steps;i++){
   const t=i/steps,width=.38*Math.pow(Math.sin(Math.PI*Math.min(.999,t*.92+.04)),.68)*Math.pow(1-t,.52)+.003;
   const curl=.23*Math.sin(t*Math.PI*1.6)*t+.14*t*t,depth=.07*Math.sin(t*Math.PI*2)*t;
   for(const side of[-1,1]){const x=curl+side*width;positions.push(x*c-depth*sn,t-.44,x*sn+depth*c);uvs.push((side+1)/2,t);}
   if(i<steps){const n=base+i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}
  }
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
class FlameBatch{
 readonly mesh:THREE.InstancedMesh<THREE.BufferGeometry,THREE.ShaderMaterial>;
 private tint:THREE.InstancedBufferAttribute;private pose=new THREE.Object3D();private count=0;
 constructor(scene:THREE.Scene,name:string,geometry:THREE.BufferGeometry,private capacity:number,flame=false){this.tint=new THREE.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('hellTint',this.tint);const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,uniforms:{hellTime:{value:0},hellFlame:{value:flame?1:0}},vertexShader:`attribute vec4 hellTint;uniform float hellTime;uniform float hellFlame;varying vec4 vTint;varying vec2 vUv;void main(){vTint=hellTint;vUv=uv;vec3 p=position;float tip=pow(uv.y,1.7)*hellFlame;float phase=hellTime*8.+instanceMatrix[3].x*2.7+instanceMatrix[3].z*3.1;p.x+=sin(uv.y*7.-phase)*.13*tip;p.z+=cos(uv.y*8.-phase*.81)*.09*tip;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(p,1.);}`,fragmentShader:`uniform float hellFlame;varying vec4 vTint;varying vec2 vUv;void main(){float edge=smoothstep(0.,.10,min(vUv.x,1.-vUv.x));float tip=1.-smoothstep(.86,1.,vUv.y);float alpha=vTint.a*mix(1.,edge*tip,hellFlame);if(alpha<.004)discard;gl_FragColor=vec4(vTint.rgb,alpha);}`});material.forceSinglePass=true;this.mesh=new THREE.InstancedMesh(geometry,material,capacity);this.mesh.name='meliodas-'+name;this.mesh.frustumCulled=false;this.mesh.renderOrder=6;this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.mesh.count=0;scene.add(this.mesh);}
 begin(time=0){this.count=0;this.mesh.material.uniforms.hellTime.value=time;}
 add(p:THREE.Vector3,q:THREE.Quaternion,x:number,y:number,z:number,color:THREE.Color,alpha:number){if(this.count>=this.capacity||alpha<.004)return;this.pose.position.copy(p);this.pose.quaternion.copy(q);this.pose.scale.set(x,y,z);this.pose.updateMatrix();this.mesh.setMatrixAt(this.count,this.pose.matrix);this.tint.setXYZW(this.count++,color.r,color.g,color.b,Math.min(1,alpha));}
 end(){this.mesh.count=this.count;this.mesh.instanceMatrix.needsUpdate=true;this.tint.needsUpdate=true;}
 dispose(){this.mesh.removeFromParent();this.mesh.dispose();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
type Impact={actor:string;born:number;grade:number;seed:number;yaw:number;point:THREE.Vector3};
type Trail={actor:string;seq:number;seen:number;point:THREE.Vector3};
export class MeliodasHellblaze{
 private flames:FlameBatch;private strokes:FlameBatch;private crescents:FlameBatch;private disposed=false;
 private impacts:Impact[]=Array.from({length:24},()=>({actor:'',born:-1e9,grade:0,seed:0,yaw:0,point:new THREE.Vector3()}));
 private trails:Trail[]=Array.from({length:16},()=>({actor:'',seq:-1,seen:-1e9,point:new THREE.Vector3()}));
 private seen=new Float64Array(128).fill(-1);private seenTime=new Float64Array(128).fill(-1);private cursor=0;private eventCursor=0;
 private a=new THREE.Vector3();private b=new THREE.Vector3();private p=new THREE.Vector3();private d=new THREE.Vector3();private q=new THREE.Quaternion();private spin=new THREE.Quaternion();private flat=new THREE.Quaternion().setFromAxisAngle(RIGHT,-Math.PI/2);
 private readonly stage:MoveStage;private dir=new THREE.Vector3();private ground=new THREE.Vector3();private hand=new THREE.Vector3();private confirmCursor=0;
 private confirms:Confirm[]=Array.from({length:8},()=>({actor:'',target:'',seq:-1,final:false,floor:0}));
 constructor(scene:THREE.Scene,private kit:Pick<VfxKit,'budget'>&Partial<VfxKit>){this.stage=MoveStage.for(scene,kit);this.flames=new FlameBatch(scene,'black-flames',meliodasFlameGeometry(),160,true);this.strokes=new FlameBatch(scene,'blade-wakes',new THREE.BoxGeometry(1,1,1),144);this.crescents=new FlameBatch(scene,'hell-crescents',new THREE.RingGeometry(.79,1,28,1,.1,Math.PI*1.3),64);}
 load(_ids:readonly string[]){return Promise.resolve();}
 handle(e:CombatEvent,fighters?:ReadonlyMap<string,Fighter>){if(this.disposed)return;if(e.kind==='eliminated'||e.kind==='respawn'||e.kind==='whiff'||e.kind==='rejected'){for(const h of this.impacts)if(h.actor===e.actorId)h.actor='';for(const t of this.trails)if(t.actor===e.actorId)t.actor='';for(const c of this.confirms)if(c.actor===e.actorId||(e.kind==='eliminated'||e.kind==='respawn')&&c.target===e.actorId&&!c.final)c.actor='';return;}
  if(isMeliodasHellblaze(e.fighter)&&e.kind==='confirm'&&e.slot==='ultimate'&&!e.branch&&e.targetId){
   for(let i=0;i<128;i++)if(this.seen[i]===e.id&&this.seenTime[i]===e.serverTime)return;const n=this.eventCursor++%128;this.seen[n]=e.id;this.seenTime[n]=e.serverTime;
   const c=this.confirms[this.confirmCursor++%this.confirms.length],who=fighters?.get(e.actorId);c.actor=e.actorId;c.target=e.targetId;c.seq=e.actionSeq??who?.state.actionSeq??-1;c.final=false;c.floor=who?.group.position.y??0;
   return;
  }
  if(!isMeliodasHellblaze(e.fighter)||e.kind!=='hit'||!e.endpoint)return;for(let i=0;i<128;i++)if(this.seen[i]===e.id&&this.seenTime[i]===e.serverTime)return;const n=this.eventCursor++%128;this.seen[n]=e.id;this.seenTime[n]=e.serverTime;const actor=fighters?.get(e.actorId);if(!actor)return;const h=this.impacts[this.cursor++%24];h.actor=e.actorId;h.born=e.serverTime;h.grade=e.slot==='ultimate'&&!e.branch?(e.contactIndex===3?3:2):e.slot==='special'?1.7:e.slot==='heavy'?1.4:1;h.seed=e.id;h.yaw=actor.state.yaw;h.point.set(e.endpoint.x,e.endpoint.y,e.endpoint.z);if(h.grade===3&&involvesLocal(e.actorId,e.targetId))SIGNATURE.screen?.impactFrame?.(.46,h.point);
  const st=this.stage,t=e.serverTime,point=h.point,dir=this.dir,target=e.targetId?fighters?.get(e.targetId):undefined,floor=blowFloor(actor,target,actor.group.position.y);
  dir.subVectors(point,actor.group.position).setY(0);if(dir.lengthSq()<.01)dir.set(Math.sin(actor.state.yaw??0),0,Math.cos(actor.state.yaw??0));dir.normalize();
  const ground=this.ground.set(point.x,floor,point.z);
  if(e.slot==='light'){st.burst(point,HELL,.48,t,{dir,floor,clean:true});return;}
  if(e.slot==='heavy'){
   if(e.branch){st.burst(point,HELL,.9,t,{dir,floor,clean:true});return;}
   st.shatter(point,dir,COUNTER,2.6,t,.45);st.burst(point,COUNTER,.7,t,{dir,floor,clean:true});st.dome(this.a.copy(point).addScaledVector(dir,.4),COUNTER,2,t,.36);
   return;
  }
  if(e.slot==='special'){
   if(e.branch==='airSpecial'){st.burst(point,HELL,2,t,{floor});st.shock(ground,COUNTER,4.6,t,.45);st.scar(ground,HELL,2.6,t,1.6);return;}
   if(e.branch){st.burst(point,HELL,1.5,t,{dir,floor});st.erupt(this.a.copy(ground).addScaledVector(dir,.6),UP,HELL,.6,3,t+.04,.6);return;}
   st.burst(point,HELL,1.7,t,{dir,floor});st.burst(point,EDGE,1.3,t,{dir,clean:true});
   st.erupt(this.a.copy(ground).addScaledVector(dir,1.2),UP,HELL,.8,4.8,t+.05,.6);
   st.shock(ground,COUNTER,4.8,t,.5);
   st.scar(this.a.copy(ground).addScaledVector(dir,1.7),HELL,2.2,t,1.5);st.scar(ground,EDGE,1.8,t+.1,2);
   return;
  }
  if(e.slot!=='ultimate'||e.branch)return;
  if(h.grade!==3){st.burst(point,HELL,1.1+.25*(e.contactIndex??0),t,{dir,floor});if(e.contactIndex)st.shock(ground,COUNTER,4.2+.4*(e.contactIndex??0),t,.45);return;}
  for(const c of this.confirms)if(c.actor===e.actorId)c.final=true;
  st.burst(this.a.copy(point).addScaledVector(dir,.5),HELL,1.9,t,{dir,floor});st.burst(point,EDGE,1.8,t,{dir,clean:true});
  st.erupt(this.a.copy(ground).addScaledVector(dir,1.7),UP,HELL,1.05,8.5,t+.08,.45);
  for(let i=0;i<3;i++){const ang=i*2.094+1;st.erupt(this.a.set(ground.x+dir.x*2.6+Math.cos(ang)*2.4,floor,ground.z+dir.z*2.6+Math.sin(ang)*2.4),UP,HELL,.5,5,t+.18+i*.06,.45);}
  st.shock(ground,COUNTER,9,t,.6);
  st.scar(ground,EDGE,3.2,t+.1,2.1);
 }
 update(time:number,fighters:ReadonlyMap<string,Fighter>,flights:ReadonlyMap<string,Flight>=NO_FLIGHTS){if(this.disposed)return;const st=this.stage.open(time);this.flames.begin(time);this.strokes.begin();this.crescents.begin();const detail=this.kit.budget>=.65;
  for(const f of fighters.values()){const s=f.state;if(!isMeliodasHellblaze(s.fighter)||!s.alive)continue;const elapsed=s.actionTime*s.actionDuration,manual=(s.action==='light'||s.action==='heavy'||s.action==='special'||s.action==='ultimate')&&s.whiffedAt===undefined&&(s.action!=='ultimate'||s.confirmedAt!==undefined||elapsed<.6);
   if(manual&&meliodasBladePoint(f,this.a,false)&&meliodasBladePoint(f,this.b)){const phase=Math.sin(Math.PI*Math.min(1,s.actionTime));this.segment(this.a,this.b,.018,VIOLET,.3+phase*.5);let t=this.trails.find(t=>t.actor===s.id);if(!t)t=this.trails.find(t=>!t.actor||time-t.seen>.3);if(t){const seq=s.actionSeq??-1;if(t.actor===s.id&&t.seq===seq&&time>=t.seen&&time-t.seen<.08&&t.point.distanceToSquared(this.b)<1.4){const distance=t.point.distanceTo(this.b);if(distance>.01){this.segment(t.point,this.b,detail?.085:.045,INK,.9);this.segment(t.point,this.b,detail?.027:.014,MAGENTA,.8);}}t.actor=s.id;t.seq=seq;t.seen=time;t.point.copy(this.b);}}
   if(s.action==='special'&&!s.branch&&elapsed>.18&&elapsed<.56){const hand=f.drawnJoint('RightHand');if(hand){hand.getWorldPosition(this.a);this.fire(this.a,UP,.34+(elapsed-.18)*.6,time,detail?5:3,.85);}}
   if(manual){
    const seed=(s.actionSeq??0)*4.1,power=Math.sin(Math.PI*Math.min(1,s.actionTime)),tip=meliodasBladePoint(f,this.hand)?this.hand:f.strikePoint(this.hand);
    if(s.action==='light'){st.glow(tip,.26,HELL.core,.6*power);st.tongue(this.p.copy(tip).setY(tip.y+.15),UP,.3,.4+.5*power,HELL,power,seed);st.light(tip,1.9,HELL,.2*power);}
    else if(s.action==='heavy'&&!s.branch&&elapsed<HEAVY.contacts[0]){
     const k=clamp(elapsed/HEAVY.contacts[0]);st.bubble(tip,.3+.25*k,COUNTER,.4+.6*k);st.charge(tip,COUNTER,.16,k,seed);
    }else if(s.action==='special'&&!s.branch&&elapsed<SPECIAL.contacts[0]){
     const k=clamp(elapsed/SPECIAL.contacts[0]),joint=typeof f.drawnJoint==='function'?f.drawnJoint('RightHand'):undefined;if(joint)joint.getWorldPosition(this.hand);
     st.pool(this.p.copy(f.group.position),2+1.4*k,HELL,k,seed);st.charge(this.hand,HELL,.36,k,seed);
    }else if(s.action==='ultimate'&&!s.branch&&s.confirmedAt===undefined)st.charge(tip,HELL,.3,clamp(elapsed/ULT.contacts[0]),seed);
   }
   if(s.action==='awaken'&&elapsed>.4&&elapsed<1.55){const u=(elapsed-.4)/1.15,fade=Math.sin(u*Math.PI);this.a.copy(f.group.position);this.a.y+=.65;this.fire(this.a,UP,.42+u*.28,time,detail?8:4,fade*.8);this.p.copy(f.group.position);this.p.y+=.04;this.crescents.add(this.p,this.flat,.35+u*1.1,.35+u*1.1,1,VIOLET,fade*.55);}
  }
  for(const t of this.trails)if(time-t.seen>.3)t.actor='';
  for(const flight of flights.values()){if(!isMeliodasHellblaze(flight.fighter)||flight.slot!=='special'||flight.branch||!flight.released)continue;this.a.copy(flight.position);this.fire(this.a,flight.heading,.7,time,detail?8:4,1);this.a.copy(flight.position).addScaledVector(flight.heading,-.6);this.fire(this.a,flight.heading,.42,time+.23,detail?3:2,.6);
   st.orb(flight.position,flight.heading,.85,HELL,(flight.since??0)*3.3);
  }
  for(const c of this.confirms){
   if(!c.actor)continue;const actor=fighters.get(c.actor),victim=fighters.get(c.target),s=actor?.state;
   if(!actor||!s?.alive||!victim?.state.alive&&!c.final||s.action!=='ultimate'||s.branch||(s.actionSeq??-1)!==c.seq||s.whiffedAt!==undefined){c.actor='';continue;}
   const elapsed=s.actionTime*s.actionDuration;if(elapsed>=ULT_LAST){if(elapsed>=ULT.duration)c.actor='';continue;}
   if(elapsed<ULT.contacts[0])continue;
   const g=clamp((elapsed-ULT.contacts[0])/(ULT_LAST-ULT.contacts[0])),seed=c.seq*2.7,feet=this.ground.copy(actor.group.position).setY(c.floor);
   st.disc(feet,2.4+2.4*g,HELL.main,1,POOL,Math.min(1,.3+g*1.2),seed,1,1.2);
   const yaw=s.yaw??actor.group.rotation.y,hx=Math.sin(yaw),hz=Math.cos(yaw),radius=2.5+.4*g;
   for(let i=0,n=st.n(9,5);i<n;i++){
    const ang=i*Math.PI*2/n+seed+time*.4,cx=Math.cos(ang),cz=Math.sin(ang);if(cx*hx+cz*hz<-.25)continue;
    const h=(.6+.8*g)*(.7+.3*Math.sin(time*7+i*2.1));
    st.tongue(this.a.set(feet.x+cx*radius,c.floor+h*.45,feet.z+cz*radius),UP,h*.45,h,HELL,.6+.4*g,seed+i);
   }
   st.light(this.a.copy(feet).setY(c.floor+.5),4.5,EDGE,.2+.2*g);
   if(!meliodasBladePoint(actor,this.hand))actor.strikePoint(this.hand);st.charge(this.hand,HELL,.2+.12*g,Math.max(.4,g),seed);
   if(g>.8)st.speed(.5*(g-.8)/.2,c.actor,c.target);
  }
  for(const h of this.impacts){if(!h.actor)continue;const age=time-h.born;if(age<0)continue;if(age>.42){h.actor='';continue;}const fade=1-age/.42,r=.24+h.grade*.12+age*1.8;this.q.setFromAxisAngle(UP,h.yaw);this.spin.setFromAxisAngle(FRONT,h.grade===3?.12:(h.seed%2?.75:-.75));this.q.multiply(this.spin);this.crescents.add(h.point,this.q,r*1.3,r*(h.grade===3?1.9:.65),1,INK,fade);this.crescents.add(h.point,this.q,r*1.23,r*(h.grade===3?1.82:.58),1,VIOLET,fade*.95);if(h.grade===3){this.a.copy(h.point);this.a.y+=age*1.2;this.fire(this.a,UP,.72+age*.45,time,detail?10:5,fade);this.p.copy(h.point);this.p.y=Math.max(0,h.point.y-.8);this.crescents.add(this.p,this.flat,r*1.6,r*1.6,1,MAGENTA,fade*.7);}else this.fire(h.point,UP,.42+h.grade*.16,time,detail?4:2,fade*.7);}
  this.flames.end();this.strokes.end();this.crescents.end();st.close();
 }
 private fire(center:THREE.Vector3,heading:THREE.Vector3,radius:number,time:number,count:number,alpha:number){this.q.setFromUnitVectors(UP,heading);for(let i=0;i<count;i++){const angle=i*2.39996+time*3,layer=(i%3)/3;this.p.set(Math.cos(angle)*radius*.24,layer*radius*.32,Math.sin(angle)*radius*.24).applyQuaternion(this.q).add(center);this.spin.setFromAxisAngle(FRONT,Math.sin(time*7+i)*.22);this.spin.premultiply(this.q);const height=radius*(1.4+.35*Math.sin(time*9+i));this.flames.add(this.p,this.spin,radius*.90,height,radius*.82,INK,alpha);this.flames.add(this.p,this.spin,radius*.68,height*.91,radius*.62,i%2?VIOLET:MAGENTA,alpha*.9);}}
 private segment(a:THREE.Vector3,b:THREE.Vector3,width:number,color:THREE.Color,alpha:number){this.p.copy(a).add(b).multiplyScalar(.5);const length=a.distanceTo(b);if(length<1e-5)return;this.d.subVectors(b,a).normalize();this.q.setFromUnitVectors(UP,this.d);this.strokes.add(this.p,this.q,width,length,width,color,alpha);}
 reset(){for(const h of this.impacts)h.actor='';for(const t of this.trails)t.actor='';for(const c of this.confirms)c.actor='';this.seen.fill(-1);this.seenTime.fill(-1);for(const b of[this.flames,this.strokes,this.crescents]){b.begin();b.end();}this.stage.reset();}
 dispose(){if(this.disposed)return;this.reset();this.disposed=true;this.flames.dispose();this.strokes.dispose();this.crescents.dispose();this.stage.release();}
}
