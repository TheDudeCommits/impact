import * as THREE from 'three';
import type { CombatEvent, PlayerState } from '../../game/types';
import { JOLYNE_MOVES } from '../../game/fighters/jolyne';
import type { Fighter } from '../Fighter';
import type { Flight } from '../CombatEffects';
import { bodyCentre, type VfxKit } from '../vfx/VfxKit';
import { SIGNATURE, involvesLocal } from './context';
import { MoveStage, WAVE, type StageLook } from './MoveStage';
import { fistRush } from './StandRush';
import { limb, polygon } from './StageStrokes';

export const isJolyneStoneThread = (id: string | undefined) => id === 'jolyne';
export const JOLYNE_THREAD_LIMITS = Object.freeze({ marks: 12, links: 8 });
export function jolyneStrikeJoint(action: string, clip?: string, index = 0): 'RightHand' | 'LeftHand' {
  if ((action === 'ultimate' && (!clip || clip === 'Stone Ocean')) || (action === 'special' && (!clip || clip === 'ORA Rush'))) return index % 2 ? 'LeftHand' : 'RightHand';
  if (['Thread Reel', 'Rush 3', 'Cross Stitch', 'Prison Break', 'Descending Stone', 'Ocean Crash'].includes(clip ?? '')) return 'LeftHand';
  return action === 'heavy' && !clip ? 'LeftHand' : 'RightHand';
}
const ULTIMATE_CONTACTS = JOLYNE_MOVES.ultimate.contacts, SPECIAL_CONTACTS = JOLYNE_MOVES.special.contacts;
export function jolyneCommandJoint(s: Pick<PlayerState, 'action' | 'branch' | 'chain' | 'actionTime' | 'actionDuration'>): 'RightHand' | 'LeftHand' {
  if (s.branch) return s.branch === 'lh' || s.branch === 'llls' ? 'RightHand' : 'LeftHand';
  if (s.action === 'light') return (s.chain ?? 0) >= 3 ? 'LeftHand' : 'RightHand';
  if (s.action === 'heavy') return 'LeftHand';
  if (s.action !== 'special' && s.action !== 'ultimate') return 'RightHand';
  const times = s.action === 'ultimate' ? ULTIMATE_CONTACTS : SPECIAL_CONTACTS, elapsed = s.actionTime * s.actionDuration; let index = 0;
  for (let i = 1; i < times.length; i++) if (elapsed > (times[i - 1] + times[i]) * .5) index = i;
  return index % 2 ? 'LeftHand' : 'RightHand';
}

