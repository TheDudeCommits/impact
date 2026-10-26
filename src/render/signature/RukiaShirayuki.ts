import * as THREE from 'three';
import type { CombatEvent } from '../../game/types';
import type { Fighter } from '../Fighter';
import type { Flight } from '../CombatEffects';
import type { VfxKit } from '../vfx/VfxKit';
import { bodyCentre } from '../vfx/VfxKit';
import { SIGNATURE, involvesLocal } from './context';
import { RUKIA_MOVES } from '../../game/fighters/rukia';
import { MoveStage, SHEEN, WAVE, stageLook } from './MoveStage';
import { blowFloor } from './blowFloor';
import { CastBook, Cuts, hash, sheenAhead, type Gather } from './StageCraft';

export const isRukiaShirayuki = (id: string | undefined) => id === 'rukia';
export const RUKIA_SNOW_LIMITS = Object.freeze({ crystals: 224, rings: 80, streaks: 128, impacts: 20, finales: 8 });
export const RUKIA_SNOW_BEATS = Object.freeze({ awakening: .585, lift: 1.58, finale: 2.54, end: 2.98 });
const UP=new THREE.Vector3(0,1,0),WHITE=new THREE.Color(0xf2ffff),BLUE=new THREE.Color(0x69c7e8);
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const manual=(s:string)=>s==='light'||s==='heavy'||s==='special'||s==='ultimate';
const ICE=stageLook(0xffffff,0xbfe4ff,0x8fb8e8,{heart:.5}),HOT_WHITE=new THREE.Color(2.2,2.4,2.6),HOT_BLUE=new THREE.Color(.8,1.65,2.3);
const ICE_WHITE=new THREE.Color(1.4,1.55,1.75),ICE_BLUE=new THREE.Color(.5,1.05,1.6);
const HEAVY=RUKIA_MOVES.heavy,SPECIAL=RUKIA_MOVES.special,ULT=RUKIA_MOVES.ultimate;
const WAVE_LINGER=.42,ICE_STANDS=1.5;
type Wave={actor:string;origin:THREE.Vector3;head:THREE.Vector3;born:number;seen:number;floor:number;live:boolean};
type Frost={at:THREE.Vector3;born:number;life:number;radius:number;height:number;count:number;seed:number;facing:number;live:boolean};
export const RUKIA_BLADE={root:[-0.022989388555288315, -0.03262696415185928, -0.09726671874523163],tip:[0.034976184368133545, -0.13311445713043213, -0.9162433743476868]} as {root:number[];tip:number[]};
const FORM_BLADE={"root": [-0.08685153722763062, 0.02097487449645996, -0.055415526032447815], "tip": [-0.6722478866577148, -0.0460686981678009, -0.6359337568283081]};
export function rukiaBlade(f:Fighter,root:THREE.Vector3,tip:THREE.Vector3):boolean {
  const body=f.shownBody??f,bone=body.joints?.get('RightHand')??body.model?.getObjectByName('RightHand');if(!bone)return false;
  const points=body===f?RUKIA_BLADE:FORM_BLADE;root.fromArray(points.root).applyMatrix4(bone.matrixWorld);tip.fromArray(points.tip).applyMatrix4(bone.matrixWorld);return true;
}
class IceBatch {
  mesh:THREE.InstancedMesh<THREE.BufferGeometry,THREE.ShaderMaterial>;count=0;
  private tint:THREE.InstancedBufferAttribute;private o=new THREE.Object3D();
  constructor(scene:THREE.Scene,name:string,g:THREE.BufferGeometry,private capacity:number,facets:boolean){
    this.tint=new THREE.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(THREE.DynamicDrawUsage);g.setAttribute('iceTint',this.tint);
    const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide,uniforms:{facets:{value:facets?1:0}},
      vertexShader:'attribute vec4 iceTint; varying vec4 vTint; varying float vLight; varying vec2 vUv; void main(){vTint=iceTint;vUv=uv;vec3 n=normalize(mat3(modelMatrix)*mat3(instanceMatrix)*normal);vLight=dot(n,normalize(vec3(-.4,.7,.5)));gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',
      fragmentShader:'uniform float facets; varying vec4 vTint; varying float vLight; varying vec2 vUv; void main(){if(vTint.a<.004)discard;float band=vLight>.5?1.:(vLight>0.?.79:.48);float edge=step(.045,vUv.x)*step(vUv.x,.955);vec3 color=facets>.5?mix(vTint.rgb*.26,vTint.rgb*band,edge):vTint.rgb;gl_FragColor=vec4(color,vTint.a);}' });
    this.mesh=new THREE.InstancedMesh(g,m,capacity);this.mesh.name='rukia-'+name;this.mesh.frustumCulled=false;this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.o.scale.setScalar(0);this.o.updateMatrix();this.mesh.setMatrixAt(0,this.o.matrix);this.mesh.count=1;scene.add(this.mesh);
  }
  begin(){this.count=0;}
  add(p:THREE.Vector3,q:THREE.Quaternion,x:number,y:number,z:number,c:THREE.Color,a:number){if(this.count>=this.capacity||a<=.004||Math.min(x,y,z)<=0)return;this.o.position.copy(p);this.o.quaternion.copy(q);this.o.scale.set(x,y,z);this.o.updateMatrix();this.mesh.setMatrixAt(this.count,this.o.matrix);this.tint.setXYZW(this.count++,c.r,c.g,c.b,clamp(a));}
  end(){this.mesh.count=this.count;this.mesh.instanceMatrix.needsUpdate=true;this.tint.needsUpdate=true;}
  dispose(){this.mesh.removeFromParent();this.mesh.dispose();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
type Impact={actor:string;born:number;grade:number;seed:number;p:THREE.Vector3;floor:number};
type Finale={actor:string;target:string;seq:number;finalHit:boolean;point:THREE.Vector3};
export class RukiaShirayuki {
  private crystals:IceBatch;private rings:IceBatch;private streaks:IceBatch;private batches:IceBatch[];
  private impacts:Impact[]=Array.from({length:RUKIA_SNOW_LIMITS.impacts},()=>({actor:'',born:-1e6,grade:0,seed:0,p:new THREE.Vector3(),floor:0}));
  private finales:Finale[]=Array.from({length:RUKIA_SNOW_LIMITS.finales},()=>({actor:'',target:'',seq:-1,finalHit:false,point:new THREE.Vector3()}));
  private seen=new Float64Array(128).fill(-1);private seenAt=new Float64Array(128).fill(-1);private seenCursor=0;private impactCursor=0;private finaleCursor=0;private disposed=false;
  private p=new THREE.Vector3();private a=new THREE.Vector3();private b=new THREE.Vector3();private dir=new THREE.Vector3();private q=new THREE.Quaternion();private flat=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
  private readonly stage:MoveStage;private readonly book=new CastBook('rukia',ULT.contacts.length);private readonly cuts=new Cuts(8,ICE);
  private waves:Wave[]=Array.from({length:4},()=>({actor:'',origin:new THREE.Vector3(),head:new THREE.Vector3(),born:0,seen:-1e9,floor:0,live:false}));
  private frosts:Frost[]=Array.from({length:8},()=>({at:new THREE.Vector3(),born:0,life:0,radius:1,height:1,count:0,seed:0,facing:0,live:false}));private frostCursor=0;
  private heading=new THREE.Vector3();private side=new THREE.Vector3();private c=new THREE.Vector3();private m=new THREE.Vector3();private axis=new THREE.Vector3();
  constructor(scene:THREE.Scene,private kit:Pick<VfxKit,'budget'>&Partial<VfxKit>){
    this.stage=MoveStage.for(scene,kit);
    this.crystals=new IceBatch(scene,'crystal-facets',new THREE.ConeGeometry(1,1,6,1,false),RUKIA_SNOW_LIMITS.crystals,true);
    this.rings=new IceBatch(scene,'snow-rings',new THREE.RingGeometry(.96,1,48),RUKIA_SNOW_LIMITS.rings,false);
    this.streaks=new IceBatch(scene,'blade-frost',new THREE.CylinderGeometry(.4,1,1,6,1),RUKIA_SNOW_LIMITS.streaks,true);this.batches=[this.crystals,this.rings,this.streaks];
  }
  load(_ids:readonly string[]){return Promise.resolve();}
  handle(e:CombatEvent,fighters?:ReadonlyMap<string,Fighter>){
    if(this.disposed)return;this.staged(e,fighters);if(e.kind==='eliminated'||e.kind==='respawn'){this.cancel(e.actorId,true);return;}
    if(!isRukiaShirayuki(e.fighter))return;if(e.kind==='whiff'||e.kind==='rejected'){this.cancel(e.actorId);return;}
    if(e.kind!=='hit'&&e.kind!=='confirm')return;
    for(let i=0;i<this.seen.length;i++)if(this.seen[i]===e.id&&this.seenAt[i]===e.serverTime)return;
    const i=this.seenCursor++%this.seen.length;this.seen[i]=e.id;this.seenAt[i]=e.serverTime;
    const actor=fighters?.get(e.actorId),victim=e.targetId?fighters?.get(e.targetId):undefined;const seq=e.actionSeq??actor?.state.actionSeq??-1;
    if(e.kind==='confirm'){if(e.slot==='ultimate'&&!e.branch&&e.targetId)Object.assign(this.finales[this.finaleCursor++%this.finales.length],{actor:e.actorId,target:e.targetId,seq,finalHit:false});return;}
    if(!victim&&!e.endpoint)return;
    const last=e.slot==='ultimate'&&!e.branch&&e.contactIndex===2;const hit=this.impacts[this.impactCursor++%this.impacts.length];Object.assign(hit,{actor:e.actorId,born:e.serverTime,seed:e.id,grade:last?3:e.slot==='heavy'||e.slot==='special'?2:1,floor:victim?blowFloor(actor,victim,0):0});
    if(victim)bodyCentre(victim,hit.p);else hit.p.set(e.endpoint!.x,e.endpoint!.y,e.endpoint!.z);
    if(last){for(const f of this.finales)if(f.actor===e.actorId&&f.target===e.targetId&&f.seq===seq){f.finalHit=true;f.point.copy(hit.p);}if(involvesLocal(e.actorId,e.targetId))SIGNATURE.screen?.impactFrame?.(.40,hit.p);}
  }
  private staged(e:CombatEvent,fighters?:ReadonlyMap<string,Fighter>){
    const blow=this.book.take(e,fighters);if(!blow)return;
    const st=this.stage,{point,ground,dir,side,floor,t}=blow,tilt=e.id%2?1:-1;
    const moon=(size:number,width:number,life:number)=>this.cuts.add(point,this.axis.copy(side).multiplyScalar(.8).addScaledVector(UP,.6*tilt).normalize(),this.c.copy(dir).multiplyScalar(-size*.3),size,width,ICE,t,life);
    if(e.slot==='light'){st.burst(point,ICE,.36,t,{dir,floor,clean:true});moon(.8,.06,.22);return;}
    if(e.slot==='heavy'){
      const big=e.branch?.8:1;
      st.erupt(ground,UP,ICE,.42*big,6*big,t,.26);st.burst(point,ICE,.6*big,t,{dir,floor});st.shock(ground,ICE,2.8*big,t,.4);
      this.frost(ground,dir,t,.62,1.35*big,1.1*big,st.n(9,5));st.scar(ground,ICE,1.2*big,t+.05,1);
      return;
    }
    if(e.slot==='special'){
      if(e.branch==='airSpecial'){st.burst(point,ICE,2.1,t,{floor});st.shock(ground,ICE,3.6,t,.45);st.scar(ground,ICE,2.2,t+.05,1.8);this.frost(ground,dir,t,1.3,2.4,1.45,st.n(14,6));return;}
      const big=e.branch?.75:1;
      st.burst(point,ICE,1.8*big,t,{dir,floor});st.shatter(point,dir,ICE,2.7*big,t,.6);st.dome(point,ICE,2.8*big,t,.4);
      st.shock(ground,ICE,4.4*big,t,.45);st.scar(ground,ICE,2.3*big,t+.05,2.4);this.frost(ground,dir,t,1.5,1.7*big,1.45*big,st.n(13,6));
      return;
    }
    if(e.slot!=='ultimate'||e.branch)return;
    if(!blow.final){st.burst(point,ICE,blow.index?1.4:1.2,t,{dir,floor});moon(1.5,.11,.3);if(blow.index){st.shock(ground,ICE,4.2,t,.45);this.frost(ground,dir,t,1.2,1.3,1.4,st.n(10,5));}return;}
    st.erupt(ground,UP,ICE,1,13,t,.8);
    st.shatter(point,dir,ICE,5,t,.8);
    st.dome(point,ICE,4,t,.45);
    st.burst(point,ICE,2,t,{dir,floor});
    st.shock(ground,ICE,9,t,.6);
    st.scar(ground,ICE,3,t+.2,2.2);
    this.frost(ground,dir,t+.05,2.2,3,2.8,st.n(18,8));
  }
  private frost(at:THREE.Vector3,dir:THREE.Vector3,born:number,life:number,radius:number,height:number,count:number){const f=this.frosts[this.frostCursor++%this.frosts.length];f.at.copy(at);f.born=born;f.life=life;f.radius=radius;f.height=height;f.count=count;f.facing=Math.atan2(dir.z,dir.x);f.seed=Math.abs(at.x*11.3+at.z*7.7+born*3.1)%53;f.live=true;}
  private crystal(x:number,floor:number,z:number,height:number,width:number,lx:number,lz:number,color:THREE.Color,alpha:number){
    if(height<=.03)return;this.dir.set(lx,1,lz).normalize();this.q.setFromUnitVectors(UP,this.dir);this.p.set(x+this.dir.x*height*.5,floor+this.dir.y*height*.5,z+this.dir.z*height*.5);this.crystals.add(this.p,this.q,width,height,width,color,alpha);
  }
  private drawFrosts(time:number){
    for(const f of this.frosts){
      if(!f.live)continue;const age=time-f.born;if(age>=f.life){f.live=false;continue;}if(age<0)continue;
      const u=age/f.life,rise=Math.min(1,age/.1)*(u<.7?1:1-(u-.7)/.3);
      const big=f.height>1.5;
      for(let i=0;i<f.count;i++){const ang=f.facing+((i+.5)/f.count-.5)*4.2,h=hash(f.seed+i*2.3),r=f.radius*(.75+.3*hash(f.seed+i*5.1));this.crystal(f.at.x+Math.cos(ang)*r,f.at.y,f.at.z+Math.sin(ang)*r,f.height*(.5+.6*h)*rise,.1+.1*f.height*(.5+.5*h),Math.cos(ang)*.3,Math.sin(ang)*.3,i%3?big?ICE_WHITE:HOT_WHITE:big?ICE_BLUE:HOT_BLUE,.92);}
      this.stage.light(this.p.set(f.at.x,f.at.y+.5,f.at.z),f.radius*1.5+1.6,ICE,.36*rise);
    }
  }
  private cancel(id:string,targetToo=false){for(const f of this.finales)if(f.actor===id||targetToo&&f.target===id&&!f.finalHit)f.actor='';for(const h of this.impacts)if(h.actor===id)h.actor='';}
  update(time:number,fighters:ReadonlyMap<string,Fighter>,flights:ReadonlyMap<string,Flight>){
    if(this.disposed)return;for(const b of this.batches)b.begin();const detail=this.kit.budget>=.65,st=this.stage.open(time);
    for(const fighter of fighters.values()){
      const s=fighter.state;if(!isRukiaShirayuki(s.fighter)||!s.alive)continue;const age=s.actionTime*s.actionDuration;
      if(s.action==='awaken')this.awaken(fighter,age,detail);
      if(!manual(s.action)||s.whiffedAt!==undefined)continue;
      if(s.action==='ultimate'&&s.confirmedAt===undefined&&age>.6)continue;
      this.pose(fighter,age);
      if(rukiaBlade(fighter,this.a,this.b)){
        this.dir.subVectors(this.b,this.a);const length=this.dir.length();if(length>.02){this.dir.multiplyScalar(1/length);this.q.setFromUnitVectors(UP,this.dir);this.p.copy(this.a).lerp(this.b,.5);const alpha=Math.sin(clamp(s.actionTime)*Math.PI);this.streaks.add(this.p,this.q,.018,length,.018,WHITE,alpha*.7);
          for(let i=0;i<(detail?5:2);i++){const phase=(i/5+time*.8)%1;this.p.copy(this.a).lerp(this.b,phase);this.p.y+=Math.sin(phase*Math.PI)*.06;this.crystals.add(this.p,this.q,.018,.07,.018,BLUE,alpha*.65);}}
      }
    }
    for(const flight of flights.values()){
      if(!isRukiaShirayuki(flight.fighter)||flight.slot!=='special'||flight.branch||!flight.released||!flight.actorId)continue;
      let wave=this.waves.find(w=>w.live&&w.actor===flight.actorId&&time-w.seen<.2);
      if(!wave){wave=this.waves.find(w=>!w.live)??this.waves[0];wave.actor=flight.actorId;wave.live=true;wave.born=time;const thrower=fighters.get(flight.actorId);wave.floor=thrower?.group.position.y??flight.position.y-1.1;if(flight.origin)wave.origin.copy(flight.origin);else wave.origin.copy(flight.position).addScaledVector(flight.heading,-1);}
      wave.head.copy(flight.position);wave.seen=time;
    }
    for(const wave of this.waves){
      if(!wave.live)continue;const gone=time-wave.seen;
      if(gone>ICE_STANDS||gone<-.5){wave.live=false;continue;}
      const span=wave.origin.distanceTo(wave.head);if(span<.4)continue;
      this.dir.subVectors(wave.head,wave.origin);const reach=this.dir.length();
      if(gone<=WAVE_LINGER&&reach>3)st.beam(this.p.copy(wave.origin).addScaledVector(this.dir,2.2/reach),wave.head,.62,ICE,gone<=0?Math.min(.6,.1+(time-wave.born)*2):.8+.2*gone/WAVE_LINGER,wave.born*5,gone>0?1:.4);
      this.dir.setY(0);const flat=this.dir.length();if(flat<.5)continue;const dx=this.dir.x/flat,dz=this.dir.z/flat,stand=gone<=0?1:1-gone/ICE_STANDS;
      for(let i=0,n=Math.min(st.n(16,6),Math.floor(flat/.8));i<n;i++){const along=1.7+i*.8,sideways=(i%2?1:-1)*(.45+.35*hash(i*3.7+wave.born)),h=(.7+.9*hash(i*1.9+wave.born))*stand*Math.min(1,(flat-along)/1.2+.3);this.crystal(wave.origin.x+dx*along-dz*sideways,wave.floor,wave.origin.z+dz*along+dx*sideways,h,.11+.05*h,-dz*sideways*.4,dx*sideways*.4,i%3?HOT_WHITE:HOT_BLUE,.9);}
      if(flat>2.6){const half=Math.min(5,(flat-1.5)*.5);st.disc(this.p.set(wave.origin.x+dx*(1.5+half),wave.floor,wave.origin.z+dz*(1.5+half)),half,ICE.main,.5*stand,SHEEN,1);}
    }
    for(const flight of flights.values()){
      if(!isRukiaShirayuki(flight.fighter)||flight.slot!=='special'||flight.branch||!flight.released)continue;
      this.q.setFromUnitVectors(UP,flight.heading);
      this.p.copy(flight.position).addScaledVector(flight.heading,.18);
      this.streaks.add(this.p,this.q,.14,1.25,.14,WHITE,.42);
      this.streaks.add(this.p,this.q,.038,1.18,.038,BLUE,.78);
      for(let i=0;i<(detail?9:4);i++){
        const k=i/(detail?9:4),theta=i*2.39996;
        this.p.copy(flight.position).addScaledVector(flight.heading,.15-k*.7);
        this.p.x+=Math.cos(theta)*(.07+k*.11);this.p.y+=Math.sin(theta)*(.07+k*.11);
        this.crystals.add(this.p,this.q,.04,.20-k*.08,.04,i%2?WHITE:BLUE,.72-k*.3);
      }
    }
    for(const f of this.finales){
      if(!f.actor)continue;const actor=fighters.get(f.actor),victim=fighters.get(f.target),s=actor?.state;
      if(!actor||!s?.alive||!victim?.state.alive&&!f.finalHit||s.action!=='ultimate'||s.branch||(s.actionSeq??-1)!==f.seq||s.whiffedAt!==undefined){f.actor='';continue;}
      const age=s.actionTime*s.actionDuration;if(age>RUKIA_SNOW_BEATS.end){f.actor='';continue;}if(age<.8)continue;
      if(victim?.state.alive)bodyCentre(victim,f.point);this.p.copy(f.point);const floor=victim?.group.position.y??Math.max(0,f.point.y-.8);this.p.y=floor+.035;
      const rise=clamp((age-1.20)/.40),burst=clamp((age-RUKIA_SNOW_BEATS.finale)/.35),fade=1-burst;
      const rad=.6+rise*.48+burst*1.6;this.rings.add(this.p,this.flat,rad,rad,1,BLUE,fade*.85);this.rings.add(this.p,this.flat,rad*.84,rad*.84,1,WHITE,fade*.7);
      for(let i=0;i<(detail?12:6);i++){const theta=i*Math.PI*2/(detail?12:6),r=.65+burst*1.6;this.p.set(f.point.x+Math.sin(theta)*r,floor+(1.1+((i%3)*.22))*rise*.5,f.point.z+Math.cos(theta)*r);this.dir.set(Math.sin(theta)*(.15+burst),1,Math.cos(theta)*(.15+burst)).normalize();this.q.setFromUnitVectors(UP,this.dir);this.crystals.add(this.p,this.q,.17*fade,(1.1+i%3*.22)*rise,.17*fade,i%3?ICE_WHITE:ICE_BLUE,fade*.83);}
    }
    for(const h of this.impacts){if(!h.actor)continue;const age=time-h.born,life=h.grade===3?.5:.32;if(age>=life){h.actor='';continue;}if(age<0)continue;const fade=1-age/life,n=detail?h.grade*5:h.grade*2;
      for(let i=0;i<n;i++){const theta=i*2.39996+h.seed*.31;this.p.copy(h.p);this.p.x+=Math.sin(theta)*age*(h.grade+1);this.p.z+=Math.cos(theta)*age*(h.grade+1);this.p.y=Math.max(h.floor+.04,this.p.y+age*(i%3+.6)-age*age*3);this.q.setFromAxisAngle(UP,theta+age*4);this.crystals.add(this.p,this.q,.025*h.grade*fade,.14*h.grade*fade,.025*h.grade*fade,i%3?WHITE:BLUE,fade);}
    }
    this.book.each(fighters,RUKIA_SNOW_BEATS.end,this.gather);
    this.drawFrosts(time);this.cuts.draw(st,time);
    for(const b of this.batches)b.end();st.close();
  }
  private pose(f:Fighter,elapsed:number){
    const st=this.stage,s=f.state,seed=(s.actionSeq??0)*4.9,yaw=s.yaw??f.group.rotation.y,heading=this.heading.set(Math.sin(yaw),0,Math.cos(yaw)),feet=f.group.position;
    if(!rukiaBlade(f,this.a,this.b)){if(typeof f.strikePoint==='function')f.strikePoint(this.b);else this.b.copy(feet).addScaledVector(heading,.9).setY(feet.y+1.2);this.a.copy(this.b).addScaledVector(heading,-.8);}
    const tip=this.b,mid=this.m.copy(this.a).lerp(tip,.6);
    if(s.action==='light'){const k=Math.sin(clamp(s.actionTime)*Math.PI);this.lit(k,1);st.glow(tip,.26,ICE.main,.45*k);st.light(mid,1.9,ICE,.2*k);return;}
    if(s.action==='heavy'){
      const contact=s.branch?s.actionDuration*.5:HEAVY.contacts[0],ring=this.c.copy(feet).addScaledVector(heading,2.1);
      if(elapsed<contact){const k=clamp(elapsed/contact);this.lit(.6+.4*k,1.2);st.charge(mid,ICE,.22,k,seed);st.disc(ring,1.25,ICE.core,.5+.5*k,WAVE,.96);st.disc(ring,1.2,ICE.main,.6*k,SHEEN,1);st.light(this.p.copy(ring).setY(ring.y+.4),3,ICE,.3*k);}
      else if(elapsed<contact+.22){const k=1-(elapsed-contact)/.22;st.disc(ring,1.25,ICE.core,k,WAVE,.96);st.column(ring,UP,.3,2.4*k,ICE,k,seed);}
      return;
    }
    if(s.action==='special'){
      const release=s.branch?s.actionDuration*.5:SPECIAL.contacts[0];if(elapsed>=release)return;
      const k=clamp(elapsed/release);this.lit(.6+.4*k,1.2);st.glow(tip,.14+.2*k,ICE.main,.35+.3*k);st.glow(tip,.06+.07*k,ICE.core,.6+.4*k);
      if(!s.branch){
        this.side.set(heading.z,0,-heading.x);
        for(let i=0;i<4;i++){const on=clamp(k*4-i);if(on<=0)break;const ang=(i-1.5)*.5;this.p.copy(feet).addScaledVector(heading,1.5*Math.cos(ang)).addScaledVector(this.side,1.5*Math.sin(ang));st.glow(this.c.copy(this.p).setY(feet.y+.12),.22,ICE.core,.9*on);st.streak(this.c,this.axis.copy(this.c).setY(feet.y+.4+1.3*on*k),.05,ICE.main,on);}
        sheenAhead(st,feet,heading,2.4+1.8*k,ICE,.75*k);st.light(this.p.copy(feet).addScaledVector(heading,3.6).setY(feet.y+.4),2.4+.5*k,ICE,.45*k);
      }
      return;
    }
    if(s.action==='ultimate'&&!s.branch&&s.confirmedAt===undefined&&elapsed<ULT.contacts[0]+.12){const k=clamp(elapsed/ULT.contacts[0]);this.lit(.6+.4*k,1.2);st.charge(mid,ICE,.3,k,seed);}
  }
  private lit(k:number,wide:number){this.stage.streak(this.a,this.b,.06*wide,ICE.main,.5*k);this.stage.streak(this.a,this.b,.022*wide,ICE.core,1.1*k);}
  private readonly gather=(actor:Fighter,g:Gather,elapsed:number,victim:Fighter|undefined)=>{
    const B=RUKIA_SNOW_BEATS;if(elapsed>=B.finale+.12)return;
    const st=this.stage,time=st.time,build=clamp((elapsed-ULT.contacts[0])/(B.finale-ULT.contacts[0])),seed=g.seq*3.7,centre=this.c.copy((victim??actor).group.position).setY(g.floor);
    st.dim(.3+.4*build,g.actor,g.target);
    this.heading.subVectors(centre,actor.group.position).setY(0);if(this.heading.lengthSq()<.01)this.heading.set(Math.sin(actor.state.yaw??0),0,Math.cos(actor.state.yaw??0));this.heading.normalize();
    sheenAhead(st,actor.group.position,this.heading,2.4+2.2*build,ICE,.5+.3*build,g.floor);
    st.disc(centre,1.5+.3*build,ICE.core,.6+.4*build,WAVE,.96);
    st.light(this.p.copy(centre).setY(g.floor+.6),2.2+.6*build,ICE,.5+.3*build);
    for(let i=0,n=st.n(26,10);i<n;i++){const ang=i*2.39996+time*.5,r=(1.2+3*hash(i*1.3+seed))*(.6+.4*build),fall=((hash(i*2.7+seed)+time*.22)%1);this.p.set(centre.x+Math.cos(ang)*r,g.floor+3.2*(1-fall),centre.z+Math.sin(ang)*r);this.q.setFromAxisAngle(UP,ang+time*2);this.crystals.add(this.p,this.q,.035,.11,.035,i%3?HOT_WHITE:HOT_BLUE,.85*Math.sin(Math.PI*fall));}
    if(build>.8)st.speed(.5*(build-.8)/.2,g.actor,g.target);
  };
  private awaken(f:Fighter,age:number,detail:boolean){const p=f.group.position,release=RUKIA_SNOW_BEATS.awakening;this.p.copy(p);this.p.y+=.035;
    const before=age<release,phase=before?clamp(age/release):clamp((age-release)/.3),rad=before?1.35-phase*.75:.6+phase*1.9,fade=before?.7:1-phase;
    this.rings.add(this.p,this.flat,rad,rad,1,BLUE,fade);if(detail)this.rings.add(this.p,this.flat,rad*.82,rad*.82,1,WHITE,fade*.7);
    const n=detail?12:6;for(let i=0;i<n;i++){const theta=i*Math.PI*2/n+.15,r=before?.55:.55+phase*1.4;this.p.set(p.x+Math.sin(theta)*r,p.y+.06+(before?phase*.55:(1-phase)*.75),p.z+Math.cos(theta)*r);this.dir.set(Math.sin(theta)*.4,1,Math.cos(theta)*.4).normalize();this.q.setFromUnitVectors(UP,this.dir);this.crystals.add(this.p,this.q,.05,.25,.05,i%3?WHITE:BLUE,fade*.8);}
  }
  reset(){for(const f of this.finales)f.actor='';for(const h of this.impacts)h.actor='';this.seen.fill(-1);this.seenAt.fill(-1);this.seenCursor=this.impactCursor=this.finaleCursor=0;for(const b of this.batches){b.begin();b.end();}for(const w of this.waves)w.live=false;for(const f of this.frosts)f.live=false;this.frostCursor=0;this.book.reset();this.cuts.reset();this.stage.reset();}
  dispose(){if(this.disposed)return;this.reset();this.disposed=true;for(const b of this.batches)b.dispose();this.stage.release();}
}
