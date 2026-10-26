import * as THREE from 'three';
import type { CombatEvent } from '../../game/types';
import { SHINJI_MOVES } from '../../game/fighters/shinji';
import type { Fighter } from '../Fighter';
import type { Flight } from '../CombatEffects';
import { bodyCentre, type VfxKit } from '../vfx/VfxKit';
import { SIGNATURE, involvesLocal } from './context';
import { STAR } from './GlowBatch';
import { MoveStage, WAVE, type StageLook } from './MoveStage';
import { blowFloor } from './blowFloor';
import { bolt, nested, sweep } from './StageStrokes';

export const isShinjiATField = (id: string | undefined) => id === 'shinji';
export const SHINJI_AT_LIMITS = Object.freeze({ marks: 14, ruptures: 6 });
const UP = new THREE.Vector3(0, 1, 0);
const lin = (r: number, g: number, b: number) => new THREE.Color(r, g, b);
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const FIELD: StageLook = { core: lin(3.3, 2.5, 1.2), main: lin(2.1, .95, .16), rim: lin(.9, .28, .05), light: lin(1.3, .74, .28), element: { spike: 0xffe6a3, rim: 0xffab38, light: 0xffb050, ink: 0x2a0d04 }, shell: 0xffab38, edge: 0x8a2a08, flame: -1, dark: false, heart: 0 };
const POSITRON: StageLook = { core: lin(2.9, 3, 3.3), main: lin(.95, 1.1, 2.3), rim: lin(.5, .2, .9), light: lin(.85, .9, 1.3), element: { spike: 0xffffff, rim: 0x9fb4ff, light: 0xd8e2ff, ink: 0x120a2a }, shell: 0xcfdcff, edge: 0x6a3ad0, flame: -1, dark: false, heart: 0 };
const CROSS: StageLook = { core: lin(3.2, 2.7, 3.3), main: lin(1.6, .5, 2.2), rim: lin(.5, .1, .8), light: lin(1.1, .62, 1.35), element: { spike: 0xf6e8ff, rim: 0x8a4ad8, light: 0xb478ff, ink: 0x14062a }, shell: 0xc58aff, edge: 0x4a1a8a, flame: -1, dark: false, heart: 0 };
const HEAVY = SHINJI_MOVES.heavy, SPECIAL = SHINJI_MOVES.special, ULT = SHINJI_MOVES.ultimate;
const FIRST = ULT.contacts[0], LAST = ULT.contacts[ULT.contacts.length - 1];
const ARC = .2, STAND = .16, BEAM = .5;
const BROKEN = 0, CROSSED = 1, SHOT = 2;
type Rupture = { actor: string; target: string; seq: number; final: boolean; floor: number };
type Mark = { kind: number; born: number; life: number; size: number; seed: number; at: THREE.Vector3; dir: THREE.Vector3; from: THREE.Vector3; floor: number; live: boolean };

