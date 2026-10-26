import * as THREE from 'three';
import type { CombatEvent } from '../../game/types';
import { AKAME_MOVES } from '../../game/fighters/akame';
import type { Fighter } from '../Fighter';
import type { Flight } from '../CombatEffects';
import { bodyCentre, type VfxKit } from '../vfx/VfxKit';
import { SIGNATURE, involvesLocal } from './context';
import { ABYSS } from './FlameSprites';
import { STAR } from './GlowBatch';
import { MoveStage, WAVE, type StageLook } from './MoveStage';
import { blowFloor } from './blowFloor';
import { Roster96Batch } from './Roster96Batch';
import { sweep } from './StageStrokes';

export const isAkameMurasame = (id: string | undefined) => id === 'akame';
export const AKAME_VFX_LIMITS = Object.freeze({ ink: 192, marks: 16, burials: 6 });
export const AKAME_BLADE = { root: [-.015, .13500000536441803, .010], tip: [-.01509892135858535767, .9346148371696472, .06012013018131256] } as const;
const UP = new THREE.Vector3(0, 1, 0);
const lin = (r: number, g: number, b: number) => new THREE.Color(r, g, b);
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const hash = (x: number) => { const v = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
export function akameBlade(f: Fighter, root: THREE.Vector3, tip: THREE.Vector3): boolean {
  const bone = (f.shownBody ?? f).bones?.get('sword'); if (!bone) return false;
  root.fromArray(AKAME_BLADE.root).applyMatrix4(bone.matrixWorld); tip.fromArray(AKAME_BLADE.tip).applyMatrix4(bone.matrixWorld); return true;
}
const EDGE: StageLook = { core: lin(3.2, 2.3, 2.3), main: lin(2, .12, .2), rim: lin(.7, .03, .07), light: lin(1.3, .2, .24), element: { spike: 0xffe4e0, rim: 0xef2148, light: 0xff3a55, ink: 0x170b18 }, shell: 0xef2148, edge: 0x4a0612, flame: -1, dark: false, heart: 0 };
const BLOODLINE: StageLook = { ...EDGE, core: lin(2.2, .14, .22), main: lin(1.35, .05, .1) };
const CURSE: StageLook = { core: lin(2.8, .45, .6), main: lin(1.7, .1, .18), rim: lin(.55, .03, .07), light: lin(1, .14, .18), element: { spike: 0xff8a9a, rim: 0xc20a26, light: 0xd0102e, ink: 0x170b18 }, shell: 0xc20a26, edge: 0x170b18, flame: ABYSS, dark: true, heart: 0,
  sphere: { body: lin(.03, .004, .008), core: lin(.55, .03, .07), rimA: lin(2.6, .22, .3), rimB: lin(1.5, .06, .12), spin: 1.2 } };
const INK = new THREE.Color(.012, .004, .014);
const HEAVY = AKAME_MOVES.heavy, SPECIAL = AKAME_MOVES.special, ULT = AKAME_MOVES.ultimate;
const FIRST = ULT.contacts[0], SECOND = ULT.contacts[1], LAST = ULT.contacts[2];
const ARC = .24, THRUST = .26;
const CUT = 0, CURSED = 1;
type Burial = { actor: string; target: string; seq: number; final: boolean; floor: number };
type Mark = { kind: number; born: number; life: number; size: number; seed: number; tilt: number; at: THREE.Vector3; dir: THREE.Vector3; live: boolean };

export class AkameMurasame {
  private readonly stage: MoveStage;
  private readonly ink: Roster96Batch;
  private burials: Burial[] = Array.from({ length: AKAME_VFX_LIMITS.burials }, () => ({ actor: '', target: '', seq: -1, final: false, floor: 0 }));
  private marks: Mark[] = Array.from({ length: AKAME_VFX_LIMITS.marks }, () => ({ kind: 0, born: -1e9, life: 0, size: 1, seed: 0, tilt: 0, at: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, 1), live: false }));
  private seen = new Float64Array(128).fill(-1); private seenTime = new Float64Array(128).fill(-1);
  private cursor = 0; private burialCursor = 0; private markCursor = 0; private disposed = false;
  private p = new THREE.Vector3(); private a = new THREE.Vector3(); private b = new THREE.Vector3(); private c = new THREE.Vector3(); private d = new THREE.Vector3(); private u = new THREE.Vector3(); private v = new THREE.Vector3();
  private heading = new THREE.Vector3(); private side = new THREE.Vector3(); private dir = new THREE.Vector3(); private ground = new THREE.Vector3();
  private root = new THREE.Vector3(); private tip = new THREE.Vector3(); private q = new THREE.Quaternion();
  constructor(scene: THREE.Scene, kit: Pick<VfxKit, 'budget'> & Partial<VfxKit>) {
    this.stage = MoveStage.for(scene, kit);
    this.ink = new Roster96Batch(scene, 'akame-curse-ink', new THREE.BoxGeometry(1, 1, 1), AKAME_VFX_LIMITS.ink); this.ink.mesh.renderOrder = 6;
  }
  load(_ids: readonly string[]): Promise<void> { return Promise.resolve(); }
  private cancel(id: string, victim = false) { for (const b of this.burials) if (b.actor === id || victim && b.target === id && !b.final) b.actor = ''; }
  private mark(kind: number, at: THREE.Vector3, dir: THREE.Vector3, born: number, life: number, size: number, tilt = .5) {
    const m = this.marks[this.markCursor++ % this.marks.length];
    m.kind = kind; m.at.copy(at); m.dir.copy(dir); m.born = born; m.life = life; m.size = size; m.tilt = tilt; m.seed = (Math.abs(at.x * 9.7 + at.z * 5.3 + born * 3.1)) % 61; m.live = true;
  }

  handle(e: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    if (this.disposed) return;
    if (e.kind === 'eliminated' || e.kind === 'respawn') { this.cancel(e.actorId, true); return; }
    if (!isAkameMurasame(e.fighter)) return;
    if (e.kind === 'whiff' || e.kind === 'rejected') { this.cancel(e.actorId); return; }
    if (e.kind !== 'hit' && e.kind !== 'confirm') return;
    for (let i = 0; i < this.seen.length; i++) if (this.seen[i] === e.id && this.seenTime[i] === e.serverTime) return;
    const index = this.cursor++ % this.seen.length; this.seen[index] = e.id; this.seenTime[index] = e.serverTime;
    const actor = fighters?.get(e.actorId), victim = e.targetId ? fighters?.get(e.targetId) : undefined, seq = e.actionSeq ?? actor?.state.actionSeq ?? -1;
    let floor = blowFloor(actor, victim, Infinity);
    if (e.kind === 'confirm') {
      if (e.slot === 'ultimate' && !e.branch && e.targetId) Object.assign(this.burials[this.burialCursor++ % this.burials.length], { actor: e.actorId, target: e.targetId, seq, final: false, floor: Number.isFinite(floor) ? floor : 0 });
      return;
    }
    if (!victim && !e.endpoint) return;
    const final = e.slot === 'ultimate' && !e.branch && e.contactIndex === ULT.contacts.length - 1, point = this.p, st = this.stage, t = e.serverTime;
    if (victim) bodyCentre(victim, point); else point.set(e.endpoint!.x, e.endpoint!.y, e.endpoint!.z);
    if (!Number.isFinite(floor)) floor = point.y - 1.05;
    let confirmed = false;
    if (final) for (const b of this.burials) if (b.actor === e.actorId && b.seq === seq) { b.final = true; floor = b.floor; confirmed = true; }
    if (final && !confirmed) return;
    const dir = this.dir;
    if (actor) { dir.subVectors(point, actor.group.position).setY(0); if (dir.lengthSq() < .01) dir.set(Math.sin(actor.state.yaw ?? 0), 0, Math.cos(actor.state.yaw ?? 0)); dir.normalize(); } else dir.set(0, 0, 1);
    const ground = this.ground.set(point.x, floor, point.z);
    if (e.slot === 'light') { this.mark(CUT, point, dir, t, .26, .8, .45); st.burst(point, EDGE, .34, t, { dir, floor, clean: true }); return; }
    if (e.slot === 'heavy') {
      const big = e.branch ? .85 : 1;
      this.mark(CUT, point, dir, t, .36, 1.6 * big, -.5);
      this.mark(CURSED, point, dir, t + .06, 1, 1.25 * big);
      st.burst(point, EDGE, .8 * big, t, { dir, floor });
      st.shock(ground, EDGE, 3.8 * big, t, .4);
      st.scar(ground, CURSE, 1.6 * big, t + .08, 1.3);
      return;
    }
    if (e.slot === 'special') {
      if (e.branch === 'airSpecial') { st.burst(point, EDGE, 2, t, { floor }); st.shock(ground, EDGE, 4.5, t, .45); st.scar(ground, CURSE, 3.2, t, 1.8); return; }
      const big = e.branch ? .7 : 1;
      this.mark(CUT, point, dir, t, .45, 3.6 * big, 0);
      this.mark(CUT, point, dir, t + .04, .4, 2.6 * big, .14);
      this.mark(CURSED, point, dir, t + .08, 1.5, 2.5 * big);
      st.burst(point, EDGE, 1.9 * big, t, { dir, floor });
      st.shock(ground, EDGE, 5.5 * big, t, .45);
      st.erupt(ground, UP, CURSE, .6 * big, 3.8 * big, t + .14, .7);
      st.scar(ground, CURSE, 3.2 * big, t + .1, 1.9);
      return;
    }
    if (e.slot !== 'ultimate' || e.branch) return;
    if (!final) {
      this.mark(CUT, point, dir, t, .4, e.contactIndex ? 2.4 : 1.6, .55);
      if (e.contactIndex) { this.mark(CUT, point, dir, t + .05, .4, 2.4, -.55); st.shock(ground, EDGE, 5, t, .5); }
      st.burst(point, EDGE, e.contactIndex ? 1.5 : 1, t, { dir, floor });
      return;
    }
    if (involvesLocal(e.actorId, e.targetId)) SIGNATURE.screen?.impactFrame?.(.4, point);
    this.mark(CUT, point, dir, t, .7, 8, .06);
    this.mark(CURSED, point, dir, t + .1, 1.4, 5.5);
    st.burst(point, EDGE, 2.4, t, { dir, floor });
    st.shatter(point, dir, BLOODLINE, 6, t + .08, .9);
    st.shock(ground, EDGE, 9, t, .6);
    st.erupt(ground, UP, CURSE, 1, 9, t + .16, .75);
    st.scar(ground, CURSE, 5, t + .12, 2.1);
  }

  update(time: number, fighters: ReadonlyMap<string, Fighter>, _flights?: ReadonlyMap<string, Flight>) {
    if (this.disposed) return;
    const st = this.stage.open(time); this.ink.begin(time);
    for (const f of fighters.values()) {
      const s = f.state; if (!isAkameMurasame(s.fighter) || !s.alive) continue;
      if (s.action === 'awaken') { this.awakening(f); continue; }
      if (s.whiffedAt !== undefined || (s.action !== 'light' && s.action !== 'heavy' && s.action !== 'special' && s.action !== 'ultimate')) continue;
      const elapsed = s.actionTime * s.actionDuration, seed = (s.actionSeq ?? 0) * 5.3, feet = f.group.position, heading = this.face(f), side = this.side;
      if (s.action === 'light') {
        this.edge(f, Math.sin(clamp(s.actionTime) * Math.PI), .6);
      } else if (s.action === 'heavy') {
        const contact = s.branch ? s.actionDuration * .55 : HEAVY.contacts[0];
        if (elapsed < contact) { const k = clamp(elapsed / contact); this.edge(f, k, 1); st.charge(this.tip, EDGE, .18, k, seed); }
        else if (elapsed < contact + ARC) {
          const w = (elapsed - contact) / ARC, cut = clamp(w / .3), fade = 1 - w * w;
          this.edge(f, fade, 1);
          this.p.copy(feet).setY(feet.y + 1.15);
          sweep(st, this.p, heading, side, 2.3, 1.3, 1.3 - 2.6 * cut, .2, EDGE, 1.5 * fade, 12);
          st.light(this.a.copy(this.p).addScaledVector(heading, 1.9), 5, EDGE, .5 * fade);
        }
      } else if (s.action === 'special' && !s.branch) {
        const release = SPECIAL.contacts[0];
        if (elapsed < release) {
          const k = clamp(elapsed / release);
          this.edge(f, k, 1.2);
          st.charge(this.tip, EDGE, .3, k, seed);
          st.speed(.3 * k, s.id);
        } else if (elapsed < release + THRUST && !this.marked(time)) {
          const w = (elapsed - release) / THRUST;
          this.line(this.p.copy(feet).addScaledVector(heading, 2.2).setY(feet.y + 1.15), heading, 2.2 * clamp(w / .2), 1 - w * w, 1);
        }
      } else if (s.action === 'ultimate' && !s.branch && s.confirmedAt === undefined && elapsed < FIRST + .12) {
        const k = clamp(elapsed / FIRST);
        this.edge(f, k, 1.2); st.charge(this.tip, EDGE, .24, k, seed);
      }
    }
    for (const b of this.burials) {
      if (!b.actor) continue;
      const actor = fighters.get(b.actor), victim = fighters.get(b.target), s = actor?.state;
      if (!actor || !s?.alive || !victim?.state.alive && !b.final || s.action !== 'ultimate' || s.branch || (s.actionSeq ?? -1) !== b.seq || s.whiffedAt !== undefined) { b.actor = ''; continue; }
      const elapsed = s.actionTime * s.actionDuration;
      if (elapsed > ULT.duration) { b.actor = ''; continue; }
      if (!b.final && elapsed < LAST && victim) this.gather(actor, victim, b, elapsed);
    }
    for (const m of this.marks) {
      if (!m.live) continue;
      const age = time - m.born;
      if (age >= m.life) { m.live = false; continue; }
      if (age < 0) continue;
      const w = age / m.life;
      if (m.kind === CUT) { this.d.set(m.dir.z, 0, -m.dir.x).multiplyScalar(Math.cos(m.tilt)).addScaledVector(UP, Math.sin(m.tilt)); if (m.tilt === 0) this.d.copy(m.dir); this.line(m.at, this.d, m.size * clamp(age / .05), (1 - w) * (1 - w), m.size > 2 ? 1.3 : 1, m.size > 1); }
      else this.curse(m.at, m.dir, m.size, clamp(age / (.25 + m.size * .08)), w < .55 ? 1 : 1 - (w - .55) / .45, m.seed);
    }
    this.ink.end(); st.close();
  }

  private face(f: Fighter) {
    const yaw = f.state.yaw ?? f.group.rotation.y;
    this.side.set(Math.cos(yaw), 0, -Math.sin(yaw));
    return this.heading.set(Math.sin(yaw), 0, Math.cos(yaw));
  }
  private marked(time: number) { for (const m of this.marks) if (m.live && m.kind === CUT && m.tilt === 0 && time - m.born < THRUST) return true; return false; }

  private edge(f: Fighter, k: number, size: number) {
    const st = this.stage;
    if (!akameBlade(f, this.root, this.tip)) { this.root.copy(f.handR); this.tip.copy(f.handR).addScaledVector(this.heading, .7).addScaledVector(UP, .35); }
    if (k <= .02) return;
    st.streak(this.root, this.tip, .07 * size, EDGE.main, k); st.streak(this.root, this.tip, .024 * size, EDGE.core, 1.2 * k);
    st.glow(this.tip, .2 * size, EDGE.main, .7 * k); st.glow(this.tip, .07 * size, EDGE.core, k, STAR, .2, 2);
    st.light(this.p.copy(this.root).lerp(this.tip, .6), 2 + size, EDGE, .26 * k);
  }
  private line(at: THREE.Vector3, along: THREE.Vector3, reach: number, fade: number, weight: number, lit = true) {
    if (fade <= .02 || reach <= .05) return;
    const st = this.stage;
    this.a.copy(at).addScaledVector(along, -reach); this.b.copy(at).addScaledVector(along, reach);
    st.streak(this.a, this.b, .17 * weight * (.35 + .65 * fade), EDGE.main, 1.2 * fade); st.streak(this.a, this.b, .045 * weight * (.35 + .65 * fade), EDGE.core, 1.7 * fade);
    st.glow(at, .34 * weight, EDGE.core, .7 * fade, STAR, .2, 5);
    if (lit) st.light(at, 3.5 + Math.min(3, reach), EDGE, .5 * fade);
  }
  private stroke(a: THREE.Vector3, b: THREE.Vector3, width: number, fade: number) {
    this.c.subVectors(b, a); const len = this.c.length(); if (len < .01) return;
    this.q.setFromUnitVectors(UP, this.c.divideScalar(len));
    this.stage.streak(a, b, width * 2.6, BLOODLINE.main, .95 * fade);
    this.ink.add(this.c.copy(a).lerp(b, .5), this.q, width, len, width * .5, INK, .94 * fade);
  }
  private curse(at: THREE.Vector3, normal: THREE.Vector3, radius: number, k: number, fade: number, seed: number) {
    if (k <= .02 || fade <= .02) return;
    const st = this.stage, u = this.u.set(normal.z, 0, -normal.x), v = this.v.copy(UP), arms = st.n(7, 4), width = Math.max(.03, radius * .02);
    for (let i = 0; i < arms; i++) {
      const ang = (i + hash(seed + i * 7.1) * .7) * Math.PI * 2 / arms, reach = radius * (.55 + .45 * hash(seed + i * 3.3)) * k;
      let px = 0, py = 0;
      for (let s = 1; s <= 4; s++) {
        const turn = ang + (hash(seed + i * 13.7 + s * 5.3) - .5) * 1.1, r = reach * s / 4, nx = Math.cos(turn) * r, ny = Math.sin(turn) * r;
        this.a.copy(at).addScaledVector(u, px).addScaledVector(v, py); this.b.copy(at).addScaledVector(u, nx).addScaledVector(v, ny);
        this.stroke(this.a, this.b, width * (1.5 - s * .25), fade);
        if (s === 2 || (s === 3 && i % 2 === 0)) {
          const off = turn + (hash(seed + i * 2.9 + s) > .5 ? .8 : -.8), len = reach * (.22 + .2 * hash(seed + i + s * 1.9));
          this.d.copy(this.b).addScaledVector(u, Math.cos(off) * len).addScaledVector(v, Math.sin(off) * len);
          this.stroke(this.b, this.d, width * .8, fade);
        }
        px = nx; py = ny;
      }
    }
    st.light(at, Math.min(8, radius * 1.3 + 2), EDGE, .34 * fade);
  }

  private gather(actor: Fighter, victim: Fighter, b: Burial, elapsed: number) {
    const st = this.stage, g = clamp((elapsed - FIRST) / (LAST - FIRST)), seed = b.seq * 2.3;
    this.face(actor); bodyCentre(victim, this.p);
    const prey = this.ground.copy(this.p), floor = this.c.set(prey.x, b.floor, prey.z);
    this.dir.subVectors(prey, actor.group.position).setY(0); if (this.dir.lengthSq() < .01) this.dir.copy(this.heading); this.dir.normalize();
    st.dim(.3 + .45 * g, b.actor, b.target);
    st.pool(floor, 2.4 + 2.8 * g, CURSE, Math.min(1, .25 + g * 1.1), seed);
    st.ring(floor, 2.3 + .4 * g, .7 + 1.2 * g, CURSE, .5 + .5 * g, seed, 7);
    const across = this.u.set(this.dir.z, 0, -this.dir.x);
    for (let i = 0, n = Math.floor((LAST - FIRST - .5) / .2); i < n; i++) {
      const born = FIRST + .22 + i * .2, age = elapsed - born;
      if (age < 0 || age > .5 || Math.abs(born - SECOND) < .12) continue;
      const tilt = (hash(seed + i * 4.7) - .5) * 2.2, w = age / .5;
      this.d.copy(across).multiplyScalar(Math.cos(tilt)).addScaledVector(UP, Math.sin(tilt));
      this.v.copy(prey); this.v.y += (hash(seed + i * 9.1) - .5) * .8;
      this.line(this.v, this.d, (1.7 + 1.1 * hash(seed + i * 2.3) + g) * clamp(age / .05), (1 - w) * (1 - w), .8, false);
    }
    this.edge(actor, .6 + .4 * g, 1.3);
    st.charge(this.tip, EDGE, .22 + .16 * g, Math.max(.35, g), seed);
    st.light(this.v.copy(prey).setY(prey.y + .4), 6 + 2 * g, EDGE, .3 + .3 * g);
    if (g > .8) st.speed(.5 * (g - .8) / .2, b.actor, b.target);
  }

  private awakening(f: Fighter) {
    const st = this.stage, w = clamp(f.state.actionTime), flare = clamp((w - .37) / .17) * clamp((.97 - w) / .21);
    if (flare <= 0) return;
    st.disc(this.p.copy(f.group.position), .7 + flare * 1.4, EDGE.main, flare * .7, WAVE, .96);
    for (let i = 0, n = st.n(10, 5); i < n; i++) {
      const theta = i * 2.39996, level = (i % 5) / 4, radius = (.3 + level * .36) * (1 - .33 * clamp((w - .68) / .2));
      this.a.set(f.group.position.x + Math.sin(theta) * radius, f.group.position.y + .2 + level * 1.3, f.group.position.z + Math.cos(theta) * radius);
      this.b.copy(this.a).addScaledVector(UP, .16 + flare * .3); this.b.x -= Math.sin(theta) * .08; this.b.z -= Math.cos(theta) * .08;
      this.stroke(this.a, this.b, .03, flare * .9);
    }
    st.light(this.p.setY(f.group.position.y + 1), 3.5, EDGE, .4 * flare);
  }
  reset() {
    for (const b of this.burials) b.actor = ''; for (const m of this.marks) m.live = false;
    this.seen.fill(-1); this.seenTime.fill(-1); this.cursor = this.burialCursor = this.markCursor = 0;
    this.ink.begin(0); this.ink.end(); this.stage.reset();
  }
  dispose() { if (this.disposed) return; this.reset(); this.disposed = true; this.ink.dispose(); this.stage.release(); }
}
