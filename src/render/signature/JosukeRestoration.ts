import * as THREE from 'three';
import type { CombatEvent } from '../../game/types';
import { JOSUKE_MOVES } from '../../game/fighters/josuke';
import type { Fighter } from '../Fighter';
import type { Flight } from '../CombatEffects';
import { bodyCentre, type VfxKit } from '../vfx/VfxKit';
import { SIGNATURE, involvesLocal } from './context';
import { STAR } from './GlowBatch';
import { MoveStage, WAVE, type StageLook } from './MoveStage';
import { fistRush } from './StandRush';

export const isJosukeRestoration = (id: string | undefined) => id === 'josuke';
export const JOSUKE_RESTORATION_LIMITS = Object.freeze({ marks: 10, assemblies: 8 });
const UP = new THREE.Vector3(0, 1, 0);
const lin = (r: number, g: number, b: number) => new THREE.Color(r, g, b);
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const hash = (x: number) => { const v = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
const DIAMOND: StageLook = { core: lin(3.3, 2.7, 3.05), main: lin(2.1, .68, 1.3), rim: lin(.7, .2, .5), light: lin(1.3, .76, 1.02), element: { spike: 0xfaf6ff, rim: 0xf086b5, light: 0xff9cc8, ink: 0x1e0a16 }, shell: 0xf086b5, edge: 0x7a2a58, flame: -1, dark: false, heart: 0 };
const MEND: StageLook = { core: lin(3.3, 2.95, 2), main: lin(2.2, 1.25, .78), rim: lin(.8, .4, .26), light: lin(1.32, 1.02, .68), element: { spike: 0xfff4d8, rim: 0xffb070, light: 0xffc890, ink: 0x1e1206 }, shell: 0xffc890, edge: 0x8a4a2a, flame: -1, dark: false, heart: 0 };
const HEAVY = JOSUKE_MOVES.heavy, SPECIAL = JOSUKE_MOVES.special, ULT = JOSUKE_MOVES.ultimate;
const FIRST = ULT.contacts[0], LAST = ULT.contacts[ULT.contacts.length - 1], RUSH = SPECIAL.contacts[0], RUSH_END = SPECIAL.contacts[SPECIAL.contacts.length - 1];
type Assembly = { actor: string; target: string; seq: number; final: boolean; floor: number };
type Mark = { born: number; life: number; size: number; seed: number; at: THREE.Vector3; live: boolean };

export class JosukeRestoration {
  private readonly stage: MoveStage;
  private assemblies: Assembly[] = Array.from({ length: JOSUKE_RESTORATION_LIMITS.assemblies }, () => ({ actor: '', target: '', seq: -1, final: false, floor: 0 }));
  private marks: Mark[] = Array.from({ length: JOSUKE_RESTORATION_LIMITS.marks }, () => ({ born: -1e9, life: 0, size: 1, seed: 0, at: new THREE.Vector3(), live: false }));
  private seen = new Float64Array(128).fill(-1); private seenTime = new Float64Array(128).fill(-1);
  private cursor = 0; private assemblyCursor = 0; private markCursor = 0; private disposed = false;
  private p = new THREE.Vector3(); private a = new THREE.Vector3(); private b = new THREE.Vector3(); private c = new THREE.Vector3();
  private heading = new THREE.Vector3(); private dir = new THREE.Vector3(); private ground = new THREE.Vector3(); private strike = new THREE.Vector3(); private prey = new THREE.Vector3();
  constructor(scene: THREE.Scene, kit: Pick<VfxKit, 'budget'> & Partial<VfxKit>) { this.stage = MoveStage.for(scene, kit); }
  load(_ids: readonly string[]): Promise<void> { return Promise.resolve(); }
  private cancel(id: string, victim = false) { for (const a of this.assemblies) if (a.actor === id || victim && a.target === id && !a.final) a.actor = ''; }
  private mend(at: THREE.Vector3, born: number, life: number, size: number) {
    const m = this.marks[this.markCursor++ % this.marks.length];
    m.at.copy(at); m.born = born; m.life = life; m.size = size; m.seed = (Math.abs(at.x * 6.7 + at.z * 5.3 + born * 3.9)) % 59; m.live = true;
  }

  handle(e: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    if (this.disposed) return;
    if (e.kind === 'eliminated' || e.kind === 'respawn') { this.cancel(e.actorId, true); return; }
    if (!isJosukeRestoration(e.fighter)) return;
    if (e.kind === 'whiff' || e.kind === 'rejected') { this.cancel(e.actorId); return; }
    if (e.kind !== 'hit' && e.kind !== 'confirm') return;
    for (let i = 0; i < this.seen.length; i++) if (this.seen[i] === e.id && this.seenTime[i] === e.serverTime) return;
    const index = this.cursor++ % this.seen.length; this.seen[index] = e.id; this.seenTime[index] = e.serverTime;
    const actor = fighters?.get(e.actorId), victim = e.targetId ? fighters?.get(e.targetId) : undefined, seq = e.actionSeq ?? actor?.state.actionSeq ?? -1;
    let floor = Math.min(actor?.group.position.y ?? Infinity, victim?.group.position.y ?? Infinity);
    if (e.kind === 'confirm') {
      if (e.slot === 'ultimate' && !e.branch && e.targetId) Object.assign(this.assemblies[this.assemblyCursor++ % this.assemblies.length], { actor: e.actorId, target: e.targetId, seq, final: false, floor: Number.isFinite(floor) ? floor : 0 });
      return;
    }
    if (!victim && !e.endpoint) return;
    const contacts = e.slot === 'ultimate' ? ULT.contacts.length : SPECIAL.contacts.length, last = !e.branch && e.contactIndex === contacts - 1, final = e.slot === 'ultimate' && last, point = this.p, st = this.stage, t = e.serverTime;
    if (e.endpoint) point.set(e.endpoint.x, e.endpoint.y, e.endpoint.z); else bodyCentre(victim!, point);
    if (!Number.isFinite(floor)) floor = point.y - 1.05;
    let confirmed = false;
    if (final) for (const a of this.assemblies) if (a.actor === e.actorId && a.seq === seq) { a.final = true; floor = a.floor; confirmed = true; }
    if (final && !confirmed) return;
    const dir = this.dir;
    if (actor) { dir.subVectors(point, actor.group.position).setY(0); if (dir.lengthSq() < .01) dir.set(Math.sin(actor.state.yaw ?? 0), 0, Math.cos(actor.state.yaw ?? 0)); dir.normalize(); } else dir.set(0, 0, 1);
    const past = this.a.copy(point).addScaledVector(dir, .6), ground = this.ground.set(past.x, floor, past.z);
    if (e.slot === 'light') { st.burst(point, DIAMOND, .38, t, { dir, floor, clean: true }); return; }
    if (e.slot === 'heavy') {
      const big = e.branch ? .85 : 1;
      ground.set(point.x, floor, point.z).addScaledVector(dir, -.2);
      st.burst(point, DIAMOND, .45 * big, t, { dir, floor });
      st.shatter(this.b.copy(ground).setY(floor + .06), UP, DIAMOND, 2.3 * big, t, .34);
      st.shock(ground, DIAMOND, 3.6 * big, t, .4);
      this.mend(ground, t + .26, .75, 2.3 * big);
      return;
    }
    if (e.slot === 'special') {
      if (e.branch === 'airSpecial') { st.burst(point, DIAMOND, 2, t, { floor }); st.shock(ground, DIAMOND, 4.5, t, .45); this.mend(ground, t + .3, 1, 3); return; }
      const big = e.branch ? .7 : 1;
      if (!last && !e.branch) { st.burst(point, DIAMOND, .9 + .25 * (e.contactIndex ?? 0), t, { dir, floor }); return; }
      st.burst(past, DIAMOND, 1.45 * big, t, { dir, floor });
      ground.set(point.x, floor, point.z).addScaledVector(dir, 1.7);
      st.shatter(this.b.copy(ground).setY(floor + .06), UP, DIAMOND, 2.6 * big, t, .42);
      st.shock(ground, DIAMOND, 5.5 * big, t, .45);
      this.mend(ground, t + .34, .8, 2.6 * big);
      return;
    }
    if (e.slot !== 'ultimate' || e.branch) return;
    if (!final) { st.burst(point, DIAMOND, e.contactIndex ? .85 + .06 * e.contactIndex : 1, t, { dir, floor }); return; }
    if (involvesLocal(e.actorId, e.targetId)) SIGNATURE.screen?.impactFrame?.(.47, point);
    st.burst(point, DIAMOND, 2.5, t, { dir, floor });
    st.shatter(point, dir, DIAMOND, 6.5, t, .6);
    st.shatter(this.b.copy(ground).setY(floor + .06), UP, DIAMOND, 7, t + .03, .62);
    st.shock(ground, DIAMOND, 10, t, .6);
    this.mend(ground, t + .5, 1.5, 7);
    st.scar(ground, MEND, 4.5, t + .5, 2);
  }

  update(time: number, fighters: ReadonlyMap<string, Fighter>, _flights?: ReadonlyMap<string, Flight>) {
    if (this.disposed) return;
    const st = this.stage.open(time);
    for (const f of fighters.values()) {
      const s = f.state; if (!isJosukeRestoration(s.fighter) || !s.alive) continue;
      if (s.action === 'awaken') { this.awakening(f, time); continue; }
      if (s.whiffedAt !== undefined || (s.action !== 'light' && s.action !== 'heavy' && s.action !== 'special' && s.action !== 'ultimate')) continue;
      const elapsed = s.actionTime * s.actionDuration, seed = (s.actionSeq ?? 0) * 6.3, heading = this.face(f), strike = f.strikePoint(this.strike), tick = Math.floor(time * 30);
      if (s.action === 'light') {
        const k = Math.sin(clamp(s.actionTime) * Math.PI);
        st.glow(strike, .26, DIAMOND.main, .6 * k); st.glow(strike, .14, DIAMOND.core, .8 * k, STAR, .2, tick); st.light(strike, 2.3, DIAMOND, .25 * k);
      } else if (s.action === 'heavy') {
        const contact = s.branch ? s.actionDuration * .55 : HEAVY.contacts[0];
        if (elapsed < contact) { const k = clamp(elapsed / contact); st.glow(strike, .2 + .14 * k, DIAMOND.main, .5 + .4 * k); st.glow(strike, .16, DIAMOND.core, k, STAR, .2, tick); st.light(strike, 2.8, DIAMOND, .3 * k); }
        else if (elapsed < contact + .2) {
          const flare = 1 - (elapsed - contact) / .2;
          st.glow(this.a.copy(strike).addScaledVector(heading, .3), .45 + .4 * flare, DIAMOND.main, .7 * flare); st.glow(this.a, .36, DIAMOND.core, .8 * flare, STAR, .22, tick);
          st.light(this.a, 3.6, DIAMOND, .4 * flare);
        }
      } else if (s.action === 'special' && !s.branch) {
        if (elapsed < RUSH - .1) { const k = clamp(elapsed / (RUSH - .1)); st.glow(strike, .3 * k, DIAMOND.core, .8 * k); st.glow(strike, .5 * k, DIAMOND.main, .5 * k); st.light(strike, 3.5, DIAMOND, .35 * k); }
        else if (elapsed < RUSH_END + .12) this.rush(f, strike, clamp((elapsed - RUSH + .1) / .1) * clamp((RUSH_END + .12 - elapsed) / .1), time, seed, 10);
      } else if (s.action === 'ultimate' && !s.branch && s.confirmedAt === undefined && elapsed < FIRST + .12) {
        const k = clamp(elapsed / FIRST);
        st.glow(strike, .28 * k, DIAMOND.core, .8 * k); st.glow(strike, .45 * k, DIAMOND.main, .5 * k); st.light(strike, 3.2, DIAMOND, .3 * k);
      }
    }
    for (const a of this.assemblies) {
      if (!a.actor) continue;
      const actor = fighters.get(a.actor), victim = fighters.get(a.target), s = actor?.state;
      if (!actor || !s?.alive || !victim?.state.alive && !a.final || s.action !== 'ultimate' || s.branch || (s.actionSeq ?? -1) !== a.seq || s.whiffedAt !== undefined) { a.actor = ''; continue; }
      const elapsed = s.actionTime * s.actionDuration;
      if (elapsed > ULT.duration) { a.actor = ''; continue; }
      if (!a.final && elapsed < LAST && victim) this.breaking(actor, victim, a, elapsed, time);
    }
    for (const m of this.marks) {
      if (!m.live) continue;
      const age = time - m.born;
      if (age >= m.life) { m.live = false; continue; }
      if (age >= 0) this.mending(m, age, time);
    }
    st.close();
  }

  private face(f: Fighter) { const yaw = f.state.yaw ?? f.group.rotation.y; return this.heading.set(Math.sin(yaw), 0, Math.cos(yaw)); }
  private rush(f: Fighter, strike: THREE.Vector3, k: number, time: number, seed: number, count: number, to?: THREE.Vector3) {
    if (k <= .02) return;
    const st = this.stage, target = to ?? this.b.copy(strike).addScaledVector(this.heading, .7);
    fistRush(st, this.a.copy(strike).addScaledVector(this.heading, -.1), target, DIAMOND, k, time, seed, count, .55, .6);
    st.light(this.a.copy(target).addScaledVector(this.heading, .6).setY(target.y + .3), 4.5, DIAMOND, .45 * k);
    st.speed(.35 * k, f.state.id);
  }

  private breaking(actor: Fighter, victim: Fighter, a: Assembly, elapsed: number, time: number) {
    const st = this.stage, g = clamp((elapsed - FIRST) / (LAST - FIRST)), seed = a.seq * 2.9, feet = actor.group.position, heading = this.face(actor);
    const prey = bodyCentre(victim, this.prey);
    this.dir.subVectors(prey, feet).setY(0); if (this.dir.lengthSq() < .01) this.dir.copy(heading); this.dir.normalize();
    let landed = 0; for (const at of ULT.contacts) if (elapsed >= at) landed++;
    const broken = clamp(landed / (ULT.contacts.length - 1)), jolt = 1 - clamp((elapsed - ULT.contacts[Math.max(0, landed - 1)]) / .2);
    st.dim(.3 + .45 * g, a.actor, a.target);
    st.cracks(this.p.set(prey.x, a.floor + .06, prey.z).addScaledVector(this.dir, .5), UP, 1.4 + 4.2 * broken, DIAMOND, 1, seed, .55 + .35 * jolt);
    st.cracks(this.c.copy(prey).addScaledVector(this.dir, 1.5), this.dir, .8 + 2.6 * broken, DIAMOND, 1, seed + 3, .5 + .4 * jolt);
    st.light(this.p.copy(prey).addScaledVector(this.dir, .6).setY(prey.y + .4), 6 + 2 * g, DIAMOND, .3 + .3 * g);
    const strike = actor.strikePoint(this.strike);
    if (elapsed > ULT.contacts[1] - .2 && elapsed < ULT.contacts[ULT.contacts.length - 2] + .15) this.rush(actor, strike, clamp((elapsed - ULT.contacts[1] + .2) / .12), time, seed, 12, prey);
    else st.glow(strike, .3, DIAMOND.core, .7, STAR, .2, Math.floor(time * 24));
    if (g > .85) st.speed(.5 * (g - .85) / .15, a.actor, a.target);
  }

  private mending(m: Mark, age: number, time: number) {
    const st = this.stage, w = age / m.life, closing = 1 - w * w, fade = Math.min(1, age / .1) * (w < .7 ? 1 : 1 - (w - .7) / .3);
    this.p.copy(m.at); this.p.y += .06;
    st.cracks(this.p, UP, m.size, MEND, closing, m.seed, fade);
    for (let i = 0, n = st.n(m.size > 4 ? 14 : 9, 5); i < n; i++) {
      const ang = i * 2.399963 + m.seed, start = m.size * (.35 + .65 * hash(i + m.seed)), r = start * (1 - w) * (1 - w), lift = (.3 + 1.3 * hash(i * 3.1 + m.seed)) * Math.sin(Math.PI * Math.min(1, w * 1.2));
      this.a.set(m.at.x + Math.cos(ang) * r, m.at.y + lift, m.at.z + Math.sin(ang) * r);
      this.b.set(m.at.x + Math.cos(ang) * (r + .3 + .4 * (1 - w)), m.at.y + lift * 1.15, m.at.z + Math.sin(ang) * (r + .3 + .4 * (1 - w)));
      st.streak(this.b, this.a, .05 + m.size * .006, MEND.main, fade); st.glow(this.a, .09 + .05 * hash(i), MEND.core, .9 * fade, STAR, .2, i + Math.floor(time * 12));
    }
    if (m.size > 4) st.bubble(this.c.copy(m.at).setY(m.at.y + 1.1), .5 + m.size * .75 * (1 - w), MEND, .55 * fade);
    else st.light(this.c.copy(m.at).setY(m.at.y + .5), m.size + 2, MEND, .5 * fade);
  }

  private awakening(f: Fighter, time: number) {
    const st = this.stage, w = clamp(f.state.actionTime);
    if (w < .48 || w > .95) return;
    const k = Math.sin(clamp((w - .48) / .47) * Math.PI), strike = f.strikePoint(this.strike);
    st.glow(strike, .3, DIAMOND.main, .7 * k); st.glow(strike, .16, DIAMOND.core, .9 * k, STAR, .2, Math.floor(time * 24));
    st.light(strike, 3, DIAMOND, .35 * k);
    if (w > .7) st.disc(this.p.copy(f.group.position), .6 + (w - .7) * 9, DIAMOND.main, k * .7, WAVE, .96);
  }
  reset() {
    for (const a of this.assemblies) a.actor = ''; for (const m of this.marks) m.live = false;
    this.seen.fill(-1); this.seenTime.fill(-1); this.cursor = this.assemblyCursor = this.markCursor = 0; this.stage.reset();
  }
  dispose() { if (this.disposed) return; this.reset(); this.disposed = true; this.stage.release(); }
}
