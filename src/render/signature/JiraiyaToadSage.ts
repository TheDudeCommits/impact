import * as THREE from 'three';
import type {CombatEvent} from '../../game/types';
import type {Fighter} from '../Fighter';
import type {Flight} from '../CombatEffects';
import type {VfxKit} from '../vfx/VfxKit';
import {bodyCentre} from '../vfx/VfxKit';
import {SIGNATURE,involvesLocal} from './context';
import {JIRAIYA_MOVES,JIRAIYA_MOUTH_OFFSET} from '../../game/fighters/jiraiya';
import {SPHERES} from './EnergySphere';
import {MoveStage,STAGE,stageLook} from './MoveStage';
import { blowFloor } from './blowFloor';
export const isJiraiyaSage=(id:string|undefined)=>id==='jiraiya';
export const JIRAIYA_SAGE_LIMITS=Object.freeze({flames:192,rings:96,streaks:192,licks:64,impacts:24,finales:8});
const UP=new THREE.Vector3(0,1,0),BLUE=new THREE.Color(.55,1.5,3),WHITE=new THREE.Color(2.5,2.8,3),GOLD=new THREE.Color(3,2.1,.5),FIRE=new THREE.Color(2.8,.85,.2),RED=new THREE.Color(1.9,.2,.12),GREEN=new THREE.Color(1,2,.85);
const RASEN=stageLook(0xe8fbff,0x59baff,0x1c58d8,{sphere:SPHERES.blue}),BLAZE=STAGE.fire,OIL=stageLook(0xfff3cf,0xffb52e,0x8a5a12),WIND=stageLook(0xf4fff0,0x9be08b,0x2f7a3a);
const HEAVY=JIRAIYA_MOVES.heavy,SPECIAL=JIRAIYA_MOVES.special,ULT=JIRAIYA_MOVES.ultimate,FORWARD=new THREE.Vector3(0,0,1);
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
class SageBatch{
 mesh:THREE.InstancedMesh<THREE.BufferGeometry,THREE.ShaderMaterial>;count=0;private tint:THREE.InstancedBufferAttribute;private o=new THREE.Object3D();
 constructor(scene:THREE.Scene,name:string,g:THREE.BufferGeometry,private capacity:number,billboard=false){
  this.tint=new THREE.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(THREE.DynamicDrawUsage);g.setAttribute('sageTint',this.tint);
  const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide,uniforms:{clock:{value:0}},vertexShader:'attribute vec4 sageTint;varying vec4 vTint;varying float vLight;varying vec3 vPos;void main(){vTint=sageTint;vPos=position;vec3 n=normalize(mat3(modelMatrix)*mat3(instanceMatrix)*normal);vLight=dot(n,normalize(vec3(-.4,.7,.5)));gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',fragmentShader:'uniform float clock;varying vec4 vTint;varying float vLight;varying vec3 vPos;void main(){if(vTint.a<.004)discard;float band=vLight>.35?1.:(vLight>-.3?.83:.5);vec3 color=vTint.rgb*band;if(vTint.b>vTint.r*1.3){float swirl=sin(atan(vPos.x,vPos.z)*5.+vPos.y*16.-clock*18.);color=mix(color,vec3(.88,.97,1.),smoothstep(.73,.96,swirl)*.9);}gl_FragColor=vec4(color,vTint.a);}' });
  if(billboard){
   m.uniforms.flameMap={value:null};m.uniforms.ready={value:0};
   m.vertexShader='attribute vec4 sageTint;uniform float clock;varying vec4 vTint;varying vec2 vUv;void main(){vTint=sageTint;vUv=uv;if(instanceMatrix[0].x<0.)vUv.x=1.-vUv.x;vec4 center=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);float sx=length(instanceMatrix[0].xyz),sy=length(instanceMatrix[1].xyz);vec2 p=position.xy;p.x+=sin(clock*8.+instanceMatrix[3].x*2.+p.y*4.)*.045*pow(p.y+.5,2.);vec2 axis=(modelViewMatrix*instanceMatrix*vec4(0.,1.,0.,0.)).xy;axis=length(axis)>.0001?normalize(axis):vec2(0.,1.);center.xy+=vec2(axis.y,-axis.x)*p.x*sx+axis*p.y*sy;gl_Position=projectionMatrix*center;}';
   m.fragmentShader='uniform sampler2D flameMap;uniform float ready;varying vec4 vTint;varying vec2 vUv;void main(){if(ready<.5)discard;vec4 flame=texture2D(flameMap,vUv);float a=flame.a*vTint.a;if(a<.015)discard;gl_FragColor=vec4(flame.rgb*1.55,a);}';
  }
  m.forceSinglePass=true;
  this.mesh=new THREE.InstancedMesh(g,m,capacity);this.mesh.name='jiraiya-'+name;this.mesh.count=0;this.mesh.frustumCulled=false;this.mesh.renderOrder=6;this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(this.mesh);
 }
 begin(){this.count=0;}
 add(p:THREE.Vector3,q:THREE.Quaternion,x:number,y:number,z:number,c:THREE.Color,a:number){if(this.count>=this.capacity||a<.004||Math.min(x,y,z)<=0)return;this.o.position.copy(p);this.o.quaternion.copy(q);this.o.scale.set(x,y,z);this.o.updateMatrix();this.mesh.setMatrixAt(this.count,this.o.matrix);this.tint.setXYZW(this.count++,c.r,c.g,c.b,clamp(a));}
 end(){this.mesh.count=this.count;this.mesh.instanceMatrix.needsUpdate=true;this.tint.needsUpdate=true;}
 dispose(){this.mesh.removeFromParent();this.mesh.dispose();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
type Hit={actor:string;seq:number;born:number;seed:number;grade:number;fire:boolean;grind:number;point:THREE.Vector3};
type Finale={actor:string;target:string;seq:number;finalHit:boolean;point:THREE.Vector3};
export class JiraiyaToadSage{
 private flames:SageBatch;private rings:SageBatch;private streaks:SageBatch;private licks:SageBatch;private texture?:THREE.Texture;private loading?:Promise<void>;private batches:SageBatch[];
 private impacts:Hit[]=Array.from({length:JIRAIYA_SAGE_LIMITS.impacts},()=>({actor:'',seq:-1,born:0,seed:0,grade:0,fire:false,grind:0,point:new THREE.Vector3()}));
 private finales:Finale[]=Array.from({length:JIRAIYA_SAGE_LIMITS.finales},()=>({actor:'',target:'',seq:-1,finalHit:false,point:new THREE.Vector3()}));
 private seen=new Float64Array(128).fill(-1);private seenAt=new Float64Array(128).fill(-1);private cursor=0;private finaleCursor=0;private seenCursor=0;private disposed=false;
 private p=new THREE.Vector3();private a=new THREE.Vector3();private b=new THREE.Vector3();private direction=new THREE.Vector3();private q=new THREE.Quaternion();private flat=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
 private readonly stage:MoveStage;private dir=new THREE.Vector3();private ground=new THREE.Vector3();private mouth=new THREE.Vector3();private heading=new THREE.Vector3();
 constructor(scene:THREE.Scene,private kit:Pick<VfxKit,'budget'>&Partial<VfxKit>){this.stage=MoveStage.for(scene,kit);this.flames=new SageBatch(scene,'flames',new THREE.IcosahedronGeometry(1,1),JIRAIYA_SAGE_LIMITS.flames);this.rings=new SageBatch(scene,'spirals',new THREE.TorusGeometry(1,.025,4,32),JIRAIYA_SAGE_LIMITS.rings);this.streaks=new SageBatch(scene,'embers',new THREE.ConeGeometry(1,1,5),JIRAIYA_SAGE_LIMITS.streaks);this.licks=new SageBatch(scene,'flame-licks',new THREE.PlaneGeometry(1,1),JIRAIYA_SAGE_LIMITS.licks,true);this.batches=[this.flames,this.rings,this.streaks,this.licks];}
 load(ids:readonly string[]):Promise<void>{
  if(this.disposed||!ids.includes('jiraiya'))return Promise.resolve();
  return this.loading??=new THREE.TextureLoader().loadAsync('/assets/vfx/jiraiya-goemon-flame.webp').then(texture=>{
   if(this.disposed){texture.dispose();return;}texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;this.texture=texture;this.licks.mesh.material.uniforms.flameMap.value=texture;this.licks.mesh.material.uniforms.ready.value=1;
  }).catch(error=>{this.loading=undefined;throw error;});
 }
 handle(e:CombatEvent,fighters?:ReadonlyMap<string,Fighter>){
  if(this.disposed)return;if(e.kind==='eliminated'||e.kind==='respawn'){this.cancel(e.actorId,true);return;}
  if(!isJiraiyaSage(e.fighter))return;if(e.kind==='whiff'||e.kind==='rejected'){this.cancel(e.actorId);return;}if(e.kind!=='hit'&&e.kind!=='confirm')return;
  const actor=fighters?.get(e.actorId);if(!actor?.state.alive)return;
  for(let i=0;i<this.seen.length;i++)if(this.seen[i]===e.id&&this.seenAt[i]===e.serverTime)return;
  const i=this.seenCursor++%this.seen.length;this.seen[i]=e.id;this.seenAt[i]=e.serverTime;const seq=e.actionSeq??actor.state.actionSeq??-1;
  if(e.kind==='confirm'){if(e.slot==='ultimate'&&!e.branch&&e.targetId)Object.assign(this.finales[this.finaleCursor++%this.finales.length],{actor:e.actorId,target:e.targetId,seq,finalHit:false});return;}
  const victim=e.targetId?fighters?.get(e.targetId):undefined;if(!victim&&!e.endpoint)return;
  const final=e.slot==='ultimate'&&!e.branch&&e.contactIndex===2,h=this.impacts[this.cursor++%this.impacts.length];Object.assign(h,{actor:e.actorId,seq,born:e.serverTime,seed:e.id,grade:final?3:e.slot==='heavy'||e.slot==='special'?2:1,fire:e.slot==='special'||e.slot==='ultimate'&&(e.contactIndex??0)>0});
  if(e.endpoint)h.point.set(e.endpoint.x,e.endpoint.y,e.endpoint.z);else bodyCentre(victim!,h.point);
  if(final){for(const f of this.finales)if(f.actor===e.actorId&&f.seq===seq){f.finalHit=true;f.point.copy(h.point);}if(involvesLocal(e.actorId,e.targetId))SIGNATURE.screen?.impactFrame?.(.48,h.point);}
  const st=this.stage,t=e.serverTime,point=h.point,dir=this.dir,floor=blowFloor(actor,victim,actor.group.position.y);h.grind=0;
  dir.subVectors(point,actor.group.position).setY(0);if(dir.lengthSq()<.01)dir.set(Math.sin(actor.group.rotation.y),0,Math.cos(actor.group.rotation.y));dir.normalize();
  const ground=this.ground.set(point.x,floor,point.z);
  if(e.slot==='light'){st.burst(point,OIL,.44,t,{dir,floor,clean:true});return;}
  if(e.slot==='heavy'){
   if(e.branch&&e.branch!=='lllh'){st.burst(point,OIL,.9,t,{dir,floor});return;}
   const big=e.branch?.85:1;h.grind=.5*big;
   st.burst(point,RASEN,1*big,t,{dir,floor});st.dome(point,RASEN,2.3*big,t,.4);st.shock(ground,RASEN,4.4*big,t,.45);st.scar(ground,RASEN,1.3*big,t+.05,1.2);
   return;
  }
  if(e.slot==='special'){
   if(e.branch==='airSpecial'){h.grind=.9;st.burst(point,RASEN,2,t,{floor});st.dome(point,RASEN,3.2,t,.45);st.shock(ground,RASEN,4.8,t,.45);st.scar(ground,RASEN,2.2,t+.05,1.8);return;}
   if(e.branch){st.burst(point,BLAZE,1.5,t,{dir,floor});st.scar(ground,BLAZE,1.5,t+.05,1.8);return;}
   st.burst(point,BLAZE,2.1,t,{dir,floor});
   st.erupt(ground,UP,BLAZE,.8,4.6,t+.04,.7);
   st.shock(ground,OIL,5,t,.5);
   st.scar(ground,BLAZE,2.3,t+.05,2.4);
   for(let i=1;i<=2;i++){const back=Math.min(i*2.2,ground.distanceTo(actor.group.position)-1.4);if(back>.8)st.scar(this.a.copy(ground).addScaledVector(dir,-back),BLAZE,1.1-i*.15,t,1.6);}
   return;
  }
  if(e.slot!=='ultimate'||e.branch)return;
  if(!final){
   if(e.contactIndex){st.burst(point,BLAZE,1.7,t,{dir,floor});st.shock(ground,OIL,5,t,.5);}else st.burst(point,OIL,1.2,t,{dir,floor});
   return;
  }
  st.burst(point,BLAZE,2.7,t,{dir,floor});
  st.erupt(ground,UP,BLAZE,1.35,11,t+.05,.8);
  this.b.set(dir.z,0,-dir.x);
  for(let i=-1;i<=1;i+=2)st.erupt(this.a.copy(ground).addScaledVector(this.b,i*2.6).addScaledVector(dir,.8),UP,BLAZE,.7,6,t+.14+(i>0?.06:0),.7);
  st.shock(ground,OIL,9,t,.6);
  st.scar(ground,BLAZE,3.2,t+.2,2.2);st.scar(this.a.copy(ground).addScaledVector(dir,3.4),BLAZE,2,t+.25,1.8);
 }
 private mouthOf(f:Fighter,out:THREE.Vector3){if(!this.socket(f,'Head',out))return false;out.addScaledVector(this.heading,JIRAIYA_MOUTH_OFFSET.forward);out.y+=JIRAIYA_MOUTH_OFFSET.up;return true;}
 private cancel(id:string,targetToo=false){for(const h of this.impacts)if(h.actor===id)h.actor='';for(const f of this.finales)if(f.actor===id||targetToo&&f.target===id&&!f.finalHit)f.actor='';}
 private socket(f:Fighter,name:string,p:THREE.Vector3){const body=f.shownBody??f,joint=body.joints?.get(name)??body.model?.getObjectByName(name);if(joint){joint.getWorldPosition(p);return true;}
  const hand=name==='RightHand'?f.handR:name==='LeftHand'?f.handL:undefined;if(!hand)return false;p.copy(hand);return true;}
 update(time:number,fighters:ReadonlyMap<string,Fighter>,flights:ReadonlyMap<string,Flight>){
  if(this.disposed)return;const st=this.stage.open(time);for(const b of this.batches){b.begin();b.mesh.material.uniforms.clock.value=time;}const detailed=this.kit.budget>=.65;
  for(const f of fighters.values()){
   const s=f.state;if(!isJiraiyaSage(s.fighter)||!s.alive)continue;const age=s.actionTime*s.actionDuration,seed=(s.actionSeq??0)*4.3;
   this.heading.set(Math.sin(f.group.rotation.y),0,Math.cos(f.group.rotation.y));
   if(s.action==='awaken'){this.awaken(f,age,detailed);continue;}
   if(s.action==='ultimate'&&s.confirmedAt!==undefined&&age>=.52&&age<.84)this.awaken(f,.576+age-.52,detailed);
   if(s.whiffedAt!==undefined)continue;
   const rasengan=s.action==='heavy'||s.branch==='lllh'||s.branch==='airSpecial';
   if(rasengan&&this.socket(f,'RightHand',this.a)){
    const phase=s.actionTime,charge=clamp(phase/.32),wound=s.action==='heavy'&&!s.branch?clamp(age/HEAVY.contacts[0]):1,fade=clamp((1-phase)/.22),r=.12+.2*Math.max(charge*.5,wound);
    this.q.identity();this.flames.add(this.a,this.q,r*.5,r*.5,r*.5,BLUE,.34*fade);
    for(let k=0;k<(detailed?5:3);k++){this.direction.set(Math.sin(k*2.399),Math.cos(k*2.399),Math.sin(time*4+k)).normalize();this.q.setFromUnitVectors(UP,this.direction);this.rings.add(this.a,this.q,r*(1.12+k*.08),r*(1.12+k*.08),r*(1.12+k*.08),k%2?WHITE:BLUE,.6*fade);}
    st.ball(this.a,r,RASEN,seed,Math.min(1,fade*2));st.glow(this.a,r*2.1,RASEN.main,.36*fade);
    st.light(this.b.copy(this.a).setY(this.a.y+.15),1.4+r*6,RASEN,(.2+.4*Math.min(1,r/.4))*fade);
    if(wound<1)for(let i=0,n=st.n(7,4);i<n;i++){
     const turn=(time*1.9+i*.618)%1,ang=i*2.399963+seed+turn*2.4,far=r*(1.3+4.5*(1-turn)*(1-turn)),lift=Math.sin(i*1.7+seed)*.5,near=Math.max(r,far-r*1.6);
     this.p.set(this.a.x+Math.cos(ang)*far,this.a.y+lift*far*.5,this.a.z+Math.sin(ang)*far);this.b.set(this.a.x+Math.cos(ang+.5)*near,this.a.y+lift*near*.5,this.a.z+Math.sin(ang+.5)*near);
     st.streak(this.p,this.b,r*.16,RASEN.main,Math.sin(Math.PI*turn)*wound*1.1);
    }
   }else if(s.action==='light'&&this.socket(f,'LeftHand',this.a)){
    const power=Math.sin(clamp(s.actionTime)*Math.PI);st.glow(this.a,.3,OIL.main,.5*power);st.glow(this.a,.12,OIL.core,.8*power);st.light(this.a,1.9,OIL,.2*power);
   }
   if(s.action==='special'&&!s.branch&&age<SPECIAL.contacts[0]&&this.mouthOf(f,this.mouth)){
    st.charge(this.mouth,BLAZE,.3,clamp(age/SPECIAL.contacts[0]),seed);
   }else if(s.action==='ultimate'&&!s.branch&&s.confirmedAt===undefined&&age<ULT.contacts[0]+.1&&this.socket(f,'LeftHand',this.a)){
    st.charge(this.a,OIL,.28,clamp(age/ULT.contacts[0]),seed);
   }
   if(s.action==='special'&&age>.25&&age<.7&&this.socket(f,'Head',this.a)){
    this.direction.set(Math.sin(f.group.rotation.y),0,Math.cos(f.group.rotation.y));this.a.addScaledVector(this.direction,.14);this.a.y+=.055;this.q.setFromUnitVectors(UP,this.direction);const r=.03+clamp((age-.25)/.44)*.04;this.flames.add(this.a,this.q,r,r*.65,r,GOLD,.65);
   }
  }
  for(const flight of flights.values()){
   if(!isJiraiyaSage(flight.fighter)||flight.slot!=='special'||flight.branch||!flight.released)continue;
   this.q.setFromUnitVectors(UP,flight.heading);this.p.copy(flight.position).addScaledVector(flight.heading,.16);
   this.flames.add(this.p,this.q,.19,.28,.19,FIRE,.48);this.flames.add(this.p,this.q,.11,.3,.11,GOLD,.54);this.licks.add(this.p,this.q,.74,1.12,1,WHITE,.92);
   st.orb(flight.position,flight.heading,.85,BLAZE,(flight.since??0)*3.7);st.glow(this.p.copy(flight.position).addScaledVector(flight.heading,-.9),.55,OIL.main,.45);
   const n=detailed?9:4;for(let i=0;i<n;i++){const k=i/n,theta=i*2.39996+time*5;this.p.copy(flight.position).addScaledVector(flight.heading,-.12-k*.54);this.p.x+=Math.cos(theta)*.10*k;this.p.y+=Math.sin(theta)*.10*k;this.streaks.add(this.p,this.q,.045*(1-k),.24,.045*(1-k),i%3?GOLD:RED,.74*(1-k));}
  }
  for(const f of this.finales){
   if(!f.actor)continue;const actor=fighters.get(f.actor),victim=fighters.get(f.target),s=actor?.state;
   if(!actor||!s?.alive||!victim?.state.alive&&!f.finalHit||s.action!=='ultimate'||s.branch||(s.actionSeq??-1)!==f.seq||s.whiffedAt!==undefined){f.actor='';continue;}
   const age=s.actionTime*s.actionDuration;if(age>3.1){f.actor='';continue;}
   if(victim?.state.alive)bodyCentre(victim,f.point);const floor=blowFloor(actor,victim,actor.group.position.y);
   if(age<ULT.contacts[2])this.gather(actor,f,age,floor,time);
   if(age<1.1)continue;
   const charge=clamp((age-1.1)/.6),burst=clamp((age-2.6)/.5),fade=1-burst;
   for(let ring=0;ring<(detailed?3:2);ring++){this.p.copy(f.point);this.p.y=floor+.04+ring*.16;const r=.45+ring*.16+charge*.45+burst*1.3;this.rings.add(this.p,this.flat,r,r,1,age<1.82?GREEN:GOLD,fade*.68);}
   if(age>=1.82){const count=detailed?9:5;for(let i=0;i<count;i++){
    const t=i*Math.PI*2/count+time*.7,rad=.6+burst*1.15;this.p.set(f.point.x+Math.sin(t)*rad,floor+.35+Math.sin(i*1.3+time*8)*.08,f.point.z+Math.cos(t)*rad);this.direction.set(Math.sin(t)*.15,1,Math.cos(t)*.15).normalize();this.q.setFromUnitVectors(UP,this.direction);const rise=clamp((age-1.82)/.3);const height=(.88+(i%3)*.18+Math.sin(time*9+i)*.07+1.1*Math.sin(burst*Math.PI))*rise;this.p.y=floor+height*.47;this.q.setFromAxisAngle(UP,i%2?Math.PI:0);this.licks.add(this.p,this.q,.66+burst*.5,height,1,WHITE,.82*fade);
   }}
  }
  for(const h of this.impacts){if(!h.actor)continue;const state=fighters.get(h.actor)?.state,age=time-h.born,life=h.grade===3?.62:.34;
   if(!state?.alive||(state.actionSeq??-1)!==h.seq||state.whiffedAt!==undefined||age>=life){h.actor='';continue;}if(age<0)continue;const fade=1-age/life,n=detailed?h.grade*5:h.grade*2;
   for(let i=0;i<n;i++){const t=i*2.39996+h.seed*.2;this.p.copy(h.point);this.p.x+=Math.sin(t)*age*(2+h.grade);this.p.z+=Math.cos(t)*age*(2+h.grade);this.p.y+=age*(i%3+.5)-age*age*2;this.direction.set(Math.sin(t),.4,Math.cos(t)).normalize();this.q.setFromUnitVectors(UP,this.direction);this.streaks.add(this.p,this.q,.028*h.grade*fade,.19*h.grade*fade,.028*h.grade*fade,h.fire?(i%3?GOLD:FIRE):(i%3?BLUE:WHITE),fade);}
  }
  for(const h of this.impacts){if(!h.actor||h.grind<=0)continue;const age=time-h.born;if(age<0||age>=.24)continue;const u=age/.24;st.ball(h.point,h.grind*(.6+.4*Math.min(1,age/.06))*(1-.25*u),RASEN,h.seed,1-u*u);st.glow(h.point,h.grind*2,RASEN.main,.4*(1-u));}
  for(const b of this.batches)b.end();st.close();
 }
 private gather(actor:Fighter,f:Finale,age:number,floor:number,time:number){
  const st=this.stage,g=clamp((age-ULT.contacts[0])/(ULT.contacts[2]-ULT.contacts[0])),boil=clamp((age-ULT.contacts[1])/(ULT.contacts[2]-ULT.contacts[1])),seed=f.seq*2.9;
  if(age<ULT.contacts[0])return;
  const centre=this.ground.set(f.point.x,floor,f.point.z);
  st.dim(.3+.45*g,f.actor,f.target);
  st.pool(centre,2.2+2.6*g,OIL,.3+.7*g,seed,1-.5*boil);
  for(let i=0,n=st.n(7,4);i<n;i++){
   const ang=i*Math.PI*2/n+time*3.2,r=2.3-.5*g,y=floor+.3+((time*.9+i*.37)%1)*2.2;
   this.a.set(centre.x+Math.cos(ang)*r,y,centre.z+Math.sin(ang)*r);this.b.set(centre.x+Math.cos(ang+.7)*r,y+.18,centre.z+Math.sin(ang+.7)*r);
   st.streak(this.a,this.b,.07,WIND.main,.9*(1-.6*boil));
  }
  st.light(this.a.copy(centre).setY(floor+.6),4.5,boil>0?BLAZE:WIND,.3+.2*g);
  if(boil<=0)return;
  st.ring(centre,2.3+.3*boil,1+1.7*boil,BLAZE,.6+.4*boil,seed,8);
  st.pool(centre,2.4+2*boil,BLAZE,.4+.6*boil,seed+1);
  this.heading.set(Math.sin(actor.group.rotation.y),0,Math.cos(actor.group.rotation.y));
  if(this.mouthOf(actor,this.mouth))st.charge(this.mouth,BLAZE,.28+.24*boil,boil,seed);
  if(boil>.6)st.speed(.55*(boil-.6)/.4,f.actor,f.target);
 }
 private awaken(f:Fighter,age:number,detail:boolean){
  const release=.576,before=age<release,u=before?clamp(age/release):clamp((age-release)/.30),fade=before?.6:1-u;
  this.p.copy(f.group.position);this.p.y+=.035;const radius=before?1.25-u*.72:.53+u*1.5;this.rings.add(this.p,this.flat,radius,radius,1,GREEN,fade*.8);
  const n=detail?12:6;for(let i=0;i<n;i++){const t=i*Math.PI*2/n+timePhase(age),r=before?1.05-u*.7:.35+u*1.5;this.p.set(f.group.position.x+Math.sin(t)*r,f.group.position.y+.1+(i%4)*.19,f.group.position.z+Math.cos(t)*r);this.q.setFromAxisAngle(UP,t);const size=.025+.015*(i%2);this.flames.add(this.p,this.q,size,size,size,GREEN,fade*.7);}
 }
 reset(){for(const h of this.impacts)h.actor='';for(const f of this.finales)f.actor='';this.seen.fill(-1);this.seenAt.fill(-1);this.cursor=this.finaleCursor=this.seenCursor=0;for(const b of this.batches){b.begin();b.end();}this.stage.reset();}
 dispose(){if(this.disposed)return;this.reset();this.disposed=true;for(const b of this.batches)b.dispose();this.texture?.dispose();this.texture=undefined;this.stage.release();}
}
const timePhase=(age:number)=>age*.8;
