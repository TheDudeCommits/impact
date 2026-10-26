import * as T from 'three';
import type {CombatEvent} from '../../game/types';
import type {Fighter} from '../Fighter';
import type {Flight} from '../CombatEffects';
import {bodyCentre,type VfxKit} from '../vfx/VfxKit';
import {YAMAMOTO_MOVES,YAMAMOTO_SWORD_SOCKET} from '../../game/fighters/yamamoto';
import {SIGNATURE,involvesLocal} from './context';
import { armoryDraws } from '../vfx/armory/drawn';
import {BURN,MoveStage,STAGE} from './MoveStage';
import {CastBook,Cuts,arc,hash,type Gather} from './StageCraft';
export const YAMAMOTO_JAKKA_ASSETS:readonly string[]=Object.freeze([]);
export const YAMAMOTO_JAKKA_LIMITS=Object.freeze({flames:112,crescents:32,cuts:96,embers:128,impacts:24,duels:8});
export const isYamamotoJakka=(id:string|undefined)=>id==='yamamoto';
const UP=new T.Vector3(0,1,0),FORWARD=new T.Vector3(0,0,1),ORANGE=new T.Color(0xff571c),GOLD=new T.Color(0xffc14c),HOT=new T.Color(0xfff5d3),ASH=new T.Color(0x6b554b),TAU=Math.PI*2;
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const FIRE=STAGE.fire,HEAVY=YAMAMOTO_MOVES.heavy,SPECIAL=YAMAMOTO_MOVES.special,ULT=YAMAMOTO_MOVES.ultimate;
export const YAMAMOTO_JAKKA_BEATS=Object.freeze({opener:ULT.contacts[0],second:ULT.contacts[1],final:ULT.contacts[2],end:ULT.duration});
const WALL_STANDS=1.2;
type Wall={actor:string;origin:T.Vector3;head:T.Vector3;heading:T.Vector3;born:number;seen:number;floor:number;live:boolean};
function ribbon(crescent=false){const positions:number[]=[],uvs:number[]=[];const steps=crescent?28:18;
 for(let i=0;i<steps;i++)for(const [u,v]of[[i/steps,0],[i/steps,1],[(i+1)/steps,1],[i/steps,0],[(i+1)/steps,1],[(i+1)/steps,0]]){
  const width=crescent?Math.pow(Math.sin(u*Math.PI),.55)*.23:Math.pow(1-u,.38)*.92;const bend=crescent?(u-.5)*2.25:0;
  positions.push(crescent?Math.sin(bend)*(1-width*v):(v-.5)*width+Math.sin(u*7)*.05,crescent?Math.cos(bend)*(1-width*v)-.6:u-.5,0);uvs.push(u,v);
 }const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.computeVertexNormals();return g;}
