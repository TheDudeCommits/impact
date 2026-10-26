import * as THREE from 'three';
import type { CombatEvent } from '../../game/types';
import type { Fighter } from '../Fighter';
import { bodyCentre, type VfxKit } from '../vfx/VfxKit';
import { HINATA_AWAKENING, HINATA_MOVES } from '../../game/fighters/hinata';
import { SIGNATURE, involvesLocal } from './context';
import { armoryDraws } from '../vfx/armory/drawn';
import { MoveStage, SHEEN, stageLook } from './MoveStage';
import { blowFloor } from './blowFloor';

export const isHinataTwinLions = (id: string | undefined) => id === 'hinata';
export const HINATA_TWIN_LION_LIMITS = Object.freeze({ lions: 32, rings: 96, jets: 16, marks: 192, impacts: 24, beams: 8, duels: 8 });
export const HINATA_TWIN_LION_ASSETS = Object.freeze(['/assets/vfx/hinata-twin-lion.webp']);
export const HINATA_TWIN_LION_BEATS = Object.freeze({ release: HINATA_AWAKENING.beats.release, finish: 3.1, end: 3.52 });
const UP=new THREE.Vector3(0,1,0),FRONT=new THREE.Vector3(0,0,1),TAU=Math.PI*2;
const CYAN=new THREE.Color(.55,1.85,2.6),PALE=new THREE.Color(1.9,1.85,2.7),WHITE=new THREE.Color(2.4,2.6,2.8),BLUE=new THREE.Color(.45,1,2.7),LION_TINT=new THREE.Color(1.02,1,1.3);
const CHAKRA=stageLook(0xf5ffff,0x71dfff,0x3f83ef),LION=stageLook(0xf2f4ff,0x8f9bff,0x4b3fd0),TRIGRAM=stageLook(0xffffff,0xd4d0ff,0x6a5acd);
const HEAVY=HINATA_MOVES.heavy,SPECIAL=HINATA_MOVES.special,ULT=HINATA_MOVES.ultimate,ULT_LAST=ULT.contacts[ULT.contacts.length-1];
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const attacking=(a:string)=>a==='light'||a==='heavy'||a==='special'||a==='ultimate';

