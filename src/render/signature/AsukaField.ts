import * as THREE from 'three';
import type { CombatEvent } from '../../game/types';
import { ASUKA_MOVES, asukaStrikeSocket } from '../../game/fighters/asuka';
import type { Fighter } from '../Fighter';
import type { Flight } from '../CombatEffects';
import { bodyCentre, type VfxKit } from '../vfx/VfxKit';
import { SIGNATURE, involvesLocal } from './context';
import { STAR } from './GlowBatch';
import { MoveStage, WAVE, type StageLook } from './MoveStage';
import { blowFloor } from './blowFloor';
import { nested, sweep } from './StageStrokes';

export const isAsukaField = (id: string | undefined) => id === 'asuka';
export const ASUKA_VFX_LIMITS = Object.freeze({ marks: 14, executions: 6 });
export const ASUKA_KNIFE = { root: [0, .17, 0], tip: [-.049, .80, 0] } as const;
const UP = new THREE.Vector3(0, 1, 0);
const lin = (r: number, g: number, b: number) => new THREE.Color(r, g, b);
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const hash = (x: number) => { const v = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
export function asukaKnife(f: Fighter, root: THREE.Vector3, tip: THREE.Vector3): boolean {
  const bone = (f.shownBody ?? f).bones?.get('progressiveknife'); if (!bone) return false;
  root.fromArray(ASUKA_KNIFE.root).applyMatrix4(bone.matrixWorld); tip.fromArray(ASUKA_KNIFE.tip).applyMatrix4(bone.matrixWorld); return true;
}
const FIELD: StageLook = { core: lin(3.3, 2.5, 1.2), main: lin(2.1, .95, .16), rim: lin(.9, .28, .05), light: lin(1.3, .74, .28), element: { spike: 0xfff1d0, rim: 0xff9a30, light: 0xffb050, ink: 0x2a0d04 }, shell: 0xff9a30, edge: 0x8a2a08, flame: -1, dark: false, heart: 0 };
const CROSS: StageLook = { core: lin(3.3, 2.8, 2.4), main: lin(2.2, .62, .34), rim: lin(.9, .12, .1), light: lin(1.35, .6, .42), element: { spike: 0xfff4e6, rim: 0xf02b32, light: 0xff6a4a, ink: 0x2a0606 }, shell: 0xff7a4a, edge: 0x8a1410, flame: -1, dark: false, heart: 0 };
const HEAVY = ASUKA_MOVES.heavy, SPECIAL = ASUKA_MOVES.special, ULT = ASUKA_MOVES.ultimate;
const FIRST = ULT.contacts[0], LAST = ULT.contacts[ULT.contacts.length - 1];
const ARC = .22, STAND = .16;
const BROKEN = 0, CROSSED = 1, CUT = 2;
type Execution = { actor: string; target: string; seq: number; final: boolean; floor: number };
type Mark = { kind: number; born: number; life: number; size: number; seed: number; at: THREE.Vector3; dir: THREE.Vector3; floor: number; live: boolean };

export class AsukaField {
  private readonly stage: MoveStage;
  private executions: Execution[] = Array.from({ length: ASUKA_VFX_LIMITS.executions }, () => ({ actor: '', target: '', seq: -1, final: false, floor: 0 }));
  private marks: Mark[] = Array.from({ length: ASUKA_VFX_LIMITS.marks }, () => ({ kind: 0, born: -1e9, life: 0, size: 1, seed: 0, at: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, 1), floor: 0, live: false }));
  private seen = new Float64Array(128).fill(-1); private seenTime = new Float64Array(128).fill(-1);
  private cursor = 0; private executionCursor = 0; private markCursor = 0; private disposed = false;
  private p = new THREE.Vector3(); private a = new THREE.Vector3(); private b = new THREE.Vector3(); private c = new THREE.Vector3(); private d = new THREE.Vector3();
  private heading = new THREE.Vector3(); private side = new THREE.Vector3(); private dir = new THREE.Vector3(); private ground = new THREE.Vector3();
  private root = new THREE.Vector3(); private tip = new THREE.Vector3(); private strike = new THREE.Vector3(); private across = new THREE.Vector3();
  constructor(scene: THREE.Scene, kit: Pick<VfxKit, 'budget'> & Partial<VfxKit>) { this.stage = MoveStage.for(scene, kit); }
  load(_ids: readonly string[]): Promise<void> { return Promise.resolve(); }
  private cancel(id: string, victim = false) { for (const x of this.executions) if (x.actor === id || victim && x.target === id && !x.final) x.actor = ''; }
  private mark(kind: number, at: THREE.Vector3, dir: THREE.Vector3, floor: number, born: number, life: number, size: number) {
    const m = this.marks[this.markCursor++ % this.marks.length];
    m.kind = kind; m.at.copy(at); m.dir.copy(dir); m.floor = floor; m.born = born; m.life = life; m.size = size; m.seed = (Math.abs(at.x * 8.9 + at.z * 5.7 + born * 3.7)) % 59; m.live = true;
  }

  handle(e: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    if (this.disposed) return;
    if (e.kind === 'eliminated' || e.kind === 'respawn') { this.cancel(e.actorId, true); return; }
    if (!isAsukaField(e.fighter)) return;
    if (e.kind === 'whiff' || e.kind === 'rejected') { this.cancel(e.actorId); return; }
    if (e.kind !== 'hit' && e.kind !== 'confirm') return;
    for (let i = 0; i < this.seen.length; i++) if (this.seen[i] === e.id && this.seenTime[i] === e.serverTime) return;
    const index = this.cursor++ % this.seen.length; this.seen[index] = e.id; this.seenTime[index] = e.serverTime;
    const actor = fighters?.get(e.actorId), victim = e.targetId ? fighters?.get(e.targetId) : undefined, seq = e.actionSeq ?? actor?.state.actionSeq ?? -1;
    let floor = blowFloor(actor, victim, Infinity);
    if (e.kind === 'confirm') {
      if (e.slot === 'ultimate' && !e.branch && e.targetId) Object.assign(this.executions[this.executionCursor++ % this.executions.length], { actor: e.actorId, target: e.targetId, seq, final: false, floor: Number.isFinite(floor) ? floor : 0 });
      return;
    }
    if (!victim && !e.endpoint) return;
    const final = e.slot === 'ultimate' && !e.branch && e.contactIndex === ULT.contacts.length - 1, point = this.p, st = this.stage, t = e.serverTime;
    if (victim) bodyCentre(victim, point); else point.set(e.endpoint!.x, e.endpoint!.y, e.endpoint!.z);
    if (!Number.isFinite(floor)) floor = point.y - 1.05;
    let confirmed = false;
    if (final) for (const x of this.executions) if (x.actor === e.actorId && x.seq === seq) { x.final = true; floor = x.floor; confirmed = true; }
    if (final && !confirmed) return;
    const dir = this.dir;
    if (actor) { dir.subVectors(point, actor.group.position).setY(0); if (dir.lengthSq() < .01) dir.set(Math.sin(actor.state.yaw ?? 0), 0, Math.cos(actor.state.yaw ?? 0)); dir.normalize(); } else dir.set(0, 0, 1);
    const ground = this.ground.set(point.x, floor, point.z);
    if (e.slot === 'light') { this.mark(CUT, point, dir, floor, t, .24, .8); st.burst(point, FIELD, .36, t, { dir, floor, clean: true }); return; }
    if (e.slot === 'heavy') {
      const big = e.branch ? .85 : 1;
      this.mark(BROKEN, point, dir, floor, t, .5, 1.5 * big);
      st.burst(point, FIELD, .7 * big, t, { dir, floor });
      st.shock(ground, FIELD, 4 * big, t, .4);
      return;
    }
    if (e.slot === 'special') {
      if (e.branch === 'airSpecial') { st.burst(point, FIELD, 2, t, { floor }); st.shock(ground, FIELD, 4.5, t, .45); st.scar(ground, FIELD, 3, t, 1.8); return; }
      const big = e.branch ? .7 : 1;
      this.mark(BROKEN, point, dir, floor, t, .7, 3 * big);
      this.mark(CROSSED, ground, dir, floor, t + STAND, .75, .5 * big);
      st.burst(point, FIELD, 1.8 * big, t, { dir, floor });
      st.shatter(point, dir, FIELD, 3 * big, t + STAND, .55);
      st.shock(ground, FIELD, 5.5 * big, t, .45);
      st.erupt(ground, UP, CROSS, .55 * big, 7 * big, t + STAND, .6);
      st.scar(ground, FIELD, 2.6 * big, t + .1, 1.9);
      return;
    }
    if (e.slot !== 'ultimate' || e.branch) return;
    if (!final) {
      if (e.contactIndex) { this.mark(BROKEN, point, dir, floor, t, .55, 1.6 + .5 * e.contactIndex); st.shock(ground, FIELD, 4 + e.contactIndex, t, .45); } else this.mark(CUT, point, dir, floor, t, .3, 1.4);
      st.burst(point, FIELD, e.contactIndex ? 1.2 + .2 * e.contactIndex : 1, t, { dir, floor });
      return;
    }
    if (involvesLocal(e.actorId, e.targetId)) SIGNATURE.screen?.impactFrame?.(.5, point);
    this.mark(BROKEN, point, dir, floor, t, .5, 3.4);
    this.mark(CROSSED, ground, dir, floor, t + .04, 1, 1);
    st.burst(point, CROSS, 2.5, t, { dir, floor });
    st.shatter(point, dir, FIELD, 6, t + .05, .8);
    st.erupt(ground, UP, CROSS, 1.1, 14, t + .04, .9);
    st.shock(ground, CROSS, 10, t, .6);
    st.scar(ground, CROSS, 4.5, t + .15, 2.2);
  }

  update(time: number, fighters: ReadonlyMap<string, Fighter>, _flights?: ReadonlyMap<string, Flight>) {
    if (this.disposed) return;
    const st = this.stage.open(time);
    for (const f of fighters.values()) {
      const s = f.state; if (!isAsukaField(s.fighter) || !s.alive) continue;
      if (s.action === 'awaken') { this.awakening(f, time); continue; }
      if (s.whiffedAt !== undefined || (s.action !== 'light' && s.action !== 'heavy' && s.action !== 'special' && s.action !== 'ultimate')) continue;
      const elapsed = s.actionTime * s.actionDuration, seed = (s.actionSeq ?? 0) * 6.7, feet = f.group.position, heading = this.face(f), side = this.side, strike = f.strikePoint(this.strike);
      if (s.action === 'light') {
        const k = Math.sin(clamp(s.actionTime) * Math.PI);
        if (this.knifeStrikes(f)) this.edge(f, k, .7, time);
        else { st.glow(strike, .3, FIELD.main, .6 * k); st.glow(strike, .12, FIELD.core, .8 * k); st.light(strike, 2.4, FIELD, .25 * k); }
      } else if (s.action === 'heavy') {
        const contact = s.branch ? s.actionDuration * .55 : HEAVY.contacts[0];
        if (elapsed < contact) { const k = clamp(elapsed / contact); st.charge(strike, FIELD, .18, k, seed); st.glow(strike, .3, FIELD.main, .6 * k); }
        else if (elapsed < contact + ARC) {
          const w = (elapsed - contact) / ARC, cut = clamp(w / .35), fade = 1 - w * w;
          this.p.copy(feet).setY(feet.y + 1.1);
          sweep(st, this.p, heading, side, 2.1, 2.2 - 4 * cut, 2.2, .24, FIELD, 1.4 * fade, 14);
          st.light(this.a.copy(this.p).addScaledVector(heading, 1.2).setY(feet.y + .5), 4.5, FIELD, .45 * fade);
        }
      } else if (s.action === 'special' && !s.branch) {
        const release = SPECIAL.contacts[0];
        if (elapsed < release) {
          const k = clamp(elapsed / release);
          this.p.copy(strike).addScaledVector(heading, .25);
          nested(st, this.p, side, UP, .5 + 1.1 * k, 8, 4, .05, FIELD, k * 1.4, .9, Math.PI / 8, time);
          st.charge(strike, FIELD, .3, k, seed);
        }
      } else if (s.action === 'ultimate' && !s.branch && s.confirmedAt === undefined && elapsed < FIRST + .12) {
        const k = clamp(elapsed / FIRST);
        this.edge(f, k, 1.1, time); st.charge(this.tip, FIELD, .24, k, seed);
      }
    }
    for (const x of this.executions) {
      if (!x.actor) continue;
      const actor = fighters.get(x.actor), victim = fighters.get(x.target), s = actor?.state;
      if (!actor || !s?.alive || !victim?.state.alive && !x.final || s.action !== 'ultimate' || s.branch || (s.actionSeq ?? -1) !== x.seq || s.whiffedAt !== undefined) { x.actor = ''; continue; }
      const elapsed = s.actionTime * s.actionDuration;
      if (elapsed > ULT.duration) { x.actor = ''; continue; }
      if (!x.final && elapsed < LAST && victim) this.gather(actor, victim, x, elapsed, time);
    }
    for (const m of this.marks) {
      if (!m.live) continue;
      const age = time - m.born;
      if (age >= m.life) { m.live = false; continue; }
      if (age >= 0) this.drawMark(m, age, time);
    }
    st.close();
  }

  private face(f: Fighter) {
    const yaw = f.state.yaw ?? f.group.rotation.y;
    this.side.set(Math.cos(yaw), 0, -Math.sin(yaw));
    return this.heading.set(Math.sin(yaw), 0, Math.cos(yaw));
  }
  private knifeStrikes(f: Fighter) { return asukaStrikeSocket(f.state.action, f.displayedClipName ?? '', f.state.actionTime) === 'RightHand'; }
  private edge(f: Fighter, k: number, size: number, time: number) {
    const st = this.stage;
    if (!asukaKnife(f, this.root, this.tip)) { this.root.copy(f.handR); this.tip.copy(f.handR).addScaledVector(this.heading, .55).addScaledVector(UP, .2); }
    if (k <= .02) return;
    const shiver = .85 + .15 * Math.sin(time * 90);
    st.streak(this.root, this.tip, .08 * size * shiver, FIELD.main, k); st.streak(this.root, this.tip, .028 * size, FIELD.core, 1.2 * k);
    st.glow(this.tip, .2 * size, FIELD.main, .7 * k); st.glow(this.tip, .08 * size, FIELD.core, k, STAR, .2, 2);
    st.light(this.p.copy(this.root).lerp(this.tip, .6), 2 + size, FIELD, .26 * k);
  }

  private gather(actor: Fighter, victim: Fighter, x: Execution, elapsed: number, time: number) {
    const st = this.stage, g = clamp((elapsed - FIRST) / (LAST - FIRST)), seed = x.seq * 2.1, feet = this.ground.copy(actor.group.position).setY(x.floor), heading = this.face(actor);
    const prey = bodyCentre(victim, this.c);
    this.dir.subVectors(prey, feet).setY(0); if (this.dir.lengthSq() < .01) this.dir.copy(heading); this.dir.normalize();
    st.dim(.3 + .45 * g, x.actor, x.target);
    this.p.copy(prey).addScaledVector(this.dir, 2.6).setY(x.floor + 2.6);
    this.across.set(this.dir.z, 0, -this.dir.x);
    nested(st, this.p, this.across, UP, 2.6 + 1.6 * g, 8, 6, .07, FIELD, clamp(.2 + g * 1.6), .55 + .35 * g, Math.PI / 8, time);
    st.glow(this.p, 2.4 + 1.4 * g, FIELD.main, .16 + .12 * g);
    st.light(this.a.copy(prey).setY(prey.y + .6), 6 + 2 * g, FIELD, .3 + .3 * g);
    for (let i = 0, n = Math.floor((LAST - FIRST - .4) / .17); i < n; i++) {
      const born = FIRST + .2 + i * .17, age = elapsed - born;
      if (age < 0 || age > .34) continue;
      const tilt = (hash(seed + i * 4.7) - .5) * 2.4, w = age / .34, fade = (1 - w) * (1 - w), reach = (1.3 + .8 * hash(seed + i * 2.3)) * clamp(age / .04);
      this.d.copy(this.across).multiplyScalar(Math.cos(tilt)).addScaledVector(UP, Math.sin(tilt));
      this.a.copy(prey).addScaledVector(this.d, -reach); this.b.copy(prey).addScaledVector(this.d, reach);
      st.streak(this.a, this.b, .13 * (.4 + .6 * fade), FIELD.main, 1.1 * fade); st.streak(this.a, this.b, .04, FIELD.core, 1.5 * fade);
    }
    this.edge(actor, .6 + .4 * g, 1.2, time);
    st.charge(this.tip, FIELD, .2 + .14 * g, Math.max(.35, g), seed);
    if (g > .8) st.speed(.5 * (g - .8) / .2, x.actor, x.target);
  }

  private drawMark(m: Mark, age: number, time: number) {
    const st = this.stage, w = age / m.life, across = this.across.set(m.dir.z, 0, -m.dir.x);
    if (m.kind === CUT) {
      const fade = (1 - w) * (1 - w), reach = m.size * clamp(age / .05);
      this.d.copy(across).multiplyScalar(.8).addScaledVector(UP, .6);
      this.a.copy(m.at).addScaledVector(this.d, -reach); this.b.copy(m.at).addScaledVector(this.d, reach);
      st.streak(this.a, this.b, .15 * (.4 + .6 * fade), FIELD.main, 1.2 * fade); st.streak(this.a, this.b, .045, FIELD.core, 1.6 * fade);
      return;
    }
    if (m.kind === BROKEN) {
      const open = clamp(age / .05), broke = clamp((age - STAND) / Math.max(.05, m.life - STAND)), fade = 1 - broke * broke;
      nested(st, m.at, across, UP, m.size * (1 + .45 * broke), 8, m.size > 2.5 ? 6 : 4, .045 + m.size * .012, FIELD, open, 1.25 * fade, Math.PI / 8 + broke * .25, time);
      st.glow(m.at, m.size * .9, FIELD.main, .3 * fade); st.glow(m.at, m.size * .3, FIELD.core, .7 * (1 - clamp(age / .12)), STAR, .2, m.seed);
      st.light(m.at, Math.min(8, m.size * 1.6 + 2), FIELD, .45 * fade);
      return;
    }
    const rise = clamp(age / .1), fade = w < .45 ? 1 : 1 - (w - .45) / .55, reach = (.5 + 5.5 * m.size) * rise;
    this.p.set(m.at.x, m.floor + 1.5 + 1.4 * m.size, m.at.z);
    this.a.copy(this.p).addScaledVector(across, -reach); this.b.copy(this.p).addScaledVector(across, reach);
    st.streak(this.a, this.b, .85 * m.size * (.5 + .5 * fade), CROSS.main, 1.1 * fade); st.streak(this.a, this.b, .34 * m.size * (.5 + .5 * fade), CROSS.core, 1.3 * fade);
    st.glow(this.p, 2.4 * m.size, CROSS.core, .8 * fade); st.glow(this.p, 4.5 * m.size, CROSS.main, .35 * fade);
  }

  private awakening(f: Fighter, time: number) {
    const st = this.stage, w = clamp(f.state.actionTime), flare = clamp((w - .36) / .19) * clamp((.97 - w) / .19);
    if (flare <= 0) return;
    this.face(f);
    nested(st, f.handL, this.side, UP, .3 + flare * .8, 8, 3, .035, FIELD, 1, flare * .9, Math.PI / 8, time);
    st.disc(this.p.copy(f.group.position), .9 + flare * 1.4, FIELD.main, flare * .6, WAVE, .96);
    st.light(this.p.setY(f.group.position.y + 1.2), 3.5, FIELD, .4 * flare);
  }
  reset() {
    for (const x of this.executions) x.actor = ''; for (const m of this.marks) m.live = false;
    this.seen.fill(-1); this.seenTime.fill(-1); this.cursor = this.executionCursor = this.markCursor = 0; this.stage.reset();
  }
  dispose() { if (this.disposed) return; this.reset(); this.disposed = true; this.stage.release(); }
}
