import * as THREE from 'three';
import type {CombatEvent} from '../../game/types';
import type {Fighter} from '../Fighter';
import type {Flight} from '../CombatEffects';
import {bodyCentre,type VfxKit} from '../vfx/VfxKit';
import {SIGNATURE,involvesLocal} from './context';
import {HISOKA_MOVES} from '../../game/fighters/hisoka';
import {MoveStage,stageLook} from './MoveStage';
import { blowFloor } from './blowFloor';
export const isHisokaBungeeGum=(id:string|undefined)=>id==='hisoka';
export function hisokaStrikeJoint(action:string,clip?:string,contactIndex=0):'LeftHand'|'RightHand'{
 if(action==='ultimate'&&(!clip||clip==='Bungee Gum Encore'))return contactIndex%2?'LeftHand':'RightHand';
 if(clip==='Elastic Palm'||clip==='Rush 3'||clip==='Elastic Breaker'||clip==='Rubber Crash'||action==='heavy'&&!clip)return 'LeftHand';
 return 'RightHand';
}
export const HISOKA_GUM_LIMITS=Object.freeze({cards:48,strokes:240,rings:64,sparks:96,impacts:24,tethers:12});
const NO_FLIGHTS:ReadonlyMap<string,Flight>=new Map();
const UP=new THREE.Vector3(0,1,0),FRONT=new THREE.Vector3(0,0,1),RIGHT=new THREE.Vector3(1,0,0);
const PINK=new THREE.Color(2.7,.72,1.9),CORE=new THREE.Color(3,2.3,2.8),INK=new THREE.Color(0x3c123f),WHITE=new THREE.Color(0xfffcf7),CARD=new THREE.Color(1.9,1.84,1.8);
const GUM=stageLook(0xffd9f2,0xf072cc,0x7a1f6a);
const HEAVY=HISOKA_MOVES.heavy,SPECIAL=HISOKA_MOVES.special,ULT=HISOKA_MOVES.ultimate,ULT_LAST=ULT.contacts[ULT.contacts.length-1],TAU=Math.PI*2;
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
export const HISOKA_ENCORE=Object.freeze({strands:6,radius:3.4,height:2.4,cards:10});
type Confirm={actor:string;target:string;seq:number;final:boolean;turn:number};
class GumBatch {
 readonly mesh:THREE.InstancedMesh<THREE.BufferGeometry,THREE.ShaderMaterial>;
 private tint:THREE.InstancedBufferAttribute;private pose=new THREE.Object3D();private count=0;
 constructor(scene:THREE.Scene,name:string,geometry:THREE.BufferGeometry,private capacity:number,card=false){
  this.tint=new THREE.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('gumTint',this.tint);
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
   vertexShader:'attribute vec4 gumTint;varying vec4 vTint;varying vec2 vUv;void main(){vTint=gumTint;vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',
   fragmentShader:card?'varying vec4 vTint;varying vec2 vUv;void main(){vec2 p=abs(vUv-.5);float edge=step(.455,p.x)+step(.475,p.y);float suit=1.-step(.19,p.x+p.y*.72);vec2 corner=abs(vUv-vec2(.18,.81));float dot=1.-step(.065,corner.x+corner.y*.72);vec3 c=mix(vTint.rgb,vec3(.12,.025,.14),clamp(edge+suit+dot,0.,1.));gl_FragColor=vec4(c,vTint.a);}':'varying vec4 vTint;void main(){if(vTint.a<.004)discard;gl_FragColor=vTint;}'});
  this.mesh=new THREE.InstancedMesh(geometry,material,capacity);this.mesh.name='hisoka-'+name;this.mesh.frustumCulled=false;this.mesh.renderOrder=6;this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.mesh.count=0;scene.add(this.mesh);
 }
 begin(){this.count=0;}
 add(p:THREE.Vector3,q:THREE.Quaternion,x:number,y:number,z:number,color:THREE.Color,alpha:number){if(this.count>=this.capacity||alpha<.004)return;this.pose.position.copy(p);this.pose.quaternion.copy(q);this.pose.scale.set(x,y,z);this.pose.updateMatrix();this.mesh.setMatrixAt(this.count,this.pose.matrix);this.tint.setXYZW(this.count++,color.r,color.g,color.b,Math.min(1,alpha));}
 end(){this.mesh.count=this.count;this.mesh.instanceMatrix.needsUpdate=true;this.tint.needsUpdate=true;}
 dispose(){this.mesh.removeFromParent();this.mesh.dispose();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
type Receipt={actor:string;target:string;born:number;seed:number;grade:number;point:THREE.Vector3};
type Tether={actor:string;target:string;born:number;seq:number;ultimate:boolean;endpoint:THREE.Vector3};
export class HisokaBungeeGum {
 private cards:GumBatch;private strokes:GumBatch;private rings:GumBatch;private sparks:GumBatch;private disposed=false;
 private receipts:Receipt[]=Array.from({length:HISOKA_GUM_LIMITS.impacts},()=>({actor:'',target:'',born:-1e9,seed:0,grade:0,point:new THREE.Vector3()}));
 private tethers:Tether[]=Array.from({length:HISOKA_GUM_LIMITS.tethers},()=>({actor:'',target:'',born:-1e9,seq:-1,ultimate:false,endpoint:new THREE.Vector3()}));
 private seen=new Float64Array(128).fill(-1);private seenTime=new Float64Array(128).fill(-1);private cursor=0;private tetherCursor=0;private seenCursor=0;
 private readonly stage:MoveStage;private dir=new THREE.Vector3();private ground=new THREE.Vector3();private centre=new THREE.Vector3();private hand=new THREE.Vector3();private confirmCursor=0;
 private confirms:Confirm[]=Array.from({length:8},()=>({actor:'',target:'',seq:-1,final:false,turn:0}));
 private a=new THREE.Vector3();private b=new THREE.Vector3();private p=new THREE.Vector3();private d=new THREE.Vector3();private along=new THREE.Vector3();private across=new THREE.Vector3();private normal=new THREE.Vector3();private last=new THREE.Vector3();private next=new THREE.Vector3();private q=new THREE.Quaternion();private spin=new THREE.Quaternion();private matrix=new THREE.Matrix4();
 constructor(scene:THREE.Scene,private kit:Pick<VfxKit,'budget'>&Partial<VfxKit>){this.stage=MoveStage.for(scene,kit);this.cards=new GumBatch(scene,'cards',new THREE.PlaneGeometry(1,1),HISOKA_GUM_LIMITS.cards,true);this.strokes=new GumBatch(scene,'gum-ribbons',new THREE.BoxGeometry(1,1,1),HISOKA_GUM_LIMITS.strokes);this.rings=new GumBatch(scene,'ink-cuts',new THREE.RingGeometry(.87,1,28,1,.15,Math.PI*1.45),HISOKA_GUM_LIMITS.rings);this.sparks=new GumBatch(scene,'gum-shards',new THREE.BoxGeometry(1,1,1),HISOKA_GUM_LIMITS.sparks);}
 load(_ids:readonly string[]){return Promise.resolve();}
 handle(e:CombatEvent,fighters?:ReadonlyMap<string,Fighter>){
  if(this.disposed)return;
  if(e.kind==='eliminated'||e.kind==='respawn'){for(const h of this.receipts)if(h.actor===e.actorId||h.target===e.actorId)h.actor='';for(const t of this.tethers)if(t.actor===e.actorId||t.target===e.actorId)t.actor='';for(const c of this.confirms)if(c.actor===e.actorId||c.target===e.actorId&&!c.final)c.actor='';return;}
  if(isHisokaBungeeGum(e.fighter)&&(e.kind==='whiff'||e.kind==='rejected')){for(const c of this.confirms)if(c.actor===e.actorId)c.actor='';return;}
  if(isHisokaBungeeGum(e.fighter)&&e.kind==='confirm'&&e.slot==='ultimate'&&!e.branch&&e.targetId){
   for(let i=0;i<this.seen.length;i++)if(this.seen[i]===e.id&&this.seenTime[i]===e.serverTime)return;
   const si=this.seenCursor++%this.seen.length;this.seen[si]=e.id;this.seenTime[si]=e.serverTime;
   const c=this.confirms[this.confirmCursor++%this.confirms.length],who=fighters?.get(e.actorId);c.actor=e.actorId;c.target=e.targetId;c.seq=e.actionSeq??who?.state.actionSeq??-1;c.final=false;c.turn=(who?.state.yaw??0)+.4;
   return;
  }
  if(!isHisokaBungeeGum(e.fighter)||e.kind!=='hit'||!e.endpoint)return;
  for(let i=0;i<this.seen.length;i++)if(this.seen[i]===e.id&&this.seenTime[i]===e.serverTime)return;
  const si=this.seenCursor++%this.seen.length;this.seen[si]=e.id;this.seenTime[si]=e.serverTime;
  const actor=fighters?.get(e.actorId);if(!actor)return;
  const h=this.receipts[this.cursor++%this.receipts.length];h.actor=e.actorId;h.target=e.targetId??'';h.born=e.serverTime;h.seed=e.id;h.point.set(e.endpoint.x,e.endpoint.y,e.endpoint.z);h.grade=e.slot==='ultimate'&&!e.branch?((e.contactIndex??0)===7?3:2):e.slot==='special'?1.7:e.slot==='heavy'?1.2:.7;
  const ultimate=e.slot==='ultimate'&&!e.branch;
  if((ultimate||(e.slot==='special'||e.slot==='heavy')&&!e.branch)&&e.targetId){const t=this.tethers.find(t=>t.actor===e.actorId&&t.target===e.targetId)??this.tethers[this.tetherCursor++%this.tethers.length];t.actor=e.actorId;t.target=e.targetId;t.born=e.serverTime;t.seq=actor.state.actionSeq??-1;t.ultimate=ultimate;t.endpoint.copy(h.point);}
  if(h.grade===3&&involvesLocal(e.actorId,e.targetId))SIGNATURE.screen?.impactFrame?.(.42,h.point);
  const st=this.stage,t=e.serverTime,point=h.point,dir=this.dir,target=e.targetId?fighters?.get(e.targetId):undefined,floor=blowFloor(actor,target,actor.group.position.y);
  dir.subVectors(point,actor.group.position).setY(0);if(dir.lengthSq()<.01)dir.set(Math.sin(actor.state.yaw??0),0,Math.cos(actor.state.yaw??0));dir.normalize();
  const ground=this.ground.set(point.x,floor,point.z);
  if(e.slot==='light'){st.burst(point,GUM,.42,t,{dir,floor,clean:true});return;}
  if(e.slot==='heavy'){
   const big=e.branch?.85:1;st.burst(point,GUM,.95*big,t,{dir,floor,clean:true});st.dome(this.a.copy(point).addScaledVector(dir,.35),GUM,2*big,t,.38);
   return;
  }
  if(e.slot==='special'){
   if(e.branch==='airSpecial'){st.burst(point,GUM,2,t,{floor});st.dome(point,GUM,3,t,.45);st.shock(ground,GUM,4.8,t,.45);st.scar(ground,GUM,2,t+.05,1.7);return;}
   if(e.branch){st.burst(point,GUM,1.5,t,{dir,floor});return;}
   st.burst(point,GUM,1.8,t,{dir:this.d.copy(dir).multiplyScalar(-1),floor});st.dome(point,GUM,2.5,t,.42);st.shock(ground,GUM,4.8,t,.5);st.scar(ground,GUM,1.7,t+.05,1.7);
   return;
  }
  if(!ultimate)return;
  if(h.grade!==3){st.burst(point,GUM,.75+.1*(e.contactIndex??0),t,{dir,floor,clean:true});if((e.contactIndex??0)>=4)st.shock(ground,GUM,3.6+.3*(e.contactIndex??0),t,.4);return;}
  for(const c of this.confirms)if(c.actor===e.actorId)c.final=true;
  st.burst(point,GUM,2.6,t,{dir,floor});st.dome(point,GUM,4.6,t,.5);st.shock(ground,GUM,9,t,.6);st.scar(ground,GUM,3,t+.15,2.1);
 }
 update(time:number,fighters:ReadonlyMap<string,Fighter>,flights:ReadonlyMap<string,Flight>=NO_FLIGHTS){
  if(this.disposed)return;const st=this.stage.open(time);this.cards.begin();this.strokes.begin();this.rings.begin();this.sparks.begin();const detail=this.kit.budget>=.65;
  for(const f of fighters.values()){
   const s=f.state;if(!isHisokaBungeeGum(s.fighter)||!s.alive)continue;const elapsed=s.actionTime*s.actionDuration,seed=(s.actionSeq??0)*3.7;
   if(s.whiffedAt===undefined&&(s.action==='light'||s.action==='heavy'||s.action==='special'||s.action==='ultimate')&&!(s.action==='ultimate'&&s.confirmedAt===undefined&&elapsed>ULT.contacts[0]+.1)){
    const power=Math.sin(clamp(s.actionTime)*Math.PI),strike=typeof f.strikePoint==='function'?f.strikePoint(this.hand):this.hand.copy(f.handR??f.group.position);
    st.glow(strike,.28,GUM.main,.45*power);st.glow(strike,.11,GUM.core,.8*power);st.light(strike,1.9,GUM,.2*power);
    if(s.action==='heavy'&&!s.branch&&elapsed<HEAVY.contacts[0]){
     const k=clamp(elapsed/HEAVY.contacts[0]);st.charge(strike,GUM,.22,k,seed);if(f.handL&&f.handR)this.ribbon(f.handL,f.handR,-.12*Math.sin(k*Math.PI),.9*k,detail?8:5);
    }else if(s.action==='special'&&!s.branch&&elapsed<SPECIAL.contacts[0])st.charge(strike,GUM,.3,clamp(elapsed/SPECIAL.contacts[0]),seed);
    else if(s.action==='ultimate'&&!s.branch&&s.confirmedAt===undefined)st.charge(strike,GUM,.28,clamp(elapsed/ULT.contacts[0]),seed);
   }
   const held=s.action!=='special'||s.branch||elapsed<.42;
   if(held&&this.cardFrame(f,this.a,this.q))this.cards.add(this.a,this.q,.075,.115,1,WHITE,1);
   if(s.action==='awaken'&&elapsed>.22&&elapsed<.79){
    const left=f.joints?.get('LeftHand'),right=f.joints?.get('RightHand');if(left&&right){left.getWorldPosition(this.a);right.getWorldPosition(this.b);this.ribbon(this.a,this.b,Math.sin((elapsed-.22)/.57*Math.PI)*.08,.9,detail?9:6);}
   }
  }
  for(const flight of flights.values()){
   if(!isHisokaBungeeGum(flight.fighter)||flight.slot!=='special'||flight.branch||!flight.released)continue;
   this.q.setFromUnitVectors(FRONT,flight.heading);this.spin.setFromAxisAngle(FRONT,time*19);this.q.multiply(this.spin);this.cards.add(flight.position,this.q,.46,.66,1,CARD,1);
   this.across.set(flight.heading.z,0,-flight.heading.x);
   for(let i=0;i<4;i++){const ang=time*7+i*TAU/4;this.p.copy(flight.position).addScaledVector(flight.heading,-.25-.12*i).addScaledVector(this.across,Math.cos(ang)*.55);this.p.y+=Math.sin(ang)*.42;this.spin.setFromAxisAngle(FRONT,time*(15+i*3)+i);this.q.setFromUnitVectors(FRONT,flight.heading).multiply(this.spin);this.cards.add(this.p,this.q,.34,.49,1,CARD,.95);}
   st.glow(flight.position,.85,GUM.main,.55);st.glow(flight.position,.3,GUM.core,.8);st.light(this.p.copy(flight.position).setY(flight.position.y+.2),5,GUM,.5);
   const dealer=flight.actorId?fighters.get(flight.actorId):undefined;
   if(dealer?.handR)this.ribbon(dealer.handR,flight.position,-.3,.85,detail?10:6);else{this.a.copy(flight.position).addScaledVector(flight.heading,-.7);this.ribbon(this.a,flight.position,.025,.7,detail?6:3);}
  }
  for(const t of this.tethers){
   if(!t.actor)continue;const age=time-t.born,actor=fighters.get(t.actor),target=fighters.get(t.target);
   if(age<0)continue;
   if(!actor||!target||!actor.state.alive||!target.state.alive||actor.state.whiffedAt!==undefined||actor.group.position.distanceToSquared(target.group.position)>64||(t.ultimate&&(actor.state.action!=='ultimate'||(actor.state.actionSeq??-1)!==t.seq))||age>(t.ultimate?.55:.32)){t.actor='';continue;}
   const hand=actor.joints?.get('RightHand');if(hand)hand.getWorldPosition(this.a);else if(actor.handR)this.a.copy(actor.handR);else continue;
   if(t.ultimate){this.b.copy(target.group.position);this.b.y+=1.12;}else this.b.copy(t.endpoint);
   const fade=1-age/(t.ultimate?.55:.32);this.ribbon(this.a,this.b,(1-fade)*.15,fade,detail?9:5);
   if(t.ultimate){const left=actor.joints?.get('LeftHand');if(left){left.getWorldPosition(this.a);this.ribbon(this.a,this.b,-.11,fade*.75,detail?8:4);}}
  }
  for(const h of this.receipts){
   if(!h.actor)continue;const age=time-h.born;if(age<0)continue;if(age>.36){h.actor='';continue;}const fade=1-age/.36,scale=.20+h.grade*.12+age*1.3;
   const actor=fighters.get(h.actor);this.q.setFromAxisAngle(UP,actor?.state.yaw??0);this.spin.setFromAxisAngle(FRONT,h.seed%2?.65:-.65);this.q.multiply(this.spin);
   this.rings.add(h.point,this.q,scale*1.3,scale*.53,1,INK,fade);this.rings.add(h.point,this.q,scale*1.25,scale*.46,1,PINK,fade*.95);
   if(h.grade===3){this.spin.setFromAxisAngle(RIGHT,Math.PI*.5);this.q.multiply(this.spin);this.rings.add(h.point,this.q,scale*1.8,scale*1.8,1,CORE,fade*.85);}
   for(let i=0;i<(detail?8:4);i++){const theta=i*2.399+h.seed*.11,r=(.1+age*2.2)*(1+h.grade*.12);this.p.copy(h.point);this.p.x+=Math.cos(theta)*r;this.p.z+=Math.sin(theta)*r;this.p.y+=Math.sin(i*1.4)*r;this.q.setFromAxisAngle(UP,theta+age*7);this.spin.setFromAxisAngle(FRONT,theta*.7);this.q.multiply(this.spin);this.sparks.add(this.p,this.q,.04,.1+age*.12,.02,i%2?PINK:CORE,fade);}
   if(h.grade>=1.7)for(let i=0,n=h.grade===3?(detail?18:9):(detail?7:4);i<n;i++){const theta=i*2.399+h.seed*.37,r=.5+age*(5+(i%4)*1.6)*(h.grade===3?1.4:1);this.p.set(h.point.x+Math.cos(theta)*r,h.point.y+.2+age*(2.2+(i%3))-age*age*5+Math.sin(i*1.9)*.4,h.point.z+Math.sin(theta)*r);this.q.setFromAxisAngle(UP,theta+age*11);this.spin.setFromAxisAngle(RIGHT,age*17+i);this.q.multiply(this.spin);this.cards.add(this.p,this.q,.3,.43,1,CARD,Math.min(1,fade*2));}
  }
  for(const c of this.confirms){
   if(!c.actor)continue;const actor=fighters.get(c.actor),victim=fighters.get(c.target),s=actor?.state;
   if(!actor||!victim||!s?.alive||!victim.state.alive&&!c.final||s.action!=='ultimate'||s.branch||(s.actionSeq??-1)!==c.seq||s.whiffedAt!==undefined){c.actor='';continue;}
   const elapsed=s.actionTime*s.actionDuration;if(elapsed>=ULT_LAST){if(elapsed>=ULT.duration)c.actor='';continue;}
   if(elapsed>=ULT.contacts[0])this.encore(actor,victim,c,elapsed,time,detail);
  }
  this.cards.end();this.strokes.end();this.rings.end();this.sparks.end();st.close();
 }
 private encore(actor:Fighter,victim:Fighter,c:Confirm,elapsed:number,time:number,detail:boolean){
  const st=this.stage,E=HISOKA_ENCORE,g=clamp((elapsed-ULT.contacts[0])/(ULT_LAST-ULT.contacts[0])),body=bodyCentre(victim,this.centre),floor=victim.group.position.y;
  st.dim(.25+.4*g,c.actor,c.target);
  this.d.subVectors(actor.group.position,victim.group.position).setY(0).normalize();const hx=this.d.x,hz=this.d.z;
  for(let i=0;i<E.strands;i++){
   const born=i*.12;if(elapsed-ULT.contacts[0]<born)break;
   const ang=c.turn+i*TAU/E.strands;if(Math.cos(ang)*hz+Math.sin(ang)*hx>.35)continue;
   const grown=Math.min(1,(elapsed-ULT.contacts[0]-born)/.14);
   this.a.set(body.x+Math.sin(ang)*E.radius,floor+E.height+.8*Math.sin(i*2.1),body.z+Math.cos(ang)*E.radius);
   this.b.copy(this.a).lerp(body,grown);
   this.ribbon(this.a,this.b,-.28+.06*Math.sin(time*23+i*2),.9,detail?9:5);
   st.glow(this.a,.3,GUM.main,.5);
  }
  for(let i=0,n=detail?E.cards:5;i<n;i++){
   const ang=i*TAU/n+time*(2.2+1.8*g);if(Math.cos(ang)*hz+Math.sin(ang)*hx>.35)continue;
   this.p.set(body.x+Math.sin(ang)*2.1,body.y-.3+.9*Math.sin(time*2+i*1.7),body.z+Math.cos(ang)*2.1);
   this.q.setFromAxisAngle(UP,ang+Math.PI/2);this.spin.setFromAxisAngle(FRONT,time*9+i);this.q.multiply(this.spin);this.cards.add(this.p,this.q,.3,.43,1,CARD,.95);
  }
  st.light(this.p.copy(body).setY(body.y+.3),4.5,GUM,.3+.25*g);
  if(g>.8)st.speed(.5*(g-.8)/.2,c.actor,c.target);
 }
 private cardFrame(f:Fighter,out:THREE.Vector3,q:THREE.Quaternion){const index=f.bones?.get('righthandindex2'),middle=f.bones?.get('righthandmiddle2'),base=f.bones?.get('righthandindex1');if(!index||!middle||!base)return false;index.getWorldPosition(this.a);middle.getWorldPosition(this.b);base.getWorldPosition(this.p);this.along.subVectors(this.a,this.p).normalize();this.across.subVectors(this.b,this.a).normalize();this.normal.crossVectors(this.across,this.along).normalize();this.across.crossVectors(this.along,this.normal).normalize();this.matrix.makeBasis(this.across,this.along,this.normal);q.setFromRotationMatrix(this.matrix);out.copy(this.a).add(this.b).multiplyScalar(.5).addScaledVector(this.along,.034);return true;}
 private ribbon(a:THREE.Vector3,b:THREE.Vector3,sag:number,alpha:number,steps:number){this.last.copy(a);for(let i=1;i<=steps;i++){const t=i/steps;this.next.copy(a).lerp(b,t);this.next.y+=Math.sin(t*Math.PI)*sag;this.segment(this.last,this.next,.05,INK,alpha*.75);this.segment(this.last,this.next,.026,PINK,alpha);this.stage.streak(this.last,this.next,.075,GUM.main,alpha*.9);this.stage.streak(this.last,this.next,.024,GUM.core,alpha*1.2);this.last.copy(this.next);}}
 private segment(a:THREE.Vector3,b:THREE.Vector3,width:number,color:THREE.Color,alpha:number){this.p.copy(a).add(b).multiplyScalar(.5);const length=a.distanceTo(b);if(length<1e-5)return;this.d.subVectors(b,a).normalize();this.q.setFromUnitVectors(UP,this.d);this.strokes.add(this.p,this.q,width,length,width,color,alpha);}
 reset(){for(const h of this.receipts)h.actor='';for(const t of this.tethers)t.actor='';for(const c of this.confirms)c.actor='';this.seen.fill(-1);this.seenTime.fill(-1);for(const batch of[this.cards,this.strokes,this.rings,this.sparks]){batch.begin();batch.end();}this.stage.reset();}
 dispose(){if(this.disposed)return;this.reset();this.disposed=true;this.cards.dispose();this.strokes.dispose();this.rings.dispose();this.sparks.dispose();this.stage.release();}
}
