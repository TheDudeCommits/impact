import * as THREE from 'three';
import type { CombatEvent } from '../../game/types';
import { KAIJU_AWAKENING, KAIJU_MOVES } from '../../game/fighters/kaiju-no-8';
import type { Fighter } from '../Fighter';
import type { Flight } from '../CombatEffects';
import { bodyCentre, type VfxKit } from '../vfx/VfxKit';
import { SIGNATURE, involvesLocal } from './context';
import { RING, STAR } from './GlowBatch';
import { MoveStage, WAVE, type StageLook } from './MoveStage';
import { bolt } from './StageStrokes';

export const KAIJU_FORTITUDE_ASSETS: readonly string[] = Object.freeze([]);
export const KAIJU_FORTITUDE_LIMITS = Object.freeze({ marks: 10, outputs: 6 });
export const isKaijuFortitude = (id: string | undefined) => id === 'kaiju-no-8';
const UP = new THREE.Vector3(0, 1, 0);
const lin = (r: number, g: number, b: number) => new THREE.Color(r, g, b);
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const hash = (x: number) => { const v = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
const CORE: StageLook = { core: lin(2.8, 3.15, 3.3), main: lin(.42, 1.7, 1.95), rim: lin(.1, .42, .52), light: lin(.72, 1.14, 1.22), element: { spike: 0xe7fff8, rim: 0x61ead0, light: 0x9cf2e6, ink: 0x061618 }, shell: 0x9cf2e6, edge: 0x1d6a70, flame: -1, dark: false, heart: .5 };
const HEAVY = KAIJU_MOVES.heavy, SPECIAL = KAIJU_MOVES.special, ULT = KAIJU_MOVES.ultimate;
const FIRST = ULT.contacts[0], LAST = ULT.contacts[ULT.contacts.length - 1];
type Output = { actor: string; target: string; seq: number; final: boolean; floor: number };
type Mark = { born: number; life: number; size: number; reach: number; at: THREE.Vector3; dir: THREE.Vector3; live: boolean };

export class KaijuFortitude {
  private readonly stage: MoveStage;
  private outputs: Output[] = Array.from({ length: KAIJU_FORTITUDE_LIMITS.outputs }, () => ({ actor: '', target: '', seq: -1, final: false, floor: 0 }));
  private marks: Mark[] = Array.from({ length: KAIJU_FORTITUDE_LIMITS.marks }, () => ({ born: -1e9, life: 0, size: 1, reach: 1, at: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, 1), live: false }));
  private seen = new Float64Array(128).fill(-1); private seenTime = new Float64Array(128).fill(-1);
  private cursor = 0; private outputCursor = 0; private markCursor = 0; private disposed = false;
  private p = new THREE.Vector3(); private a = new THREE.Vector3(); private b = new THREE.Vector3(); private c = new THREE.Vector3();
  private heading = new THREE.Vector3(); private dir = new THREE.Vector3(); private ground = new THREE.Vector3(); private strike = new THREE.Vector3();
  constructor(scene: THREE.Scene, kit: Pick<VfxKit, 'budget'> & Partial<VfxKit>) { this.stage = MoveStage.for(scene, kit); }
  load(_ids: readonly string[]): Promise<void> { return Promise.resolve(); }
  private cancel(id: string, victim = false) { for (const o of this.outputs) if (o.actor === id || victim && o.target === id && !o.final) o.actor = ''; }
  private through(at: THREE.Vector3, dir: THREE.Vector3, born: number, life: number, size: number, reach: number) {
    const m = this.marks[this.markCursor++ % this.marks.length];
    m.at.copy(at); m.dir.copy(dir).normalize(); m.born = born; m.life = life; m.size = size; m.reach = reach; m.live = true;
  }

  handle(e: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    if (this.disposed) return;
    if (e.kind === 'eliminated' || e.kind === 'respawn') { this.cancel(e.actorId, true); return; }
    if (!isKaijuFortitude(e.fighter)) return;
    if (e.kind === 'whiff' || e.kind === 'rejected') { this.cancel(e.actorId); return; }
    if (e.kind !== 'hit' && e.kind !== 'confirm') return;
    for (let i = 0; i < this.seen.length; i++) if (this.seen[i] === e.id && this.seenTime[i] === e.serverTime) return;
    const index = this.cursor++ % this.seen.length; this.seen[index] = e.id; this.seenTime[index] = e.serverTime;
    const actor = fighters?.get(e.actorId), victim = e.targetId ? fighters?.get(e.targetId) : undefined, seq = e.actionSeq ?? actor?.state.actionSeq ?? -1;
    let floor = Math.min(actor?.group.position.y ?? Infinity, victim?.group.position.y ?? Infinity);
    if (e.kind === 'confirm') {
      if (e.slot === 'ultimate' && !e.branch && e.targetId) Object.assign(this.outputs[this.outputCursor++ % this.outputs.length], { actor: e.actorId, target: e.targetId, seq, final: false, floor: Number.isFinite(floor) ? floor : 0 });
      return;
    }
    if (!victim && !e.endpoint) return;
    const final = e.slot === 'ultimate' && !e.branch && e.contactIndex === ULT.contacts.length - 1, point = this.p, st = this.stage, t = e.serverTime;
    if (e.endpoint) point.set(e.endpoint.x, e.endpoint.y, e.endpoint.z); else bodyCentre(victim!, point);
    if (!Number.isFinite(floor)) floor = point.y - 1.05;
    let confirmed = false;
    if (final) for (const o of this.outputs) if (o.actor === e.actorId && o.seq === seq) { o.final = true; floor = o.floor; confirmed = true; }
    if (final && !confirmed) return;
    const dir = this.dir;
    if (actor) { dir.subVectors(point, actor.group.position).setY(0); if (dir.lengthSq() < .01) dir.set(Math.sin(actor.state.yaw ?? 0), 0, Math.cos(actor.state.yaw ?? 0)); dir.normalize(); } else dir.set(0, 0, 1);
    const past = this.a.copy(point).addScaledVector(dir, .6), ground = this.ground.set(past.x, floor, past.z);
    if (e.slot === 'light') { st.burst(point, CORE, .38, t, { dir, floor, clean: true }); return; }
    if (e.slot === 'heavy') {
      const big = e.branch ? .85 : 1;
      this.through(this.b.copy(past).setY(point.y + 1.3), UP, t, .3, .6 * big, 2.2 * big);
      st.burst(past, CORE, .42 * big, t, { dir, floor });
      st.shock(ground, CORE, 3.8 * big, t, .4);
      return;
    }
    if (e.slot === 'special') {
      if (e.branch === 'airSpecial') { st.burst(point, CORE, 2, t, { floor }); st.shock(ground, CORE, 4.5, t, .45); st.scar(ground, CORE, 3, t, 1.8); return; }
      const big = e.branch ? .7 : 1;
      this.through(past, this.b.copy(dir).setY(.08), t, .6, .9 * big, 7 * big);
      st.burst(past, CORE, 1.5 * big, t, { dir, floor });
      st.erupt(this.c.copy(past).addScaledVector(dir, .3), this.b, CORE, .5 * big, 7 * big, t, .42);
      st.shock(ground, CORE, 5.5 * big, t, .45);
      st.scar(this.c.copy(ground).addScaledVector(dir, 2.2), CORE, 2.2 * big, t + .08, 1.7);
      return;
    }
    if (e.slot !== 'ultimate' || e.branch) return;
    if (!final) {
      st.burst(e.contactIndex ? past : point, CORE, e.contactIndex ? 1.2 : .9, t, { dir, floor });
      if (e.contactIndex) { this.through(past, this.b.copy(dir).setY(.08), t, .5, .8, 4.5); st.shock(ground, CORE, 5, t, .5); }
      return;
    }
    if (involvesLocal(e.actorId, e.targetId)) SIGNATURE.screen?.impactFrame?.(.5, point);
    this.through(past, this.b.copy(dir).setY(.06), t, .9, 1.3, 13);
    st.burst(past, CORE, 2.3, t, { dir, floor });
    st.erupt(this.c.copy(past).addScaledVector(dir, .3), this.b, CORE, 1, 14, t, .6);
    st.shatter(past, dir, CORE, 6, t, .7);
    st.dome(past, CORE, 5, t, .45);
    st.shock(ground, CORE, 10, t, .6);
    st.scar(this.c.copy(ground).addScaledVector(dir, 2.5), CORE, 3, t + .1, 2.1);
    st.scar(this.c.copy(ground).addScaledVector(dir, 6.5), CORE, 2.2, t + .18, 1.8);
  }

  update(time: number, fighters: ReadonlyMap<string, Fighter>, _flights?: ReadonlyMap<string, Flight>) {
    if (this.disposed) return;
    const st = this.stage.open(time);
    for (const f of fighters.values()) {
      const s = f.state; if (!isKaijuFortitude(s.fighter) || !s.alive) continue;
      if (s.action === 'awaken') { this.entry(f, time); continue; }
      if (s.whiffedAt !== undefined || (s.action !== 'light' && s.action !== 'heavy' && s.action !== 'special' && s.action !== 'ultimate')) continue;
      const elapsed = s.actionTime * s.actionDuration, seed = (s.actionSeq ?? 0) * 6.9, feet = f.group.position, heading = this.face(f), strike = f.strikePoint(this.strike), tick = Math.floor(time * 30);
      if (s.action === 'light') {
        const k = Math.sin(clamp(s.actionTime) * Math.PI);
        st.glow(strike, .26, CORE.main, .6 * k); st.glow(strike, .12, CORE.core, .8 * k); st.light(strike, 2.3, CORE, .25 * k);
      } else if (s.action === 'heavy') {
        const contact = s.branch ? s.actionDuration * .55 : HEAVY.contacts[0];
        if (elapsed < contact) { const k = clamp(elapsed / contact); st.glow(strike, .2 + .12 * k, CORE.main, .5 + .4 * k); st.glow(strike, .14, CORE.core, k, STAR, .2, tick); st.light(strike, 2.8, CORE, .3 * k); }
        else if (elapsed < contact + .22) {
          const flare = 1 - (elapsed - contact) / .22;
          st.column(this.a.copy(strike).addScaledVector(heading, .3), UP, .24, .5 + 1.4 * flare, CORE, flare, seed);
        }
      } else if (s.action === 'special' && !s.branch) {
        const release = SPECIAL.contacts[0];
        if (elapsed < release) {
          const k = clamp(elapsed / release);
          st.cracks(this.a.copy(feet).setY(feet.y + .06), UP, .8 + 1.6 * k, CORE, k, seed, .8);
          st.glow(strike, .22 + .2 * k, CORE.main, .5 + .4 * k); st.glow(strike, .12 + .1 * k, CORE.core, k, STAR, .2, tick);
          for (let i = 0; i < 2; i++) bolt(st, this.b.copy(strike).addScaledVector(heading, -.6).setY(strike.y + (i ? .35 : -.35)), strike, .035, CORE.main, k, tick + i * 7, .14, 4, CORE.heart);
          st.light(this.b.copy(strike).addScaledVector(heading, .4), 3.4, CORE, .2 + .3 * k);
        } else if (elapsed < release + .2) {
          const flare = 1 - (elapsed - release) / .2;
          st.column(this.a.copy(strike).addScaledVector(heading, .2), this.b.copy(heading).setY(.08).normalize(), .26, .6 + 1.6 * flare, CORE, flare, seed);
        }
      } else if (s.action === 'ultimate' && !s.branch && s.confirmedAt === undefined && elapsed < FIRST + .12) {
        const k = clamp(elapsed / FIRST);
        st.glow(strike, .2 + .14 * k, CORE.main, .5 + .4 * k); st.glow(strike, .14, CORE.core, k, STAR, .2, tick); st.light(strike, 3, CORE, .3 * k);
      }
    }
    for (const o of this.outputs) {
      if (!o.actor) continue;
      const actor = fighters.get(o.actor), victim = fighters.get(o.target), s = actor?.state;
      if (!actor || !s?.alive || !victim?.state.alive && !o.final || s.action !== 'ultimate' || s.branch || (s.actionSeq ?? -1) !== o.seq || s.whiffedAt !== undefined) { o.actor = ''; continue; }
      const elapsed = s.actionTime * s.actionDuration;
      if (elapsed > ULT.duration) { o.actor = ''; continue; }
      if (!o.final && elapsed < LAST) this.gather(actor, o, elapsed, time);
    }
    for (const m of this.marks) {
      if (!m.live) continue;
      const age = time - m.born;
      if (age >= m.life) { m.live = false; continue; }
      if (age < 0) continue;
      const w = age / m.life, fade = (1 - w) * (1 - w), n = m.reach > 9 ? 6 : m.reach > 5 ? 4 : 3, front = m.reach * (1 - (1 - w) * (1 - w));
      for (let i = 0; i < n; i++) {
        const along = front * (i + 1) / n;
        st.glow(this.a.copy(m.at).addScaledVector(m.dir, along), m.size * (1 + along * .22) * (1 + .6 * w), i % 2 ? CORE.main : CORE.core, (i % 2 ? .9 : .7) * fade, RING, .05, 0, .86);
      }
      st.light(this.a.copy(m.at).addScaledVector(m.dir, front * .6), 4 + m.size * 2, CORE, .5 * fade);
    }
    st.close();
  }

  private face(f: Fighter) { const yaw = f.state.yaw ?? f.group.rotation.y; return this.heading.set(Math.sin(yaw), 0, Math.cos(yaw)); }

  private gather(actor: Fighter, o: Output, elapsed: number, time: number) {
    const st = this.stage, g = clamp((elapsed - FIRST) / (LAST - FIRST)), seed = o.seq * 2.3, feet = this.ground.copy(actor.group.position).setY(o.floor), tick = Math.floor(time * 30);
    st.dim(.3 + .45 * g, o.actor, o.target);
    st.cracks(this.a.copy(feet).setY(o.floor + .06), UP, 1.4 + 3.4 * g, CORE, 1, seed, .5 + .4 * g);
    for (let i = 0, n = st.n(8, 4); i < n; i++) {
      const slot = Math.floor((tick + i * 2) / 3), ang = hash(seed + i * 4.1 + slot * 1.3) * Math.PI * 2, r = 1.9 + .7 * hash(i + slot), tall = (1.2 + 2 * g) * (.5 + .5 * hash(i * 3 + slot));
      this.a.set(feet.x + Math.cos(ang) * r, o.floor + .05, feet.z + Math.sin(ang) * r); this.b.set(this.a.x + Math.cos(ang) * .3, o.floor + tall, this.a.z + Math.sin(ang) * .3);
      bolt(st, this.a, this.b, .05, CORE.main, .6 + .4 * g, tick + i * 11, tall * .16, 5, CORE.heart);
    }
    st.light(this.a.copy(feet).setY(o.floor + .8), 6 + 2 * g, CORE, .28 + .3 * g);
    const strike = actor.strikePoint(this.strike);
    st.glow(strike, .22 + .16 * g, CORE.main, .6 + .3 * g); st.glow(strike, .14 + .1 * g, CORE.core, .7 + .3 * g, STAR, .2, tick);
    if (g > .8) st.speed(.5 * (g - .8) / .2, o.actor, o.target);
  }

  private entry(f: Fighter, time: number) {
    const st = this.stage, w = clamp(f.state.actionTime), B = KAIJU_AWAKENING.beats, tick = Math.floor(time * 30), feet = f.group.position;
    if (w < B.crossedGuard || w > .97) return;
    const fade = clamp((w - B.crossedGuard) / .1) * clamp((.97 - w) / .12), k = clamp((w - B.crossedGuard) / (B.release - B.crossedGuard));
    for (let i = 0, n = st.n(5, 3); i < n; i++) {
      const slot = Math.floor((tick + i * 2) / 3), ang = hash(i * 4.1 + slot * 1.3) * Math.PI * 2, r = .8 - .25 * k;
      this.a.set(feet.x + Math.cos(ang) * r, feet.y + .1, feet.z + Math.sin(ang) * r); this.b.set(feet.x + Math.cos(ang + .8) * r * .8, feet.y + 1 + 1.1 * hash(i + slot), feet.z + Math.sin(ang + .8) * r * .8);
      bolt(st, this.a, this.b, .035, CORE.main, fade * (.5 + .5 * k), tick + i * 11, .2, 5, CORE.heart);
    }
    if (w > B.release) { const u = clamp((w - B.release) / (B.roar - B.release)); st.disc(this.p.copy(feet), .6 + u * 4, CORE.core, (1 - u) * .8, WAVE, .96); for (let i = 0; i < 4; i++) st.glow(this.a.set(feet.x + Math.cos(i * 1.6) * .6, feet.y + .4 + u * (1.4 + .3 * i), feet.z + Math.sin(i * 1.6) * .6), .3 + .2 * u, CORE.main, .25 * (1 - u)); }
    st.light(this.p.copy(feet).setY(feet.y + 1), 3.5, CORE, .4 * fade);
  }
  reset() {
    for (const o of this.outputs) o.actor = ''; for (const m of this.marks) m.live = false;
    this.seen.fill(-1); this.seenTime.fill(-1); this.cursor = this.outputCursor = this.markCursor = 0; this.stage.reset();
  }
  dispose() { if (this.disposed) return; this.reset(); this.disposed = true; this.stage.release(); }
}