class JakkaBatch{
 readonly mesh:T.InstancedMesh<T.BufferGeometry,T.ShaderMaterial>;private tint:T.InstancedBufferAttribute;private object=new T.Object3D();private count=0;
 constructor(scene:T.Scene,name:string,g:T.BufferGeometry,readonly cap:number,kind:number){this.tint=new T.InstancedBufferAttribute(new Float32Array(cap*4),4).setUsage(T.DynamicDrawUsage);g.setAttribute('jakkaTint',this.tint);
 const m=new T.ShaderMaterial({name:`Yamamoto-${name}`,transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false,uniforms:{clock:{value:0},kind:{value:kind}},vertexShader:`uniform float clock;uniform float kind;attribute vec4 jakkaTint;varying vec4 vTint;varying vec2 vUv;varying float vSeed;void main(){vTint=jakkaTint;vUv=uv;vSeed=instanceMatrix[3].x*12.73+instanceMatrix[3].y*7.91+instanceMatrix[3].z*5.37;vec3 p=position;if(kind<.5){p.x*=1.+.24*sin(uv.x*9.+vSeed);p.x+=sin(uv.x*5.-clock*2.+vSeed)*.18*uv.x;p.z+=cos(uv.x*7.+vSeed)*.10*sin(uv.x*3.14159);}gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(p,1.);}`,fragmentShader:`uniform float clock;uniform float kind;varying vec4 vTint;varying vec2 vUv;varying float vSeed;void main(){float across=abs(vUv.y-.5)*2.;float endFade=kind<.5?smoothstep(0.,.055,vUv.x)*(1.-smoothstep(.76,1.,vUv.x)):pow(max(0.,sin(vUv.x*3.14159)),.55);float noise=.88+.12*sin(vUv.x*17.-clock*4.+vSeed+sin(vUv.x*8.+clock*2.+vSeed)*2.);float edge=kind<.5?(1.-smoothstep(.42,1.,across/noise))*endFade:kind<2.5?pow(1.-smoothstep(.08,.98,across/noise),1.2)*endFade:1.;float a=vTint.a*edge;if(a<.003)discard;vec3 c=mix(vTint.rgb,vec3(1.,.965,.80),pow(1.-across,2.)*(kind<.5?.36:.56));gl_FragColor=vec4(c,a);\n#include <colorspace_fragment>\n}`});m.forceSinglePass=true;this.mesh=new T.InstancedMesh(g,m,cap);this.mesh.name=`yamamoto-jakka-${name}`;this.mesh.count=0;this.mesh.frustumCulled=false;this.mesh.renderOrder=3;this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(this.mesh);}
 begin(time:number){this.count=0;this.mesh.material.uniforms.clock.value=time;}
 add(p:T.Vector3,q:T.Quaternion,x:number,y:number,z:number,c:T.Color,alpha:number){if(this.count>=this.cap||alpha<.003||Math.min(x,y,z)<=0)return;this.object.position.copy(p);this.object.quaternion.copy(q);this.object.scale.set(x,y,z);this.object.updateMatrix();this.mesh.setMatrixAt(this.count,this.object.matrix);this.tint.setXYZW(this.count++,c.r,c.g,c.b,clamp(alpha));}
 end(){this.mesh.count=this.count;this.mesh.instanceMatrix.needsUpdate=true;this.tint.needsUpdate=true;}
 dispose(){this.mesh.removeFromParent();this.mesh.dispose();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
type Impact={actor:string;seq:number;born:number;grade:number;seed:number;projectile:boolean;point:T.Vector3};
type Duel={actor:string;target:string;seq:number;finalHit:boolean;point:T.Vector3};
export class YamamotoJakka{
 private flames:JakkaBatch;private crescents:JakkaBatch;private cuts:JakkaBatch;private embers:JakkaBatch;private batches:JakkaBatch[];
 private impacts:Impact[]=Array.from({length:YAMAMOTO_JAKKA_LIMITS.impacts},()=>({actor:'',seq:-1,born:0,grade:0,seed:0,projectile:false,point:new T.Vector3()}));
 private duels:Duel[]=Array.from({length:YAMAMOTO_JAKKA_LIMITS.duels},()=>({actor:'',target:'',seq:-1,finalHit:false,point:new T.Vector3()}));
 private seen=new Float64Array(128).fill(-1);private seenTime=new Float64Array(128).fill(-1);private eventCursor=0;private hitCursor=0;private duelCursor=0;private disposed=false;
 private bladeColors=new Map<string,{body:object;materials:{material:T.Material&{color:T.Color};color:T.Color}[]}>();
 private a=new T.Vector3();private b=new T.Vector3();private p=new T.Vector3();private center=new T.Vector3();private direction=new T.Vector3();private side=new T.Vector3();private q=new T.Quaternion();private face=new T.Quaternion();private turn=new T.Quaternion();
 private readonly stage:MoveStage;private readonly book=new CastBook('yamamoto',ULT.contacts.length);private readonly slashes=new Cuts(8,FIRE);
 private walls:Wall[]=Array.from({length:4},()=>({actor:'',origin:new T.Vector3(),head:new T.Vector3(),heading:new T.Vector3(0,0,1),born:0,seen:-1e9,floor:0,live:false}));
 private heading=new T.Vector3();private axis=new T.Vector3();private c=new T.Vector3();private m=new T.Vector3();
 constructor(scene:T.Scene,private kit:Pick<VfxKit,'budget'>&Partial<VfxKit>){this.stage=MoveStage.for(scene,kit);this.flames=new JakkaBatch(scene,'flames',ribbon(),112,0);this.crescents=new JakkaBatch(scene,'crescents',ribbon(true),32,1);this.cuts=new JakkaBatch(scene,'cuts',ribbon(),96,2);this.embers=new JakkaBatch(scene,'embers',new T.PlaneGeometry(1,1),128,3);this.batches=[this.flames,this.crescents,this.cuts,this.embers];}
 load(_ids:readonly string[]):Promise<void>{return Promise.resolve();}
 handle(e:CombatEvent,fighters?:ReadonlyMap<string,Fighter>){if(this.disposed)return;this.staged(e,fighters);if(e.kind==='eliminated'||e.kind==='respawn'){this.cancel(e.actorId,true);return;}if(!isYamamotoJakka(e.fighter))return;if(e.kind==='whiff'||e.kind==='rejected'){this.cancel(e.actorId);return;}if(e.kind!=='confirm'&&e.kind!=='hit')return;
  for(let i=0;i<128;i++)if(this.seen[i]===e.id&&this.seenTime[i]===e.serverTime)return;const idx=this.eventCursor++%128;this.seen[idx]=e.id;this.seenTime[idx]=e.serverTime;const actor=fighters?.get(e.actorId),target=e.targetId?fighters?.get(e.targetId):undefined,seq=e.actionSeq??actor?.state.actionSeq??-1;
  if(e.kind==='confirm'){if(e.slot==='ultimate'&&!e.branch&&e.targetId)Object.assign(this.duels[this.duelCursor++%this.duels.length],{actor:e.actorId,target:e.targetId,seq,finalHit:false});return;}if(!target&&!e.endpoint)return;
  if(armoryDraws(e.fighter,e.slot,e.branch,e.actorId)){if(e.slot==='ultimate'&&e.contactIndex===2){if(target)bodyCentre(target,this.p);else this.p.set(e.endpoint!.x,e.endpoint!.y,e.endpoint!.z);for(const d of this.duels)if(d.actor===e.actorId&&d.target===e.targetId&&d.seq===seq){d.finalHit=true;d.point.copy(this.p);}if(involvesLocal(e.actorId,e.targetId))SIGNATURE.screen?.impactFrame?.(.46,this.p);}return;}
  const final=e.slot==='ultimate'&&!e.branch&&e.contactIndex===2,h=this.impacts[this.hitCursor++%this.impacts.length];Object.assign(h,{actor:e.actorId,seq,born:e.serverTime,grade:final?3:e.slot==='light'?1:2,seed:e.id,projectile:e.slot==='special'&&!e.branch});if(target)bodyCentre(target,h.point);else h.point.set(e.endpoint!.x,e.endpoint!.y,e.endpoint!.z);
  if(final){for(const d of this.duels)if(d.actor===e.actorId&&d.target===e.targetId&&d.seq===seq){d.finalHit=true;d.point.copy(h.point);}if(involvesLocal(e.actorId,e.targetId))SIGNATURE.screen?.impactFrame?.(.46,h.point);}
 }
 private staged(e:CombatEvent,fighters?:ReadonlyMap<string,Fighter>){
  const blow=this.book.take(e,fighters);if(!blow)return;
  const st=this.stage,{point,ground,dir,side,floor,t}=blow,tilt=e.id%2?1:-1;
  if(e.slot==='light'){st.burst(point,FIRE,.42,t,{dir,floor,clean:true});this.slash(point,side,.45*tilt,.85,.065,t,.22);return;}
  if(e.slot==='heavy'){
   const big=e.branch?.85:1;
   st.burst(point,FIRE,.6*big,t,{dir,floor});this.slash(point,side,.3*tilt,1.7*big,.13,t,.26);
   st.erupt(this.c.copy(ground).addScaledVector(dir,1.7),UP,FIRE,.36*big,4.6*big,t+.03,.36);
   st.scar(this.c.copy(ground).addScaledVector(dir,2.5),FIRE,1*big,t+.05,1.3);
   return;
  }
  if(e.slot==='special'){
   if(e.branch==='airSpecial'){st.burst(point,FIRE,2.2,t,{floor});st.shock(ground,FIRE,3.6,t,.45);st.scar(ground,FIRE,2.4,t+.05,2.2);return;}
   const big=e.branch?.75:1;
   st.burst(point,FIRE,2*big,t,{dir,floor});
   st.erupt(this.c.copy(ground).addScaledVector(dir,.6),UP,FIRE,.6*big,5.5*big,t+.04,.5);
   for(let i=-1;i<=1;i+=2)st.erupt(this.c.copy(ground).addScaledVector(side,i*1.9).addScaledVector(dir,.9),UP,FIRE,.4*big,3.6*big,t+.1,.45);
   st.shock(ground,FIRE,4.6*big,t,.45);st.scar(ground,FIRE,2.1*big,t+.05,2.3);
   return;
  }
  if(e.slot!=='ultimate'||e.branch)return;
  if(!blow.final){st.burst(point,FIRE,blow.index?1.7:1.3,t,{dir,floor});this.slash(point,side,.4*tilt,1.6,.12,t,.3);if(blow.index)st.shock(ground,FIRE,5,t,.5);return;}
  st.erupt(ground,UP,FIRE,.8,13,t,.7);
  for(let i=0;i<3;i++){const ang=Math.atan2(dir.z,dir.x)+(i-1)*1.9;st.erupt(this.c.set(ground.x+Math.cos(ang)*3.5,floor,ground.z+Math.sin(ang)*3.5),UP,FIRE,.45,6,t+.1+i*.06,.55);}
  st.burst(point,FIRE,1.8,t,{dir,floor});
  st.shock(ground,FIRE,9,t,.6);
  st.scar(ground,FIRE,3.2,t+.2,2.2);
  st.scar(this.c.copy(ground).addScaledVector(dir,3.4),FIRE,1.9,t+.25,1.8);
 }
 private slash(point:T.Vector3,side:T.Vector3,lean:number,size:number,width:number,at:number,life:number){this.slashes.add(point,this.axis.copy(side).multiplyScalar(Math.cos(lean)).addScaledVector(UP,Math.sin(lean)).normalize(),undefined,size,width,FIRE,at,life);}
 private cancel(id:string,targetToo=false){for(const h of this.impacts)if(h.actor===id)h.actor='';for(const d of this.duels)if(d.actor===id||targetToo&&d.target===id&&!d.finalHit)d.actor='';}
 private charredBlade(f:Fighter){const body=f.shownBody??f,id=f.state.id;let entry=this.bladeColors.get(id);if(entry?.body!==body){if(entry)for(const m of entry.materials)m.material.color.copy(m.color);const materials:{material:T.Material&{color:T.Color};color:T.Color}[]=[];body.model?.traverse((o:T.Object3D)=>{if(!o.name.startsWith('Yamamoto_RyujinJakka'))return;const mesh=o as T.Mesh;if(!mesh.isMesh)return;for(const material of(Array.isArray(mesh.material)?mesh.material:[mesh.material])){const m=material as T.Material&{color?:T.Color};if(m.color)materials.push({material:m as T.Material&{color:T.Color},color:m.color.clone()});}});entry={body,materials};this.bladeColors.set(id,entry);}for(const m of entry.materials){m.material.color.copy(m.color);if(f.state.awakened&&(f.state.action!=='awaken'||f.state.actionTime>=.64))m.material.color.multiplyScalar(.12);}}
 private blade(f:Fighter,alpha:number){const body=f.shownBody??f;const hand=body.joints?.get('RightHand');if(hand)this.a.fromArray(YAMAMOTO_SWORD_SOCKET.heel).applyMatrix4(hand.matrixWorld);else this.a.copy(body.handR);f.strikePoint(this.b);this.direction.subVectors(this.b,this.a);const length=this.direction.length();if(length<.01)return;this.q.setFromUnitVectors(UP,this.direction.multiplyScalar(1/length));this.center.copy(this.a).add(this.b).multiplyScalar(.5);this.cuts.add(this.center,this.q,.13,length,1,GOLD,alpha);this.turn.setFromAxisAngle(UP,Math.PI/2);this.q.multiply(this.turn);this.cuts.add(this.center,this.q,.09,length,1,HOT,alpha*.65);}
 update(time:number,fighters:ReadonlyMap<string,Fighter>,flights:ReadonlyMap<string,Flight>){if(this.disposed)return;for(const b of this.batches)b.begin(time);const detail=this.kit.budget>=.65,st=this.stage.open(time);for(const[id,entry]of this.bladeColors)if(!fighters.has(id)){for(const m of entry.materials)m.material.color.copy(m.color);this.bladeColors.delete(id);}
  for(const f of fighters.values()){const s=f.state;if(!isYamamotoJakka(s.fighter)||!s.alive)continue;this.charredBlade(f);const t=s.actionTime*s.actionDuration;this.face.copy(f.group.quaternion);
   if(s.action==='awaken'){this.awaken(f,t,detail);continue;}
   if((s.action==='light'||s.action==='heavy'||s.action==='ultimate')&&s.whiffedAt===undefined)this.blade(f,Math.sin(clamp(s.actionTime)*Math.PI)*.65);
   if(s.action==='special'&&!s.branch&&s.whiffedAt===undefined&&t<YAMAMOTO_MOVES.special.contacts[0]){const k=clamp(t/YAMAMOTO_MOVES.special.contacts[0]);this.blade(f,k*.9);f.strikePoint(this.p);this.flames.add(this.p,this.face,.35*k,.4*k,1,ORANGE,k*.75);}
   if(s.whiffedAt===undefined)this.pose(f,t);
  }
  for(const flight of flights.values())if(isYamamotoJakka(flight.fighter)&&flight.slot==='special'&&!flight.branch&&flight.released&&!armoryDraws(flight.fighter,'special',undefined,flight.actorId)){this.face.setFromUnitVectors(FORWARD,this.direction.copy(flight.heading).normalize());this.crescents.add(flight.position,this.face,1.6,2.0,1,ORANGE,.95);this.crescents.add(flight.position,this.face,1.43,1.77,1,HOT,.82);this.side.set(1,0,0).applyQuaternion(this.face);const count=detail?7:4;for(let i=0;i<count;i++){const angle=(i/(count-1)-.5)*2.08+Math.sin(i*2.399)*.09;this.p.copy(flight.position).addScaledVector(flight.heading,-.10-(i%3)*.13).addScaledVector(this.side,Math.sin(angle)*1.18);this.p.y+=Math.cos(angle)*.68-.27;this.turn.setFromAxisAngle(FORWARD,-angle*.45);this.q.copy(this.face).multiply(this.turn);this.flames.add(this.p,this.q,.85+Math.sin(i*1.9)*.17,.64+(i%3)*.19,1,i%3?ORANGE:GOLD,.72+(i%2)*.12);}}
  for(const d of this.duels){if(!d.actor)continue;const f=fighters.get(d.actor),target=fighters.get(d.target),s=f?.state;if(!f||!s?.alive||!target?.state.alive&&!d.finalHit||s.action!=='ultimate'||s.branch||(s.actionSeq??-1)!==d.seq||s.whiffedAt!==undefined){d.actor='';continue;}const t=s.actionTime*s.actionDuration;if(t>3.85){d.actor='';continue;}if(!d.finalHit||t<3.14||armoryDraws('yamamoto','ultimate'))continue;const age=t-3.14,fade=clamp((3.85-t)/.42);this.face.copy(f.group.quaternion);this.direction.set(0,0,1).applyQuaternion(this.face);this.side.set(1,0,0).applyQuaternion(this.face);this.center.copy(d.point);this.center.y=f.group.position.y;
   for(let i=0;i<(detail?13:7);i++){const k=i/((detail?13:7)-1)-.5,height=(1.55+Math.sin(i*2.399)*.58+Math.cos(i*1.17)*.28)*Math.min(1,age*9);this.p.copy(this.center).addScaledVector(this.side,k*3.6+Math.sin(i*4.7)*.11).addScaledVector(this.direction,.62+Math.abs(k)*.22+Math.sin(i*1.9)*.16);this.p.y+=height*.5+.025;this.turn.setFromAxisAngle(FORWARD,Math.sin(i*2.31)*.14);this.q.copy(this.face).multiply(this.turn);this.flames.add(this.p,this.q,1.13+Math.cos(i*2.07)*.28,height,1,i%4===0?GOLD:ORANGE,fade*(.73+(i%3)*.08));this.p.addScaledVector(this.direction,-.08);this.p.y-=height*.12;this.turn.setFromAxisAngle(UP,.24+Math.sin(i*1.2)*.43);this.q.copy(this.face).multiply(this.turn);this.flames.add(this.p,this.q,.73+Math.sin(i*1.67)*.16,height*.70,1,GOLD,fade*.48);}
  }
  for(const h of this.impacts){if(!h.actor)continue;const f=fighters.get(h.actor),s=f?.state,age=time-h.born,life=h.grade===3?.60:.36;if(!s?.alive||!h.projectile&&((s.actionSeq??-1)!==h.seq||!['light','heavy','special','ultimate'].includes(s.action))||s.whiffedAt!==undefined||age>=life){h.actor='';continue;}if(age<0)continue;const fade=1-age/life;this.face.copy(f!.group.quaternion);this.crescents.add(h.point,this.face,.25+age*4,.3+age*4,1,GOLD,fade*.8);for(let i=0;i<(detail?5:3)*h.grade;i++){const angle=i*2.39996+h.seed;this.p.copy(h.point);this.p.x+=Math.sin(angle)*age*(2+h.grade);this.p.z+=Math.cos(angle)*age*(2+h.grade);this.p.y+=age*(i%4*.7)-age*age*2;this.q.setFromAxisAngle(FORWARD,angle);this.q.premultiply(this.face);this.embers.add(this.p,this.q,.022*fade,.07*fade,1,i%2?GOLD:ASH,fade);}}
  for(const flight of flights.values()){
   if(!isYamamotoJakka(flight.fighter)||flight.slot!=='special'||flight.branch||!flight.released||!flight.actorId)continue;
   let wall=this.walls.find(w=>w.live&&w.actor===flight.actorId&&time-w.seen<.2);
   if(!wall){wall=this.walls.find(w=>!w.live)??this.walls[0];wall.actor=flight.actorId;wall.live=true;wall.born=time;wall.floor=fighters.get(flight.actorId)?.group.position.y??flight.position.y-1.1;if(flight.origin)wall.origin.copy(flight.origin);else wall.origin.copy(flight.position).addScaledVector(flight.heading,-1);}
   wall.head.copy(flight.position);wall.heading.copy(flight.heading);wall.seen=time;
  }
  for(const wall of this.walls){
   if(!wall.live)continue;const gone=time-wall.seen;
   if(gone>WALL_STANDS||gone<-.5){wall.live=false;continue;}
   this.direction.subVectors(wall.head,wall.origin).setY(0);const flat=this.direction.length();
   if(gone<=0){if(flat>2.6)st.orb(wall.head,wall.heading,.8,FIRE,wall.born*3.1);else{st.glow(wall.head,.5,FIRE.main,.7);st.glow(wall.head,.2,FIRE.core,.9);}}
   if(flat<1.2)continue;const dx=this.direction.x/flat,dz=this.direction.z/flat,stand=gone<=0?1:1-gone/WALL_STANDS;
   for(let i=0,n=Math.min(st.n(14,6),Math.floor((flat-1)/.75));i<n;i++){const along=1.6+i*.75,sideways=(i%2?1:-1)*(.3+.3*hash(i*3.7+wall.born)),h=(1.2+1.1*hash(i*1.9+wall.born))*stand*(.8+.2*Math.sin(time*8+i*2.3));this.p.set(wall.origin.x+dx*along-dz*sideways,wall.floor+h*.45,wall.origin.z+dz*along+dx*sideways);st.tongue(this.p,UP,h*.45,h,FIRE,stand*(.6+.35*hash(i+wall.born)),i*3+wall.born);}
   st.disc(this.p.set(wall.origin.x+dx*(flat*.5+.8),wall.floor,wall.origin.z+dz*(flat*.5+.8)),Math.min(4,flat*.45+.8),FIRE.main,1,BURN,stand,wall.born);
   st.light(this.p.set(wall.origin.x+dx*(flat*.5+.8),wall.floor+.6,wall.origin.z+dz*(flat*.5+.8)),Math.min(7,flat*.5+3),FIRE,.6*stand);
  }
  this.book.each(fighters,YAMAMOTO_JAKKA_BEATS.end,this.gather);
  this.slashes.draw(st,time);
  for(const b of this.batches)b.end();st.close();
 }
 private pose(f:Fighter,elapsed:number){
  const st=this.stage,s=f.state;if(s.action!=='light'&&s.action!=='heavy'&&s.action!=='special'&&s.action!=='ultimate')return;
  const seed=(s.actionSeq??0)*5.9,yaw=s.yaw??f.group.rotation.y,heading=this.heading.set(Math.sin(yaw),0,Math.cos(yaw)),body=f.shownBody??f,hand=body.joints?.get('RightHand'),feet=f.group.position;
  const heel=this.a,tip=this.b;if(hand)heel.fromArray(YAMAMOTO_SWORD_SOCKET.heel).applyMatrix4(hand.matrixWorld);else heel.copy(body.handR??feet);f.strikePoint(tip);
  const mid=this.m.copy(heel).lerp(tip,.6);
  if(s.action==='light'){
   const k=Math.sin(clamp(s.actionTime)*Math.PI);this.burning(heel,tip,k,2,.3,seed);st.glow(tip,.3,FIRE.main,.5*k);st.light(mid,2,FIRE,.22*k);return;
  }
  if(s.action==='heavy'){
   const contact=s.branch?s.actionDuration*.5:HEAVY.contacts[0];
   if(elapsed<contact){const k=clamp(elapsed/contact);this.burning(heel,tip,k,3,.34+.2*k,seed);st.charge(mid,FIRE,.26,k,seed);}
   else if(elapsed<contact+.22){
    const k=1-(elapsed-contact)/.22;this.side.set(heading.z,0,-heading.x);this.c.copy(feet);this.c.y+=1.25;
    arc(st,this.c,heading,this.side,2.1,-1.1,1.1,.17,FIRE.main,.9*k);arc(st,this.c,heading,this.side,2.1,-1.1,1.1,.06,FIRE.core,1.5*k);
    for(let i=-1;i<=1;i++){this.p.copy(this.c).addScaledVector(heading,2.1*Math.cos(i*.7)).addScaledVector(this.side,2.1*Math.sin(i*.7));st.tongue(this.p,UP,.3,.8,FIRE,k,seed+i);}
    st.light(this.p.copy(this.c).addScaledVector(heading,1.5),4,FIRE,.42*k);
   }
   return;
  }
  if(s.action==='special'){
   const release=s.branch?s.actionDuration*.5:SPECIAL.contacts[0];if(elapsed>=release)return;
   const k=clamp(elapsed/release);this.burning(heel,tip,k,3,.34+.26*k,seed);st.charge(tip,FIRE,.28,k,seed);
   if(!s.branch){const reach=(2+1.4*k)*(.4+.6*k)+.4;st.pool(this.p.copy(feet).addScaledVector(heading,reach),2+1.4*k,FIRE,k,seed);}
   return;
  }
  if(s.action==='ultimate'&&!s.branch&&s.confirmedAt===undefined&&elapsed<ULT.contacts[0]+.12){const k=clamp(elapsed/ULT.contacts[0]);this.burning(heel,tip,k,3,.34+.2*k,seed);st.charge(mid,FIRE,.3,k,seed);}
 }
 private burning(heel:T.Vector3,tip:T.Vector3,k:number,count:number,length:number,seed:number){
  const st=this.stage;st.streak(heel,tip,.07,FIRE.main,.5*k);st.streak(heel,tip,.026,FIRE.core,1.1*k);
  for(let i=0;i<count;i++){this.p.copy(heel).lerp(tip,(i+.6)/count);this.p.y+=length*.4;st.tongue(this.p,UP,.3,length*(1-.12*i),FIRE,k*(.9-.1*i),seed+i);}
 }
 private readonly gather=(actor:Fighter,g:Gather,elapsed:number,victim:Fighter|undefined)=>{
  const B=YAMAMOTO_JAKKA_BEATS;if(elapsed>=B.final+.08)return;
  const st=this.stage,build=clamp((elapsed-B.opener)/(B.final-B.opener)),rise=clamp((elapsed-B.opener)/.4),seed=g.seq*4.1,centre=this.c.copy((victim??actor).group.position).setY(g.floor);
  st.dim(.3+.45*build,g.actor,g.target);
  st.pool(this.p.copy(centre),2.6+2.4*build,FIRE,.3+.7*build,seed);
  st.ring(centre,3.3+.4*build,(1.2+1.7*build)*rise,FIRE,.45+.45*build,seed,7);
  st.light(this.p.copy(centre).setY(g.floor+1),4.5+1.5*build,FIRE,.24+.2*build);
  const body=actor.shownBody??actor,hand=body.joints?.get('RightHand');if(hand)this.a.fromArray(YAMAMOTO_SWORD_SOCKET.heel).applyMatrix4(hand.matrixWorld);else this.a.copy(body.handR??actor.group.position);actor.strikePoint(this.b);
  st.streak(this.a,this.b,.05,FIRE.main,.6+.4*build);st.streak(this.a,this.b,.02,FIRE.core,1.5+.4*build);st.glow(this.b,.16+.1*build,FIRE.core,.7+.3*build);
  if(build>.75)st.speed(.5*(build-.75)/.25,g.actor,g.target);
 };
 private awaken(f:Fighter,t:number,detail:boolean){const u=clamp(f.state.actionTime),collapse=clamp((u-.28)/.32),fade=1-clamp((u-.82)/.18);this.face.copy(f.group.quaternion);f.strikePoint(this.center);this.blade(f,(.3+collapse*.5)*fade);const count=detail?10:5;
  for(let i=0;i<count;i++){const a=i/count*TAU,rad=(.38+i%3*.09)*(1-collapse);this.p.copy(this.center);this.p.x+=Math.sin(a)*rad;this.p.z+=Math.cos(a)*rad;this.p.y+=Math.cos(a*.73)*rad;this.flames.add(this.p,this.face,.18*(1-collapse),(.30+i%3*.08)*(1-collapse),1,ORANGE,fade*(1-collapse)*.65);if(u>.50){this.p.y+=(u-.5)*(.7+i%3*.2);this.embers.add(this.p,this.face,.012,.035,1,ASH,fade*.6);}}
 }
 reset(){for(const entry of this.bladeColors.values())for(const m of entry.materials)m.material.color.copy(m.color);this.bladeColors.clear();for(const h of this.impacts)h.actor='';for(const d of this.duels)d.actor='';this.seen.fill(-1);this.seenTime.fill(-1);this.eventCursor=this.hitCursor=this.duelCursor=0;for(const b of this.batches){b.begin(0);b.end();}for(const w of this.walls)w.live=false;this.book.reset();this.slashes.reset();this.stage.reset();}
 dispose(){if(this.disposed)return;this.reset();this.disposed=true;for(const b of this.batches)b.dispose();this.stage.release();}
}
