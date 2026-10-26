import {SignaturePoolUpload} from './SignaturePoolUpload';
import * as THREE from 'three';
import type {CombatEvent} from '../../game/types';
import type {Fighter} from '../Fighter';
import type {Flight} from '../CombatEffects';
import {bodyCentre,type VfxKit} from '../vfx/VfxKit';
import {SIGNATURE,involvesLocal} from './context';
import {mightGuyStrikeJoint,MIGHT_GUY_MOVES} from '../../game/fighters/might-guy';
import {BLOOD} from './FlameSprites';
import {MoveStage,STAGE,stageLook} from './MoveStage';
import { blowFloor } from './blowFloor';
export const isMightGuyGates=(id:string|undefined)=>id==='might-guy';
export const MIGHT_GUY_GATES_ASSETS:readonly string[]=Object.freeze(['/assets/vfx/might-guy-pressure-beasts.webp']);
export const MIGHT_GUY_GATES_LIMITS=Object.freeze({ribbons:640,rings:40,heads:16,impacts:20,confirms:8});
const BRANCH={lh:'Leaf Rising Wind',llh:'Dynamic Entry',lllh:'Youthful Hurricane',llls:'Morning Peacock',airHeavy:'Descending Fang',airSpecial:'Evening Elephant'}as const;
const GUY_OTHER_HAND=new THREE.Vector3();
function guyJointPoint(f:Fighter,name:string,out:THREE.Vector3){const joint=f.joints?.get(name)??f.bones?.get(name.toLowerCase());return joint?joint.getWorldPosition(out):bodyCentre(f,out);}
export function mightGuyStrikePoint(f:Fighter,out:THREE.Vector3,clip?:string,sourceTime?:number,index?:number){
 const s=f.state;if(!clip&&s.branch)clip=BRANCH[s.branch];if(!clip&&s.action==='light'&&s.chain)clip=`Rush ${s.chain}`;if(!clip)clip=s.action==='heavy'?'Leaf Whirlwind':s.action==='special'?'Daytime Tiger':s.action==='ultimate'?'Night Guy':'Leaf Straight';
 const t=sourceTime??s.actionTime*s.actionDuration,j= mightGuyStrikeJoint(clip,index??(t>2?2:t>.8?1:0));if(j==='BothHands'){guyJointPoint(f,'LeftHand',out);guyJointPoint(f,'RightHand',GUY_OTHER_HAND);return out.lerp(GUY_OTHER_HAND,.5);}return guyJointPoint(f,j,out);
}
const UP=new THREE.Vector3(0,1,0),FRONT=new THREE.Vector3(0,0,1),RIGHT=new THREE.Vector3(1,0,0),CROSS=new THREE.Quaternion(0,Math.SQRT1_2,0,Math.SQRT1_2);
const WHITE=new THREE.Color(2.2,2.5,2.5),BLUE=new THREE.Color(.75,1.9,2.4),RED=new THREE.Color(2.5,.34,.32),HOT=new THREE.Color(2.7,1.3,1);
const GATE=stageLook(0xf2fff0,0x39d65a,0x0f7a2c),DEATH=stageLook(0xffe9dc,0xff3636,0x8a0c14,{flame:BLOOD}),AIR=stageLook(0xffffff,0xa8e6ff,0x3a8fd0),PEACOCK=STAGE.fire;
const DOWN=new THREE.Vector3(0,-1,0),HEAVY=MIGHT_GUY_MOVES.heavy,SPECIAL=MIGHT_GUY_MOVES.special,ULT=MIGHT_GUY_MOVES.ultimate;
const DRAGON={rise:2.6,flight:.5};
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
class GateBatch{
 readonly mesh:THREE.InstancedMesh<THREE.BufferGeometry,THREE.ShaderMaterial>;private tint:THREE.InstancedBufferAttribute;private object=new THREE.Object3D();private count=0;private upload:SignaturePoolUpload;
 constructor(scene:THREE.Scene,name:string,geometry:THREE.BufferGeometry,private capacity:number){
  this.tint=new THREE.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('gateTint',this.tint);const material=new THREE.ShaderMaterial({name:`MightGuy-${name}`,transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,toneMapped:false,vertexShader:'attribute vec4 gateTint;varying vec4 vTint;void main(){vTint=gateTint;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',fragmentShader:'varying vec4 vTint;void main(){if(vTint.a<.005)discard;gl_FragColor=vTint;\n#include <colorspace_fragment>\n}'});this.mesh=new THREE.InstancedMesh(geometry,material,capacity);this.mesh.name=`might-guy-gates-${name}`;this.mesh.frustumCulled=false;this.mesh.renderOrder=6;this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.mesh.count=0;this.upload=new SignaturePoolUpload(this.mesh,this.tint);scene.add(this.mesh);
 }
 begin(){this.count=0;}
 add(p:THREE.Vector3,q:THREE.Quaternion,x:number,y:number,z:number,color:THREE.Color,alpha:number){if(this.count>=this.capacity||alpha<=.005||Math.min(x,y,z)<=0)return;this.object.position.copy(p);this.object.quaternion.copy(q);this.object.scale.set(x,y,z);this.object.updateMatrix();this.mesh.setMatrixAt(this.count,this.object.matrix);this.tint.setXYZW(this.count++,color.r,color.g,color.b,clamp(alpha));}
 end(){this.upload.end(this.count);}
 dispose(){this.mesh.removeFromParent();this.mesh.dispose();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
type Impact={actor:string;born:number;seed:number;grade:number;red:boolean;point:THREE.Vector3;dir:THREE.Vector3;tiger:boolean};
class GateHeadBatch{
 private mesh:THREE.InstancedMesh;private tint:THREE.InstancedBufferAttribute;private object=new THREE.Object3D();private count=0;private upload:SignaturePoolUpload;private ready=false;private disposed=false;private texture:THREE.Texture|undefined;
 constructor(scene:THREE.Scene){
  const g=new THREE.PlaneGeometry(1,1);this.tint=new THREE.InstancedBufferAttribute(new Float32Array(16*3),3).setUsage(THREE.DynamicDrawUsage);g.setAttribute('headData',this.tint);
  const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,toneMapped:false,uniforms:{atlas:{value:null}},vertexShader:`
   attribute vec3 headData;varying vec2 vUv;varying float vKind;varying float vAlpha;varying float vPhase;
   void main(){vUv=uv;vKind=headData.x;vAlpha=headData.y;vPhase=headData.z;
    // The dragon artwork faces left. Keep its muzzle leading the real kick
    // from either camera shoulder while the pressure face stays bill-boarded.
    if(vKind>.5&&vKind<1.5&&(viewMatrix*instanceMatrix*vec4(0.,0.,1.,0.)).x>0.)vUv.x=1.-vUv.x;
    vec4 centre=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);
    vec2 size=vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));
    centre.xy+=position.xy*size;gl_Position=projectionMatrix*centre;}
  `,fragmentShader:`
   uniform sampler2D atlas;varying vec2 vUv;varying float vKind;varying float vAlpha;varying float vPhase;
   float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
   void main(){vec4 c;
    if(vKind>1.5){
     vec2 p=vec2(vUv.x*3.,vUv.y*4.-vPhase*2.7);float n=noise(p)*.65+noise(p*2.1)*.35;
     float bend=.5+sin(vUv.y*6.-vPhase*3.)*.14;
     float edge=1.-smoothstep(.10,.47,abs(vUv.x-bend));
     float body=edge*sin(vUv.y*3.14159265);float density=body*smoothstep(.21,.77,n);
     c=vec4(mix(vec3(.42,.012,.018),vec3(.95,.13,.12),density),density*vAlpha);
    }else{c=texture2D(atlas,vec2(vUv.x*.5+vKind*.5,vUv.y));
     // (Over the bloom threshold: drawn as painted, the technique's own grade dimmed the beasts with the room.)
     c.rgb*=1.55;
     // A hot ivory core keeps the eye, teeth and ink contours readable under
     // Night Guy's red cinematic grade without another glow pass or texture.
     if(vKind>.5){float hot=smoothstep(.35,.90,max(c.r,max(c.g,c.b)));c.rgb=mix(c.rgb,vec3(1.,.78,.61),hot*.56);}
     c.a*=vAlpha;}
    if(c.a<.006)discard;gl_FragColor=c;
    #include <colorspace_fragment>
   }
  `});this.mesh=new THREE.InstancedMesh(g,m,16);this.mesh.name='might-guy-gates-heads';this.mesh.frustumCulled=false;this.mesh.renderOrder=6;this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.mesh.count=0;this.upload=new SignaturePoolUpload(this.mesh,this.tint);scene.add(this.mesh);
 }
 async load(){const t=await new THREE.TextureLoader().loadAsync(MIGHT_GUY_GATES_ASSETS[0]);if(this.disposed){t.dispose();return;}t.colorSpace=THREE.SRGBColorSpace;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;this.texture=t;(this.mesh.material as THREE.ShaderMaterial).uniforms.atlas.value=t;this.ready=true;}
 begin(){this.count=0;}
 add(p:THREE.Vector3,size:number,kind:number,alpha:number,aspect=1,phase=0,direction?:THREE.Vector3){if(!this.ready||this.count>=16||alpha<.005||size<.001)return;this.object.position.copy(p);if(direction)this.object.quaternion.setFromUnitVectors(FRONT,direction);else this.object.quaternion.identity();this.object.scale.set(size,size*aspect,1);this.object.updateMatrix();this.mesh.setMatrixAt(this.count,this.object.matrix);this.tint.setXYZ(this.count++,kind,alpha,phase);}
 end(){this.upload.end(this.count);}
 dispose(){if(this.disposed)return;this.disposed=true;this.mesh.removeFromParent();this.mesh.dispose();this.mesh.geometry.dispose();(this.mesh.material as THREE.Material).dispose();this.texture?.dispose();}
}
type Confirm={actor:string;target:string;seq:number};
export class MightGuyGates{
 private readonly stage:MoveStage;
 private ribbons:GateBatch;private rings:GateBatch;private heads:GateHeadBatch;private loading:Promise<void>|undefined;private impacts:Impact[]=Array.from({length:20},()=>({actor:'',born:-1e9,seed:0,grade:0,red:false,point:new THREE.Vector3(),dir:new THREE.Vector3(0,0,1),tiger:false}));private confirms:Confirm[]=Array.from({length:8},()=>({actor:'',target:'',seq:-1}));private seen=new Float64Array(128).fill(-1);private seenTime=new Float64Array(128).fill(-1);private cursor=0;private impactCursor=0;private confirmCursor=0;private disposed=false;
 private p=new THREE.Vector3();private a=new THREE.Vector3();private b=new THREE.Vector3();private c=new THREE.Vector3();private d=new THREE.Vector3();private start=new THREE.Vector3();private end=new THREE.Vector3();private forward=new THREE.Vector3();private side=new THREE.Vector3();private direction=new THREE.Vector3();private q=new THREE.Quaternion();private q2=new THREE.Quaternion();private face=new THREE.Quaternion();private head=new THREE.Vector3();
 private ground=new THREE.Vector3();private blow=new THREE.Vector3();
 constructor(scene:THREE.Scene,private kit:Pick<VfxKit,'budget'>&Partial<VfxKit>){this.stage=MoveStage.for(scene,kit);const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([0,-.5,0,-.5,-.14,0,.5,-.14,0,-.5,-.14,0,.5,-.14,0,.25,.28,0,-.5,-.14,0,.25,.28,0,0,.5,0],3));this.ribbons=new GateBatch(scene,'ribbons',g,640);this.rings=new GateBatch(scene,'rings',new THREE.RingGeometry(.91,1,32),40);this.heads=new GateHeadBatch(scene);}
 load(ids:readonly string[]){if(!ids.includes('might-guy'))return Promise.resolve();return this.loading??=this.heads.load();}
 private cancel(id:string){for(const c of this.confirms)if(c.actor===id||c.target===id)c.actor='';}
 handle(e:CombatEvent,fighters?:ReadonlyMap<string,Fighter>){
  if(this.disposed)return;if(e.kind==='eliminated'||e.kind==='respawn'){this.cancel(e.actorId);return;}if(!isMightGuyGates(e.fighter))return;if(e.kind==='whiff'||e.kind==='rejected'){this.cancel(e.actorId);return;}if(e.kind!=='hit'&&e.kind!=='confirm')return;
  for(let i=0;i<128;i++)if(this.seen[i]===e.id&&this.seenTime[i]===e.serverTime)return;const at=this.cursor++%128;this.seen[at]=e.id;this.seenTime[at]=e.serverTime;const f=fighters?.get(e.actorId),v=e.targetId?fighters?.get(e.targetId):undefined;
  if(e.kind==='confirm'){if(e.slot==='ultimate'&&!e.branch&&e.targetId){const c=this.confirms[this.confirmCursor++%8];c.actor=e.actorId;c.target=e.targetId;c.seq=e.actionSeq??f?.state.actionSeq??-1;}return;}
  if(!e.endpoint&&!v)return;const h=this.impacts[this.impactCursor++%20];h.actor=e.actorId;h.born=e.serverTime;h.seed=e.id;h.grade=e.slot==='ultimate'&&!e.branch&&e.contactIndex===2?3:e.slot==='heavy'||e.slot==='special'?2:1;h.red=!!f?.state.awakened||e.slot==='ultimate';h.tiger=e.slot==='special'&&!e.branch;if(e.endpoint)h.point.set(e.endpoint.x,e.endpoint.y,e.endpoint.z);else if(v)bodyCentre(v,h.point);if(h.grade===3&&involvesLocal(e.actorId,e.targetId))SIGNATURE.screen?.impactFrame?.(.42,h.point);
  const dir=h.dir,point=h.point,st=this.stage,t=e.serverTime,floor=blowFloor(f,v,point.y-1);
  if(f){dir.subVectors(point,f.group.position).setY(0);if(dir.lengthSq()<.01)dir.set(Math.sin(f.state.yaw??0),0,Math.cos(f.state.yaw??0));dir.normalize();}else dir.copy(FRONT);
  const ground=this.ground.set(point.x,floor,point.z),gate=f?.state.awakened?DEATH:GATE;
  if(e.slot==='light'){st.burst(point,gate,.44,t,{dir,floor,clean:true});return;}
  if(e.slot==='heavy'){
   const big=e.branch?.85:1;
   st.burst(point,gate,.85*big,t,{dir,floor});st.shock(ground,gate,4.2*big,t,.45);
   st.erupt(this.a.copy(point).addScaledVector(dir,.45),this.b.copy(dir).setY(.12).normalize(),gate,.3,3.4*big,t,.3);
   return;
  }
  if(e.slot==='special'){
   if(e.branch==='llls'){st.burst(point,PEACOCK,1.5,t,{dir,floor});st.scar(ground,PEACOCK,1.4,t+.05,1.6);return;}
   if(e.branch==='airSpecial'){
    st.burst(point,AIR,1.9,t,{floor});st.shock(ground,AIR,5.5,t,.5);st.scar(ground,AIR,1.9,t+.1,1.5);
    for(let i=0;i<3;i++){const ang=i*2.094+e.id;st.erupt(this.a.set(ground.x+Math.cos(ang)*1.1*i,floor+5,ground.z+Math.sin(ang)*1.1*i),DOWN,AIR,.65,5,t+i*.08,.3);}
    return;
   }
   st.burst(point,AIR,2,t,{dir,floor});st.dome(point,AIR,3.8,t,.6);st.shock(ground,AIR,6,t,.55);st.scar(ground,AIR,2.3,t+.1,2.3);
   return;
  }
  if(e.slot!=='ultimate'||e.branch)return;
  if(h.grade!==3){
   st.burst(point,DEATH,e.contactIndex?1.6:1.2,t,{dir,floor});if(e.contactIndex)st.shock(ground,DEATH,5,t,.5);
   return;
  }
  const along=this.b.copy(dir).setY(.07).normalize();
  st.burst(point,DEATH,2.6,t,{dir,floor});
  st.erupt(this.a.copy(point).addScaledVector(dir,-1),along,DEATH,.95,12,t,.55);
  st.shatter(point,dir,DEATH,5.5,t,.7);
  st.shock(ground,DEATH,9,t,.6);
  st.scar(ground,DEATH,3,t+.2,2.2);st.scar(this.a.copy(ground).addScaledVector(dir,3.6),DEATH,2,t+.25,1.8);
 }
 private segment(a:THREE.Vector3,b:THREE.Vector3,width:number,col:THREE.Color,alpha:number){this.direction.subVectors(b,a);const length=this.direction.length();if(length<.001)return;this.q.setFromUnitVectors(UP,this.direction.multiplyScalar(1/length));this.p.copy(a).lerp(b,.5);this.ribbons.add(this.p,this.q,Math.min(width,length*.28),length,1,col,alpha);this.q2.copy(this.q).multiply(CROSS);this.ribbons.add(this.p,this.q2,Math.min(width*.65,length*.18),length,1,col,alpha*.65);}
 private beast(at:THREE.Vector3,direction:THREE.Vector3,size:number,alpha:number,dragon:boolean,_detail:boolean){this.heads.add(at,size*(dragon?2.1:1.7),dragon?1:0,alpha*(dragon?.97:.90),1,0,dragon?direction:undefined);}
 update(time:number,fighters:ReadonlyMap<string,Fighter>,flights:ReadonlyMap<string,Flight>){
  if(this.disposed)return;const st=this.stage.open(time);this.ribbons.begin();this.rings.begin();this.heads.begin();const detail=this.kit.budget>.5;
  for(const f of fighters.values()){
   const s=f.state;if(!isMightGuyGates(s.fighter)||!s.alive)continue;const phase=s.actionTime,t=phase*s.actionDuration;if(s.action==='idle'||s.action==='hurt'||s.action==='guard')continue;this.forward.set(Math.sin(s.yaw),0,Math.cos(s.yaw));this.side.set(this.forward.z,0,-this.forward.x);const col=s.awakened?RED:WHITE,gate=s.awakened?DEATH:GATE,seed=(s.actionSeq??0)*4.7;
   if(s.action==='awaken'){
    const power=Math.sin(Math.PI*phase),release=clamp((phase-.28)/.3);
    const strands=detail?6:4;
    for(let i=0;i<strands;i++){
     const angle=i/strands*Math.PI*2+.2;
     this.c.copy(f.group.position).addScaledVector(this.side,Math.sin(angle)*.39).addScaledVector(this.forward,Math.cos(angle)*.24);
     this.c.y+=.75+Math.sin(i*2.4)*.08;
     this.heads.add(this.c,.44+release*.16,2,power*release*.66,2.65,phase+i*.71);
    }
    if(phase>.45){this.p.copy(f.group.position);this.p.y+=.035;this.face.setFromAxisAngle(RIGHT,-Math.PI/2);const r=.34+(phase-.45)*1.7;this.rings.add(this.p,this.face,r,r,1,RED,power*.28);}continue;
   }
   if(s.whiffedAt!==undefined||s.action==='ultimate'&&t>.57&&s.confirmedAt===undefined)continue;
   if(s.action==='special'&&!s.branch){
    this.c.copy(f.handL).lerp(f.handR,.5);
    if(t<SPECIAL.contacts[0])st.charge(this.c,AIR,.36,clamp(t/SPECIAL.contacts[0]),seed);
    if(phase>.15&&phase<.60){this.a.copy(f.handL);this.b.copy(f.handR);this.segment(this.a,this.b,.04,WHITE,Math.sin(phase*Math.PI));this.face.setFromUnitVectors(FRONT,this.forward);const r=.1+Math.sin(phase*Math.PI)*.16;this.rings.add(this.c,this.face,r,r,1,BLUE,.8);}
    continue;
   }
   if(s.action==='ultimate'&&t>2.05)continue;
   if(s.action==='light'||s.action==='heavy'||s.branch||s.action==='ultimate'){
    const power=Math.sin(Math.PI*phase),kick=s.action==='heavy'||s.branch==='lh'||s.branch==='llh'||s.branch==='lllh'||s.branch==='airHeavy';f.strikePoint(this.c);this.a.copy(this.c).addScaledVector(this.forward,-.16);this.b.copy(this.c).addScaledVector(this.forward,.08);this.segment(this.a,this.b,.04,col,power*.8);if(kick){this.face.setFromUnitVectors(FRONT,this.forward);const r=.09+power*.08;this.rings.add(this.c,this.face,r,r,1,col,power*.65);}
    const look=s.action==='ultimate'?DEATH:s.branch==='llls'?PEACOCK:gate;
    st.glow(this.c,.34,look.main,.5*power);st.glow(this.c,.14,look.core,.8*power);
    st.streak(this.a.copy(this.c).addScaledVector(this.forward,-(.35+.45*power)),this.c,.045,look.core,1.2*power);
    st.light(this.c,2,look,.22*power);
    if(s.action==='ultimate'){if(s.confirmedAt===undefined)st.charge(this.c,DEATH,.3,clamp(t/ULT.contacts[0]),seed);}
    else if(kick&&!s.branch){
     const contact=HEAVY.contacts[0],k=clamp(t/contact),fade=t<contact?k:clamp(1-(t-contact)/.22);
     if(fade>0)for(let i=0,n=st.n(6,3);i<n;i++){
      const ang=i*Math.PI*2/n-time*13,r=1.25-.25*k,y=f.group.position.y+.35+.9*k+.12*Math.sin(i*2.1);
      this.a.set(f.group.position.x+Math.cos(ang)*r,y,f.group.position.z+Math.sin(ang)*r);this.b.set(f.group.position.x+Math.cos(ang+.75)*r,y,f.group.position.z+Math.sin(ang+.75)*r);
      st.streak(this.a,this.b,.07,gate.main,.9*fade);
     }
    }
   }
  }
  for(const f of flights.values()){
   if(!isMightGuyGates(f.fighter)||f.slot!=='special'||f.branch||!f.released||!f.origin)continue;this.forward.copy(f.heading).normalize();const distance=Math.max(0,this.direction.subVectors(f.position,f.origin).dot(this.forward));if(distance<.002)continue;const size=Math.min(1.5,distance/1.1);this.beast(f.position,this.forward,size,.96,false,detail);
   this.side.set(this.forward.z,0,-this.forward.x);const tail=Math.min(2,distance);for(let i=0;i<(detail?4:2);i++){const side=(i-1.5)*.15;this.a.copy(f.position).addScaledVector(this.forward,-tail*.22).addScaledVector(this.side,side*size);this.a.y+=Math.sin(i*2.2)*.12*size;this.b.copy(this.a).addScaledVector(this.forward,-tail*.78);this.segment(this.a,this.b,.05,BLUE,.48);}
   if(distance>.5)st.orb(f.position,this.forward,Math.min(.75,distance*.3),AIR,(f.since??0)*3.1);
  }
  for(const c of this.confirms){
   if(!c.actor)continue;const f=fighters.get(c.actor),v=fighters.get(c.target),s=f?.state;if(!f||!v?.state.alive||!s?.alive||s.action!=='ultimate'||s.branch||(s.actionSeq??-1)!==c.seq||s.whiffedAt!==undefined){c.actor='';continue;}const t=s.actionTime*s.actionDuration;
   if(t<ULT.contacts[2])this.gather(f,c,t);
   if(t<DRAGON.rise||t>3.5)continue;const fade=clamp((t-DRAGON.rise)/.25)*clamp((3.5-t)/.25);this.forward.set(Math.sin(s.yaw),0,Math.cos(s.yaw));f.strikePoint(this.c);this.head.copy(this.c).addScaledVector(this.forward,.14);this.head.y+=.45;
   if(t<ULT.contacts[2])this.beast(this.head,this.forward,1.2,fade,true,detail);
   this.side.set(this.forward.z,0,-this.forward.x);for(let i=0;i<(detail?5:3);i++){this.a.copy(this.c).addScaledVector(this.side,(i-2)*.08);this.a.y+=Math.sin(i*2.1)*.13;this.b.copy(this.a).addScaledVector(this.forward,-.40-fade*.70);this.b.y+=Math.cos(i*1.7)*.20;this.segment(this.a,this.b,.06,RED,fade*.68);}
  }
  for(const h of this.impacts){if(!h.actor)continue;const age=time-h.born,life=h.grade===3?DRAGON.flight:h.tiger?.5:.24;if(age>=life){h.actor='';continue;}if(age<0)continue;const fade=1-age/life,col=h.red?HOT:WHITE,n=(detail?4:2)*h.grade;for(let i=0;i<n;i++){const angle=i*2.39996+h.seed;this.a.copy(h.point);this.b.copy(h.point);const distance=.08+age*(h.grade===3?5:3.2);this.b.x+=Math.sin(angle)*distance;this.b.y+=Math.cos(angle)*distance;this.b.z+=Math.sin(angle*1.3)*distance*.5;this.segment(this.a,this.b,.06*fade,col,fade);}
   if(h.grade===3){
    this.face.identity();const r=.10+age*2.6;this.rings.add(h.point,this.face,r,r,1,RED,fade*.65);
    this.head.copy(h.point).addScaledVector(h.dir,age*15);this.head.y+=.5+age*1.2;this.beast(this.head,h.dir,1.25+age*.8,fade,true,detail);
   }else if(h.tiger){
    this.beast(this.blow.copy(h.point).setY(h.point.y+.3),h.dir,1.5+age*4,fade,false,detail);
   }
  }
  this.ribbons.end();this.rings.end();this.heads.end();st.close();
 }
 private gather(f:Fighter,c:Confirm,t:number){
  const st=this.stage,g=clamp((t-ULT.contacts[0])/(ULT.contacts[2]-ULT.contacts[0])),feet=f.group.position,seed=c.seq*3.3;
  if(t<ULT.contacts[0])return;
  st.dim(.3+.45*g,c.actor,c.target);
  st.ring(feet,1.9+.4*g,1.1+1.9*g,DEATH,.55+.45*g,seed,9);
  st.pool(this.p.copy(feet),2.2+2.3*g,DEATH,.3+.7*g,seed);
  f.strikePoint(this.d);st.charge(this.d,DEATH,.28+.3*g,Math.max(.35,g),seed);
  if(g>.75)st.speed(.6*(g-.75)/.25,c.actor,c.target);
 }
 reset(){for(const h of this.impacts)h.actor='';for(const c of this.confirms)c.actor='';this.seen.fill(-1);this.seenTime.fill(-1);this.cursor=this.impactCursor=this.confirmCursor=0;this.ribbons.begin();this.rings.begin();this.heads.begin();this.ribbons.end();this.rings.end();this.heads.end();this.stage.reset();}
 dispose(){if(this.disposed)return;this.reset();this.disposed=true;this.ribbons.dispose();this.rings.dispose();this.heads.dispose();this.stage.release();}
}