export class ShinjiATField {
  private readonly stage: MoveStage;
  private ruptures: Rupture[] = Array.from({ length: SHINJI_AT_LIMITS.ruptures }, () => ({ actor: '', target: '', seq: -1, final: false, floor: 0 }));
  private marks: Mark[] = Array.from({ length: SHINJI_AT_LIMITS.marks }, () => ({ kind: 0, born: -1e9, life: 0, size: 1, seed: 0, at: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, 1), from: new THREE.Vector3(), floor: 0, live: false }));
  private seen = new Float64Array(128).fill(-1); private seenAt = new Float64Array(128).fill(-1);
  private cursor = 0; private ruptureCursor = 0; private markCursor = 0; private disposed = false;
  private p = new THREE.Vector3(); private a = new THREE.Vector3(); private b = new THREE.Vector3(); private c = new THREE.Vector3(); private d = new THREE.Vector3();
  private heading = new THREE.Vector3(); private side = new THREE.Vector3(); private dir = new THREE.Vector3(); private ground = new THREE.Vector3();
  private strike = new THREE.Vector3(); private across = new THREE.Vector3();
  constructor(scene: THREE.Scene, kit: Pick<VfxKit, 'budget'> & Partial<VfxKit>) { this.stage = MoveStage.for(scene, kit); }
  load(_ids: readonly string[]): Promise<void> { return Promise.resolve(); }
  private cancel(id: string, victim = false) { for (const r of this.ruptures) if (r.actor === id || victim && r.target === id && !r.final) r.actor = ''; }
  private mark(kind: number, at: THREE.Vector3, dir: THREE.Vector3, floor: number, born: number, life: number, size: number) {
    const m = this.marks[this.markCursor++ % this.marks.length];
    m.kind = kind; m.at.copy(at); m.dir.copy(dir); m.floor = floor; m.born = born; m.life = life; m.size = size; m.seed = (Math.abs(at.x * 9.1 + at.z * 6.3 + born * 3.9)) % 67; m.live = true;
    return m;
  }

  handle(e: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    if (this.disposed) return;
    if (e.kind === 'eliminated' || e.kind === 'respawn') { this.cancel(e.actorId, true); return; }
    if (!isShinjiATField(e.fighter)) return;
    if (e.kind === 'whiff' || e.kind === 'rejected') { this.cancel(e.actorId); return; }
    if (e.kind !== 'hit' && e.kind !== 'confirm') return;
    for (let i = 0; i < this.seen.length; i++) if (this.seen[i] === e.id && this.seenAt[i] === e.serverTime) return;
    const index = this.cursor++ % this.seen.length; this.seen[index] = e.id; this.seenAt[index] = e.serverTime;
    const actor = fighters?.get(e.actorId), victim = e.targetId ? fighters?.get(e.targetId) : undefined, seq = e.actionSeq ?? actor?.state.actionSeq ?? -1;
    let floor = blowFloor(actor, victim, Infinity);
    if (e.kind === 'confirm') {
      if (e.slot === 'ultimate' && !e.branch && e.targetId) Object.assign(this.ruptures[this.ruptureCursor++ % this.ruptures.length], { actor: e.actorId, target: e.targetId, seq, final: false, floor: Number.isFinite(floor) ? floor : 0 });
      return;
    }
    if (!victim && !e.endpoint) return;
    const final = e.slot === 'ultimate' && !e.branch && e.contactIndex === ULT.contacts.length - 1, point = this.p, st = this.stage, t = e.serverTime;
    if (victim && !(final && e.endpoint)) bodyCentre(victim, point); else point.set(e.endpoint!.x, e.endpoint!.y, e.endpoint!.z);
    if (!Number.isFinite(floor)) floor = point.y - 1.05;
    let confirmed = false;
    if (final) for (const r of this.ruptures) if (r.actor === e.actorId && r.seq === seq) { r.final = true; floor = r.floor; confirmed = true; }
    if (final && !confirmed) return;
    const dir = this.dir;
    if (actor) { dir.subVectors(point, actor.group.position).setY(0); if (dir.lengthSq() < .01) dir.set(Math.sin(actor.state.yaw ?? 0), 0, Math.cos(actor.state.yaw ?? 0)); dir.normalize(); } else dir.set(0, 0, 1);
    const ground = this.ground.set(point.x, floor, point.z);
    if (e.slot === 'light') { this.mark(BROKEN, point, dir, floor, t, .28, .7); st.burst(point, FIELD, .36, t, { dir, floor, clean: true }); return; }
    if (e.slot === 'heavy') {
      const big = e.branch ? .85 : 1;
      this.mark(BROKEN, point, dir, floor, t, .32, 1.25 * big);
      st.burst(point, FIELD, .58 * big, t, { dir, floor });
      st.shock(ground, FIELD, 4 * big, t, .4);
      st.erupt(this.a.copy(ground).addScaledVector(dir, 1.7), UP, FIELD, .28 * big, 4.5 * big, t + .03, .26);
      return;
    }
    if (e.slot === 'special') {
      if (e.branch === 'airSpecial') { st.burst(point, FIELD, 2, t, { floor }); st.shock(ground, FIELD, 4.5, t, .45); st.scar(ground, FIELD, 3, t, 1.8); return; }
      const big = e.branch ? .7 : 1;
      this.mark(BROKEN, point, dir, floor, t, .7, 3.1 * big);
      st.burst(point, FIELD, 1.9 * big, t, { dir, floor });
      st.shatter(point, dir, FIELD, 3 * big, t + STAND, .55);
      st.shock(ground, FIELD, 5.5 * big, t, .45);
      st.erupt(this.a.copy(ground).addScaledVector(dir, .8), UP, FIELD, .5 * big, 6 * big, t + .06, .55);
      st.scar(ground, FIELD, 2.6 * big, t + .1, 1.9);
      return;
    }
    if (e.slot !== 'ultimate' || e.branch) return;
    if (!final) { this.mark(BROKEN, point, dir, floor, t, .4, 1.2); st.burst(point, FIELD, 1, t, { dir, floor }); return; }
    if (involvesLocal(e.actorId, e.targetId)) SIGNATURE.screen?.impactFrame?.(.5, point);
    const shot = this.mark(SHOT, point, dir, floor, t, BEAM, 1);
    if (actor) shot.from.copy(actor.handR).lerp(actor.handL, .5).addScaledVector(dir, .5); else shot.from.copy(point).addScaledVector(dir, -2.2);
    this.mark(CROSSED, ground, dir, floor, t + .12, 1, 1);
    st.shatter(point, dir, FIELD, 6.5, t, .8);
    st.burst(point, CROSS, 2.4, t, { dir, floor });
    st.erupt(ground, UP, CROSS, 1.1, 14, t + .12, .9);
    st.shock(ground, CROSS, 10, t, .6);
    st.scar(ground, CROSS, 4.5, t + .2, 2.2);
  }

  update(time: number, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>) {
    if (this.disposed) return;
    const st = this.stage.open(time);
    for (const f of fighters.values()) {
      const s = f.state; if (!isShinjiATField(s.fighter) || !s.alive) continue;
      if (s.action === 'awaken') { this.awakening(f, time); continue; }
      if (s.whiffedAt !== undefined || (s.action !== 'light' && s.action !== 'heavy' && s.action !== 'special' && s.action !== 'ultimate')) continue;
      const elapsed = s.actionTime * s.actionDuration, seed = (s.actionSeq ?? 0) * 6.3, feet = f.group.position, heading = this.face(f), side = this.side, strike = f.strikePoint(this.strike);
      if (s.action === 'light') {
        const k = Math.sin(clamp(s.actionTime) * Math.PI);
        nested(st, this.p.copy(strike).addScaledVector(heading, .12), side, UP, .34, 8, 2, .035, FIELD, 1, .9 * k, Math.PI / 8, time);
        st.glow(strike, .26, FIELD.main, .6 * k); st.light(strike, 2.3, FIELD, .25 * k);
      } else if (s.action === 'heavy') {
        const contact = s.branch ? s.actionDuration * .55 : HEAVY.contacts[0];
        if (elapsed < contact) { const k = clamp(elapsed / contact); st.charge(strike, FIELD, .18, k, seed); nested(st, strike, side, UP, .3 + .25 * k, 8, 2, .035, FIELD, 1, .8 * k, Math.PI / 8, time); }
        else if (elapsed < contact + ARC) {
          const w = (elapsed - contact) / ARC, cut = clamp(w / .35), fade = 1 - w * w;
          this.p.copy(feet).addScaledVector(heading, .2).setY(feet.y + 1.3);
          this.c.copy(heading).multiplyScalar(.8).addScaledVector(side, .6).normalize(); this.d.copy(UP).addScaledVector(side, -.62).normalize();
          sweep(st, this.p, this.c, this.d, 2.1, 1.7 - 2.3 * cut, 1.7, .26, FIELD, 1.4 * fade, 11);
          st.light(this.a.copy(this.p).addScaledVector(heading, .9).setY(feet.y + .5), 4, FIELD, .3 * fade);
        }
      } else if (s.action === 'special' && !s.branch) {
        const release = SPECIAL.contacts[0];
        if (elapsed < release) {
          const k = clamp(elapsed / release);
          nested(st, this.p.copy(strike).addScaledVector(heading, .35), side, UP, .5 + 1.4 * k, 8, 5, .05, FIELD, k * 1.4, .95, Math.PI / 8, time);
          st.charge(strike, FIELD, .3, k, seed);
        }
      } else if (s.action === 'ultimate' && !s.branch && s.confirmedAt === undefined && elapsed < FIRST + .12) {
        const k = clamp(elapsed / FIRST);
        st.charge(strike, FIELD, .26, k, seed); nested(st, strike, side, UP, .3 + .3 * k, 8, 2, .035, FIELD, 1, .8 * k, Math.PI / 8, time);
      }
    }
    for (const flight of flights.values()) {
      if (!isShinjiATField(flight.fighter) || flight.slot !== 'special' || flight.branch || !flight.released) continue;
      const across = this.across.set(flight.heading.z, 0, -flight.heading.x);
      if (across.lengthSq() < 1e-6) across.set(1, 0, 0); else across.normalize();
      nested(st, flight.position, across, UP, 2, 8, 5, .06, FIELD, 1, 1.1, Math.PI / 8, time);
      for (let i = 1; i <= 2; i++) nested(st, this.p.copy(flight.position).addScaledVector(flight.heading, -i * 1.1), across, UP, 2 - i * .55, 8, 2, .045, FIELD, 1, .7 - i * .2, Math.PI / 8, time);
      st.glow(flight.position, 1.5, FIELD.main, .4); st.glow(flight.position, .5, FIELD.core, .7, STAR, .2, Math.floor(time * 24));
      st.light(this.p.copy(flight.position).setY(flight.position.y + .2), 6.5, FIELD, 1);
    }
    for (const r of this.ruptures) {
      if (!r.actor) continue;
      const actor = fighters.get(r.actor), victim = fighters.get(r.target), s = actor?.state;
      if (!actor || !s?.alive || !victim?.state.alive && !r.final || s.action !== 'ultimate' || s.branch || (s.actionSeq ?? -1) !== r.seq || s.whiffedAt !== undefined) { r.actor = ''; continue; }
      const elapsed = s.actionTime * s.actionDuration;
      if (elapsed > ULT.duration) { r.actor = ''; continue; }
      if (!r.final && elapsed < LAST && victim) this.rupture(actor, victim, r, elapsed, time);
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

  private rupture(actor: Fighter, victim: Fighter, r: Rupture, elapsed: number, time: number) {
    const st = this.stage, g = clamp((elapsed - FIRST) / (LAST - FIRST)), seed = r.seq * 2.3, feet = actor.group.position, heading = this.face(actor);
    const prey = bodyCentre(victim, this.c);
    this.dir.subVectors(prey, feet).setY(0); if (this.dir.lengthSq() < .01) this.dir.copy(heading); this.dir.normalize();
    const across = this.across.set(this.dir.z, 0, -this.dir.x), gap = .1 + 1.5 * g * g, radius = 2.3 + .7 * g, open = clamp((elapsed - FIRST) / .3), shake = Math.sin(time * 47) * .03 * g;
    st.dim(.3 + .45 * g, r.actor, r.target);
    nested(st, this.a.copy(prey).addScaledVector(across, gap + shake), across, UP, radius, 8, 6, .06, FIELD, open, .95, 0, time, 6, 4);
    nested(st, this.b.copy(prey).addScaledVector(across, -gap - shake), across, UP, radius, 8, 6, .06, FIELD, open, .95, 0, time, 2, 4);
    this.p.copy(prey); this.p.y -= radius * g; this.d.copy(prey); this.d.y += radius * g;
    st.streak(this.p, this.d, .1 + .3 * g, POSITRON.main, .5 + .7 * g); st.streak(this.p, this.d, .04 + .1 * g, POSITRON.core, 1.2 * g);
    st.glow(prey, .5 + 1.1 * g, POSITRON.core, .35 + .4 * g); st.light(this.p.copy(prey).setY(prey.y + .4), 6 + 2 * g, FIELD, .3 + .3 * g);
    for (let i = -1; i <= 1; i += 2) bolt(st, i > 0 ? actor.handR : actor.handL, this.p.copy(prey).addScaledVector(across, i * (gap + .1)).setY(prey.y + .2 * i), .045, FIELD.core, .5 + .5 * g, Math.floor(time * 24) + i, .22, 5, 0);
    st.charge(actor.handR, FIELD, .18 + .12 * g, Math.max(.35, g), seed);
    if (g > .8) st.speed(.5 * (g - .8) / .2, r.actor, r.target);
  }

  private drawMark(m: Mark, age: number, time: number) {
    const st = this.stage, w = age / m.life, across = this.across.set(m.dir.z, 0, -m.dir.x);
    if (m.kind === BROKEN) {
      const open = clamp(age / .05), broke = clamp((age - STAND) / Math.max(.05, m.life - STAND)), fade = 1 - broke * broke;
      nested(st, m.at, across, UP, m.size * (1 + .45 * broke), 8, m.size > 2.5 ? 6 : m.size > 1.3 ? 4 : m.size > 1 ? 3 : 2, m.size > 1.3 ? .045 + m.size * .012 : .04, FIELD, open, 1.25 * fade, Math.PI / 8 + broke * .25, time);
      st.glow(m.at, m.size * .9, FIELD.main, .3 * fade); st.glow(m.at, m.size * .3, FIELD.core, .7 * (1 - clamp(age / .12)), STAR, .2, m.seed);
      if (m.size > 1.3) st.light(m.at, Math.min(8, m.size * 1.6 + 2), FIELD, .45 * fade);
      return;
    }
    if (m.kind === SHOT) {
      st.beam(m.from, this.p.copy(m.at).addScaledVector(m.dir, 16), .6, POSITRON, w, m.seed, .4);
      return;
    }
    const rise = clamp(age / .1), fade = w < .45 ? 1 : 1 - (w - .45) / .55, reach = (.5 + 5.5 * m.size) * rise;
    this.p.set(m.at.x, m.floor + 1.5 + 1.4 * m.size, m.at.z);
    this.a.copy(this.p).addScaledVector(across, -reach); this.b.copy(this.p).addScaledVector(across, reach);
    st.streak(this.a, this.b, .85 * m.size * (.5 + .5 * fade), CROSS.main, 1.1 * fade); st.streak(this.a, this.b, .34 * m.size * (.5 + .5 * fade), CROSS.core, 1.3 * fade);
    st.glow(this.p, 2.4 * m.size, CROSS.core, .8 * fade); st.glow(this.p, 4.5 * m.size, CROSS.main, .35 * fade);
  }

  private awakening(f: Fighter, time: number) {
    const st = this.stage, w = clamp(f.state.actionTime), release = .64, pre = w < release, phase = pre ? clamp(w / release) : clamp((w - release) / (1 - release)), fade = pre ? Math.sin(phase * Math.PI * .5) * .55 : 1 - phase;
    if (fade <= .02) return;
    const heading = this.face(f), feet = f.group.position, radius = pre ? 1.5 - phase * .8 : .7 + phase * 3.6;
    st.disc(this.p.copy(feet), radius, FIELD.core, fade * .85, WAVE, .96);
    nested(st, this.p.copy(feet).addScaledVector(heading, .3).setY(feet.y + 1.45), this.side, UP, .18 + fade * .2, 8, 2, .03, FIELD, 1, fade, Math.PI / 8, time);
    for (let i = 0, n = st.n(8, 4); i < n; i++) {
      const theta = i * Math.PI * 2 / n, r = Math.min(radius, 1.6);
      this.a.copy(feet).addScaledVector(this.side, Math.cos(theta) * r).addScaledVector(heading, Math.sin(theta) * r); this.a.y += .06;
      st.streak(this.a, this.b.copy(this.a).setY(this.a.y + .3 + fade * .5), .04, i % 2 ? FIELD.main : CROSS.main, fade * .9);
    }
    st.light(this.p.copy(feet).setY(feet.y + 1.2), 3.5, FIELD, .4 * fade);
  }
  reset() {
    for (const r of this.ruptures) r.actor = ''; for (const m of this.marks) m.live = false;
    this.seen.fill(-1); this.seenAt.fill(-1); this.cursor = this.ruptureCursor = this.markCursor = 0; this.stage.reset();
  }
  dispose() { if (this.disposed) return; this.reset(); this.disposed = true; this.stage.release(); }
}
