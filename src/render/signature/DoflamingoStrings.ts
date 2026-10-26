import * as THREE from 'three';
import type { CombatEvent } from '../../game/types';
import type { Fighter } from '../Fighter';
import type { Flight } from '../CombatEffects';
import { bodyCentre, type VfxKit } from '../vfx/VfxKit';
import { SIGNATURE, involvesLocal } from './context';
import { FIRE } from './FlameSprites';
import { STAR } from './GlowBatch';
import { MoveStage, stageLook, type StageLook } from './MoveStage';
import { blowFloor } from './blowFloor';

export const isDoflamingoStrings = (id: string | undefined) => id === 'doflamingo';
export const DOFLAMINGO_STRINGS_ASSETS: readonly string[] = Object.freeze([]);
export const DOFLAMINGO_STRINGS_LIMITS = Object.freeze({ threads: 384, needles: 64, rings: 48, impacts: 20, confirms: 8, rakes: 12, whips: 4 });
export const DOFLAMINGO_STRINGS_BEATS = Object.freeze({ overheat: .63, command: 2.10, final: 3.18 });
export function doflamingoStrikeSocket(action: string, elapsed: number, clip?: string, contactIndex?: number): 'LeftHand' | 'RightHand' | 'LeftToeBase' | 'Both' {
  if (clip === 'God Thread' || action === 'ultimate' && !clip) return (contactIndex ?? (elapsed > 2.85 ? 2 : 0)) === 2 ? 'Both' : 'RightHand';
  if (clip === 'Athlete Thread' || clip === 'Sky String Heel' || action === 'heavy' && !clip) return 'LeftToeBase';
  if (clip === 'Rush 2' || clip === 'Puppet Reversal') return 'LeftHand';
  if (clip === 'Parasite Snare' || clip === 'White Breaker') return 'Both';
  return 'RightHand';
}
export function doflamingoAuthoredKick(clip?: string) { return clip === 'Athlete Thread' || clip === 'Sky String Heel'; }
export function doflamingoStrikePoint(fighter: Fighter, out: THREE.Vector3, clip?: string, sourceTime?: number, contactIndex?: number): THREE.Vector3 {
  const s = fighter.state;
  if (!clip && s.branch) clip = ({ lh: 'Puppet Reversal', llh: 'String Guillotine', lllh: 'Tamaito Burst', llls: 'Parasite Snare', airHeavy: 'Sky String Heel', airSpecial: 'White Breaker' } as const)[s.branch];
  if (!clip && s.action === 'light' && s.chain) clip = `Rush ${s.chain}`;
  const socket = doflamingoStrikeSocket(s.action, sourceTime ?? s.actionTime * s.actionDuration, clip, contactIndex);
  if (socket === 'LeftToeBase') {
    const foot = fighter.bones.get('lefttoebase') ?? fighter.bones.get('leftfoot');
    if (foot) return foot.getWorldPosition(out);
  }
  if (socket === 'Both') return out.copy(fighter.handL).lerp(fighter.handR, .5);
  return out.copy(socket === 'LeftHand' ? fighter.handL : fighter.handR);
}
const UP = new THREE.Vector3(0, 1, 0), FRONT = new THREE.Vector3(0, 0, 1), TAU = Math.PI * 2;
const INK = new THREE.Color(0x301425), ROSE = new THREE.Color(0xf074ad), HOT = new THREE.Color(0xf64d47), WHITE = new THREE.Color(0xfffaf1);
const clamp = (v: number) => Math.min(1, Math.max(0, v));
const B = DOFLAMINGO_STRINGS_BEATS;
export const STRING: StageLook = stageLook(0xfffaf1, 0xf074ad, 0x301425);
export const OVERHEAT: StageLook = stageLook(0xfff3d6, 0xf6593f, 0x5a100c, { flame: FIRE });
const WHITE_HOT = new THREE.Color(1.75, 1.64, 1.56), ROSE_HOT = new THREE.Color(1.9, .7, 1.25);
const WHIP_LINGER = .28;
class StringBatch {
  readonly mesh: THREE.InstancedMesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private tint: THREE.InstancedBufferAttribute; private object = new THREE.Object3D(); private count = 0;
  constructor(scene: THREE.Scene, name: string, geometry: THREE.BufferGeometry, private capacity: number) {
    this.tint = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage); geometry.setAttribute('stringTint', this.tint);
    const material = new THREE.ShaderMaterial({ name: `Doflamingo-${name}`, transparent: true, depthWrite: false, forceSinglePass: true, side: THREE.DoubleSide, toneMapped: false,
      vertexShader: 'attribute vec4 stringTint;varying vec4 vTint;varying vec3 vNormal;void main(){vTint=stringTint;mat3 m=mat3(instanceMatrix);vec3 n=normal/vec3(dot(m[0],m[0]),dot(m[1],m[1]),dot(m[2],m[2]));vNormal=normalize(normalMatrix*m*n);gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',
      fragmentShader: 'varying vec4 vTint;varying vec3 vNormal;void main(){if(vTint.a<.005)discard;float band=mix(.62,1.,step(-.12,dot(normalize(vNormal),normalize(vec3(.4,.8,.3)))));gl_FragColor=vec4(vTint.rgb*band,vTint.a);}' });
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity); this.mesh.name = `doflamingo-strings-${name}`; this.mesh.frustumCulled = false;
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
type Rake = { live: boolean; born: number; life: number; at: THREE.Vector3; dir: THREE.Vector3; size: number; tilt: number };
type Whip = { live: boolean; actor: string; origin: THREE.Vector3; head: THREE.Vector3; heading: THREE.Vector3; seen: number; floor: number };
export class DoflamingoStrings {
  private readonly stage: MoveStage;
  private threads: StringBatch; private needles: StringBatch; private rings: StringBatch; private batches: StringBatch[];
  private rakes: Rake[] = Array.from({ length: DOFLAMINGO_STRINGS_LIMITS.rakes }, () => ({ live: false, born: 0, life: 0, at: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, 1), size: 1, tilt: 0 }));
  private whips: Whip[] = Array.from({ length: DOFLAMINGO_STRINGS_LIMITS.whips }, () => ({ live: false, actor: '', origin: new THREE.Vector3(), head: new THREE.Vector3(), heading: new THREE.Vector3(0, 0, 1), seen: -1e9, floor: 0 }));
  private rakeCursor = 0; private ground = new THREE.Vector3(); private blow = new THREE.Vector3();
  private confirms: Confirm[] = Array.from({ length: DOFLAMINGO_STRINGS_LIMITS.confirms }, () => ({ actor: '', target: '', seq: -1, floor: 0, final: false, endpoint: new THREE.Vector3() }));
  private impacts: Impact[] = Array.from({ length: DOFLAMINGO_STRINGS_LIMITS.impacts }, () => ({ actor: '', born: -1e9, seed: 0, grade: 0, point: new THREE.Vector3() }));
  private seen = new Float64Array(128).fill(-1); private seenTime = new Float64Array(128).fill(-1);
  private flightStarts = Array.from({ length: 32 }, () => ({ flight: null as Flight | null, origin: new THREE.Vector3() }));
  private flightStartCursor = 0;
  private cursor = 0; private impactCursor = 0; private confirmCursor = 0; private disposed = false;
  private p = new THREE.Vector3(); private a = new THREE.Vector3(); private b = new THREE.Vector3(); private c = new THREE.Vector3();
  private start = new THREE.Vector3(); private end = new THREE.Vector3(); private direction = new THREE.Vector3(); private centre = new THREE.Vector3();
  private forward = new THREE.Vector3(); private side = new THREE.Vector3(); private target = new THREE.Vector3();
  private q = new THREE.Quaternion(); private face = new THREE.Quaternion();
  private flat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  constructor(scene: THREE.Scene, private kit: Pick<VfxKit, 'budget'> & Partial<VfxKit>) {
    this.stage = MoveStage.for(scene, kit);
    this.threads = new StringBatch(scene, 'filaments', new THREE.CylinderGeometry(1, 1, 1, 5, 1), DOFLAMINGO_STRINGS_LIMITS.threads);
    this.needles = new StringBatch(scene, 'holy-bullets', new THREE.CylinderGeometry(0, 1, 1, 5, 1).toNonIndexed(), DOFLAMINGO_STRINGS_LIMITS.needles);
    this.rings = new StringBatch(scene, 'webs', new THREE.RingGeometry(.965, 1, 40, 1), DOFLAMINGO_STRINGS_LIMITS.rings);
    this.batches = [this.threads, this.needles, this.rings];
  }
  load(_ids: readonly string[]) { return Promise.resolve(); }
  private cancel(id: string, victim = false) { for (const c of this.confirms) if (c.actor === id || victim && c.target === id && !c.final) c.actor = ''; }
  handle(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    if (this.disposed) return;
    if (event.kind === 'eliminated' || event.kind === 'respawn') { this.cancel(event.actorId, true); return; }
    if (!isDoflamingoStrings(event.fighter)) return;
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
    let confirmed = false;
    if (final) {
      for (const c of this.confirms) if (c.actor === event.actorId && c.seq === seq) { c.final = true; c.endpoint.copy(hit.point); confirmed = true; }
      if (involvesLocal(event.actorId, event.targetId)) SIGNATURE.screen?.impactFrame?.(.48, hit.point);
    }
    const st = this.stage, t = event.serverTime, point = hit.point, floor = blowFloor(actor, victim, point.y - 1), dir = this.blow;
    if (actor) { dir.subVectors(point, actor.group.position).setY(0); if (dir.lengthSq() < .01) dir.set(Math.sin(actor.state.yaw ?? 0), 0, Math.cos(actor.state.yaw ?? 0)); dir.normalize(); } else dir.set(0, 0, 1);
    const ground = this.ground.set(point.x, floor, point.z), lean = seq % 2 ? .7 : -.7;
    if (event.slot === 'light') { st.burst(point, STRING, .4, t, { dir, floor, clean: true }); this.rake(point, dir, 1.2, lean, t, .18); return; }
    if (event.slot === 'heavy') {
      const k = event.branch ? .8 : 1;
      st.burst(point, STRING, .85 * k, t, { dir, floor }); this.rake(point, dir, 3.2 * k, lean, t, .28); st.shock(ground, STRING, 4.2 * k, t, .4);
      return;
    }
    if (event.slot === 'special') {
      if (event.branch === 'airSpecial') { st.burst(point, STRING, 2, t, { floor }); st.shock(ground, STRING, 4.5, t, .45); st.scar(ground, STRING, 2.4, t + .05, 1.8); return; }
      const k = event.branch ? .7 : 1;
      st.burst(point, OVERHEAT, 2 * k, t, { dir, floor });
      st.erupt(ground, UP, OVERHEAT, .7 * k, 4.6 * k, t + .03, .6);
      st.shock(ground, OVERHEAT, 4.8 * k, t, .45);
      st.scar(ground, OVERHEAT, 2.1 * k, t + .05, 2.2);
      return;
    }
    if (event.slot !== 'ultimate' || event.branch) return;
    if (!final) { st.burst(point, STRING, event.contactIndex ? 1.2 : .9, t, { dir, floor }); this.rake(point, dir, event.contactIndex ? 3.2 : 2.3, lean, t, .3); if (event.contactIndex) st.shock(ground, STRING, 5, t, .5); return; }
    if (!confirmed) return;
    st.shatter(point, dir, STRING, 7, t, .8);
    st.shatter(this.a.copy(ground).setY(floor + .06), UP, STRING, 7.5, t + .04, 1.3);
    st.burst(point, STRING, 2.2, t, { dir, floor });
    st.erupt(ground, UP, STRING, .7, 9, t + .04, .5);
    st.shock(ground, STRING, 9, t, .6);
    st.scar(ground, STRING, 3, t + .1, 2);
  }
  private rake(at: THREE.Vector3, dir: THREE.Vector3, size: number, tilt: number, born: number, life: number) {
    const r = this.rakes[this.rakeCursor++ % this.rakes.length];
    r.live = true; r.born = born; r.life = life; r.at.copy(at); r.dir.copy(dir); r.size = size; r.tilt = tilt;
  }
  private segment(a: THREE.Vector3, b: THREE.Vector3, width: number, color: THREE.Color, alpha: number) {
    this.direction.subVectors(b, a); const length = this.direction.length(); if (length < .001) return;
    this.q.setFromUnitVectors(UP, this.direction.multiplyScalar(1 / length)); this.p.copy(a).lerp(b, .5);
    this.threads.add(this.p, this.q, width, length, width, color, alpha);
  }
  private curve(a: THREE.Vector3, mid: THREE.Vector3, b: THREE.Vector3, width: number, color: THREE.Color, alpha: number, steps: number) {
    this.start.copy(a);
    for (let i = 1; i <= steps; i++) {
      const u = i / steps, v = 1 - u;
      this.end.copy(a).multiplyScalar(v * v).addScaledVector(mid, 2 * v * u).addScaledVector(b, u * u);
      this.segment(this.start, this.end, width * (1 - u * .68), color, alpha); this.start.copy(this.end);
    }
  }
  update(time: number, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>) {
    if (this.disposed) return; for (const batch of this.batches) batch.begin(); const detail = this.kit.budget >= .65;
    const st = this.stage.open(time);
    for (const f of fighters.values()) {
      const s = f.state; if (!isDoflamingoStrings(s.fighter) || !s.alive) continue;
      const elapsed = s.actionTime * s.actionDuration, seed = (s.actionSeq ?? 0) * 5.7;
      this.forward.set(Math.sin(s.yaw), 0, Math.cos(s.yaw)); this.side.set(this.forward.z, 0, -this.forward.x);
      if (s.action === 'awaken') {
        const fade = clamp(elapsed / .22) * clamp((.9 - elapsed) / .11), count = detail ? 10 : 6;
        for (let i = 0; i < count; i++) {
          const angle = i * TAU / count, radius = .45 + clamp(elapsed / .6) * 1.5;
          this.a.copy(f.group.position); this.a.x += Math.cos(angle) * radius; this.a.z += Math.sin(angle) * radius; this.a.y += .035;
          this.b.copy(i % 2 ? f.handR : f.handL); this.b.y += .1;
          this.c.copy(this.a).lerp(this.b, .5); this.c.y += .8 + fade * .7;
          this.curve(this.a, this.c, this.b, .015, i % 3 ? WHITE : ROSE, fade * .78, detail ? 5 : 3);
        }
        this.p.copy(f.group.position); this.p.y += .04;
        this.rings.add(this.p, this.flat, .5 + fade * 1.35, .5 + fade * 1.35, 1, WHITE, fade * .65); continue;
      }
      if (!['light', 'heavy', 'special', 'ultimate'].includes(s.action) || s.whiffedAt !== undefined) continue;
      if (s.action === 'ultimate' && elapsed > .57 && s.confirmedAt === undefined) continue;
      const strength = Math.sin(clamp(s.actionTime) * Math.PI);
      if (s.action === 'light' || s.branch === 'lh' || s.branch === 'llh') {
        const side = s.branch === 'lh' || s.action === 'light' && s.chain === 2 ? 'left' : 'right';
        for (let i = 0; i < 5; i++) {
          const bone = f.bones.get(`${side}hand${['thumb', 'index', 'middle', 'ring', 'pinky'][i]}3`);
          if (bone) bone.getWorldPosition(this.a); else this.a.copy(side === 'left' ? f.handL : f.handR);
          this.b.copy(this.a).addScaledVector(this.forward, .45 + strength * .72).addScaledVector(this.side, (i - 2) * .13);
          this.c.copy(this.a).lerp(this.b, .5); this.c.y += .14;
          this.curve(this.a, this.c, this.b, .013 * strength, i % 2 ? WHITE_HOT : ROSE_HOT, strength, 3);
          st.streak(this.a, this.c, .05, STRING.main, .5 * strength); st.streak(this.c, this.b, .05, STRING.main, .5 * strength);
          st.streak(this.a, this.c, .016, STRING.core, 1.3 * strength); st.streak(this.c, this.b, .016, STRING.core, 1.3 * strength);
        }
        if (s.action === 'light') { this.a.copy(side === 'left' ? f.handL : f.handR); st.glow(this.a, .3, STRING.main, .5 * strength); st.light(this.a, 2.2, STRING, .22 * strength); }
      } else if (s.action === 'heavy') {
        doflamingoStrikePoint(f, this.c); this.face.setFromUnitVectors(FRONT, this.forward);
        for (let i = 0; i < 3; i++) { this.p.copy(this.c).addScaledVector(this.forward, (i - 1) * .055); const radius = .17 + strength * .10 + i * .025; this.rings.add(this.p, this.face, radius, radius, 1, i === 1 ? ROSE_HOT : WHITE_HOT, strength); }
        const contact = s.branch ? s.actionDuration * .5 : .55;
        if (elapsed < contact) st.charge(this.c, STRING, .24, clamp(elapsed / contact), seed);
        else if (elapsed < contact + .2) {
          const flare = 1 - (elapsed - contact) / .2;
          for (let i = -2; i <= 2; i++) {
            this.a.copy(this.c).addScaledVector(this.side, i * .07); this.b.copy(this.a).addScaledVector(this.forward, .5 + .7 * (1 - flare)).addScaledVector(this.side, i * .2); this.b.y += .25 - Math.abs(i) * .1;
            st.streak(this.a, this.b, .05, STRING.main, .6 * flare); st.streak(this.a, this.b, .018, STRING.core, 1.4 * flare);
          }
          st.glow(this.c, .5, STRING.main, .6 * flare); st.light(this.c, 3, STRING, .4 * flare);
        }
      } else if (s.action === 'special' && elapsed < .74 && !s.branch) {
        for (let i = 0; i < 3; i++) {
          this.a.copy(f.handR); this.b.copy(this.a).addScaledVector(this.forward, .38 + strength * .5);
          this.c.copy(this.a).lerp(this.b, .5).addScaledVector(this.side, (i - 1) * .13); this.c.y += .10;
          this.curve(this.a, this.c, this.b, .027 * strength, i === 1 ? WHITE_HOT : HOT, strength, 3);
        }
        if (elapsed < B.overheat) { const k = clamp(elapsed / B.overheat); st.charge(f.handR, OVERHEAT, .36, k, seed); st.tongue(this.p.copy(f.handR).setY(f.handR.y + .22), UP, .3, .4 + .6 * k, OVERHEAT, k, seed); }
      } else if (s.action === 'ultimate' && !s.branch && s.confirmedAt === undefined && elapsed < .56) {
        st.charge(f.handR, STRING, .3, clamp(elapsed / .56), seed);
      }
    }
    for (const flight of flights.values()) {
      if (!isDoflamingoStrings(flight.fighter) || flight.slot !== 'special' || flight.branch || !flight.released) continue;
      this.forward.copy(flight.heading).normalize(); this.side.crossVectors(this.forward, UP).normalize();
      let origin = flight.origin;
      if (!origin) {
        let record = this.flightStarts.find(r => r.flight === flight);
        if (!record) { record = this.flightStarts[this.flightStartCursor++ % this.flightStarts.length]; record.flight = flight; record.origin.copy(flight.position); }
        origin = record.origin;
      }
      const travelled = Math.max(0, this.direction.subVectors(flight.position, origin).dot(this.forward));
      const tail = Math.min(2.9, travelled);
      if (tail < .001) continue;
      if (flight.actorId) {
        let whip = this.whips.find(w => w.live && w.actor === flight.actorId);
        if (!whip) { whip = this.whips.find(w => !w.live) ?? this.whips[0]; whip.actor = flight.actorId; whip.live = true; }
        whip.origin.copy(origin); whip.head.copy(flight.position); whip.heading.copy(this.forward); whip.seen = time; whip.floor = fighters.get(flight.actorId)?.group.position.y ?? flight.position.y - 1.2;
      }
      for (let strand = 0; strand < 3; strand++) {
        this.a.copy(flight.position).addScaledVector(this.forward, -tail);
        for (let i = 1; i <= (detail ? 7 : 4); i++) {
          const u = i / (detail ? 7 : 4), twist = u * TAU * 1.7 + strand * TAU / 3 + time * 10;
          this.b.copy(flight.position).addScaledVector(this.forward, -tail * (1 - u)).addScaledVector(this.side, Math.cos(twist) * .07); this.b.y += Math.sin(twist) * .07;
          this.segment(this.a, this.b, strand === 1 ? .034 : .022, strand === 1 ? WHITE_HOT : HOT, .96); this.a.copy(this.b);
        }
      }
      const headLength = Math.min(.62, tail);
      this.q.setFromUnitVectors(UP, this.forward); this.p.copy(flight.position).addScaledVector(this.forward, -headLength * .5);
      this.needles.add(this.p, this.q, .095, headLength, .095, WHITE_HOT, 1);
    }
    for (const whip of this.whips) {
      if (!whip.live) continue;
      const gone = time - whip.seen;
      if (gone > WHIP_LINGER || gone < -.5 || !fighters.get(whip.actor)?.state.alive) { whip.live = false; continue; }
      this.whip(whip, 1 - clamp(gone / WHIP_LINGER), time);
    }
    for (const confirm of this.confirms) {
      if (!confirm.actor) continue; const f = fighters.get(confirm.actor), victim = fighters.get(confirm.target), s = f?.state;
      if (!f || !s?.alive || !victim?.state.alive && !confirm.final || s.action !== 'ultimate' || s.branch || (s.actionSeq ?? -1) !== confirm.seq || s.whiffedAt !== undefined) { confirm.actor = ''; continue; }
      const elapsed = s.actionTime * s.actionDuration; if (elapsed > 3.86) { confirm.actor = ''; continue; }
      if (!confirm.final && elapsed < B.final) this.gather(f, confirm, elapsed, time);
      if (elapsed < 2.10) continue;
      if (confirm.final) this.target.copy(confirm.endpoint); else if (victim) bodyCentre(victim, this.target); else continue;
      this.forward.subVectors(this.target, f.group.position); this.forward.y = 0; this.forward.normalize(); this.side.set(this.forward.z, 0, -this.forward.x);
      const grown = clamp((elapsed - 2.10) / .72), thrust = clamp((elapsed - 2.98) / .20), fade = clamp((3.88 - elapsed) / .34);
      for (let i = 0; i < 16; i++) {
        const u = i / 15, angle = -.88 * Math.PI + u * 1.76 * Math.PI;
        this.a.copy(f.group.position).addScaledVector(this.side, Math.sin(angle) * (2.8 + i % 2 * .22)).addScaledVector(this.forward, -1.1 - Math.cos(angle) * .7);
        this.a.y = confirm.floor + .08;
        this.b.copy(this.a).addScaledVector(this.forward, .45 + grown * .75); this.b.y += grown * (2.8 + Math.cos(angle) * 1.7);
        this.b.lerp(this.target, thrust * .985);
        this.direction.subVectors(this.b, this.a); const length = this.direction.length(); if (length < .01) continue;
        this.q.setFromUnitVectors(UP, this.direction.multiplyScalar(1 / length)); this.p.copy(this.a).lerp(this.b, .5);
        const width = (.07 + grown * .095) * (i % 2 ? .88 : 1);
        this.needles.add(this.p, this.q, width * 1.22, length, width * 1.22, INK, fade * .75);
        this.needles.add(this.p, this.q, width, length, width, i % 4 ? WHITE_HOT : ROSE_HOT, fade);
        if (!confirm.final && i % 2 === 0) st.glow(this.b, .26 + .3 * thrust, STRING.core, (.35 + .5 * thrust) * fade * grown);
        if (detail) { this.c.copy(this.a).lerp(this.b, .45); this.c.addScaledVector(this.side, (i % 2 ? 1 : -1) * .28); this.curve(this.a, this.c, this.b, .009, WHITE, fade * .7, 3); }
      }
      if (confirm.final) { this.p.set(this.target.x, confirm.floor + .035, this.target.z); const radius = .4 + Math.max(0, elapsed - 3.18) * 4; this.rings.add(this.p, this.flat, radius, radius, 1, WHITE, fade * .7); }
    }
    for (const hit of this.impacts) {
      if (!hit.actor) continue; const age = time - hit.born, life = hit.grade === 3 ? .44 : .24;
      if (age >= life) { hit.actor = ''; continue; } if (age < 0) continue;
      const fade = 1 - age / life, count = detail ? hit.grade * 5 : hit.grade * 3;
      for (let i = 0; i < count; i++) {
        const angle = i * 2.39996 + hit.seed;
        this.a.copy(hit.point); this.b.copy(hit.point); this.b.x += Math.sin(angle) * (.16 + age * 4.7); this.b.y += Math.cos(angle) * (.16 + age * 4.7); this.b.z += Math.sin(angle * 1.7) * .35;
        this.segment(this.a, this.b, .018 * fade, i % 3 ? WHITE : ROSE, fade);
      }
    }
    for (const rake of this.rakes) {
      if (!rake.live) continue;
      const age = time - rake.born;
      if (age >= rake.life) { rake.live = false; continue; }
      if (age < 0) continue;
      const u = age / rake.life, fade = u < .35 ? 1 : 1 - (u - .35) / .65, snap = Math.min(1, age / .04);
      this.side.set(rake.dir.z, 0, -rake.dir.x);
      const along = this.a.copy(UP).multiplyScalar(Math.cos(rake.tilt)).addScaledVector(this.side, Math.sin(rake.tilt)), across = this.b.copy(this.side).multiplyScalar(Math.cos(rake.tilt)).addScaledVector(UP, -Math.sin(rake.tilt));
      for (let i = -2; i <= 2; i++) {
        const half = rake.size * .5 * snap * (1 - Math.abs(i) * .13), gap = rake.size * .075;
        this.start.copy(rake.at).addScaledVector(across, i * gap).addScaledVector(along, -half); this.end.copy(rake.at).addScaledVector(across, i * gap).addScaledVector(along, half);
        st.streak(this.start, this.end, Math.min(.12, .03 + rake.size * .02), STRING.main, .6 * fade); st.streak(this.start, this.end, Math.min(.04, .012 + rake.size * .006), STRING.core, 1.6 * fade);
      }
      st.glow(rake.at, Math.min(1.2, .25 + rake.size * .2), STRING.core, .6 * fade, STAR, .2, rake.born);
      st.light(rake.at, 1.4 + rake.size * .8, STRING, .34 * fade);
    }
    for (const batch of this.batches) batch.end();
    st.close();
  }

  private whip(whip: Whip, fade: number, time: number) {
    const st = this.stage, span = whip.origin.distanceTo(whip.head); if (span < .3) return;
    const steps = Math.max(3, Math.min(10, Math.ceil(span / 1.6))), bow = Math.min(.7, span * .06);
    this.side.set(whip.heading.z, 0, -whip.heading.x);
    this.start.copy(whip.origin);
    for (let i = 1; i <= steps; i++) {
      const u = i / steps, wave = Math.sin(u * Math.PI);
      this.end.copy(whip.origin).lerp(whip.head, u).addScaledVector(this.side, Math.sin(u * 7 - time * 22) * bow * wave * .5); this.end.y += wave * bow + Math.sin(u * 9 + time * 17) * .06 * wave;
      st.streak(this.start, this.end, .3, OVERHEAT.main, .55 * fade); st.streak(this.start, this.end, .095, OVERHEAT.core, 1.6 * fade);
      if (i < steps) st.tongue(this.p.copy(this.end).setY(this.end.y + .28), UP, .3, .7, OVERHEAT, fade * (.5 + .4 * u), i * 3.1);
      this.start.copy(this.end);
    }
    st.glow(whip.head, 1.2, OVERHEAT.main, .95 * fade); st.glow(whip.head, .48, OVERHEAT.core, 1.2 * fade);
    st.glow(whip.origin, .5, OVERHEAT.core, .8 * fade);
    st.light(this.p.copy(whip.head).setY(whip.head.y + .3), 6.5, OVERHEAT, 1.1 * fade);
    st.light(this.p.copy(whip.origin).lerp(whip.head, .45).setY(whip.origin.y + .3), 5.5, OVERHEAT, .8 * fade);
  }

  private gather(f: Fighter, c: Confirm, elapsed: number, time: number) {
    const st = this.stage, g = clamp((elapsed - .56) / (B.final - .56)), seed = c.seq * 3.9, yaw = f.state.yaw ?? f.group.rotation.y;
    const feet = this.ground.copy(f.group.position).setY(c.floor);
    this.forward.set(Math.sin(yaw), 0, Math.cos(yaw));
    st.dim(.3 + .45 * g, c.actor, c.target);
    st.pool(feet, 2.6 + 3 * g, STRING, .3 + .7 * g, seed);
    for (let i = 0, n = st.n(11, 6); i < n; i++) {
      const ang = i * 2.399963 + seed, r = 3.1 + .9 * Math.abs(Math.sin(i * 1.9 + seed)), h = (1.5 + 6 * g) * (.55 + .45 * Math.abs(Math.sin(i * 2.7 + seed))), sway = Math.sin(time * 2.3 + i) * .1 * h;
      this.a.set(feet.x + Math.cos(ang) * r, c.floor + .04, feet.z + Math.sin(ang) * r);
      this.c.set(this.a.x + Math.cos(ang + 1.2) * sway, c.floor + h * .5, this.a.z + Math.sin(ang + 1.2) * sway); this.b.set(this.a.x - Math.cos(ang) * h * .08, c.floor + h, this.a.z - Math.sin(ang) * h * .08);
      st.streak(this.a, this.c, .045, STRING.main, .3 + .25 * g); st.streak(this.c, this.b, .045, STRING.main, .3 + .25 * g);
      st.streak(this.a, this.c, .014, STRING.core, .9 + .5 * g); st.streak(this.c, this.b, .014, STRING.core, .9 + .5 * g);
    }
    st.cracks(this.p.copy(feet).addScaledVector(this.forward, -1.5).setY(c.floor + 1.9), this.forward, 2.2 + 2.6 * g, STRING, .25 + .75 * g, seed, .55 + .3 * g);
    st.light(this.p.copy(feet).setY(c.floor + 1), 5 + 3 * g, STRING, .3 + .4 * g);
    st.charge(f.handR, STRING, .26 + .2 * g, Math.max(.4, g), seed); st.charge(f.handL, STRING, .22 + .16 * g, Math.max(.3, g), seed + 2);
    if (g > .8) st.speed(.5 * (g - .8) / .2, c.actor, c.target);
  }
  reset() { for (const c of this.confirms) c.actor = ''; for (const hit of this.impacts) hit.actor = ''; this.seen.fill(-1); this.seenTime.fill(-1); this.cursor = this.impactCursor = this.confirmCursor = this.flightStartCursor = this.rakeCursor = 0; for (const record of this.flightStarts) record.flight = null; for (const rake of this.rakes) rake.live = false; for (const whip of this.whips) whip.live = false; for (const batch of this.batches) { batch.begin(); batch.end(); } this.stage.reset(); }
  dispose() { if (this.disposed) return; this.disposed = true; this.reset(); for (const batch of this.batches) batch.dispose(); this.stage.release(); }
}
