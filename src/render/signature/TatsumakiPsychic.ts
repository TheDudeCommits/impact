import * as THREE from 'three';
import type { CombatEvent } from '../../game/types';
import type { Fighter } from '../Fighter';
import type { Flight } from '../CombatEffects';
import { bodyCentre, type VfxKit } from '../vfx/VfxKit';
import { SIGNATURE, involvesLocal } from './context';
import { TATSUMAKI_MOVES } from '../../game/fighters/tatsumaki';
import { MoveStage, SHEEN, stageLook } from './MoveStage';
import { blowFloor } from './blowFloor';
import { CastBook, Rifts, arc, flare, hash, sheenAhead, type Gather } from './StageCraft';

export const isTatsumakiPsychic = (id: string | undefined) => id === 'tatsumaki';
export const TATSUMAKI_PSYCHIC_ASSETS: readonly string[] = Object.freeze([]);
export const TATSUMAKI_PSYCHIC_LIMITS = Object.freeze({ threads: 384, needles: 96, rings: 48, impacts: 20, confirms: 8 });
export const TATSUMAKI_PSYCHIC_BEATS = Object.freeze({ release: .61, command: 1.2, final: 3.14 });
const GROUNDED_CLIPS = new Set(['Hit 01','shake','stun','Die fall','down_end','slammed','blownback_end','Landing']);
const AURA_ACTIONS = new Set(['light','heavy','special','ultimate','guard']);
const BRANCH_CLIPS = Object.freeze({lh:'Vector Reversal',llh:'Psychic Uplift',lllh:'Pressure Collapse',llls:'Spiral Compression',airHeavy:'Aerial Repulse',airSpecial:'Meteor Descent'});
export function tatsumakiStrikeSocket(action:string,elapsed:number,clip?:string,contactIndex?:number):'LeftHand'|'RightHand'|'Both'{
 if(clip==='Terrible Tornado'||action==='ultimate'&&!clip)return(contactIndex??(elapsed>2.8?2:elapsed>1.2?1:0))===2?'Both':'RightHand';
 if(clip==='Gravity Crush'||clip==='Rush 2'||clip==='Vector Reversal'||clip==='Pressure Collapse'||clip==='Meteor Descent'||action==='heavy'&&!clip)return'LeftHand';
 return'RightHand';
}
export function tatsumakiAuthoredHover(clip?:string){return !!clip&&!GROUNDED_CLIPS.has(clip);}
export function tatsumakiStrikePoint(fighter:Fighter,out:THREE.Vector3,clip?:string,sourceTime?:number,contactIndex?:number){
 const s=fighter.state;
 if(!clip&&s.branch)clip=BRANCH_CLIPS[s.branch];
 if(!clip&&s.action==='light'&&s.chain)clip=`Rush ${s.chain}`;
 const joint=tatsumakiStrikeSocket(s.action,sourceTime??s.actionTime*s.actionDuration,clip,contactIndex);
 return joint==='Both'?out.copy(fighter.handL).lerp(fighter.handR,.5):out.copy(joint==='LeftHand'?fighter.handL:fighter.handR);
}
const UP = new THREE.Vector3(0, 1, 0), FRONT = new THREE.Vector3(0, 0, 1), TAU = Math.PI * 2;
const GREEN = new THREE.Color(0x5dffac), ROCK = new THREE.Color(0x6c847a), WHITE = new THREE.Color(0xeaffef);
const clamp = (v: number) => Math.min(1, Math.max(0, v));
const PSY = stageLook(0xeaffef, 0x5dffac, 0x1d6b48);
const METEOR = stageLook(0xeaffef, 0x5dffac, 0x1d6b48, { sphere: { body: new THREE.Color(.2, .26, .23), core: new THREE.Color(.9, 2.4, 1.4), rimA: new THREE.Color(.3, 2.3, 1), rimB: new THREE.Color(.8, 2.6, 1.5), spin: .6 } });
const LIT_ROCK = new THREE.Color(.62, .78, .7), GREEN_ROCK = new THREE.Color(.5, 1.5, .9);
const DOWN = new THREE.Vector3(0, -1, 0);
const HEAVY = TATSUMAKI_MOVES.heavy, SPECIAL = TATSUMAKI_MOVES.special, ULT = TATSUMAKI_MOVES.ultimate;
const BURST = { flash: .2, life: .34, ring: [.35, 1.5], glide: 4.5 } as const;
const METEOR_FALL = .42, METEOR_HEIGHT = 13;
type Lift = { at: THREE.Vector3; born: number; life: number; radius: number; height: number; count: number; seed: number; facing: number; live: boolean };
class PsychicBatch {
  readonly mesh: THREE.InstancedMesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private tint: THREE.InstancedBufferAttribute; private object = new THREE.Object3D(); private count = 0;
  constructor(scene: THREE.Scene, name: string, geometry: THREE.BufferGeometry, private capacity: number) {
    this.tint = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage); geometry.setAttribute('psychicTint', this.tint);
    const material = new THREE.ShaderMaterial({ name: `Tatsumaki-${name}`, transparent: true, depthWrite: false, forceSinglePass: true, side: THREE.DoubleSide, toneMapped: false,
      vertexShader: 'attribute vec4 psychicTint;varying vec4 vTint;varying vec3 vNormal;void main(){vTint=psychicTint;mat3 m=mat3(instanceMatrix);vec3 n=normal/vec3(dot(m[0],m[0]),dot(m[1],m[1]),dot(m[2],m[2]));vNormal=normalize(normalMatrix*m*n);gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',
      fragmentShader: 'varying vec4 vTint;varying vec3 vNormal;void main(){if(vTint.a<.005)discard;float band=mix(.62,1.,step(-.12,dot(normalize(vNormal),normalize(vec3(.4,.8,.3)))));gl_FragColor=vec4(vTint.rgb*band,vTint.a);}' });
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity); this.mesh.name = `tatsumaki-psychic-${name}`; this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.count = 0; scene.add(this.mesh);
  }
  begin() { this.count = 0; }
  add(p: THREE.Vector3, q: THREE.Quaternion, x: number, y: number, z: number, color: THREE.Color, alpha: number) {
    if (this.count >= this.capacity || alpha <= .005 || Math.min(x, y, z) <= 0) return;
    this.object.position.copy(p); this.object.quaternion.copy(q); this.object.scale.set(x, y, z); this.object.updateMatrix();
    this.mesh.setMatrixAt(this.count, this.object.matrix); this.tint.setXYZW(this.count++, color.r, color.g, color.b, clamp(alpha));
  }
  end() { this.mesh.count = this.count; this.mesh.instanceMatrix.needsUpdate = true; this.tint.needsUpdate = true; }
  dispose() { this.mesh.removeFromParent(); this.mesh.dispose(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
type Confirm = { actor: string; target: string; seq: number; floor: number; final: boolean; endpoint: THREE.Vector3 };
type Impact = { actor: string; born: number; seed: number; grade: number; point: THREE.Vector3 };
export class TatsumakiPsychic {
  private readonly stage: MoveStage; private readonly book = new CastBook('tatsumaki', ULT.contacts.length);
  private lifts: Lift[] = Array.from({ length: 6 }, () => ({ at: new THREE.Vector3(), born: 0, life: 0, radius: 1, height: 1, count: 0, seed: 0, facing: 0, live: false })); private liftCursor = 0;
  private readonly rifts = new Rifts(8, PSY); private fan = new THREE.Vector3();
  private u = new THREE.Vector3(); private v = new THREE.Vector3(); private m = new THREE.Vector3(); private heading = new THREE.Vector3();
  private threads: PsychicBatch; private needles: PsychicBatch; private rings: PsychicBatch; private batches: PsychicBatch[];
  private confirms: Confirm[] = Array.from({ length: TATSUMAKI_PSYCHIC_LIMITS.confirms }, () => ({ actor: '', target: '', seq: -1, floor: 0, final: false, endpoint: new THREE.Vector3() }));
  private impacts: Impact[] = Array.from({ length: TATSUMAKI_PSYCHIC_LIMITS.impacts }, () => ({ actor: '', born: -1e9, seed: 0, grade: 0, point: new THREE.Vector3() }));
  private bursts = Array.from({ length: 6 }, () => ({ actor: '', key: Number.NaN, born: 0, live: false, at: new THREE.Vector3() })); private burstCursor = 0;
  private seen = new Float64Array(128).fill(-1); private seenTime = new Float64Array(128).fill(-1);
  private cursor = 0; private impactCursor = 0; private confirmCursor = 0; private disposed = false;
  private p = new THREE.Vector3(); private a = new THREE.Vector3(); private b = new THREE.Vector3(); private c = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private forward = new THREE.Vector3(); private side = new THREE.Vector3(); private target = new THREE.Vector3();
  private q = new THREE.Quaternion(); private face = new THREE.Quaternion();
  private flat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  constructor(scene: THREE.Scene, private kit: Pick<VfxKit, 'budget'> & Partial<VfxKit>) {
    this.stage = MoveStage.for(scene, kit);
    this.threads = new PsychicBatch(scene, 'pressure' , new THREE.CylinderGeometry(1, 1, 1, 5, 1), TATSUMAKI_PSYCHIC_LIMITS.threads);
    this.needles = new PsychicBatch(scene, 'debris', new THREE.IcosahedronGeometry(1, 0), TATSUMAKI_PSYCHIC_LIMITS.needles);
    this.rings = new PsychicBatch(scene, 'rings', new THREE.RingGeometry(.965, 1, 40, 1), TATSUMAKI_PSYCHIC_LIMITS.rings);
    this.batches = [this.threads, this.needles, this.rings];
  }
  load(_ids: readonly string[]) { return Promise.resolve(); }
  private cancel(id: string, victim = false) { for (const c of this.confirms) if (c.actor === id || victim && c.target === id && !c.final) c.actor = ''; }
  handle(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    if (this.disposed) return;
    this.staged(event, fighters);
    if (event.kind === 'eliminated' || event.kind === 'respawn') { this.cancel(event.actorId, true); return; }
    if (!isTatsumakiPsychic(event.fighter)) return;
    if (event.kind === 'whiff' || event.kind === 'rejected') { this.cancel(event.actorId); return; }
    if (event.kind !== 'hit' && event.kind !== 'confirm') return;
    for (let i = 0; i < this.seen.length; i++) if (this.seen[i] === event.id && this.seenTime[i] === event.serverTime) return;
    const index = this.cursor++ % this.seen.length; this.seen[index] = event.id; this.seenTime[index] = event.serverTime;
    const actor = fighters?.get(event.actorId), victim = event.targetId ? fighters?.get(event.targetId) : undefined, seq = event.actionSeq ?? actor?.state.actionSeq ?? -1;
    if (event.kind === 'confirm') {
      if (event.slot === 'ultimate' && !event.branch && event.targetId) Object.assign(this.confirms[this.confirmCursor++ % this.confirms.length], {
        actor: event.actorId, target: event.targetId, seq, final: false, floor: blowFloor(actor, victim, 0) });
      return;
    }
    if (!victim && !event.endpoint) return;
    const final = event.slot === 'ultimate' && !event.branch && event.contactIndex === 2;
    const hit = this.impacts[this.impactCursor++ % this.impacts.length];
    Object.assign(hit, { actor: event.actorId, born: event.serverTime, seed: event.id, grade: final ? 3 : event.slot === 'heavy' || event.slot === 'special' ? 2 : 1 });
    if (event.endpoint) hit.point.set(event.endpoint.x, event.endpoint.y, event.endpoint.z); else if (victim) bodyCentre(victim, hit.point);
    if (final) {
      for (const c of this.confirms) if (c.actor === event.actorId && c.seq === seq) { c.final = true; c.endpoint.copy(hit.point); }
      if (involvesLocal(event.actorId, event.targetId)) SIGNATURE.screen?.impactFrame?.(.48, hit.point);
    }
  }
  private staged(e: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    const blow = this.book.take(e, fighters); if (!blow) return;
    const st = this.stage, { point, ground, dir, floor, t } = blow, cracked = this.m.copy(ground).setY(floor + .06);
    if (e.slot === 'light') { st.burst(point, PSY, .4, t, { dir, floor, clean: true }); return; }
    if (e.slot === 'heavy') {
      const big = e.branch ? .85 : 1;
      st.burst(point, PSY, .7 * big, t, { dir, floor }); this.crack(ground, dir, 3, 2.6 * big, t, .6); st.shock(this.fan.copy(ground).addScaledVector(dir, 1.4), PSY, 2.6 * big, t, .4);
      this.lift(ground, dir, t + .05, .5, 1.5 * big, 1.5 * big, st.n(7, 4));
      return;
    }
    if (e.slot === 'special') {
      if (e.branch === 'airSpecial') { st.burst(point, PSY, 2.1, t, { floor }); st.shatter(cracked, UP, PSY, 3.4, t, .8); st.shock(ground, PSY, 3.6, t, .45); st.scar(ground, PSY, 2.2, t + .05, 1.8); this.lift(ground, dir, t + .05, 1.2, 2.2, 2, st.n(12, 6)); return; }
      const big = e.branch ? .75 : 1;
      st.burst(point, PSY, 1.9 * big, t, { dir, floor }); st.dome(point, PSY, 3 * big, t, .42); st.shatter(cracked, UP, PSY, 3 * big, t, .7);
      st.shock(ground, PSY, 4.5 * big, t, .45); st.scar(ground, PSY, 2 * big, t + .05, 2); this.lift(ground, dir, t + .05, 1.3, 2 * big, 2.2 * big, st.n(12, 6));
      return;
    }
    if (e.slot !== 'ultimate' || e.branch) return;
    if (!blow.final) { st.burst(point, PSY, blow.index ? 1.3 : 1.1, t, { dir, floor }); if (blow.index) { st.shock(this.fan.copy(ground).addScaledVector(dir, 1.6), PSY, 3.4, t, .5); this.crack(ground, dir, 5, 3.4, t, 1.1); this.lift(ground, dir, t + .05, 1.2, 2, 2, st.n(10, 5)); } return; }
    st.erupt(ground, UP, PSY, .85, 12, t, .55);
    st.dome(point, PSY, 4.2, t, .45);
    st.burst(point, PSY, 2, t, { dir, floor });
    this.crack(ground, dir, 7, 7, t + .04, 2);
    st.shock(this.fan.copy(ground).addScaledVector(dir, 2), PSY, 7, t, .6);
    st.scar(this.fan.copy(ground).addScaledVector(dir, 1.6), PSY, 2.8, t + .2, 2.2);
    this.lift(ground, dir, t + .05, 1.8, 3.2, 3.4, st.n(18, 8));
  }
  private lift(at: THREE.Vector3, dir: THREE.Vector3, born: number, life: number, radius: number, height: number, count: number) { const l = this.lifts[this.liftCursor++ % this.lifts.length]; l.at.copy(at); l.born = born; l.life = life; l.radius = radius; l.height = height; l.count = count; l.facing = Math.atan2(dir.z, dir.x); l.seed = Math.abs(at.x * 7.3 + at.z * 13.1 + born * 2.9) % 47; l.live = true; }
  private crack(at: THREE.Vector3, dir: THREE.Vector3, count: number, length: number, born: number, life: number) {
    const base = Math.atan2(dir.z, dir.x);
    for (let i = 0; i < count; i++) { const ang = base + (count > 1 ? (i / (count - 1) - .5) * 2.2 : 0); this.rifts.add(at, this.fan.set(Math.cos(ang), 0, Math.sin(ang)), length * (1 - .25 * Math.abs(i / Math.max(1, count - 1) - .5) * 2), PSY, born + i * .02, life, 1, .09, i === (count >> 1)); }
  }
  private rock(at: THREE.Vector3, size: number, spin: number, alpha: number, thread: number) {
    this.q.setFromAxisAngle(UP, spin); this.needles.add(at, this.q, size, size * .8, size * 1.25, LIT_ROCK, alpha);
    if (thread > .05) { this.b.copy(at); this.b.y -= Math.min(.28, thread); this.stage.streak(at, this.b, size * .16, PSY.main, .6 * alpha); }
    this.stage.glow(at, size * 1.9, PSY.main, .22 * alpha);
  }
  private segment(a: THREE.Vector3, b: THREE.Vector3, width: number, color: THREE.Color, alpha: number) {
    this.direction.subVectors(b, a); const length = this.direction.length(); if (length < .001) return;
    this.q.setFromUnitVectors(UP, this.direction.multiplyScalar(1 / length)); this.p.copy(a).lerp(b, .5);
    this.threads.add(this.p, this.q, width, length, width, color, alpha);
  }
  update(time:number,fighters:ReadonlyMap<string,Fighter>,flights:ReadonlyMap<string,Flight>){
    if(this.disposed)return;for(const batch of this.batches)batch.begin();const detail=this.kit.budget>=.65,st=this.stage.open(time);
    for(const f of fighters.values()){
      const s=f.state;if(!isTatsumakiPsychic(s.fighter)||!s.alive)continue;
      const elapsed=s.actionTime*s.actionDuration;this.forward.set(Math.sin(s.yaw),0,Math.cos(s.yaw));this.side.set(this.forward.z,0,-this.forward.x);this.face.setFromUnitVectors(FRONT,this.forward);
      if(s.action==='awaken'){
        const bloom=clamp((elapsed-.16)/.43),fade=clamp(elapsed/.14)*clamp((.9-elapsed)/.12),count=detail?12:7;
        for(let i=0;i<count;i++){
          const angle=i*TAU/count+time*2.4,radius=.48+bloom*1.0;
          this.p.copy(f.group.position);this.p.x+=Math.cos(angle)*radius;this.p.z+=Math.sin(angle)*radius;this.p.y+=.12+bloom*(.2+i%3*.22);
          this.q.setFromAxisAngle(UP,time*1.8+i);this.needles.add(this.p,this.q,.10+i%2*.045,.09,.16,ROCK,fade);
          this.a.copy(this.p);this.b.copy(this.p).addScaledVector(UP,.16+bloom*.28);this.segment(this.a,this.b,.012,GREEN,fade*.75);
        }
        for(let i=0;i<3;i++){this.p.copy(f.group.position);this.p.y+=.08+i*.48*bloom;const r=.3+bloom*(1.25-i*.21);this.rings.add(this.p,this.flat,r,r,1,i===1?WHITE:GREEN,fade*(.74-i*.1));}
        continue;
      }
      if(s.action==='dash'||s.action==='run'){this.flight(f,time,elapsed);continue;}
      if(!AURA_ACTIONS.has(s.action)||s.whiffedAt!==undefined)continue;
      if(s.action==='ultimate'&&elapsed>.56&&s.confirmedAt===undefined)continue;
      const power=s.action==='guard'?.55:Math.sin(clamp(s.actionTime)*Math.PI);
      if(s.action==='guard'){
        this.p.copy(f.handL).lerp(f.handR,.5).addScaledVector(this.forward,.13);this.rings.add(this.p,this.face,.48,.61,1,GREEN,.33);
        continue;
      }
      f.strikePoint(this.c);
      this.pose(f,time,elapsed);
      if(s.action!=='ultimate'||elapsed<1.9){
        for(let i=0;i<2;i++){this.p.copy(this.c).addScaledVector(this.forward,i*.035);const r=.10+power*.17+i*.035;this.rings.add(this.p,this.face,r,r,1,i?GREEN:WHITE,power*.92);}
        if(s.action==='light'){
          this.a.copy(this.c);this.b.copy(this.a).addScaledVector(this.forward,.22+power*.66);this.segment(this.a,this.b,.014,WHITE,power);
        }
        if(s.action==='special'&&!s.branch&&elapsed<.66){
          const gather=clamp(elapsed/.61),n=detail?7:4;
          for(let i=0;i<n;i++){const ang=i*TAU/n+time*3;this.p.copy(this.c).addScaledVector(this.side,Math.cos(ang)*(.55-.35*gather));this.p.y+=Math.sin(ang)*(.55-.35*gather);this.p.addScaledVector(this.forward,-.28*(1-gather));this.q.setFromAxisAngle(UP,i+time);this.needles.add(this.p,this.q,.08,.10,.13,i%2?ROCK:GREEN,power);}
        }
      }
    }
    for(const flight of flights.values()){
      if(!isTatsumakiPsychic(flight.fighter)||flight.slot!=='special'||flight.branch||!flight.released)continue;
      this.forward.copy(flight.heading).normalize();this.side.crossVectors(this.forward,UP).normalize();this.face.setFromUnitVectors(FRONT,this.forward);
      const n=detail?8:5;
      for(let i=0;i<n;i++){
        const angle=i*2.39996+time*7,radius=.09+(i%3)*.07;
        this.p.copy(flight.position).addScaledVector(this.forward,-i*.17).addScaledVector(this.side,Math.cos(angle)*radius);this.p.y+=Math.sin(angle)*radius;
        this.q.setFromAxisAngle(this.forward,angle);this.needles.add(this.p,this.q,.12+i%2*.04,.10+i%3*.02,.25,ROCK,1);
        this.a.copy(this.p);this.b.copy(this.a).addScaledVector(this.forward,-.45-i*.025);this.segment(this.a,this.b,.017,i%3?GREEN:WHITE,.9);
      }
      this.rings.add(flight.position,this.face,.31,.31,1,GREEN,.84);
      this.rock(flight.position,.42,time*5,1,0);st.orb(flight.position,this.forward,.75,PSY,(flight.since??0)*2.7);
    }
    for(const confirm of this.confirms){
      if(!confirm.actor)continue;const f=fighters.get(confirm.actor),victim=fighters.get(confirm.target),s=f?.state;
      if(!f||!s?.alive||!victim?.state.alive&&!confirm.final||s.action!=='ultimate'||s.branch||(s.actionSeq??-1)!==confirm.seq||s.whiffedAt!==undefined){confirm.actor='';continue;}
      const elapsed=s.actionTime*s.actionDuration;if(elapsed<1.2)continue;if(elapsed>3.91){confirm.actor='';continue;}
      if(confirm.final)this.target.copy(confirm.endpoint);else if(victim)bodyCentre(victim,this.target);else continue;
      const grown=clamp((elapsed-1.2)/.85),collapse=clamp((elapsed-2.89)/.25),fade=clamp((3.92-elapsed)/.48),radius=(.55+grown*1.25)*(1-collapse*.87),height=.9+grown*2.1;
      const n=detail?28:16;
      for(let i=0;i<n;i++){
        const u=i/(n-1),angle=u*TAU*3.1+time*8;
        this.a.set(this.target.x+Math.cos(angle)*radius*(.7+u*.3),confirm.floor+.1+u*height,this.target.z+Math.sin(angle)*radius*(.7+u*.3));
        const next=angle+.27;this.b.set(this.target.x+Math.cos(next)*radius*(.7+u*.3),this.a.y+.05,this.target.z+Math.sin(next)*radius*(.7+u*.3));
        this.segment(this.a,this.b,.016+(1-u)*.011,i%3?GREEN:WHITE,fade*.87);
        if(i%2===0){this.q.setFromAxisAngle(UP,angle*1.3);this.needles.add(this.a,this.q,.11+i%3*.035,.08,.18,ROCK,fade);}
      }
      if(confirm.final){this.p.set(this.target.x,confirm.floor+.035,this.target.z);const r=.35+Math.max(0,elapsed-3.14)*4.3;this.rings.add(this.p,this.flat,r,r,1,GREEN,fade*.8);}
    }
    for(const hit of this.impacts){
      if(!hit.actor)continue;const age=time-hit.born,life=hit.grade===3?.46:.24;if(age>=life){hit.actor='';continue;}if(age<0)continue;
      const fade=1-age/life,n=detail?hit.grade*6:hit.grade*3;
      for(let i=0;i<n;i++){const angle=i*2.39996+hit.seed;this.a.copy(hit.point);this.b.copy(hit.point);this.b.x+=Math.sin(angle)*(.14+age*5.2);this.b.y+=Math.cos(angle)*(.14+age*5.2);this.b.z+=Math.sin(angle*1.7)*.32;this.segment(this.a,this.b,.016*fade,i%3?GREEN:WHITE,fade);}
    }
    this.book.each(fighters,ULT.duration,this.gather);
    for(const l of this.lifts){
      if(!l.live)continue;const age=time-l.born;if(age>=l.life){l.live=false;continue;}if(age<0)continue;
      const u=age/l.life,up=u<.75?1-(1-Math.min(1,age/.22))**2:1-((u-.75)/.25)**2,fade=u<.85?1:1-(u-.85)/.15;
      for(let i=0;i<l.count;i++){const ang=l.facing+((i+.5)/l.count-.5)*4.2,r=l.radius*(.35+.65*hash(l.seed+i*1.7)),h=l.height*(.25+.75*hash(l.seed+i*2.9))*up;this.a.set(l.at.x+Math.cos(ang)*r,l.at.y+.1+h,l.at.z+Math.sin(ang)*r);this.rock(this.a,.1+.16*hash(l.seed+i*4.3),time*2+i,fade,Math.min(.6,h));}
      st.light(this.a.set(l.at.x,l.at.y+.6,l.at.z),l.radius*1.5+1.6,PSY,.36*fade*up);
    }
    for(const b of this.bursts){
      if(!b.live)continue;const age=time-b.born;if(age>=BURST.life){b.live=false;continue;}if(age<0)continue;
      const k=1-age/BURST.life,r=BURST.ring[0]+(BURST.ring[1]-BURST.ring[0])*(1-k*k);this.rings.add(b.at,this.flat,r,r,1,k>.6?WHITE:GREEN,.8*k);
      if(k>.5)this.rings.add(b.at,this.flat,r*.62,r*.62,1,GREEN,.6*k);
    }
    this.rifts.draw(st,time);
    for(const batch of this.batches)batch.end();st.close();
  }
  private flight(f:Fighter,time:number,elapsed:number){
    const st=this.stage,s=f.state,feet=f.group.position,v=(f as {velocity?:THREE.Vector3}).velocity,speed=v?Math.hypot(v.x,v.z):0;
    if(speed>.5)this.heading.set(v!.x/speed,0,v!.z/speed);else this.heading.copy(this.forward);
    if(s.action==='run'){if(speed>BURST.glide){const k=clamp((speed-BURST.glide)/3);this.p.copy(feet);this.p.y+=.1;st.glow(this.p,.28,PSY.main,.11*k);}return;}
    const id=s.id??'',key=s.actionStarted??0;let b=this.bursts.find(x=>x.actor===id);
    if(!b){b=this.bursts[this.burstCursor++%this.bursts.length];b.actor=id;b.key=Number.NaN;}
    if(b.key!==key){b.key=key;b.born=time;b.live=true;b.at.copy(feet);b.at.y+=.04;}
    const k=1-clamp(elapsed/BURST.flash);if(k<=0)return;
    this.p.copy(feet);this.p.y+=.15;st.glow(this.p,.4+.25*(1-k),PSY.main,.26*k);st.glow(this.p,.13,PSY.core,.45*k);st.light(this.p,2.4,PSY,.4*k);
    bodyCentre(f,this.c);st.glow(this.c,.62,PSY.main,.12*k);
  }
  private held(at:THREE.Vector3,size:number,k:number){const st=this.stage;st.glow(at,size*(.6+.9*k),PSY.main,.35+.3*k);st.glow(at,size*(.25+.35*k),PSY.core,.6+.4*k);}
  private pose(f:Fighter,time:number,elapsed:number){
    const st=this.stage,s=f.state,seed=(s.actionSeq??0)*4.1,at=this.c,feet=f.group.position,heading=this.heading.copy(this.forward);
    if(s.action==='light'){const k=Math.sin(clamp(s.actionTime)*Math.PI);st.glow(at,.26,PSY.main,.5*k);st.glow(at,.1,PSY.core,.8*k);this.a.copy(at).addScaledVector(heading,.3+.7*k);st.streak(at,this.a,.04,PSY.main,.9*k);st.light(at,1.9,PSY,.2*k);return;}
    if(s.action==='heavy'||s.action==='ultimate'&&!s.branch&&s.confirmedAt===undefined&&elapsed<ULT.contacts[0]+.12){
      const contact=s.action==='ultimate'?ULT.contacts[0]:s.branch?s.actionDuration*.5:HEAVY.contacts[0],reach=this.m.copy(feet).addScaledVector(heading,2.1);reach.y=feet.y+1.1;
      if(elapsed<contact){const k=clamp(elapsed/contact);this.held(at,.2,k);if(s.action==='heavy')st.bubble(reach,1.15-.45*k,PSY,.35+.5*k);}
      else if(s.action==='heavy'&&elapsed<contact+.16){const k=1-(elapsed-contact)/.16;this.a.copy(reach);this.a.y=feet.y+3.6;st.column(this.a,DOWN,.26,3.4,PSY,k,seed);}
      return;
    }
    if(s.action==='special'){
      const release=s.branch?s.actionDuration*.5:SPECIAL.contacts[0];if(elapsed>=release)return;
      const k=clamp(elapsed/release);this.held(at,.28,k);
      if(!s.branch){
        const facing=Math.atan2(heading.z,heading.x);
        for(let i=0,n=st.n(8,4);i<n;i++){const ang=facing+((i+.5)/n-.5)*3.6+Math.sin(time*.8+i)*.12,r=1.5+1*hash(i*1.7+seed),h=(.3+1.5*hash(i*2.9+seed))*k;this.a.set(feet.x+Math.cos(ang)*r,feet.y+.15+h,feet.z+Math.sin(ang)*r);this.rock(this.a,.11+.13*hash(i*4.3+seed),time*2+i,Math.min(1,k*3),Math.min(.6,h));}
        sheenAhead(st,feet,heading,2+1.6*k,PSY,.55*k);st.light(this.a.copy(feet).addScaledVector(heading,3.6).setY(feet.y+.5),2.4+.5*k,PSY,.4*k);
      }
    }
  }
  private readonly gather=(actor:Fighter,g:Gather,elapsed:number,victim:Fighter|undefined)=>{
    const final=ULT.contacts[ULT.contacts.length-1];if(elapsed>=final+.1)return;
    const st=this.stage,time=st.time,opener=ULT.contacts[0],build=clamp((elapsed-opener)/(final-opener)),rise=clamp((elapsed-opener)/.4),seed=g.seq*3.7,feet=this.a.copy(actor.group.position).setY(g.floor);
    st.dim(.3+.45*build,g.actor,g.target);
    flare(st,feet,1.9+.3*build,(1.4+2.2*build)*rise,PSY,.45+.45*build,seed,6,.06,.14,false);
    const centre=this.m.copy((victim??actor).group.position).setY(g.floor);
    this.heading.subVectors(centre,feet).setY(0);if(this.heading.lengthSq()<.01)this.heading.set(Math.sin(actor.state.yaw??0),0,Math.cos(actor.state.yaw??0));this.heading.normalize();
    sheenAhead(st,feet,this.heading,2.4+2.2*build,PSY,.45+.35*build,g.floor);st.light(this.b.copy(centre).setY(g.floor+1),2.1+.5*build,PSY,.5+.3*build);
    const facing=Math.atan2(centre.z-feet.z,centre.x-feet.x);
    for(let i=0,n=st.n(16,8);i<n;i++){const ang=facing+((i+.5)/n-.5)*4.4+Math.sin(time*.25+i)*.1,r=2.4+2.6*hash(i*1.7+seed),h=(.4+2.6*hash(i*2.9+seed))*build*rise;this.p.set(centre.x+Math.cos(ang)*r,g.floor+.15+h,centre.z+Math.sin(ang)*r);this.rock(this.p,.12+.2*hash(i*4.3+seed),time*1.5+i,Math.min(1,build*4),Math.min(.7,h));}
    if(elapsed>1.1&&elapsed<final){
      const grown=clamp((elapsed-1.1)/.7);this.u.set(1,0,0);this.v.set(0,0,1);
      for(let i=0,n=st.n(7,4);i<n;i++){const from=time*10+i*1.2,r=(1.1+.9*i/n)*(1.15-.35*build);this.p.set(centre.x,g.floor+.3+4*(i+.5)/n*grown,centre.z);arc(st,this.p,this.u,this.v,r,from,from+3.9,.1,PSY.main,.8*grown);if(i%2===0)arc(st,this.p,this.u,this.v,r,from+.4,from+3.5,.036,PSY.core,1.4*grown);}
    }
    if(elapsed>final-METEOR_FALL){
      const fall=clamp((elapsed-(final-METEOR_FALL))/METEOR_FALL),target=victim?bodyCentre(victim,this.b):this.b.copy(centre).setY(g.floor+1);
      this.p.copy(target);this.p.y+=METEOR_HEIGHT*(1-fall*fall);
      st.ball(this.p,1.15,METEOR,seed);st.glow(this.p,2.6,PSY.main,.6);
      this.b.copy(this.p);this.b.y+=2.4+2*fall;st.streak(this.p,this.b,.5,PSY.main,.9);st.streak(this.p,this.b,.18,PSY.core,1.4);
      st.light(this.p,7,PSY,.7);
    }
    if(build>.8)st.speed(.5*(build-.8)/.2,g.actor,g.target);
  };
  reset() { for (const c of this.confirms) c.actor = ''; for (const hit of this.impacts) hit.actor = ''; this.seen.fill(-1); this.seenTime.fill(-1); this.cursor = this.impactCursor = this.confirmCursor = 0; for (const batch of this.batches) { batch.begin(); batch.end(); } for (const l of this.lifts) l.live = false; for (const b of this.bursts) { b.live = false; b.actor = ''; } this.rifts.reset(); this.book.reset(); this.stage.reset(); }
  dispose() { if (this.disposed) return; this.reset(); this.disposed = true; for (const batch of this.batches) batch.dispose(); this.stage.release(); }
}
