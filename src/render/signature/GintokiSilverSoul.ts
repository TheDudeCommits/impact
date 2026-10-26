import * as THREE from 'three';
import type { CombatEvent } from '../../game/types';
import { GINTOKI_MOVES } from '../../game/fighters/gintoki';
import type { Fighter } from '../Fighter';
import type { Flight } from '../CombatEffects';
import { bodyCentre, type VfxKit } from '../vfx/VfxKit';
import { SIGNATURE, involvesLocal } from './context';
import { STAR } from './GlowBatch';
import { MoveStage, WAVE, type StageLook } from './MoveStage';
import { sweep } from './StageStrokes';

export const isGintokiSilverSoul = (id: string | undefined) => id === 'gintoki';
export const GINTOKI_SILVER_LIMITS = Object.freeze({ marks: 14, rampages: 6 });
const UP = new THREE.Vector3(0, 1, 0);
const TIP = new THREE.Vector3(0.8921814254969536, 0.07761142948204301, 0.36734193544408766), ROOT = new THREE.Vector3(0.08432913028509417, 0.0845028866437481, 0.04410362272019319);
export function gintokiBokkenPoint(f: Pick<Fighter, 'joints'>, out: THREE.Vector3, tip = true): boolean {
  const hand = f.joints.get('RightHand'); if (!hand) return false;
  out.copy(tip ? TIP : ROOT).applyMatrix4(hand.matrixWorld); return true;
}
const lin = (r: number, g: number, b: number) => new THREE.Color(r, g, b);
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const hash = (x: number) => { const v = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
const SILVER: StageLook = { core: lin(3.2, 3.2, 3.3), main: lin(1.55, 1.65, 1.85), rim: lin(.32, .4, .58), light: lin(1, 1.03, 1.1), element: { spike: 0xffffff, rim: 0xccd5e2, light: 0xe8eef8, ink: 0x10141c }, shell: 0xe8eef8, edge: 0x2f4f86, flame: -1, dark: false, heart: 0 };
const BLOOD: StageLook = { ...SILVER, main: lin(1.7, .12, .2), rim: lin(.6, .03, .07) };
const HEAVY = GINTOKI_MOVES.heavy, SPECIAL = GINTOKI_MOVES.special, ULT = GINTOKI_MOVES.ultimate;
const FIRST = ULT.contacts[0], LAST = ULT.contacts[ULT.contacts.length - 1];
const SMEAR = .22, LINES = .5;
const CUT = 0, IMPACT = 1;
type Rampage = { actor: string; target: string; seq: number; final: boolean; floor: number };
type Mark = { kind: number; born: number; life: number; size: number; seed: number; tilt: number; red: boolean; at: THREE.Vector3; dir: THREE.Vector3; live: boolean };

export class GintokiSilverSoul {
  private readonly stage: MoveStage;
  private rampages: Rampage[] = Array.from({ length: GINTOKI_SILVER_LIMITS.rampages }, () => ({ actor: '', target: '', seq: -1, final: false, floor: 0 }));
  private marks: Mark[] = Array.from({ length: GINTOKI_SILVER_LIMITS.marks }, () => ({ kind: 0, born: -1e9, life: 0, size: 1, seed: 0, tilt: 0, red: false, at: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, 1), live: false }));
  private seen = new Float64Array(128).fill(-1); private seenTime = new Float64Array(128).fill(-1);
  private cursor = 0; private rampageCursor = 0; private markCursor = 0; private disposed = false;
  private p = new THREE.Vector3(); private a = new THREE.Vector3(); private b = new THREE.Vector3(); private c = new THREE.Vector3(); private d = new THREE.Vector3();
  private heading = new THREE.Vector3(); private side = new THREE.Vector3(); private dir = new THREE.Vector3(); private ground = new THREE.Vector3(); private strike = new THREE.Vector3(); private across = new THREE.Vector3(); private prey = new THREE.Vector3();
  constructor(scene: THREE.Scene, kit: Pick<VfxKit, 'budget'> & Partial<VfxKit>) { this.stage = MoveStage.for(scene, kit); }
  load(_ids: readonly string[]): Promise<void> { return Promise.resolve(); }
  private cancel(id: string, victim = false) { for (const r of this.rampages) if (r.actor === id || victim && r.target === id && !r.final) r.actor = ''; }
  private mark(kind: number, at: THREE.Vector3, dir: THREE.Vector3, born: number, life: number, size: number, tilt = 0, red = false) {
    const m = this.marks[this.markCursor++ % this.marks.length];
    m.kind = kind; m.at.copy(at); m.dir.copy(dir); m.born = born; m.life = life; m.size = size; m.tilt = tilt; m.red = red; m.seed = (Math.abs(at.x * 7.7 + at.z * 5.3 + born * 3.1)) % 67; m.live = true;
  }

  handle(e: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    if (this.disposed) return;
    if (e.kind === 'eliminated' || e.kind === 'respawn') { this.cancel(e.actorId, true); return; }
    if (!isGintokiSilverSoul(e.fighter)) return;
    if (e.kind === 'whiff' || e.kind === 'rejected') { this.cancel(e.actorId); return; }
    if (e.kind !== 'hit' && e.kind !== 'confirm') return;
    for (let i = 0; i < this.seen.length; i++) if (this.seen[i] === e.id && this.seenTime[i] === e.serverTime) return;
    const index = this.cursor++ % this.seen.length; this.seen[index] = e.id; this.seenTime[index] = e.serverTime;
    const actor = fighters?.get(e.actorId), victim = e.targetId ? fighters?.get(e.targetId) : undefined, seq = e.actionSeq ?? actor?.state.actionSeq ?? -1;
    let floor = Math.min(actor?.group.position.y ?? Infinity, victim?.group.position.y ?? Infinity);
    if (e.kind === 'confirm') {
      if (e.slot === 'ultimate' && !e.branch && e.targetId) Object.assign(this.rampages[this.rampageCursor++ % this.rampages.length], { actor: e.actorId, target: e.targetId, seq, final: false, floor: Number.isFinite(floor) ? floor : 0 });
      return;
    }
    if (!victim && !e.endpoint) return;
    const final = e.slot === 'ultimate' && !e.branch && e.contactIndex === ULT.contacts.length - 1, point = this.p, st = this.stage, t = e.serverTime;
    if (e.endpoint) point.set(e.endpoint.x, e.endpoint.y, e.endpoint.z); else bodyCentre(victim!, point);
    if (!Number.isFinite(floor)) floor = point.y - 1.05;
    let confirmed = false;
    if (final) for (const r of this.rampages) if (r.actor === e.actorId && r.seq === seq) { r.final = true; floor = r.floor; confirmed = true; }
    if (final && !confirmed) return;
    const dir = this.dir;
    if (actor) { dir.subVectors(point, actor.group.position).setY(0); if (dir.lengthSq() < .01) dir.set(Math.sin(actor.state.yaw ?? 0), 0, Math.cos(actor.state.yaw ?? 0)); dir.normalize(); } else dir.set(0, 0, 1);
    const ground = this.ground.set(point.x, floor, point.z);
    if (e.slot === 'light') { st.burst(point, SILVER, .36, t, { dir, floor, clean: true }); return; }
    if (e.slot === 'heavy') {
      const big = e.branch ? .85 : 1;
      this.mark(CUT, point, dir, t, .3, 1.5 * big, -.5);
      this.mark(IMPACT, point, dir, t, .34, 2.6 * big);
      st.burst(point, SILVER, .55 * big, t, { dir, floor });
      st.shock(ground, SILVER, 4 * big, t, .4);
      return;
    }
    if (e.slot === 'special') {
      if (e.branch === 'airSpecial') { st.burst(point, SILVER, 2, t, { floor }); st.shock(ground, SILVER, 4.5, t, .45); this.mark(IMPACT, point, dir, t, LINES, 5); return; }
      const big = e.branch ? .7 : 1;
      this.mark(CUT, point, dir, t, .5, 3 * big, .1);
      this.mark(IMPACT, point, dir, t, LINES + .5, 6 * big);
      st.burst(point, SILVER, 1.3 * big, t, { dir, floor });
      st.shatter(point, dir, SILVER, 2.8 * big, t, .5);
      st.shock(ground, SILVER, 6 * big, t, .5);
      return;
    }
    if (e.slot !== 'ultimate' || e.branch) return;
    if (!final) {
      st.burst(point, SILVER, e.contactIndex ? .7 + .1 * e.contactIndex : .6, t, { dir, floor });
      this.mark(CUT, point, dir, t, .4, 1.8 + .4 * (e.contactIndex ?? 0), e.contactIndex === 1 ? .6 : -.6, !!e.contactIndex);
      if (e.contactIndex) { this.mark(IMPACT, point, dir, t, .4, 3 + e.contactIndex); st.shock(ground, SILVER, 4 + e.contactIndex, t, .45); }
      return;
    }
    if (involvesLocal(e.actorId, e.targetId)) SIGNATURE.screen?.impactFrame?.(.5, point);
    this.mark(CUT, point, dir, t, .7, 8, .08, true);
    this.mark(IMPACT, point, dir, t, .9, 10);
    st.burst(point, SILVER, 1.7, t, { dir, floor });
    st.shatter(point, dir, SILVER, 6.5, t, .8);
    st.shatter(this.a.copy(ground).setY(floor + .06), UP, SILVER, 7, t + .04, 1.2);
    st.dome(point, SILVER, 4.5, t, .45);
    st.shock(ground, SILVER, 10, t, .6);
  }

  update(time: number, fighters: ReadonlyMap<string, Fighter>, _flights?: ReadonlyMap<string, Flight>) {
    if (this.disposed) return;
    const st = this.stage.open(time);
    for (const f of fighters.values()) {
      const s = f.state; if (!isGintokiSilverSoul(s.fighter) || !s.alive) continue;
      if (s.action === 'awaken') { this.awakening(f); continue; }
      if (s.whiffedAt !== undefined || (s.action !== 'light' && s.action !== 'heavy' && s.action !== 'special' && s.action !== 'ultimate')) continue;
      const elapsed = s.actionTime * s.actionDuration, seed = (s.actionSeq ?? 0) * 6.7, feet = f.group.position, heading = this.face(f), side = this.side, tip = f.strikePoint(this.strike);
      if (s.action === 'light') {
        const k = Math.sin(clamp(s.actionTime) * Math.PI);
        st.streak(f.handR, tip, .07, SILVER.main, .9 * k); st.glow(tip, .2, SILVER.main, .6 * k); st.light(tip, 2.2, SILVER, .22 * k);
      } else if (s.action === 'heavy') {
        const contact = s.branch ? s.actionDuration * .55 : HEAVY.contacts[0];
        if (elapsed < contact) { const k = clamp(elapsed / contact); st.streak(f.handR, tip, .08, SILVER.main, k); st.glow(tip, .18, SILVER.core, .8 * k, STAR, .2, 3); }
        else if (elapsed < contact + SMEAR) {
          const w = (elapsed - contact) / SMEAR, cut = clamp(w / .3), fade = 1 - w * w;
          this.p.copy(feet).addScaledVector(heading, .7).setY(feet.y + 1.05);
          this.c.copy(heading).multiplyScalar(.8).addScaledVector(side, -.6).normalize(); this.d.copy(UP).addScaledVector(side, .62).normalize();
          sweep(st, this.p, this.c, this.d, 1.8, -.7, -.7 + 1.9 * cut, .26, SILVER, 1.3 * fade, 11);
          st.light(this.a.copy(this.p).addScaledVector(heading, 1.2).setY(feet.y + .5), 4, SILVER, .3 * fade);
        }
      } else if (s.action === 'special' && !s.branch) {
        const release = SPECIAL.contacts[0];
        if (elapsed < release) {
          const k = clamp(elapsed / release);
          this.speedLines(this.p.copy(feet).setY(feet.y + 1), heading, side, 1.4 + 3 * k, k, time, seed, 10);
          st.streak(f.handR, tip, .08, SILVER.main, k); st.glow(tip, .2, SILVER.core, .8 * k, STAR, .2, 3);
          st.light(this.a.copy(feet).addScaledVector(heading, -1).setY(feet.y + .6), 4, SILVER, .3 * k);
          st.speed(.45 * k, s.id);
        } else if (elapsed < release + SMEAR && !this.cutting(time)) {
          const w = (elapsed - release) / SMEAR;
          this.line(this.p.copy(feet).addScaledVector(heading, 2.2).setY(feet.y + 1.1), side, 3 * clamp(w / .2), 1 - w * w, 1.2, false);
        }
      } else if (s.action === 'ultimate' && !s.branch && s.confirmedAt === undefined && elapsed < FIRST + .12) {
        const k = clamp(elapsed / FIRST);
        st.streak(f.handR, tip, .08, SILVER.main, k); st.glow(tip, .2, SILVER.core, .8 * k, STAR, .2, 3); st.light(tip, 2.6, SILVER, .25 * k);
      }
    }
    for (const r of this.rampages) {
      if (!r.actor) continue;
      const actor = fighters.get(r.actor), victim = fighters.get(r.target), s = actor?.state;
      if (!actor || !s?.alive || !victim?.state.alive && !r.final || s.action !== 'ultimate' || s.branch || (s.actionSeq ?? -1) !== r.seq || s.whiffedAt !== undefined) { r.actor = ''; continue; }
      const elapsed = s.actionTime * s.actionDuration;
      if (elapsed > ULT.duration) { r.actor = ''; continue; }
      if (!r.final && elapsed < LAST && victim) this.rampage(actor, victim, r, elapsed, time);
    }
    for (const m of this.marks) {
      if (!m.live) continue;
      const age = time - m.born;
      if (age >= m.life) { m.live = false; continue; }
      if (age < 0) continue;
      const w = age / m.life;
      if (m.kind === CUT) { this.d.set(m.dir.z, 0, -m.dir.x).multiplyScalar(Math.cos(m.tilt)).addScaledVector(UP, Math.sin(m.tilt)); this.line(m.at, this.d, m.size * clamp(age / .05), (1 - w) * (1 - w), m.size > 2.5 ? 1.4 : 1, m.red); }
      else this.impact(m.at, m.dir, m.size, clamp(age / .07), w < .35 ? 1 : 1 - (w - .35) / .65, m.seed);
    }
    st.close();
  }

  private face(f: Fighter) {
    const yaw = f.state.yaw ?? f.group.rotation.y;
    this.side.set(Math.cos(yaw), 0, -Math.sin(yaw));
    return this.heading.set(Math.sin(yaw), 0, Math.cos(yaw));
  }
  private cutting(time: number) { for (const m of this.marks) if (m.live && m.kind === CUT && time - m.born < SMEAR) return true; return false; }
  private line(at: THREE.Vector3, along: THREE.Vector3, reach: number, fade: number, weight: number, red: boolean) {
    if (fade <= .02 || reach <= .05) return;
    const st = this.stage;
    this.a.copy(at).addScaledVector(along, -reach); this.b.copy(at).addScaledVector(along, reach);
    if (red) st.streak(this.a, this.b, .24 * weight * (.4 + .6 * fade), BLOOD.main, 1.1 * fade);
    st.streak(this.a, this.b, (red ? .1 : .17) * weight * (.4 + .6 * fade), SILVER.main, 1.2 * fade); st.streak(this.a, this.b, .045 * weight, SILVER.core, 1.6 * fade);
    st.glow(at, .34 * weight, SILVER.core, .7 * fade, STAR, .2, 5);
  }
  private speedLines(at: THREE.Vector3, heading: THREE.Vector3, side: THREE.Vector3, length: number, k: number, time: number, seed: number, count: number) {
    const st = this.stage, tick = Math.floor(time * 12);
    for (let i = 0, n = st.n(count, 4); i < n; i++) {
      const out = (hash(seed + i * 3.3 + tick) - .5) * 2.4, up = (hash(seed + i * 5.9 + tick * 1.7) - .5) * 1.5, len = length * (.5 + .5 * hash(i + tick));
      this.a.copy(at).addScaledVector(side, out + Math.sign(out || 1) * .45).addScaledVector(heading, -.5); this.a.y += up;
      this.b.copy(this.a).addScaledVector(heading, -len);
      st.streak(this.a, this.b, .035, SILVER.main, .9 * k);
    }
  }
  private impact(at: THREE.Vector3, normal: THREE.Vector3, radius: number, k: number, fade: number, seed: number) {
    if (k <= .02 || fade <= .02) return;
    const st = this.stage, u = this.across.set(normal.z, 0, -normal.x), n = st.n(radius > 5 ? 22 : 14, 8);
    for (let i = 0; i < n; i++) {
      const ang = (i + hash(seed + i * 3.7) * .8) * Math.PI * 2 / n, inner = radius * (.36 + .2 * hash(seed + i * 5.1)), outer = inner + (radius - inner) * (.55 + .45 * hash(seed + i * 2.3)) * k;
      this.a.copy(at).addScaledVector(u, Math.cos(ang) * inner).addScaledVector(UP, Math.sin(ang) * inner);
      this.b.copy(at).addScaledVector(u, Math.cos(ang) * outer).addScaledVector(UP, Math.sin(ang) * outer);
      st.streak(this.a, this.b, (.03 + .05 * hash(seed + i)) * (1 + radius * .05), i % 3 ? SILVER.main : SILVER.core, (.7 + .5 * hash(i + seed * 2)) * fade);
    }
    st.glow(at, Math.min(1.2, radius * .22), SILVER.core, .8 * fade, STAR, .22, seed);
    st.light(at, Math.min(9, radius * 1.1 + 2), SILVER, .5 * fade);
  }

  private rampage(actor: Fighter, victim: Fighter, r: Rampage, elapsed: number, time: number) {
    const st = this.stage, g = clamp((elapsed - FIRST) / (LAST - FIRST)), seed = r.seq * 2.3, feet = actor.group.position, heading = this.face(actor), tick = Math.floor(time * 12);
    const prey = bodyCentre(victim, this.prey);
    this.dir.subVectors(prey, feet).setY(0); if (this.dir.lengthSq() < .01) this.dir.copy(heading); this.dir.normalize();
    const across = this.across.set(this.dir.z, 0, -this.dir.x);
    st.dim(.3 + .45 * g, r.actor, r.target);
    for (let i = 0, n = Math.floor((LAST - FIRST - .4) / .16); i < n; i++) {
      const born = FIRST + .2 + i * .16, age = elapsed - born;
      if (age < 0 || age > .36) continue;
      const tilt = (hash(seed + i * 4.7) - .5) * 2.6, w = age / .36;
      this.d.copy(across).multiplyScalar(Math.cos(tilt)).addScaledVector(UP, Math.sin(tilt));
      this.c.copy(prey); this.c.y += (hash(seed + i * 9.1) - .5) * .8;
      this.line(this.c, this.d, (1.5 + 1.2 * hash(seed + i * 2.3) + g) * clamp(age / .04), (1 - w) * (1 - w), .9, true);
    }
    for (let i = 0, n = st.n(10, 5); i < n; i++) {
      const ang = (i + hash(seed + i + tick) * .9) * Math.PI * 2 / n, far = 4.5 + 2.5 * hash(i * 3 + tick), near = 1.6 + .8 * hash(i * 7 + tick);
      this.a.copy(prey).addScaledVector(across, Math.cos(ang) * far).addScaledVector(UP, Math.sin(ang) * far * .7);
      this.b.copy(prey).addScaledVector(across, Math.cos(ang) * near).addScaledVector(UP, Math.sin(ang) * near * .7);
      st.streak(this.a, this.b, .035, SILVER.main, (.35 + .45 * g));
    }
    const tip = actor.strikePoint(this.strike);
    st.streak(actor.handR, tip, .08, SILVER.main, .9); st.glow(tip, .2, SILVER.core, .8, STAR, .2, tick);
    st.light(this.a.copy(prey).setY(prey.y + .4), 6 + 2 * g, SILVER, .28 + .3 * g);
    if (g > .8) st.speed(.5 * (g - .8) / .2, r.actor, r.target);
  }

  private awakening(f: Fighter) {
    const st = this.stage, elapsed = f.state.actionTime * f.state.actionDuration;
    if (elapsed <= .35 || elapsed >= .86) return;
    const w = (elapsed - .35) / .51, k = Math.sin(w * Math.PI), tip = f.strikePoint(this.strike);
    st.streak(f.handR, tip, .07, SILVER.main, k); st.glow(tip, .22, SILVER.core, k, STAR, .2, 2);
    st.disc(this.p.copy(f.group.position), .6 + w * 3, SILVER.core, k * .7, WAVE, .96);
  }
  reset() {
    for (const r of this.rampages) r.actor = ''; for (const m of this.marks) m.live = false;
    this.seen.fill(-1); this.seenTime.fill(-1); this.cursor = this.rampageCursor = this.markCursor = 0; this.stage.reset();
  }
  dispose() { if (this.disposed) return; this.reset(); this.disposed = true; this.stage.release(); }
}