class ChakraBatch{
 readonly mesh:THREE.InstancedMesh<THREE.BufferGeometry,THREE.ShaderMaterial>;
 private tint:THREE.InstancedBufferAttribute;private object=new THREE.Object3D();private count=0;
 constructor(scene:THREE.Scene,name:string,g:THREE.BufferGeometry,private capacity:number,face=false){
  if(!g.getAttribute('color'))g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*3).fill(1),3));
  this.tint=new THREE.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(THREE.DynamicDrawUsage);g.setAttribute('chakraTint',this.tint);
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,vertexColors:true,uniforms:{face:{value:face?1:0},uMap:{value:null},ready:{value:0},clock:{value:0}},
   vertexShader:'attribute vec4 chakraTint;varying vec4 vTint;varying vec3 vColor;varying float vLight;void main(){vTint=chakraTint;vColor=color;vLight=dot(normalize(mat3(modelMatrix)*mat3(instanceMatrix)*normal),normalize(vec3(-.3,.8,.4)));gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',
   fragmentShader:'uniform float face;varying vec4 vTint;varying vec3 vColor;varying float vLight;void main(){if(vTint.a<.004)discard;float band=vLight>.35?1.:(vLight>-.3?.85:.63);gl_FragColor=vec4(vColor*vTint.rgb*mix(1.,band,face),vTint.a);}'});material.forceSinglePass=true;
  if(face){
   material.vertexShader='attribute vec4 chakraTint;varying vec4 vTint;varying vec2 vUv;void main(){vTint=chakraTint;vUv=uv;vec4 center=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);vec2 scale=vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));center.xy+=position.xy*scale;gl_Position=projectionMatrix*center;}';
   material.fragmentShader='uniform sampler2D uMap;uniform float ready;uniform float clock;varying vec4 vTint;varying vec2 vUv;void main(){if(ready<.5)discard;vec2 at=vUv;float edge=smoothstep(.23,.5,abs(at.x-.5));at.x+=sin(at.y*16.-clock*9.)*.008*edge;vec4 tex=texture2D(uMap,at);float alpha=tex.a*vTint.a;if(alpha<.025)discard;gl_FragColor=vec4(tex.rgb*vTint.rgb,alpha);}';
  }
  this.mesh=new THREE.InstancedMesh(g,material,capacity);this.mesh.name='hinata-chakra-'+name;this.mesh.frustumCulled=false;this.mesh.renderOrder=6;this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.mesh.count=0;scene.add(this.mesh);
 }
 begin(){this.count=0;}
 add(p:THREE.Vector3,q:THREE.Quaternion,x:number,y:number,z:number,c:THREE.Color,a:number){if(this.count>=this.capacity||a<.004||Math.min(x,y,z)<=0)return;this.object.position.copy(p);this.object.quaternion.copy(q);this.object.scale.set(x,y,z);this.object.updateMatrix();this.mesh.setMatrixAt(this.count,this.object.matrix);this.tint.setXYZW(this.count++,c.r,c.g,c.b,clamp(a));}
 end(){this.mesh.count=this.count;this.mesh.instanceMatrix.needsUpdate=true;this.tint.needsUpdate=true;}
 dispose(){this.mesh.removeFromParent();this.mesh.dispose();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
type Duel={actor:string;target:string;seq:number;finalHit:boolean;point:THREE.Vector3};
type Beam={actor:string;born:number;from:THREE.Vector3;to:THREE.Vector3};
type Impact={actor:string;seq:number;born:number;grade:number;seed:number;beam:boolean;point:THREE.Vector3};
export class HinataTwinLions{
 private lions:ChakraBatch;private rings:ChakraBatch;private jets:ChakraBatch;private marks:ChakraBatch;private batches:ChakraBatch[];
 private duels:Duel[]=Array.from({length:8},()=>({actor:'',target:'',seq:-1,finalHit:false,point:new THREE.Vector3()}));
 private beams:Beam[]=Array.from({length:8},()=>({actor:'',born:0,from:new THREE.Vector3(),to:new THREE.Vector3()}));
 private impacts:Impact[]=Array.from({length:24},()=>({actor:'',seq:-1,born:0,grade:0,seed:0,beam:false,point:new THREE.Vector3()}));
 private texture?:THREE.Texture;private loading?:Promise<void>;
 private seen=new Float64Array(128).fill(-1);private seenTime=new Float64Array(128).fill(-1);private eventCursor=0;private duelCursor=0;private beamCursor=0;private impactCursor=0;private disposed=false;
 private p=new THREE.Vector3();private a=new THREE.Vector3();private b=new THREE.Vector3();private direction=new THREE.Vector3();private q=new THREE.Quaternion();private face=new THREE.Quaternion();private flat=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
 private readonly stage:MoveStage;private dir=new THREE.Vector3();private ground=new THREE.Vector3();private strike=new THREE.Vector3();
 constructor(scene:THREE.Scene,private kit:Pick<VfxKit,'budget'>&Partial<VfxKit>){
  this.stage=MoveStage.for(scene,kit);
  this.lions=new ChakraBatch(scene,'lions',new THREE.PlaneGeometry(1,1),32,true);this.rings=new ChakraBatch(scene,'rings',new THREE.RingGeometry(.91,1,40),96);
  this.jets=new ChakraBatch(scene,'jets',new THREE.CylinderGeometry(.48,.12,1,20,1,true),16);this.marks=new ChakraBatch(scene,'marks',new THREE.BoxGeometry(1,1,1),192);this.batches=[this.lions,this.rings,this.jets,this.marks];
 }
 load(ids:readonly string[]){
  if(this.disposed||!ids.some(isHinataTwinLions))return Promise.resolve();
  return this.loading??=new THREE.TextureLoader().loadAsync(HINATA_TWIN_LION_ASSETS[0]).then(texture=>{
   if(this.disposed){texture.dispose();return;}this.texture=texture;texture.colorSpace=THREE.NoColorSpace;texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;this.lions.mesh.material.uniforms.uMap.value=texture;this.lions.mesh.material.uniforms.ready.value=1;
  });
 }
 handle(e:CombatEvent,fighters?:ReadonlyMap<string,Fighter>){
  if(this.disposed)return;if(e.kind==='eliminated'||e.kind==='respawn'){this.cancel(e.actorId,true);return;}if(!isHinataTwinLions(e.fighter))return;if(e.kind==='whiff'||e.kind==='rejected'){this.cancel(e.actorId);return;}
  if(e.kind!=='release'&&e.kind!=='confirm'&&e.kind!=='hit')return;for(let i=0;i<128;i++)if(this.seen[i]===e.id&&this.seenTime[i]===e.serverTime)return;const next=this.eventCursor++%128;this.seen[next]=e.id;this.seenTime[next]=e.serverTime;
  const actor=fighters?.get(e.actorId),target=e.targetId?fighters?.get(e.targetId):undefined,seq=e.actionSeq??actor?.state.actionSeq??-1;
  if(e.kind==='release'){if(e.slot==='special'&&!e.branch&&e.origin&&e.endpoint){const beam=this.beams[this.beamCursor++%8];beam.actor=e.actorId;beam.born=e.serverTime;beam.from.set(e.origin.x,e.origin.y,e.origin.z);beam.to.set(e.endpoint.x,e.endpoint.y,e.endpoint.z);}return;}
  if(e.kind==='confirm'){if(e.slot==='ultimate'&&!e.branch&&e.targetId)Object.assign(this.duels[this.duelCursor++%8],{actor:e.actorId,target:e.targetId,seq,finalHit:false});return;}
  if(!target&&!e.endpoint)return;const final=e.slot==='ultimate'&&!e.branch&&e.contactIndex===5,impact=this.impacts[this.impactCursor++%24];Object.assign(impact,{actor:e.actorId,seq,born:e.serverTime,grade:final?3:e.slot==='heavy'||e.slot==='special'?2:1,seed:e.id,beam:e.slot==='special'&&!e.branch});
  if(target)bodyCentre(target,impact.point);else impact.point.set(e.endpoint!.x,e.endpoint!.y,e.endpoint!.z);
  if(final){for(const d of this.duels)if(d.actor===e.actorId&&d.seq===seq&&d.target===e.targetId){d.finalHit=true;d.point.copy(impact.point);}if(involvesLocal(e.actorId,e.targetId))SIGNATURE.screen?.impactFrame?.(.45,impact.point);}
  const st=this.stage,t=e.serverTime,point=impact.point,dir=this.dir,floor=blowFloor(actor, target, point.y-1);
  if(actor){dir.subVectors(point,actor.group.position).setY(0);if(dir.lengthSq()<.01)dir.set(Math.sin(actor.group.rotation.y),0,Math.cos(actor.group.rotation.y));dir.normalize();}else dir.copy(FRONT);
  const ground=this.ground.set(point.x,floor,point.z);
  if(e.slot==='light'){st.burst(point,CHAKRA,.42,t,{dir,floor,clean:true});return;}
  if(e.slot==='heavy'){
   const big=e.branch?.85:1;st.burst(point,CHAKRA,.95*big,t,{dir,floor,clean:true});st.dome(this.a.copy(point).addScaledVector(dir,.4),CHAKRA,2.1*big,t,.38);
   return;
  }
  if(e.slot==='special'){
   if(e.branch==='airSpecial'){st.burst(point,LION,2,t,{floor});st.dome(point,LION,3,t,.45);st.shock(ground,LION,5,t,.5);st.scar(ground,LION,2,t+.05,1.8);return;}
   const big=e.branch?.75:armoryDraws(e.fighter,e.slot,e.branch,e.actorId)?.85:1;
   st.burst(point,CHAKRA,1.9*big,t,{dir,floor});st.dome(point,CHAKRA,2.8*big,t,.45);st.shock(ground,CHAKRA,5*big,t,.5);st.scar(ground,CHAKRA,1.8*big,t+.05,2);
   return;
  }
  if(e.slot!=='ultimate'||e.branch)return;
  if(!final){
   const palm=e.contactIndex??0;st.burst(point,LION,.8+.12*palm,t,{dir,floor,clean:true});if(palm>=3)st.shock(ground,LION,3.4+.4*palm,t,.4);
   return;
  }
  st.burst(point,LION,2.5,t,{dir,floor});
  st.erupt(this.a.copy(point).addScaledVector(dir,-1.1),this.b.copy(dir).setY(.06).normalize(),LION,.9,10,t,.5);
  st.dome(point,LION,4.4,t,.5);
  st.shock(ground,LION,9,t,.6);
  st.scar(ground,LION,3,t+.2,2.1);
 }
 private cancel(id:string,target=false){for(const d of this.duels)if(d.actor===id||target&&d.target===id&&!d.finalHit)d.actor='';for(const b of this.beams)if(b.actor===id)b.actor='';for(const i of this.impacts)if(i.actor===id)i.actor='';}
 update(time:number,fighters:ReadonlyMap<string,Fighter>){
  if(this.disposed)return;const st=this.stage.open(time);for(const b of this.batches)b.begin();this.lions.mesh.material.uniforms.clock.value=time;const detail=this.kit.budget>=.65;
  for(const f of fighters.values()){
   const s=f.state;if(!isHinataTwinLions(s.fighter)||!s.alive)continue;const age=s.actionTime*s.actionDuration;this.face.setFromAxisAngle(UP,f.group.rotation.y);
   if(s.action==='awaken'){const grow=clamp((age-HINATA_AWAKENING.beats.focus)/.24),fade=clamp((.9-age)/.15);this.hands(f,grow*.46,fade*.66,detail);if(age>=HINATA_AWAKENING.beats.release)this.trigrams(f,.7+(age-.63)*3,fade,detail);continue;}
   if(!attacking(s.action)||s.whiffedAt!==undefined)continue;
   const alpha=Math.sin(clamp(s.actionTime)*Math.PI);
   if(s.action==='ultimate'&&!s.branch)continue;
   f.strikePoint(this.p);const r=.14+alpha*.16;this.rings.add(this.p,this.face,r,r,1,PALE,alpha*.8);
   if(s.action==='special'&&!s.branch&&age<HINATA_MOVES.special.contacts[0]){this.rings.add(this.p,this.face,r*.58,r*.58,1,WHITE,alpha);}
   const palm=this.strike.copy(this.p),seed=(s.actionSeq??0)*3.1,release=s.branch?0:s.action==='heavy'?HEAVY.contacts[0]:s.action==='special'?SPECIAL.contacts[0]:0;
   st.glow(palm,.3,CHAKRA.main,.45*alpha);st.glow(palm,.12,CHAKRA.core,.8*alpha);st.light(palm,1.9,CHAKRA,.2*alpha);
   if(release>0&&age<release){const k=clamp(age/release);st.charge(palm,CHAKRA,s.action==='special'?.34:.22,k,seed);this.trigrams(f,.9+.7*k,k*.8,detail);}
   if(s.awakened)this.hands(f,.6,alpha*.7,detail);
  }
  for(const duel of this.duels){if(!duel.actor)continue;const f=fighters.get(duel.actor),target=fighters.get(duel.target),s=f?.state;
   if(!f||!s?.alive||s.action!=='ultimate'||s.branch||(s.actionSeq??-1)!==duel.seq||s.whiffedAt!==undefined||!target?.state.alive&&!duel.finalHit){duel.actor='';continue;}
   const age=s.actionTime*s.actionDuration;if(age>HINATA_TWIN_LION_BEATS.end){duel.actor='';continue;}const fade=clamp((HINATA_TWIN_LION_BEATS.end-age)/.25);this.face.setFromAxisAngle(UP,f.group.rotation.y);
   const g=clamp((age-ULT.contacts[0])/(ULT_LAST-ULT.contacts[0]));
   this.hands(f,age>2.6?1:.76+.16*g,fade*.8,detail,.3);this.trigrams(f,2.5,fade*.8,detail);this.gather(f,duel,age,g,fade,time);
   if(duel.finalHit){if(target?.state.alive)bodyCentre(target,this.b);else this.b.copy(duel.point);this.a.copy(f.handL).add(f.handR).multiplyScalar(.5);this.direction.subVectors(this.b,this.a);const length=this.direction.length();if(length>.05){this.direction.multiplyScalar(1/length);this.q.setFromUnitVectors(UP,this.direction);this.p.copy(this.a).addScaledVector(this.direction,length*.5);this.jets.add(this.p,this.q,1.4,length,1.4,PALE,fade*.6);}}
  }
  for(const beam of this.beams){if(!beam.actor)continue;const age=time-beam.born;if(age<0)continue;if(age>.28){beam.actor='';continue;}const fade=1-age/.28;this.direction.subVectors(beam.to,beam.from);const length=Math.min(24,this.direction.length());if(length<.001)continue;this.direction.normalize();this.q.setFromUnitVectors(UP,this.direction);this.p.copy(beam.from).addScaledVector(this.direction,length*.5);this.jets.add(this.p,this.q,.65,length,.65,CYAN,fade*.5);this.q.setFromUnitVectors(FRONT,this.direction);
   for(let i=0;i<(detail?6:3);i++){const u=clamp(i/(detail?6:3)+age*1.2),r=.10+u*.55;this.p.copy(beam.from).addScaledVector(this.direction,length*u);this.rings.add(this.p,this.q,r,r,1,WHITE,fade*.9);}
   st.beam(beam.from,this.b.copy(beam.from).addScaledVector(this.direction,length),.45,CHAKRA,age/.28,beam.born*7.1,length<21?1:.33);
  }
  for(const impact of this.impacts){if(!impact.actor)continue;const age=time-impact.born,s=fighters.get(impact.actor)?.state,life=impact.grade===3?.42:.24;if(!s?.alive||!impact.beam&&((s.actionSeq??-1)!==impact.seq||!attacking(s.action)||s.whiffedAt!==undefined)||age>life){impact.actor='';continue;}if(age<0)continue;const fade=1-age/life,r=.14+age*(2+impact.grade);this.q.setFromAxisAngle(UP,impact.seed);this.rings.add(impact.point,this.q,r,r,1,WHITE,fade);
   for(let i=0;i<(detail?6:3)*impact.grade;i++){const a=i*2.39996+impact.seed;this.p.copy(impact.point);this.p.x+=Math.cos(a)*age*3;this.p.y+=Math.sin(a)*age*3;this.q.setFromAxisAngle(FRONT,a);this.marks.add(this.p,this.q,.025,.12+age*.3,.025,i%2?CYAN:PALE,fade);}
  }
  for(const b of this.batches)b.end();st.close();
 }
 private gather(f:Fighter,duel:Duel,age:number,g:number,fade:number,time:number){
  const st=this.stage,feet=f.group.position,seed=duel.seq*2.1,live=age<ULT_LAST;
  if(live)st.dim(.28+.42*g,duel.actor,duel.target);
  st.disc(this.a.copy(feet),3,TRIGRAM.main,(.14+.1*g)*fade,SHEEN,1);
  for(let i=0,n=st.n(8,4);i<n;i++){
   const turn=i*TAU/n;if(Math.cos(turn)<-.3)continue;
   const rise=(time*(.9+.15*(i%3))+i*.29)%1,ang=turn+f.group.rotation.y,x=feet.x+Math.sin(ang)*2.2,z=feet.z+Math.cos(ang)*2.2,y=feet.y+.08+rise*(1.1+1.2*g);
   st.streak(this.a.set(x,y,z),this.b.set(x,y+.45+.4*g,z),.055,i%2?TRIGRAM.main:LION.main,Math.sin(Math.PI*rise)*(.6+.5*g)*fade);
  }
  st.light(this.a.copy(f.handL).lerp(f.handR,.5).addScaledVector(this.direction.copy(FRONT).applyQuaternion(this.face),.9),3,LION,(.16+.12*g)*fade);
  if(live&&g>.8)st.speed(.5*(g-.8)/.2,duel.actor,duel.target);
 }
 private hands(f:Fighter,scale:number,alpha:number,detail:boolean,lead=.11){
  for(let i=0;i<2;i++){this.p.copy(i?f.handR:f.handL);this.direction.copy(FRONT).applyQuaternion(this.face);this.p.addScaledVector(this.direction,lead*scale);this.lions.add(this.p,this.face,scale,scale,scale,LION_TINT,alpha);
   if(detail){this.q.copy(this.face);this.rings.add(this.p,this.q,.43*scale,.43*scale,1,CYAN,alpha*.45);}
  }
 }
 private trigrams(f:Fighter,r:number,alpha:number,detail:boolean){
  this.p.copy(f.group.position);this.p.y+=.035;this.rings.add(this.p,this.flat,r,r,1,BLUE,alpha);this.rings.add(this.p,this.flat,r*.7,r*.7,1,PALE,alpha*.7);
  if(!detail)return;for(let i=0;i<8;i++){const angle=i*TAU/8+f.group.rotation.y;for(let j=0;j<3;j++){const radius=r*(.79+j*.055);this.p.copy(f.group.position);this.p.x+=Math.sin(angle)*radius;this.p.z+=Math.cos(angle)*radius;this.p.y+=.037;this.q.setFromAxisAngle(UP,angle);if((i>>j)&1){this.marks.add(this.p,this.q,r*.105,.006,r*.016,PALE,alpha*.8);}else{for(const sign of[-1,1]){this.a.copy(this.p);this.a.x+=Math.cos(angle)*sign*r*.034;this.a.z-=Math.sin(angle)*sign*r*.034;this.marks.add(this.a,this.q,r*.037,.006,r*.016,PALE,alpha*.8);}}}}
 }
 reset(){for(const d of this.duels)d.actor='';for(const b of this.beams)b.actor='';for(const i of this.impacts)i.actor='';this.seen.fill(-1);this.seenTime.fill(-1);this.eventCursor=this.duelCursor=this.beamCursor=this.impactCursor=0;for(const b of this.batches){b.begin();b.end();}this.stage.reset();}
 dispose(){if(this.disposed)return;this.reset();this.disposed=true;for(const b of this.batches)b.dispose();this.texture?.dispose();this.texture=undefined;this.stage.release();}
}
