import * as THREE from 'three';
import type { CombatEvent } from '../../game/types';
import { DENJI_MOVES } from '../../game/fighters/denji';
import type { Fighter } from '../Fighter';
import { bodyCentre, type VfxKit } from '../vfx/VfxKit';
import { MARK } from '../vfx/GroundMarks';
import { armoryDraws } from '../vfx/armory/drawn';
import { SIGNATURE, involvesLocal } from './context';
import { STAR } from './GlowBatch';
import { MoveStage, stageLook } from './MoveStage';
import { blowFloor, floorUnder } from './blowFloor';

export const isDenjiChainsaw = (id: string | undefined) => id === 'denji';
export const DENJI_ENGINE_BEATS = Object.freeze({ grip: .18, pull: .468, ignition: .63 });
export const DENJI_ENGINE_LIMITS = Object.freeze({ teeth: 192, sparks: 192, impacts: 24 });
type Blade = 'left' | 'right' | 'head';
const BLADES:readonly Blade[]=['left','right','head'];
const MANUAL=new Set(['light','heavy','special','ultimate']);
const BLADE = {
  left: { joint: 'LeftHand_Chainsaw', root: [0,.014,-.018], tip: [.418,.014,-.018] },
  right: { joint: 'RightHand_Chainsaw', root: [0,.014,-.018], tip: [-.418,.014,-.018] },
  head: { joint: 'Head_Chainsaw', root: [0,0,.075], tip: [0,0,.448] },
} as const;
const sockets = new WeakMap<Fighter, Partial<Record<Blade, THREE.Object3D>>>();
export function denjiBladeFrame(f: Fighter, blade: Blade, root: THREE.Vector3, tip: THREE.Vector3): boolean {
  let cached = sockets.get(f);
  if (!cached) { cached = {}; for (const key of BLADES) cached[key] = f.model?.getObjectByName(BLADE[key].joint); sockets.set(f,cached); }
  const bone = cached[blade]; if (!bone) return false;
  root.fromArray(BLADE[blade].root).applyMatrix4(bone.matrixWorld);
  tip.fromArray(BLADE[blade].tip).applyMatrix4(bone.matrixWorld); return true;
}
const scratchRoot = new THREE.Vector3();
export function denjiSawContact(f: Fighter, index: number, out: THREE.Vector3, clip = ''): boolean {
  if (!isDenjiChainsaw(f.state.fighter)) return false;
  const blade: Blade = f.state.action === 'ultimate' && !f.state.branch && index >= 3 ? 'head' :
    (f.state.action === 'ultimate' && index === 1 || clip === 'Saw Backcut' || clip === 'Rush 1') ? 'left' : 'right';
  return denjiBladeFrame(f,blade,scratchRoot,out);
}
const UP = new THREE.Vector3(0,1,0), AMBER = new THREE.Color(0xffa847), STEEL = new THREE.Color(0xffefd0);
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const hash = (x: number) => { const v = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
const SPARK = stageLook(0xfff4d6, 0xffa847, 0xe5531a), RED = stageLook(0xffd9d2, 0xe0182c, 0x5c0a0a);
const HEAVY = DENJI_MOVES.heavy, SPECIAL = DENJI_MOVES.special, ULT = DENJI_MOVES.ultimate, TAU = Math.PI * 2;
const FUME_LIT = 0x8a8078, FUME_SHADE = 0x2c2624;
class SawBatch {
  readonly mesh: THREE.InstancedMesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private tint: THREE.InstancedBufferAttribute;
  private object = new THREE.Object3D(); count = 0;
  constructor(scene: THREE.Scene, name: string, capacity: number) {
    const geometry = new THREE.BoxGeometry(1,1,1);
    this.tint = new THREE.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('sawTint',this.tint);
    const material = new THREE.ShaderMaterial({ transparent:true, depthWrite:false, toneMapped:false,
      vertexShader:'attribute vec4 sawTint; varying vec4 vTint; void main(){vTint=sawTint;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',
      fragmentShader:'varying vec4 vTint; void main(){if(vTint.a<.004)discard;gl_FragColor=vTint;}' });
    this.mesh = new THREE.InstancedMesh(geometry,material,capacity); this.mesh.name=`denji-${name}`;
    this.mesh.frustumCulled=false; this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.object.scale.setScalar(0);this.object.updateMatrix();this.mesh.setMatrixAt(0,this.object.matrix);this.mesh.count=1;scene.add(this.mesh);
  }
  begin(){this.count=0;}
  add(p:THREE.Vector3,q:THREE.Quaternion,width:number,length:number,color:THREE.Color,alpha:number){
    if(this.count>=this.mesh.instanceMatrix.count||alpha<.004)return;
    this.object.position.copy(p);this.object.quaternion.copy(q);this.object.scale.set(width,length,width);this.object.updateMatrix();
    this.mesh.setMatrixAt(this.count,this.object.matrix);this.tint.setXYZW(this.count++,color.r,color.g,color.b,alpha);
  }
  end(){this.mesh.count=this.count;this.mesh.instanceMatrix.needsUpdate=true;this.tint.needsUpdate=true;}
  dispose(){this.mesh.removeFromParent();this.mesh.dispose();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
type Grind = { actor:string; born:number; seed:number; big:boolean; p:THREE.Vector3 };
type Cut = { p: THREE.Vector3; yaw: number; born: number; life: number; size: number; count: number; seed: number; spray: number; live: boolean };
type Engine = { actor: string; target: string; seq: number; final: boolean };
export class DenjiChainsaw {
  private stage?: MoveStage; private full?: VfxKit;
  private cuts: Cut[] = Array.from({ length: 10 }, () => ({ p: new THREE.Vector3(), yaw: 0, born: -1e9, life: 0, size: 0, count: 0, seed: 0, spray: 0, live: false }));
  private engines: Engine[] = Array.from({ length: 6 }, () => ({ actor: '', target: '', seq: -1, final: false }));
  private cutCursor = 0; private engineCursor = 0;
  private heading = new THREE.Vector3(); private ground = new THREE.Vector3(); private c = new THREE.Vector3(); private d = new THREE.Vector3(); private e = new THREE.Vector3(); private side = new THREE.Vector3();
  private teeth:SawBatch; private sparks:SawBatch; private disposed=false;
  private impacts:Grind[]=Array.from({length:DENJI_ENGINE_LIMITS.impacts},()=>({actor:'',born:-1e9,seed:0,big:false,p:new THREE.Vector3()}));
  private cursor=0;private seen=new Float64Array(128).fill(-1);private seenAt=new Float64Array(128).fill(-1);private seenCursor=0;
  private a=new THREE.Vector3();private b=new THREE.Vector3();private p=new THREE.Vector3();private direction=new THREE.Vector3();private q=new THREE.Quaternion();
  constructor(private scene:THREE.Scene,private kit:Pick<VfxKit,'budget'>&Partial<VfxKit>){this.teeth=new SawBatch(scene,'chain-edges',DENJI_ENGINE_LIMITS.teeth);this.sparks=new SawBatch(scene,'metal-grind',DENJI_ENGINE_LIMITS.sparks);
    this.full=kit.sparks&&kit.dust&&kit.marks&&kit.debris?kit as VfxKit:undefined;}
  load(ids:readonly string[]){
    const wanted=!this.disposed&&ids.some(isDenjiChainsaw);
    if(wanted&&!this.stage)this.stage=MoveStage.for(this.scene,this.kit);
    else if(!wanted&&this.stage){this.stage.release();this.stage=undefined;}
    return Promise.resolve();
  }
  handle(event:CombatEvent,fighters?:ReadonlyMap<string,Fighter>){
    if(this.disposed)return;
    if(event.kind==='eliminated'||event.kind==='respawn'){for(const hit of this.impacts)if(hit.actor===event.actorId)hit.actor='';for(const en of this.engines)if(en.actor===event.actorId||en.target===event.actorId&&!en.final)en.actor='';return;}
    if(!isDenjiChainsaw(event.fighter))return;
    if(event.kind==='whiff'||event.kind==='rejected'){for(const en of this.engines)if(en.actor===event.actorId)en.actor='';return;}
    if(event.kind==='confirm'){
      const seq=event.actionSeq??fighters?.get(event.actorId)?.state.actionSeq??-1;
      if(event.slot==='ultimate'&&!event.branch&&event.targetId&&!armoryDraws(event.fighter,event.slot,event.branch,event.actorId)&&!this.engines.some(en=>en.actor===event.actorId&&en.seq===seq))
        Object.assign(this.engines[this.engineCursor++%this.engines.length],{actor:event.actorId,target:event.targetId,seq,final:false});
      return;
    }
    if(event.kind!=='hit')return;
    for(let i=0;i<this.seen.length;i++)if(this.seen[i]===event.id&&this.seenAt[i]===event.serverTime)return;
    const seen=this.seenCursor++%this.seen.length;this.seen[seen]=event.id;this.seenAt[seen]=event.serverTime;
    const actor=fighters?.get(event.actorId);if(!actor)return;
    const target=event.targetId?fighters?.get(event.targetId):undefined;
    if(this.stage&&!armoryDraws(event.fighter,event.slot,event.branch,event.actorId))this.land(this.stage,event,actor,target);
    const impact=this.impacts[this.cursor++%this.impacts.length];
    if(!denjiSawContact(actor,event.contactIndex??0,impact.p))return;
    impact.actor=event.actorId;impact.born=event.serverTime;impact.seed=event.id;
    impact.big=event.slot==='ultimate'&&!event.branch&&(event.contactIndex??0)===3;
    if(impact.big&&involvesLocal(event.actorId,event.targetId))SIGNATURE.screen?.impactFrame?.(.5,impact.p);
  }
  private land(st: MoveStage, e: CombatEvent, actor: Fighter, target: Fighter | undefined) {
    if (!target && !e.endpoint) return;
    const kit = this.full, t = e.serverTime, point = this.c, dir = this.heading, yaw = actor.state.yaw ?? actor.group.rotation.y;
    if (target) bodyCentre(target, point); else point.set(e.endpoint!.x, e.endpoint!.y, e.endpoint!.z);
    const floor = blowFloor(actor, target, point.y - 1.05), ground = this.ground.set(point.x, floor, point.z);
    dir.subVectors(point, actor.group.position).setY(0); if (dir.lengthSq() < .01) dir.set(Math.sin(yaw), 0, Math.cos(yaw)); dir.normalize();
    if (e.slot === 'light') { this.cut(point, yaw, t, .18, .65, 1, e.id, 1); st.burst(point, SPARK, .34, t, { dir, floor, clean: true }); return; }
    if (e.slot === 'heavy') {
      const big = e.branch ? .85 : 1;
      this.cut(point, yaw, t, .3, 2.3 * big, 2, e.id, 5);
      st.burst(point, SPARK, .82 * big, t, { dir, floor, clean: true });
      return;
    }
    if (e.slot === 'special') {
      if (e.branch === 'airSpecial') { st.burst(point, SPARK, 2, t, { floor }); st.shock(ground, SPARK, 4.6, t, .45); this.cut(point, yaw, t, .4, 2.2, 3, e.id, 6); return; }
      const big = e.branch ? .7 : 1;
      this.cut(this.d.copy(point).addScaledVector(dir, .4), yaw, t, .46, 2.9 * big, 3, e.id, 9);
      st.burst(this.d.copy(point).addScaledVector(dir, .8), SPARK, 1.7 * big, t, { dir, floor });
      st.erupt(this.d.copy(point).addScaledVector(dir, .6), this.e.copy(dir).setY(.22).normalize(), SPARK, .3 * big, 4.6 * big, t, .34);
      st.shock(ground, SPARK, 5.6 * big, t, .48);
      st.scar(this.d.copy(ground).addScaledVector(dir, 1.6), SPARK, 1.7 * big, t + .05, 1.9);
      if (kit && kit.quality !== 'low') for (let i = 0; i < 3; i++) kit.marks.mark(MARK.crack, ground.x - dir.x * (.6 + i * 1.5), floor, ground.z - dir.z * (.6 + i * 1.5), 0, 1, 0, 1.7 - i * .3, t, 2.6);
      this.fumes(this.d.copy(ground).addScaledVector(dir, 1.8), .8 * big, 4, t + .05, e.id, dir);
      return;
    }
    if (e.slot !== 'ultimate' || e.branch) return;
    const index = e.contactIndex ?? 0;
    if (index < 3) {
      this.cut(point, yaw + index * 1.1, t, .34, 2.2 + .25 * index, 2, e.id + index, 5);
      st.burst(point, SPARK, .85 + .1 * index, t, { dir, floor, clean: true });
      if (index) st.shock(ground, SPARK, 3.6 + index, t, .4);
      return;
    }
    for (const en of this.engines) if (en.actor === e.actorId && en.target === e.targetId) en.final = true;
    this.cut(point, yaw, t, .7, 5, 5, e.id, 14);
    st.burst(point, SPARK, 2.4, t, { dir, floor });
    st.erupt(ground, UP, SPARK, .9, 8, t + .05, .6);
    st.shock(ground, SPARK, 9.5, t, .6);
    st.scar(ground, SPARK, 2.8, t + .15, 2.1);
    if (kit) for (let i = 0; i < 4; i++) {
      const ang = i * 1.571 + yaw + .6, r = 2.2 + hash(i + e.id);
      if (kit.quality !== 'low') kit.marks.mark(MARK.crack, ground.x + Math.cos(ang) * r, floor, ground.z + Math.sin(ang) * r, 0, 1, 0, 2.4, t + .05, 3);
      kit.debris.burst(kit.n(5, 2), ground.x + Math.cos(ang) * r, floor, ground.z + Math.sin(ang) * r, 0, 1, 0, 7.5, .8, .13, floor, 2);
    }
    this.fumes(ground, 1.4, 7, t + .1, e.id);
  }
  private cut(p: THREE.Vector3, yaw: number, born: number, life: number, size: number, count: number, seed: number, spray: number) {
    const cut = this.cuts[this.cutCursor++ % this.cuts.length];
    cut.p.copy(p); cut.yaw = yaw; cut.born = born; cut.life = life; cut.size = size; cut.count = count; cut.seed = seed; cut.spray = spray; cut.live = true;
  }
  private fumes(ground: THREE.Vector3, size: number, count: number, born: number, seed: number, away?: THREE.Vector3) {
    const kit = this.full; if (!kit) return;
    const base = away ? Math.atan2(away.z, away.x) : 0;
    for (let i = 0, n = kit.n(count, 2); i < n; i++) {
      const ang = away ? base + (hash(i * 2.3 + seed) - .5) * 2 : i * 2.399963 + seed, r = size * (away ? .6 + hash(i + seed) : 1.2 + .8 * hash(i + seed)), v = 1 + 1.4 * hash(i * 3.3 + seed);
      kit.smoke(ground.x + Math.cos(ang) * r, ground.y + size * (.4 + .4 * hash(i * 1.9 + seed)), ground.z + Math.sin(ang) * r, Math.cos(ang) * v, .7 + .9 * hash(i * 5.1 + seed), Math.sin(ang) * v, size * (.8 + .5 * hash(i * 7.7 + seed)), born + .04 * i, .9 + .4 * hash(i + 2.2), FUME_LIT, FUME_SHADE);
    }
  }
  private sawline(st: MoveStage, a: THREE.Vector3, b: THREE.Vector3, width: number, fade: number, time: number) {
    st.streak(a, b, width * 2.6, SPARK.main, .55 * fade); st.streak(a, b, width, SPARK.core, 1.3 * fade);
    this.side.subVectors(b, a); const span = this.side.length(); if (span < .2) return;
    this.side.multiplyScalar(1 / span);
    for (let i = 0, n = Math.min(14, Math.floor(span / .34)); i < n; i++) {
      const u = ((i + time * 9) % n) / n;
      this.d.copy(a).addScaledVector(this.side, span * u); this.e.copy(this.d).addScaledVector(this.side, -.12); this.e.y += .16 * (i % 2 ? 1 : -1);
      st.streak(this.d, this.e, width * 1.2, SPARK.core, fade);
    }
  }
  update(time:number,fighters:ReadonlyMap<string,Fighter>){
    if(this.disposed)return;this.teeth.begin();this.sparks.begin();const detail=this.kit.budget>=.65;
    if(!this.stage)for(const f of fighters.values())if(isDenjiChainsaw(f.state.fighter)){this.stage=MoveStage.for(this.scene,this.kit);break;}
    const st=this.stage?.open(time);
    for(const fighter of fighters.values()){
      const s=fighter.state;if(!isDenjiChainsaw(s.fighter)||!s.alive)continue;
      const age=s.actionTime*s.actionDuration, manual=MANUAL.has(s.action);
      const allowed=manual&&s.whiffedAt===undefined&&(s.action!=='ultimate'||s.confirmedAt!==undefined||age<.6);
      const ignition=s.action==='awaken'&&age>=DENJI_ENGINE_BEATS.ignition?Math.max(0,1-(age-DENJI_ENGINE_BEATS.ignition)/.22):0;
      const restingHeat=s.awakened&&(s.action!=='awaken'||age>=DENJI_ENGINE_BEATS.ignition)?.3:0;
      const heat=Math.max(ignition,allowed?.8:restingHeat);if(heat<=0)continue;
      if(st&&allowed&&!armoryDraws('denji',s.action,s.branch,s.id))this.windup(st,fighter,age,time);
      for(const blade of BLADES){
        if(!denjiBladeFrame(fighter,blade,this.a,this.b))continue;
        this.direction.subVectors(this.b,this.a);const length=this.direction.length();if(length<1e-6)continue;
        this.direction.multiplyScalar(1/length);this.q.setFromUnitVectors(UP,this.direction);
        const count=detail?8:4;
        for(let i=0;i<count;i++){
          const phase=(i/count+time*(allowed?4:1.7))%1;
          this.p.copy(this.a).lerp(this.b,phase);
          this.teeth.add(this.p,this.q,.012+ignition*.007,length/(count*2.8),i%2?STEEL:AMBER,heat*(.55+.4*phase));
        }
        if(ignition>.01)this.grind(this.b,Math.max(0,age-DENJI_ENGINE_BEATS.ignition),ignition,11,detail?10:5,.24);
      }
    }
    for(const impact of this.impacts){if(!impact.actor)continue;const age=time-impact.born;if(age<0)continue;if(age>.36){impact.actor='';continue;}
      this.grind(impact.p,age,1-age/.36,impact.seed,detail?(impact.big?20:12):6,impact.big?.55:.32);
    }
    if(st){
      for(const en of this.engines){
        if(!en.actor)continue;
        const actor=fighters.get(en.actor),victim=fighters.get(en.target),s=actor?.state;
        if(!actor||!s?.alive||!victim?.state.alive&&!en.final||s.action!=='ultimate'||s.branch||(s.actionSeq??-1)!==en.seq||s.whiffedAt!==undefined){en.actor='';continue;}
        const elapsed=s.actionTime*s.actionDuration;
        if(!en.final&&victim&&elapsed<ULT.contacts[3])this.engine(st,actor,victim,en,elapsed,time);
      }
      for(const cut of this.cuts){
        if(!cut.live)continue;const age=time-cut.born;if(age>=cut.life){cut.live=false;continue;}if(age<0)continue;
        const w=age/cut.life,fade=w<.45?1:1-(w-.45)/.55;
        for(let i=0;i<cut.count;i++){
          const since=age-i*.03;if(since<0)continue;
          const open=Math.min(1,since/.05),roll=cut.seed*2.1+i*Math.PI/cut.count+(i%2?.5:-.3),yaw=cut.yaw+((i%3)-1)*.6,reach=cut.size*(.4+.6*open);
          this.side.set(Math.cos(yaw)*Math.cos(roll),Math.sin(roll),-Math.sin(yaw)*Math.cos(roll));
          this.a.copy(cut.p).addScaledVector(this.side,-reach);this.b.copy(cut.p).addScaledVector(this.side,reach);
          this.sawline(st,this.a,this.b,.03+cut.size*.012,fade,time);
        }
        for(let i=0,n=st.n(cut.spray,2);i<n;i++){
          const sd=cut.seed+i*5.3,phi=hash(sd)*TAU,up=.2+.9*hash(sd+1.7),far=cut.size*(.5+.9*hash(sd+2.9))*Math.min(1,age/.12);
          this.a.set(cut.p.x+Math.cos(phi)*far*.55,cut.p.y+up*far*.6-age*age*3,cut.p.z+Math.sin(phi)*far*.55);
          this.b.set(cut.p.x+Math.cos(phi)*far,cut.p.y+up*far-age*age*5,cut.p.z+Math.sin(phi)*far);
          st.streak(this.a,this.b,.03,i%3===0?RED.main:SPARK.main,1.2*fade);
        }
        st.light(cut.p,1.8+cut.size,SPARK,.3*fade*(1-w));
      }
    }
    this.teeth.end();this.sparks.end();st?.close();
  }
  private blade(f:Fighter,which:Blade,root:THREE.Vector3,tip:THREE.Vector3){
    if(denjiBladeFrame(f,which,root,tip))return true;
    const hand=which==='left'?f.handL:f.handR;if(!hand)return false;
    root.copy(hand);tip.copy(hand);tip.y+=.42;return true;
  }
  private shower(st:MoveStage,root:THREE.Vector3,tip:THREE.Vector3,amount:number,time:number,seed:number){
    for(let i=0,n=st.n(Math.round(3+amount*4),2);i<n;i++){
      const sd=seed+i*3.7+Math.floor(time*30)*1.3,u=hash(sd),phi=hash(sd+1.1)*TAU,len=.25+.6*hash(sd+2.3)*amount;
      this.d.copy(root).lerp(tip,u);this.e.set(this.d.x+Math.cos(phi)*len,this.d.y+.1+len*.8*hash(sd+3.1),this.d.z+Math.sin(phi)*len);
      st.streak(this.d,this.e,.018,SPARK.main,.9*amount);
    }
    st.glow(tip,.16+.1*amount,SPARK.core,.5*amount,STAR,.2,Math.floor(time*24)+seed);
    st.light(tip,1.6+amount,SPARK,.2*amount);
  }
  private windup(st:MoveStage,f:Fighter,age:number,time:number){
    const s=f.state,yaw=s.yaw??f.group.rotation.y,heading=this.heading.set(Math.sin(yaw),0,Math.cos(yaw)),feet=f.group.position;
    if(s.action==='light'){if(this.blade(f,'right',this.a,this.b))this.shower(st,this.a,this.b,Math.sin(clamp(s.actionTime)*Math.PI),time,1);return;}
    if(s.action==='heavy'){
      const contact=s.branch?s.actionDuration*.55:HEAVY.contacts[0];
      if(age<contact){const k=clamp(age/contact);for(const which of ['left','right'] as const)if(this.blade(f,which,this.a,this.b))this.shower(st,this.a,this.b,.4+.6*k,time,which==='left'?3:7);}
      else if(age<contact+.2){
        const flare=1-(age-contact)/.2;this.c.copy(feet).addScaledVector(heading,1.5);this.c.y+=1.15;
        for(let i=0;i<2;i++){const roll=i?-.8:.8;this.side.set(Math.cos(yaw)*Math.cos(roll),Math.sin(roll),-Math.sin(yaw)*Math.cos(roll));this.a.copy(this.c).addScaledVector(this.side,-1.3);this.b.copy(this.c).addScaledVector(this.side,1.3);this.sawline(st,this.a,this.b,.04,flare,time);}
        st.light(this.c,2.6,SPARK,.3*flare);
      }
      return;
    }
    if(s.action==='special'&&!s.branch){
      const contact=SPECIAL.contacts[0];if(age>=contact+.1)return;
      const k=clamp(age/contact);
      for(const which of ['left','right'] as const)if(this.blade(f,which,this.a,this.b))this.shower(st,this.a,this.b,.5+.5*k,time,which==='left'?3:7);
      if(this.blade(f,'right',this.a,this.b)){
        const reach=1+3.6*k,links=st.n(12,6);this.c.copy(this.b);
        for(let i=0;i<links;i++){
          const u0=i/links,u1=(i+.6)/links,sag=(1-k)*.5;
          this.d.copy(this.c).addScaledVector(heading,reach*u0);this.d.y-=Math.sin(u0*Math.PI)*sag;this.e.copy(this.c).addScaledVector(heading,reach*u1);this.e.y-=Math.sin(u1*Math.PI)*sag;
          st.streak(this.d,this.e,.04,SPARK.main,.9);
        }
        this.d.copy(this.c).addScaledVector(heading,reach);st.glow(this.d,.22,SPARK.core,.8,STAR,.2,Math.floor(time*24));st.light(this.d,2.2,SPARK,.25);
      }
      st.speed(.45*k,s.id);
      if(st.tick&&Math.floor(time*30)%3===0&&this.full)this.full.smoke(feet.x-heading.x*.7,feet.y+1,feet.z-heading.z*.7,-heading.x*1.4,.8,-heading.z*1.4,.42,time,.55,FUME_LIT,FUME_SHADE);
      return;
    }
    if(s.action==='ultimate'&&!s.branch&&s.confirmedAt===undefined&&age<ULT.contacts[0]+.1&&this.blade(f,'right',this.a,this.b))this.shower(st,this.a,this.b,clamp(age/ULT.contacts[0]),time,5);
  }
  private engine(st:MoveStage,actor:Fighter,victim:Fighter,en:Engine,elapsed:number,time:number){
    const g=clamp((elapsed-ULT.contacts[0])/(ULT.contacts[3]-ULT.contacts[0])),centre=bodyCentre(victim,this.ground),floor=floorUnder(victim.group.position.x,victim.group.position.y,victim.group.position.z),radius=3.1-.7*g,turn=time*(7+5*g)+en.seq;
    st.dim(.3+.4*g,en.actor,en.target);
    for(const which of BLADES)if(this.blade(actor,which,this.a,this.b))this.shower(st,this.a,this.b,.6+.4*g,time,which==='head'?11:which==='left'?3:7);
    const links=st.n(12,6);
    for(let arc=0;arc<2;arc++){
      const head=turn+arc*Math.PI,wave=.5*(1-.4*g);
      for(let i=0;i<=links;i++){
        const a0=head-i*.17,a1=a0-.1;
        this.c.set(centre.x+Math.cos(a0)*radius,floor+1.05+wave*Math.sin(a0*2+arc*1.7),centre.z+Math.sin(a0)*radius);
        this.d.set(centre.x+Math.cos(a1)*radius,floor+1.05+wave*Math.sin(a1*2+arc*1.7),centre.z+Math.sin(a1)*radius);
        st.streak(this.c,this.d,.045*(1-i/(links*1.6)),SPARK.main,1.05*(1-i/(links*1.25)));
      }
      this.c.set(centre.x+Math.cos(head)*radius,floor+1.05+wave*Math.sin(head*2+arc*1.7),centre.z+Math.sin(head)*radius);
      st.glow(this.c,.3,SPARK.core,.9,STAR,.2,Math.floor(time*30)+arc);st.light(this.c,2.6,SPARK,.3);
    }
    st.light(this.c.copy(actor.group.position).setY(actor.group.position.y+.8),3.4+g,SPARK,.24+.2*g);
    if(st.tick&&Math.floor(time*30)%3===0&&this.full){const ang=hash(time*5.3+en.seq)*TAU,p=actor.group.position;this.full.smoke(p.x+Math.cos(ang)*2.4,p.y+.4,p.z+Math.sin(ang)*2.4,Math.cos(ang)*1.6,.9,Math.sin(ang)*1.6,.5+.2*g,time,.6,FUME_LIT,FUME_SHADE);}
    if(g>.7)st.speed(.5*(g-.7)/.3,en.actor,en.target);
  }
  private grind(origin:THREE.Vector3,age:number,alpha:number,seed:number,count:number,reach:number){
    for(let i=0;i<count;i++){const angle=i*2.39996+seed*.17;this.direction.set(Math.cos(angle),.25+(i%4)*.22,Math.sin(angle)).normalize();
      this.p.copy(origin).addScaledVector(this.direction,age*reach*5);this.p.y-=age*age*1.5;
      this.q.setFromUnitVectors(UP,this.direction);this.sparks.add(this.p,this.q,.009,.035+.075*alpha,i%3?AMBER:STEEL,alpha);}
  }
  reset(){for(const impact of this.impacts)impact.actor='';for(const cut of this.cuts)cut.live=false;for(const en of this.engines)en.actor='';this.seen.fill(-1);this.seenAt.fill(-1);this.teeth.begin();this.teeth.end();this.sparks.begin();this.sparks.end();this.stage?.reset();}
  dispose(){if(this.disposed)return;this.reset();this.disposed=true;this.teeth.dispose();this.sparks.dispose();this.stage?.release();this.stage=undefined;}
}