const UP = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);
const lin = (r: number, g: number, b: number) => new THREE.Color(r, g, b);
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const hash = (x: number) => { const v = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
const THREAD: StageLook = { core: lin(2.9, 3.3, 3), main: lin(.42, 1.95, 1.5), rim: lin(.1, .42, .42), light: lin(.7, 1.22, 1.08), element: { spike: 0xf4fff5, rim: 0x73e0c3, light: 0x8fe8d0, ink: 0x06181a }, shell: 0x8fe8d0, edge: 0x1d5f63, flame: -1, dark: false, heart: 0 };
const HEAVY = JOLYNE_MOVES.heavy, SPECIAL = JOLYNE_MOVES.special, ULT = JOLYNE_MOVES.ultimate;
const FIRST = ULT.contacts[0], LAST = ULT.contacts[ULT.contacts.length - 1], RUSH = SPECIAL.contacts[0], RUSH_END = SPECIAL.contacts[SPECIAL.contacts.length - 1];
const WRAP = 0, SNAP = 1;
type Link = { actor: string; target: string; seq: number; final: boolean; floor: number };
type Mark = { kind: number; born: number; life: number; size: number; seed: number; at: THREE.Vector3; dir: THREE.Vector3; live: boolean };

export class JolyneStoneThread {
  private readonly stage: MoveStage;
  private links: Link[] = Array.from({ length: JOLYNE_THREAD_LIMITS.links }, () => ({ actor: '', target: '', seq: -1, final: false, floor: 0 }));
  private marks: Mark[] = Array.from({ length: JOLYNE_THREAD_LIMITS.marks }, () => ({ kind: 0, born: -1e9, life: 0, size: 1, seed: 0, at: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, 1), live: false }));
  private seen = new Float64Array(128).fill(-1); private seenTime = new Float64Array(128).fill(-1);
  private cursor = 0; private linkCursor = 0; private markCursor = 0; private disposed = false;
  private p = new THREE.Vector3(); private a = new THREE.Vector3(); private b = new THREE.Vector3(); private c = new THREE.Vector3(); private d = new THREE.Vector3();
  private heading = new THREE.Vector3(); private side = new THREE.Vector3(); private dir = new THREE.Vector3(); private ground = new THREE.Vector3(); private strike = new THREE.Vector3(); private across = new THREE.Vector3(); private prey = new THREE.Vector3();
  constructor(scene: THREE.Scene, kit: Pick<VfxKit, 'budget'> & Partial<VfxKit>) { this.stage = MoveStage.for(scene, kit); }
  load(_ids: readonly string[]): Promise<void> { return Promise.resolve(); }
  private cancel(id: string, victim = false) { for (const l of this.links) if (l.actor === id || victim && l.target === id && !l.final) l.actor = ''; }
  private mark(kind: number, at: THREE.Vector3, dir: THREE.Vector3, born: number, life: number, size: number) {
    const m = this.marks[this.markCursor++ % this.marks.length];
    m.kind = kind; m.at.copy(at); m.dir.copy(dir); m.born = born; m.life = life; m.size = size; m.seed = (Math.abs(at.x * 7.1 + at.z * 5.9 + born * 3.7)) % 61; m.live = true;
  }

  handle(e: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    if (this.disposed) return;
    if (e.kind === 'eliminated' || e.kind === 'respawn') { this.cancel(e.actorId, true); return; }
    if (!isJolyneStoneThread(e.fighter)) return;
    if (e.kind === 'whiff' || e.kind === 'rejected') { this.cancel(e.actorId); return; }
    if (e.kind !== 'hit' && e.kind !== 'confirm') return;
    for (let i = 0; i < this.seen.length; i++) if (this.seen[i] === e.id && this.seenTime[i] === e.serverTime) return;
    const index = this.cursor++ % this.seen.length; this.seen[index] = e.id; this.seenTime[index] = e.serverTime;
    const actor = fighters?.get(e.actorId), victim = e.targetId ? fighters?.get(e.targetId) : undefined, seq = e.actionSeq ?? actor?.state.actionSeq ?? -1;
    let floor = Math.min(actor?.group.position.y ?? Infinity, victim?.group.position.y ?? Infinity);
    if (e.kind === 'confirm') {
      if (e.slot === 'ultimate' && !e.branch && e.targetId) Object.assign(this.links[this.linkCursor++ % this.links.length], { actor: e.actorId, target: e.targetId, seq, final: false, floor: Number.isFinite(floor) ? floor : 0 });
      return;
    }
    if (!victim && !e.endpoint) return;
    const contacts = e.slot === 'ultimate' ? ULT.contacts.length : SPECIAL.contacts.length, last = !e.branch && e.contactIndex === contacts - 1, final = e.slot === 'ultimate' && last, point = this.p, st = this.stage, t = e.serverTime;
    if (victim) bodyCentre(victim, point); else point.set(e.endpoint!.x, e.endpoint!.y, e.endpoint!.z);
    if (!Number.isFinite(floor)) floor = point.y - 1.05;
    let confirmed = false;
    if (final) for (const l of this.links) if (l.actor === e.actorId && l.seq === seq) { l.final = true; floor = l.floor; confirmed = true; }
    if (final && !confirmed) return;
    const dir = this.dir;
    if (actor) { dir.subVectors(point, actor.group.position).setY(0); if (dir.lengthSq() < .01) dir.set(Math.sin(actor.state.yaw ?? 0), 0, Math.cos(actor.state.yaw ?? 0)); dir.normalize(); } else dir.set(0, 0, 1);
    const ground = this.ground.set(point.x, floor, point.z);
    if (e.slot === 'light') { st.burst(point, THREAD, .38, t, { dir, floor, clean: true }); return; }
    if (e.slot === 'heavy') {
      const big = e.branch ? .85 : 1;
      this.mark(WRAP, point, dir, t, .5, big);
      st.burst(this.a.copy(point).addScaledVector(dir, .8), THREAD, .4 * big, t, { dir, floor });
      st.shock(this.b.copy(ground).addScaledVector(dir, .8), THREAD, 2.8 * big, t, .4);
      return;
    }
    if (e.slot === 'special') {
      if (e.branch === 'airSpecial') { st.burst(point, THREAD, 2, t, { floor }); st.shock(ground, THREAD, 4.5, t, .45); st.scar(ground, THREAD, 3, t, 1.8); return; }
      const big = e.branch ? .7 : 1;
      if (!last && !e.branch) { st.burst(point, THREAD, .9 + .25 * (e.contactIndex ?? 0), t, { dir, floor }); return; }
      this.a.copy(point).addScaledVector(dir, .7); this.b.copy(ground).addScaledVector(dir, .7);
      this.mark(SNAP, this.a, dir, t, .5, 2.4 * big);
      st.burst(this.a, THREAD, 1.45 * big, t, { dir, floor });
      st.shock(this.b, THREAD, 5.5 * big, t, .45);
      st.scar(this.b, THREAD, 2.4 * big, t + .08, 1.8);
      return;
    }
    if (e.slot !== 'ultimate' || e.branch) return;
    if (!final) { st.burst(point, THREAD, e.contactIndex ? .85 + .06 * e.contactIndex : 1, t, { dir, floor }); return; }
    if (involvesLocal(e.actorId, e.targetId)) SIGNATURE.screen?.impactFrame?.(.47, point);
    this.mark(SNAP, point, dir, t, .8, 6.5);
    st.burst(point, THREAD, 2.6, t, { dir, floor });
    st.shatter(point, dir, THREAD, 6, t + .03, .8);
    st.dome(point, THREAD, 5, t, .5);
    st.shock(ground, THREAD, 10, t, .6);
    st.scar(ground, THREAD, 4.5, t + .12, 2.1);
  }

  update(time: number, fighters: ReadonlyMap<string, Fighter>, _flights?: ReadonlyMap<string, Flight>) {
    if (this.disposed) return;
    const st = this.stage.open(time);
    for (const f of fighters.values()) {
      const s = f.state; if (!isJolyneStoneThread(s.fighter) || !s.alive) continue;
      if (s.action === 'awaken') { this.awakening(f); continue; }
      if (s.whiffedAt !== undefined || (s.action !== 'light' && s.action !== 'heavy' && s.action !== 'special' && s.action !== 'ultimate')) continue;
      const elapsed = s.actionTime * s.actionDuration, seed = (s.actionSeq ?? 0) * 5.9, feet = f.group.position, heading = this.face(f), side = this.side;
      const hand = jolyneCommandJoint(s) === 'LeftHand' ? f.handL : f.handR, strike = f.strikePoint(this.strike);
      if (s.action === 'light') {
        const k = Math.sin(clamp(s.actionTime) * Math.PI);
        this.strand(hand, strike, .12, .05, k, 0);
        st.glow(strike, .26, THREAD.main, .6 * k); st.light(strike, 2.3, THREAD, .25 * k);
      } else if (s.action === 'heavy') {
        const contact = s.branch ? s.actionDuration * .55 : HEAVY.contacts[0], reach = this.a.copy(feet).addScaledVector(heading, 3).setY(feet.y + 1.1);
        if (elapsed < contact + .26) {
          const k = clamp(elapsed / contact), taut = clamp((elapsed - contact) / .05), fade = elapsed < contact ? 1 : 1 - (elapsed - contact) / .26;
          const off = this.d.subVectors(reach, hand).normalize().multiplyScalar(.5).add(hand);
          for (let i = -2; i <= 2; i++) {
            this.b.copy(reach).addScaledVector(side, i * .45 * (1 - taut)).setY(reach.y + Math.abs(i) * .12 * (1 - taut));
            this.strand(off, this.b, (.5 + .12 * Math.abs(i)) * (1 - taut), .035, k * fade, i);
          }
          st.light(this.b.copy(reach).setY(reach.y - .3), 4, THREAD, (.2 + .3 * taut) * fade);
        }
      } else if (s.action === 'special' && !s.branch) {
        if (elapsed < RUSH - .1) { const k = clamp(elapsed / (RUSH - .1)); for (let i = -1; i <= 1; i++) this.strand(hand, strike, .2 + .08 * i, .035, k, i); st.glow(strike, .3 * k, THREAD.core, .8 * k); st.light(strike, 3.5, THREAD, .35 * k); }
        else if (elapsed < RUSH_END + .12) this.rush(f, strike, clamp((elapsed - RUSH + .1) / .1) * clamp((RUSH_END + .12 - elapsed) / .1), time, seed, 10);
      } else if (s.action === 'ultimate' && !s.branch && s.confirmedAt === undefined && elapsed < FIRST + .12) {
        const k = clamp(elapsed / FIRST);
        this.strand(hand, strike, .2, .04, k, 0); st.glow(strike, .28 * k, THREAD.core, .8 * k); st.light(strike, 3.2, THREAD, .3 * k);
      }
    }
    for (const l of this.links) {
      if (!l.actor) continue;
      const actor = fighters.get(l.actor), victim = fighters.get(l.target), s = actor?.state;
      if (!actor || !s?.alive || !victim?.state.alive && !l.final || s.action !== 'ultimate' || s.branch || (s.actionSeq ?? -1) !== l.seq || s.whiffedAt !== undefined) { l.actor = ''; continue; }
      const elapsed = s.actionTime * s.actionDuration;
      if (elapsed > ULT.duration) { l.actor = ''; continue; }
      if (!l.final && elapsed < LAST && victim) this.ocean(actor, victim, l, elapsed, time);
    }
    for (const m of this.marks) {
      if (!m.live) continue;
      const age = time - m.born;
      if (age >= m.life) { m.live = false; continue; }
      if (age >= 0) this.drawMark(m, age);
    }
    st.close();
  }

  private face(f: Fighter) {
    const yaw = f.state.yaw ?? f.group.rotation.y;
    this.side.set(Math.cos(yaw), 0, -Math.sin(yaw));
    return this.heading.set(Math.sin(yaw), 0, Math.cos(yaw));
  }
  private strand(from: THREE.Vector3, to: THREE.Vector3, sag: number, width: number, k: number, number: number) {
    if (k <= .02) return;
    this.c.copy(from).lerp(to, .5); this.c.y -= sag; this.c.x += number * .06; this.c.z += number * .04;
    limb(this.stage, from, this.c, to, width, THREAD, 1, k, 7, .8);
  }
  private rush(f: Fighter, strike: THREE.Vector3, k: number, time: number, seed: number, count: number, to?: THREE.Vector3) {
    if (k <= .02) return;
    const st = this.stage, target = to ?? this.b.copy(strike).addScaledVector(this.heading, .7);
    fistRush(st, this.a.copy(strike).addScaledVector(this.heading, -.1), target, THREAD, k, time, seed, count, .55, .6);
    st.light(this.a.copy(target).addScaledVector(this.heading, .6).setY(target.y + .3), 4.5, THREAD, .45 * k);
    st.speed(.35 * k, f.state.id);
  }

  private ocean(actor: Fighter, victim: Fighter, l: Link, elapsed: number, time: number) {
    const st = this.stage, g = clamp((elapsed - FIRST) / (LAST - FIRST)), seed = l.seq * 2.7, feet = actor.group.position, heading = this.face(actor);
    const prey = bodyCentre(victim, this.prey);
    this.dir.subVectors(prey, feet).setY(0); if (this.dir.lengthSq() < .01) this.dir.copy(heading); this.dir.normalize();
    const across = this.across.set(this.dir.z, 0, -this.dir.x), hub = this.ground.copy(prey).addScaledVector(this.dir, 1.6), radius = 2.6 + 1 * g, strung = clamp((elapsed - FIRST) / .9);
    hub.y = Math.max(prey.y + .4, l.floor + 1.7);
    st.dim(.3 + .45 * g, l.actor, l.target);
    for (let i = 0; i < 8; i++) {
      const k = clamp(strung * 8 - i), ang = i * Math.PI / 4 + .2; if (k <= 0) continue;
      this.a.copy(hub).addScaledVector(across, Math.cos(ang) * radius * 1.25).addScaledVector(UP, Math.sin(ang) * radius * 1.05);
      if (this.a.y < l.floor + .05) this.a.y = l.floor + .05;
      this.b.copy(hub).lerp(this.a, .5); this.b.y -= .22;
      limb(st, hub, this.b, this.a, .05, THREAD, k, .85, 6, .7);
    }
    for (let ring = 1; ring <= 3; ring++) polygon(st, hub, across, UP, radius * ring / 3.2, 8, .04, THREAD.main, .8 * clamp((elapsed - FIRST - .7 - ring * .25) / .3), .2);
    st.glow(hub, 1.6 + g, THREAD.main, .14 + .12 * g);
    st.light(this.a.copy(prey).setY(prey.y + .5), 6 + 2 * g, THREAD, .3 + .3 * g);
    const hand = jolyneCommandJoint(actor.state) === 'LeftHand' ? actor.handL : actor.handR, strike = actor.strikePoint(this.strike);
    this.strand(hand, strike, .2, .045, .8, 0);
    if (elapsed > ULT.contacts[1] - .2 && elapsed < ULT.contacts[ULT.contacts.length - 2] + .15) this.rush(actor, strike, clamp((elapsed - ULT.contacts[1] + .2) / .12), time, seed, 12, prey);
    if (g > .85) st.speed(.5 * (g - .85) / .15, l.actor, l.target);
  }

  private drawMark(m: Mark, age: number) {
    const st = this.stage, w = age / m.life, fade = (1 - w) * (1 - w);
    if (m.kind === WRAP) {
      const tight = clamp(age / .05);
      for (let i = 0; i < 3; i++) polygon(st, this.a.copy(m.at).setY(m.at.y - .45 + i * .45), X, Z, (.62 - .16 * tight + .25 * w) * m.size, 10, .04, i === 1 ? THREAD.core : THREAD.main, 1.2 * fade, i * .7 + m.seed);
      return;
    }
    const out = clamp(age / .07), across = this.across.set(m.dir.z, 0, -m.dir.x);
    for (let i = 0, n = st.n(m.size > 3 ? 12 : 8, 5); i < n; i++) {
      const ang = i * Math.PI * 2 / n + m.seed, reach = m.size * (.6 + .4 * hash(i + m.seed)) * out, curl = (hash(i * 3 + m.seed) - .5) * m.size * .5;
      this.a.copy(m.at).addScaledVector(across, Math.cos(ang) * reach).addScaledVector(UP, Math.sin(ang) * reach);
      this.b.copy(m.at).lerp(this.a, .5).addScaledVector(across, -Math.sin(ang) * curl * w).addScaledVector(UP, Math.cos(ang) * curl * w);
      limb(st, m.at, this.b, this.a, .05 + m.size * .006, THREAD, 1, 1.2 * fade, 6, .5);
    }
  }

  private awakening(f: Fighter) {
    const st = this.stage, s = f.state;
    if (s.actionTime <= .16 || s.actionTime >= .9) return;
    const w = clamp((s.actionTime - .16) / .74), fade = Math.sin(w * Math.PI);
    for (let i = -1; i <= 1; i++) this.strand(f.handR, f.handL, .12 * (1 - w) + .04 * i, .04, fade, i);
    st.glow(f.handR, .2, THREAD.core, .7 * fade);
    if (w > .55) st.disc(this.p.copy(f.group.position), .6 + (w - .55) * 5, THREAD.main, fade * .7, WAVE, .96);
  }
  reset() {
    for (const l of this.links) l.actor = ''; for (const m of this.marks) m.live = false;
    this.seen.fill(-1); this.seenTime.fill(-1); this.cursor = this.linkCursor = this.markCursor = 0; this.stage.reset();
  }
  dispose() { if (this.disposed) return; this.reset(); this.disposed = true; this.stage.release(); }
}
