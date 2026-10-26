import * as THREE from 'three';
import type {CombatEvent} from '../../game/types';
import type {Fighter} from '../Fighter';
import type {Flight} from '../CombatEffects';
import type {VfxKit} from '../vfx/VfxKit';
import {SIGNATURE,involvesLocal} from './context';
import {GAROU_MOVES} from '../../game/fighters/garou';
import {STAR} from './GlowBatch';
import {MoveStage,SHEEN,stageLook,type StageLook} from './MoveStage';
import {CastBook,Cuts,arc,hash,type Gather} from './StageCraft';
export const isGarouWaterStream=(id:string|undefined)=>id==='garou';
export const GAROU_STREAM_LIMITS=Object.freeze({rings:64,slashes:128,shards:96,impacts:24});
export function garouStrikeJoint(action:string,clip?:string,contactIndex=0):'LeftHand'|'RightHand'{
 if(action==='ultimate'&&(!clip||clip==='Monster Calamity Rush'))return contactIndex%2?'LeftHand':'RightHand';
 if(['Rock Smashing Palm','Rush 2','Flowing Redirection','Descending Palm'].includes(clip??''))return'LeftHand';
 if(action==='heavy'&&!clip)return'LeftHand';
 return'RightHand';
}
export function garouFlowGeometry(){const positions:number[]=[],uv:number[]=[],indices:number[]=[];const steps=24;for(let i=0;i<=steps;i++){const u=i/steps,t=(u-.5)*3.8,r=.75+.06*Math.sin(u*Math.PI*2),width=.075*Math.pow(Math.sin(u*Math.PI),.8);for(const side of[-1,1]){positions.push(Math.cos(t)*(r+side*width)-.43,Math.sin(t)*(r+side*width),0);uv.push(u,(side+1)/2);}if(i<steps){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;}
class Batch{
 readonly mesh:THREE.InstancedMesh<THREE.BufferGeometry,THREE.ShaderMaterial>;private tint:THREE.InstancedBufferAttribute;private object=new THREE.Object3D();private count=0;
 constructor(scene:THREE.Scene,name:string,geometry:THREE.BufferGeometry,private capacity:number){this.tint=new THREE.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('streamTint',this.tint);const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,vertexShader:'attribute vec4 streamTint;varying vec4 vTint;void main(){vTint=streamTint;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',fragmentShader:'varying vec4 vTint;void main(){if(vTint.a<.004)discard;gl_FragColor=vTint;}'});material.forceSinglePass=true;this.mesh=new THREE.InstancedMesh(geometry,material,capacity);this.mesh.name='garou-'+name;this.mesh.count=0;this.mesh.frustumCulled=false;this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(this.mesh);}
 begin(){this.count=0;}
 add(p:THREE.Vector3,q:THREE.Quaternion,x:number,y:number,z:number,c:THREE.Color,a:number){if(this.count>=this.capacity||a<.004)return;this.object.position.copy(p);this.object.quaternion.copy(q);this.object.scale.set(x,y,z);this.object.updateMatrix();this.mesh.setMatrixAt(this.count,this.object.matrix);this.tint.setXYZW(this.count++,c.r,c.g,c.b,Math.min(1,a));}
 end(){this.mesh.count=this.count;this.mesh.instanceMatrix.needsUpdate=true;this.tint.needsUpdate=true;}
 dispose(){this.mesh.removeFromParent();this.mesh.dispose();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const UP=new THREE.Vector3(0,1,0),X=new THREE.Vector3(1,0,0),Z=new THREE.Vector3(0,0,1),INK=new THREE.Color(0x140d18),BLUE=new THREE.Color(0x2696ec),HOT=new THREE.Color(0xc4f3ff),COSMIC=new THREE.Color(0x9b8cff);
type Impact={actor:string;target:string;born:number;grade:number;seed:number;yaw:number;cosmic:boolean;point:THREE.Vector3};
const WATER=stageLook(0xffffff,0x74c8ff,0x1b2433),COSMOS=stageLook(0xffffff,0x9b8cff,0x1a1030);
const HEAVY=GAROU_MOVES.heavy,SPECIAL=GAROU_MOVES.special,ULT=GAROU_MOVES.ultimate,TAU=Math.PI*2;
export const GAROU_STREAM_BEATS=Object.freeze({opener:ULT.contacts[0],final:ULT.contacts[ULT.contacts.length-1],end:ULT.duration});
type Whirl={at:THREE.Vector3;born:number;life:number;radius:number;height:number;look:StageLook;live:boolean};
export class GarouWaterStream{
 private rings:Batch;private slashes:Batch;private shards:Batch;private disposed=false;
 private impacts:Impact[]=Array.from({length:24},()=>({actor:'',target:'',born:-1e9,grade:0,seed:0,yaw:0,cosmic:false,point:new THREE.Vector3()}));private cursor=0;private seen=new Float64Array(128).fill(-1);private seenTime=new Float64Array(128).fill(-1);private eventCursor=0;
 private p=new THREE.Vector3();private q=new THREE.Quaternion();private spin=new THREE.Quaternion();private flat=new THREE.Quaternion().setFromAxisAngle(X,-Math.PI/2);
 private readonly stage:MoveStage;private readonly book=new CastBook('garou',ULT.contacts.length);private readonly cuts=new Cuts(12,WATER);
 private whirls:Whirl[]=Array.from({length:4},()=>({at:new THREE.Vector3(),born:0,life:0,radius:1,height:1,look:WATER,live:false}));private whirlCursor=0;
 private a=new THREE.Vector3();private b=new THREE.Vector3();private c=new THREE.Vector3();private u=new THREE.Vector3();private v=new THREE.Vector3();private heading=new THREE.Vector3();private axis=new THREE.Vector3();
 constructor(scene:THREE.Scene,private kit:Pick<VfxKit,'budget'>&Partial<VfxKit>){this.stage=MoveStage.for(scene,kit);this.rings=new Batch(scene,'rings',new THREE.RingGeometry(.94,1,32),64);this.slashes=new Batch(scene,'ink-slashes',garouFlowGeometry(),128);this.shards=new Batch(scene,'shards',new THREE.OctahedronGeometry(1,0),96);}
 load(_ids:readonly string[]){return Promise.resolve();}
 handle(e:CombatEvent,fighters?:ReadonlyMap<string,Fighter>){if(this.disposed)return;this.staged(e,fighters);if(['eliminated','respawn','whiff','rejected'].includes(e.kind)){for(const h of this.impacts)if(h.actor===e.actorId||h.target===e.actorId)h.actor='';return;}if(!isGarouWaterStream(e.fighter)||e.kind!=='hit'||!e.endpoint)return;for(let i=0;i<128;i++)if(this.seen[i]===e.id&&this.seenTime[i]===e.serverTime)return;const f=fighters?.get(e.actorId);if(!f)return;const key=this.eventCursor++%128;this.seen[key]=e.id;this.seenTime[key]=e.serverTime;const h=this.impacts[this.cursor++%24];h.actor=e.actorId;h.target=e.targetId??'';h.born=e.serverTime;h.grade=e.slot==='ultimate'&&!e.branch?(e.contactIndex===4?3:1.4):e.slot==='light'?1:1.8;h.point.set(e.endpoint.x,e.endpoint.y,e.endpoint.z);h.yaw=f.state.yaw;h.cosmic=!!f.state.awakened;h.seed=e.id;if(h.grade===3&&involvesLocal(e.actorId,e.targetId))SIGNATURE.screen?.impactFrame?.(.42,h.point);}
 private staged(e:CombatEvent,fighters?:ReadonlyMap<string,Fighter>){
  const blow=this.book.take(e,fighters);if(!blow)return;
  const st=this.stage,{point,ground,dir,side,floor,t}=blow,cosmic=!!blow.actor?.state.awakened,look=cosmic?COSMOS:WATER,tilt=e.id%2?1:-1;
  const slash=(lean:number,size:number,width:number,at:number,life:number)=>this.cuts.add(point,this.axis.copy(side).multiplyScalar(Math.cos(lean)).addScaledVector(UP,Math.sin(lean)).normalize(),this.c.copy(dir).multiplyScalar(-size*.22),size,width,look,at,life);
  if(e.slot==='light'){st.burst(point,look,.4,t,{dir,floor,clean:true});slash(.5*tilt,.8,.06,t,.22);return;}
  if(e.slot==='heavy'){
   const big=e.branch?.85:1;
   st.burst(point,look,.9*big,t,{dir,floor});st.shatter(point,dir,look,2.3*big,t,.4);st.dome(point,look,1.9*big,t,.34);st.shock(ground,look,3.4*big,t,.4);
   return;
  }
  if(e.slot==='special'){
   if(e.branch==='airSpecial'){st.burst(point,look,2.1,t,{floor});st.shock(ground,look,3.6,t,.45);st.scar(ground,look,2.2,t+.05,1.8);this.whirl(ground,t,.8,1.5,3,look);return;}
   const big=e.branch?.75:1;
   st.burst(point,look,1.9*big,t,{dir,floor});
   for(let i=0;i<4;i++)slash((i*.9-1.3)*tilt,(1.4+.25*i)*big,.11,t+i*.06,.32);
   this.whirl(ground,t,.9,1.4*big,3.4*big,look);
   st.shock(ground,look,4.5*big,t,.45);st.scar(ground,look,1.9*big,t+.05,2);
   return;
  }
  if(e.slot!=='ultimate'||e.branch)return;
  if(!blow.final){
   const n=blow.index;st.burst(point,look,1.1+.18*n,t,{dir,floor});slash((n%2?.6:-.6),1.4+.2*n,.11,t,.3);if(n>=2)st.shock(ground,look,3.6+.5*n,t,.45);
   return;
  }
  this.a.copy(dir).setY(.12).normalize();
  st.erupt(this.c.copy(point).addScaledVector(dir,.5),this.a,look,.9,11,t,.5);
  st.shatter(point,dir,look,6,t,.8);
  st.dome(point,look,4,t,.42);
  st.burst(point,look,2,t,{dir,floor});
  st.shock(ground,look,9,t,.6);
  this.whirl(ground,t+.05,1.3,2,4.2,look);
  st.scar(ground,look,3,t+.2,2.1);
 }
 private whirl(at:THREE.Vector3,born:number,life:number,radius:number,height:number,look:StageLook){const w=this.whirls[this.whirlCursor++%this.whirls.length];w.at.copy(at);w.born=born;w.life=life;w.radius=radius;w.height=height;w.look=look;w.live=true;}
 private flow(at:THREE.Vector3,radius:number,count:number,k:number,phase:number,look:StageLook,width=.07,sweep=3.4){
  const st=this.stage;
  for(let i=0;i<count;i++){
   const yaw=i*TAU/count+phase*.7,tilt=.45+.5*Math.sin(i*2.1+phase*.4),from=phase*2.6+i*2.3;
   this.u.set(Math.cos(yaw),0,Math.sin(yaw));this.v.set(-Math.sin(yaw)*Math.sin(tilt),Math.cos(tilt),Math.cos(yaw)*Math.sin(tilt));
   arc(st,at,this.u,this.v,radius*(1-.12*i),from,from+sweep,width,look.main,.85*k);arc(st,at,this.u,this.v,radius*(1-.12*i),from+.3,from+sweep-.3,width*.36,look.core,1.5*k);
   if(look===COSMOS){const head=from+sweep;this.b.copy(at).addScaledVector(this.u,Math.cos(head)*radius*(1-.12*i)).addScaledVector(this.v,Math.sin(head)*radius*(1-.12*i));st.glow(this.b,.16+.1*radius,look.core,.9*k,STAR,.2,i);}
  }
 }
 private stars(at:THREE.Vector3,reach:number,count:number,k:number,time:number,seed:number){
  const st=this.stage;
  for(let i=0,n=st.n(count,4);i<n;i++){const ang=i*2.399963+seed+time*.4,r=reach*(.35+.65*hash(i*1.7+seed)),y=reach*(.15+.85*hash(i*2.9+seed));this.b.set(at.x+Math.cos(ang)*r,at.y+y,at.z+Math.sin(ang)*r);st.glow(this.b,.1+.12*hash(i+seed),COSMOS.core,k*(.45+.55*Math.sin(time*6+i*2.3)**2),STAR,.22,i);}
 }
 update(time:number,fighters:ReadonlyMap<string,Fighter>,_flights?:ReadonlyMap<string,Flight>){if(this.disposed)return;this.rings.begin();this.slashes.begin();this.shards.begin();const detail=this.kit.budget>=.65,st=this.stage.open(time);
  for(const f of fighters.values()){const s=f.state;if(!isGarouWaterStream(s.fighter)||!s.alive||s.whiffedAt!==undefined)continue;
   if(s.action==='awaken'&&s.actionTime>.39&&s.actionTime<.96){const u=(s.actionTime-.39)/.57,alpha=Math.sin(u*Math.PI);this.p.copy(f.group.position);this.p.y+=.04;const r=.25+u*.8;this.rings.add(this.p,this.flat,r,r,1,INK,alpha*.7);this.rings.add(this.p,this.flat,r*.94,r*.94,1,COSMIC,alpha*.55);
    for(const side of['LeftHand','RightHand']){const hand=f.drawnJoint(side);if(!hand)continue;hand.getWorldPosition(this.p);this.q.setFromAxisAngle(UP,s.yaw);this.spin.setFromAxisAngle(Z,u*2.8+(side==='LeftHand'?1.4:0));this.q.multiply(this.spin);this.slashes.add(this.p,this.q,.31,.24,1,COSMIC,alpha*.7);this.slashes.add(this.p,this.q,.26,.19,1,HOT,alpha*.8);}
   }
   if(['light','heavy','special','ultimate'].includes(s.action))this.pose(f,time,s.actionTime*s.actionDuration);
   if(!['light','heavy','special','ultimate'].includes(s.action)||s.actionTime<.12||s.actionTime>.85)continue;
   const elapsed=s.actionTime*s.actionDuration;if(s.action==='ultimate'&&s.confirmedAt===undefined&&elapsed>.48)continue;
   f.strikePoint(this.p);const alpha=Math.sin(s.actionTime*Math.PI)*.72,size=s.action==='special'?.43:s.action==='ultimate'?.32:.23;
   this.q.setFromAxisAngle(UP,s.yaw);this.spin.setFromAxisAngle(Z,(s.actionTime-.2)*3.4+Math.sin(elapsed*5)*.8);this.q.multiply(this.spin);this.slashes.add(this.p,this.q,size,size*.76,1,INK,alpha*.9);this.slashes.add(this.p,this.q,size*.90,size*.64,1,s.awakened?COSMIC:BLUE,alpha);this.slashes.add(this.p,this.q,size*.77,size*.49,1,HOT,alpha*.75);
  }

  for(const h of this.impacts){if(!h.actor)continue;const age=time-h.born;if(age<0)continue;if(age>.38){h.actor='';continue;}const fade=1-age/.38,r=.24+age*(1.7+h.grade*.45);this.q.setFromAxisAngle(UP,h.yaw);this.rings.add(h.point,this.q,r,r,1,INK,fade*.92);if(h.grade>1)this.rings.add(h.point,this.q,r*.91,r*.91,1,h.cosmic?COSMIC:BLUE,fade*.8);
   const n=h.grade===3?(detail?4:2):h.grade>1?2:1;for(let i=0;i<n;i++){this.q.setFromAxisAngle(UP,h.yaw);this.spin.setFromAxisAngle(Z,(i/n*Math.PI)+.45+h.seed*.19);this.q.multiply(this.spin);this.slashes.add(h.point,this.q,r*1.45,r,1,INK,fade);this.slashes.add(h.point,this.q,r*1.34,r*.84,1,i%2?HOT:h.cosmic?COSMIC:BLUE,fade*.85);}
   for(let i=0;i<(detail?6:3);i++){const angle=i*2.399+h.seed*.17;this.p.copy(h.point);this.p.x+=Math.cos(angle)*r*.78;this.p.y+=Math.sin(angle)*r*.78;this.q.setFromAxisAngle(Z,angle);this.shards.add(this.p,this.q,.018,.05+.035*h.grade,.014,i%2?INK:h.cosmic?COSMIC:BLUE,fade*.78);}
   if(h.grade===3){this.p.copy(h.point);this.p.y=Math.max(.035,this.p.y-.8);this.rings.add(this.p,this.flat,r*1.2,r*1.2,1,h.cosmic?COSMIC:BLUE,fade*.55);}
  }
  this.book.each(fighters,GAROU_STREAM_BEATS.end,this.gather);
  for(const w of this.whirls){
   if(!w.live)continue;const age=time-w.born;if(age>=w.life){w.live=false;continue;}if(age<0)continue;
   const fade=Math.min(1,age/.1)*(1-(age/w.life)**2),rows=st.n(6,3);this.u.set(1,0,0);this.v.set(0,0,1);
   for(let i=0;i<rows;i++){const from=time*9+i*1.1,r=w.radius*(.75+.4*i/rows);this.c.set(w.at.x,w.at.y+w.height*(i+.5)/rows*Math.min(1,age/.14),w.at.z);arc(st,this.c,this.u,this.v,r,from,from+4.2,.1,w.look.main,.85*fade);if(i%2===0)arc(st,this.c,this.u,this.v,r,from+.4,from+3.8,.036,w.look.core,1.5*fade);}
   if(w.look===COSMOS)this.stars(w.at,w.radius*1.4,10,fade,time,w.born);
   st.light(this.c.set(w.at.x,w.at.y+w.height*.4,w.at.z),w.radius*1.6+2,w.look,.42*fade);
  }
  this.cuts.draw(st,time);
  this.rings.end();this.slashes.end();this.shards.end();st.close();
 }
 private pose(f:Fighter,time:number,elapsed:number){
  const st=this.stage,s=f.state,look=s.awakened?COSMOS:WATER,seed=(s.actionSeq??0)*3.9,yaw=s.yaw??f.group.rotation.y,heading=this.heading.set(Math.sin(yaw),0,Math.cos(yaw)),at=f.strikePoint(this.a),feet=f.group.position,phase=time*5+seed;
  if(s.action==='light'){const k=Math.sin(clamp(s.actionTime)*Math.PI);this.flow(at,.42,2,k,phase,look,.05);st.light(at,1.9,look,.2*k);return;}
  if(s.action==='heavy'||s.action==='ultimate'&&!s.branch&&s.confirmedAt===undefined&&elapsed<ULT.contacts[0]+.12){
   const contact=s.action==='ultimate'?ULT.contacts[0]:s.branch?s.actionDuration*.5:HEAVY.contacts[0];
   if(elapsed<contact){const k=clamp(elapsed/contact);st.charge(at,look,.24,k,seed);this.flow(at,.4+.3*k,3,.5+.5*k,phase,look,.06);}
   else if(s.action==='heavy'&&elapsed<contact+.2){const k=1-(elapsed-contact)/.2;st.bubble(at,.3+.55*(1-k),look,k);}
   return;
  }
  if(s.action==='special'){
   const release=s.branch?s.actionDuration*.5:SPECIAL.contacts[0];
   if(elapsed<release){
    const k=clamp(elapsed/release);st.charge(at,look,.3,k,seed);this.flow(at,.5,2,k,phase,look,.06);
    if(!s.branch){this.c.copy(feet);this.c.y+=1.05;this.flow(this.c,1.25+.35*k,st.n(4,3),.45+.55*k,phase*1.4,look,.09,3.9);st.disc(this.b.copy(feet),2.2+1.6*k,look.main,.5*k,SHEEN,1);st.light(this.b.copy(feet).setY(feet.y+.6),3.6+2*k,look,.36*k);if(look===COSMOS)this.stars(feet,2.2,12,k,time,seed);}
   }else if(elapsed<release+.24){
    const k=1-(elapsed-release)/.24;this.u.set(heading.z,0,-heading.x);this.c.copy(feet);this.c.y+=1.2;
    for(let i=-1;i<=1;i++){this.v.copy(this.u).multiplyScalar(Math.cos(i*.7)).addScaledVector(UP,Math.sin(i*.7));arc(st,this.c,heading,this.v,2+.15*i,-1.1,1.1,.13,look.main,.9*k);arc(st,this.c,heading,this.v,2+.15*i,-.9,.9,.045,look.core,1.5*k);}
    st.light(this.b.copy(this.c).addScaledVector(heading,1.5),4,look,.42*k);
   }
  }
 }
 private readonly gather=(actor:Fighter,g:Gather,elapsed:number,victim:Fighter|undefined)=>{
  const B=GAROU_STREAM_BEATS;if(elapsed>=B.final+.1)return;
  const st=this.stage,time=st.time,look=actor.state.awakened?COSMOS:WATER,build=clamp((elapsed-B.opener)/(B.final-B.opener)),rise=clamp((elapsed-B.opener)/.3),seed=g.seq*3.3;
  const centre=this.c.copy(actor.group.position);if(victim)centre.lerp(victim.group.position,.5);centre.y=g.floor;
  st.dim(.3+.45*build,g.actor,g.target);
  st.disc(this.b.copy(centre),3+3*build,look.main,.45+.35*build,SHEEN,1);
  st.light(this.b.copy(centre).setY(g.floor+1),5+2.4*build,look,.4+.3*build);
  this.u.set(1,0,0);this.v.set(0,0,1);
  for(let i=0,n=st.n(6,4);i<n;i++){const from=time*(4+5*build)*(i%2?1:-1)+i*1.3,r=(2.5+.5*build)*(.85+.3*i/n)*rise;this.a.set(centre.x,g.floor+.25+2.6*i/n,centre.z);arc(st,this.a,this.u,this.v,r,from,from+2.6,.1,look.main,.5+.4*build);arc(st,this.a,this.u,this.v,r,from+.3,from+2.3,.036,look.core,1.3);}
  if(look===COSMOS)this.stars(centre,3.2,16,.6+.4*build,time,seed);
  if(build>.8)st.speed(.5*(build-.8)/.2,g.actor,g.target);
 };
 reset(){for(const h of this.impacts)h.actor='';this.seen.fill(-1);this.seenTime.fill(-1);for(const b of[this.rings,this.slashes,this.shards]){b.begin();b.end();}for(const w of this.whirls)w.live=false;this.book.reset();this.cuts.reset();this.stage.reset();}
 dispose(){if(this.disposed)return;this.reset();this.disposed=true;this.rings.dispose();this.slashes.dispose();this.shards.dispose();this.stage.release();}
}
