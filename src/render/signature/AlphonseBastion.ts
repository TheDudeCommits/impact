import * as THREE from 'three';
import type { CombatEvent } from '../../game/types';
import { ALPHONSE_ELRIC_AWAKENING, ALPHONSE_ELRIC_MOVES, alphonseStrikeJoint } from '../../game/fighters/alphonse-elric';
import type { Fighter } from '../Fighter';
import type { Flight } from '../CombatEffects';
import { bodyCentre, type VfxKit } from '../vfx/VfxKit';
import { SIGNATURE, involvesLocal } from './context';
import { reaction, STONE, STONE_DARK, StoneBatch, transmutationCircle } from './AlchemyParts';
import { STAR } from './GlowBatch';
import { MoveStage, type StageLook } from './MoveStage';
import { blowFloor } from './blowFloor';
import { bolt } from './StageStrokes';

export { alphonseAuthoredKick, alphonseAuthoredGround } from '../../game/fighters/alphonse-elric';
export const isAlphonseBastion = (id: string | undefined) => id === 'alphonse-elric';
export const ALPHONSE_BASTION_ASSETS: readonly string[] = Object.freeze([]);
export const ALPHONSE_BASTION_LIMITS = Object.freeze({ stones: 96, marks: 10, ridges: 4, confirms: 8 });
export const ALPHONSE_BASTION_BEATS = Object.freeze({ clap: .3, release: .85, final: 3.56 });
const BRANCH = Object.freeze({ lh: 'Steel Backhand', llh: 'Armored Rising Fist', lllh: 'Hammering Elbow', llls: 'Foundation Breaker', airHeavy: 'Iron Heel', airSpecial: 'Bulwark Descent' });
export function alphonseStrikePoint(f: Fighter, out: THREE.Vector3, clip?: string, sourceTime?: number, index?: number) {
  const s = f.state; if (!clip && s.branch) clip = BRANCH[s.branch]; if (!clip && s.action === 'light' && s.chain) clip = `Rush ${s.chain}`;
  if (!clip) clip = s.action === 'heavy' ? 'Iron Shoulder' : s.action === 'special' ? 'Seismic Palm' : s.action === 'ultimate' ? 'Soulbound Bastion' : 'Armored Straight';
  const i = index ?? ((sourceTime ?? s.actionTime * s.actionDuration) > 3.2 ? 2 : (sourceTime ?? s.actionTime * s.actionDuration) > 1 ? 1 : 0);
  const joint = alphonseStrikeJoint(clip, i); if (joint === 'BothHands') return out.copy(f.handL).lerp(f.handR, .5);
  if (joint === 'RightHand' || joint === 'LeftHand') return out.copy(joint === 'RightHand' ? f.handR : f.handL);
  const bone = f.bones?.get(joint.toLowerCase()); if (bone) return bone.getWorldPosition(out); return out.copy(f.handR);
}

const UP = new THREE.Vector3(0, 1, 0);
const lin = (r: number, g: number, b: number) => new THREE.Color(r, g, b);
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const hash = (x: number) => { const v = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
const ALCH: StageLook = { core: lin(2.8, 3.1, 3.2), main: lin(.55, 1.6, 2.1), rim: lin(.15, .5, .9), light: lin(.78, 1.08, 1.25), element: { spike: 0xeafcff, rim: 0x78daf2, light: 0xa8e8ff, ink: 0x06161c }, shell: 0xa8e6ff, edge: 0x1a5a8a, flame: -1, dark: false, heart: .5 };
const HEAVY = ALPHONSE_ELRIC_MOVES.heavy, SPECIAL = ALPHONSE_ELRIC_MOVES.special, ULT = ALPHONSE_ELRIC_MOVES.ultimate;
const FIRST = ULT.contacts[0], LAST = ULT.contacts[2], CLAP = ALPHONSE_BASTION_BEATS.clap;
const SPACING = 1, RISE = .1, STANDS = .5, SINKS = .45;
const SLAB = 0, FIST = 1, FISTS = 2;
type Confirm = { actor: string; target: string; seq: number; floor: number; final: boolean };
type Mark = { kind: number; born: number; life: number; size: number; seed: number; at: THREE.Vector3; dir: THREE.Vector3; live: boolean };
type Ridge = { actor: string; origin: THREE.Vector3; heading: THREE.Vector3; reach: number; born: number; seen: number; floor: number; live: boolean };

export class AlphonseBastion {
  private readonly stage: MoveStage;
  private readonly stones: StoneBatch;
  private confirms: Confirm[] = Array.from({ length: ALPHONSE_BASTION_LIMITS.confirms }, () => ({ actor: '', target: '', seq: -1, floor: 0, final: false }));
  private marks: Mark[] = Array.from({ length: ALPHONSE_BASTION_LIMITS.marks }, () => ({ kind: 0, born: -1e9, life: 0, size: 1, seed: 0, at: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, 1), live: false }));
  private ridges: Ridge[] = Array.from({ length: ALPHONSE_BASTION_LIMITS.ridges }, () => ({ actor: '', origin: new THREE.Vector3(), heading: new THREE.Vector3(0, 0, 1), reach: 0, born: 0, seen: -1e9, floor: 0, live: false }));
  private seen = new Float64Array(128).fill(-1); private seenTime = new Float64Array(128).fill(-1);
  private cursor = 0; private confirmCursor = 0; private markCursor = 0; private disposed = false;
  private p = new THREE.Vector3(); private a = new THREE.Vector3(); private b = new THREE.Vector3(); private c = new THREE.Vector3(); private d = new THREE.Vector3();
  private heading = new THREE.Vector3(); private side = new THREE.Vector3(); private dir = new THREE.Vector3(); private ground = new THREE.Vector3(); private strike = new THREE.Vector3(); private across = new THREE.Vector3();
  constructor(scene: THREE.Scene, kit: Pick<VfxKit, 'budget'> & Partial<VfxKit>) { this.stage = MoveStage.for(scene, kit); this.stones = new StoneBatch(scene, 'alphonse-bastion-stone', ALPHONSE_BASTION_LIMITS.stones); }
  load(_ids: readonly string[]) { return Promise.resolve(); }
  private cancel(id: string, victim = false) { for (const c of this.confirms) if (c.actor === id || victim && c.target === id && !c.final) c.actor = ''; }
  private mark(kind: number, at: THREE.Vector3, dir: THREE.Vector3, born: number, life: number, size: number) {
    const m = this.marks[this.markCursor++ % this.marks.length];
    m.kind = kind; m.at.copy(at); m.dir.copy(dir); m.born = born; m.life = life; m.size = size; m.seed = (Math.abs(at.x * 8.3 + at.z * 4.7 + born * 3.1)) % 73; m.live = true;
  }

  handle(e: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    if (this.disposed) return;
    if (e.kind === 'eliminated' || e.kind === 'respawn') { this.cancel(e.actorId, true); return; }
    if (!isAlphonseBastion(e.fighter)) return;
    if (e.kind === 'whiff' || e.kind === 'rejected') { this.cancel(e.actorId); return; }
    if (e.kind !== 'hit' && e.kind !== 'confirm') return;
    for (let i = 0; i < this.seen.length; i++) if (this.seen[i] === e.id && this.seenTime[i] === e.serverTime) return;
    const index = this.cursor++ % this.seen.length; this.seen[index] = e.id; this.seenTime[index] = e.serverTime;
    const actor = fighters?.get(e.actorId), victim = e.targetId ? fighters?.get(e.targetId) : undefined, seq = e.actionSeq ?? actor?.state.actionSeq ?? -1;
    let floor = blowFloor(actor, victim, Infinity);
    if (e.kind === 'confirm') {
      if (e.slot === 'ultimate' && !e.branch && e.targetId) Object.assign(this.confirms[this.confirmCursor++ % this.confirms.length], { actor: e.actorId, target: e.targetId, seq, final: false, floor: Number.isFinite(floor) ? floor : 0 });
      return;
    }
    if (!victim && !e.endpoint) return;
    const final = e.slot === 'ultimate' && !e.branch && e.contactIndex === ULT.contacts.length - 1, point = this.p, st = this.stage, t = e.serverTime;
    if (victim) bodyCentre(victim, point); else point.set(e.endpoint!.x, e.endpoint!.y, e.endpoint!.z);
    if (!Number.isFinite(floor)) floor = point.y - 1.05;
    let confirmed = false;
    if (final) for (const c of this.confirms) if (c.actor === e.actorId && c.seq === seq) { c.final = true; floor = c.floor; confirmed = true; }
    if (final && !confirmed) return;
    const dir = this.dir;
    if (actor) { dir.subVectors(point, actor.group.position).setY(0); if (dir.lengthSq() < .01) dir.set(Math.sin(actor.state.yaw ?? 0), 0, Math.cos(actor.state.yaw ?? 0)); dir.normalize(); } else dir.set(0, 0, 1);
    const ground = this.ground.set(point.x, floor, point.z);
    if (e.slot === 'light') { st.burst(point, ALCH, .38, t, { dir, floor, clean: true }); return; }
    if (e.slot === 'heavy') {
      const big = e.branch ? .85 : 1;
      this.mark(SLAB, ground, dir, t, .8, big);
      st.burst(point, ALCH, .62 * big, t, { dir, floor });
      st.shock(ground, ALCH, 4.5 * big, t, .4);
      return;
    }
    if (e.slot === 'special') {
      if (e.branch === 'airSpecial') { st.burst(point, ALCH, 2, t, { floor }); st.shock(ground, ALCH, 4.5, t, .45); this.mark(FIST, ground, dir, t, 1.1, .8); return; }
      const big = e.branch ? .7 : 1;
      this.mark(FIST, ground, dir, t, 1.05, big);
      st.burst(point, ALCH, 1.8 * big, t, { dir, floor });
      st.shock(ground, ALCH, 5.5 * big, t, .45);
      st.scar(ground, ALCH, 2.6 * big, t + .1, 1.8);
      return;
    }
    if (e.slot !== 'ultimate' || e.branch) return;
    if (!final) {
      st.burst(point, ALCH, e.contactIndex ? 1.5 : 1, t, { dir, floor });
      if (e.contactIndex) { this.mark(FIST, ground, dir, t, .9, .72); st.shock(ground, ALCH, 5, t, .5); }
      return;
    }
    if (involvesLocal(e.actorId, e.targetId)) SIGNATURE.screen?.impactFrame?.(.47, point);
    this.mark(FISTS, ground, dir, t, 1.7, 1);
    st.burst(point, ALCH, 2.6, t, { dir, floor });
    st.shatter(this.a.copy(ground).setY(floor + .06), UP, ALCH, 7, t + .03, 1.2);
    st.shock(ground, ALCH, 10, t, .6);
    st.scar(ground, ALCH, 4.5, t + .15, 2);
  }

  update(time: number, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>) {
    if (this.disposed) return;
    const st = this.stage.open(time); this.stones.begin();
    for (const f of fighters.values()) {
      const s = f.state; if (!isAlphonseBastion(s.fighter) || !s.alive) continue;
      if (s.action === 'awaken') { this.awakening(f, time); continue; }
      if (s.whiffedAt !== undefined || (s.action !== 'light' && s.action !== 'heavy' && s.action !== 'special' && s.action !== 'ultimate')) continue;
      const elapsed = s.actionTime * s.actionDuration, seed = (s.actionSeq ?? 0) * 5.7, heading = this.face(f), strike = f.strikePoint(this.strike), tick = Math.floor(time * 30);
      if (s.action === 'light') {
        const k = Math.sin(clamp(s.actionTime) * Math.PI);
        bolt(st, this.a.copy(strike).addScaledVector(heading, -.5).setY(strike.y + .14), strike, .04, ALCH.main, .9 * k, tick, .13, 4, ALCH.heart);
        st.glow(strike, .28, ALCH.main, .6 * k); st.light(strike, 2.4, ALCH, .25 * k);
      } else if (s.action === 'heavy') {
        const contact = s.branch ? s.actionDuration * .55 : HEAVY.contacts[0];
        if (elapsed < contact) {
          const k = clamp(elapsed / contact);
          for (let i = 0; i < 2; i++) bolt(st, this.a.copy(strike).addScaledVector(heading, -.5).setY(strike.y + (i ? .3 : -.3)), strike, .04, ALCH.main, k, tick + i * 7, .15, 4, ALCH.heart);
          st.charge(strike, ALCH, .14, k, seed);
        } else if (elapsed < contact + .2) {
          const flare = 1 - (elapsed - contact) / .2;
          st.glow(this.a.copy(strike).addScaledVector(heading, .3), .5 + .5 * flare, ALCH.main, .7 * flare); st.glow(this.a, .4, ALCH.core, .8 * flare, STAR, .2, tick);
          st.light(this.a, 4, ALCH, .4 * flare);
        }
      } else if (s.action === 'special' && !s.branch) {
        const release = SPECIAL.contacts[0];
        if (elapsed < release) this.transmute(f, elapsed, release, 1.8, time, seed);
      } else if (s.action === 'ultimate' && !s.branch && s.confirmedAt === undefined && elapsed < FIRST + .12) {
        const k = clamp(elapsed / FIRST);
        bolt(st, this.a.copy(strike).addScaledVector(heading, -.5).setY(strike.y + .15), strike, .04, ALCH.main, k, tick, .14, 4, ALCH.heart);
        st.charge(strike, ALCH, .22, k, seed);
      }
    }
    this.ridgesFrom(flights, fighters, time);
    for (const c of this.confirms) {
      if (!c.actor) continue;
      const actor = fighters.get(c.actor), victim = fighters.get(c.target), s = actor?.state;
      if (!actor || !s?.alive || !victim?.state.alive && !c.final || s.action !== 'ultimate' || s.branch || (s.actionSeq ?? -1) !== c.seq || s.whiffedAt !== undefined) { c.actor = ''; continue; }
      const elapsed = s.actionTime * s.actionDuration;
      if (elapsed > ULT.duration) { c.actor = ''; continue; }
      if (!c.final && elapsed < LAST && victim) this.gather(actor, victim, c, elapsed, time);
    }
    for (const m of this.marks) {
      if (!m.live) continue;
      const age = time - m.born;
      if (age >= m.life) { m.live = false; continue; }
      if (age >= 0) this.drawMark(m, age, time);
    }
    this.stones.end(); st.close();
  }

  private face(f: Fighter) {
    const yaw = f.state.yaw ?? f.group.rotation.y;
    this.side.set(Math.cos(yaw), 0, -Math.sin(yaw));
    return this.heading.set(Math.sin(yaw), 0, Math.cos(yaw));
  }
  private transmute(f: Fighter, elapsed: number, release: number, radius: number, time: number, seed: number) {
    const st = this.stage, feet = f.group.position, hands = this.a.copy(f.handR).lerp(f.handL, .5), tick = Math.floor(time * 30);
    if (elapsed < CLAP) { st.charge(hands, ALCH, .2, clamp(elapsed / CLAP), seed); return; }
    const k = clamp((elapsed - CLAP) / Math.max(.05, release - CLAP)), clap = 1 - clamp((elapsed - CLAP) / .14);
    if (clap > 0) { st.glow(hands, .5 + .5 * clap, ALCH.core, clap, STAR, .22, tick); st.light(hands, 4, ALCH, .7 * clap); }
    this.p.copy(feet).addScaledVector(this.heading, 1.1);
    transmutationCircle(st, this.p, radius, ALCH, .25 + .75 * k, .9, time * .5);
    reaction(st, this.p, radius, 1.2 + .8 * k, ALCH, .5 + .5 * k, time, seed, 5);
    for (let i = -1; i <= 1; i += 2) bolt(st, i > 0 ? f.handR : f.handL, this.b.copy(this.p).addScaledVector(this.side, i * .6), .04, ALCH.main, .9, tick + i * 5, .2, 5, ALCH.heart);
    st.light(this.b.copy(this.p).setY(feet.y + .6), 4.5, ALCH, .3 + .4 * k);
    st.charge(hands, ALCH, .26, k, seed);
  }

  private ridgesFrom(flights: ReadonlyMap<string, Flight>, fighters: ReadonlyMap<string, Fighter>, time: number) {
    const st = this.stage, speed = SPECIAL.speed ?? 25;
    for (const flight of flights.values()) {
      if (!isAlphonseBastion(flight.fighter) || flight.slot !== 'special' || flight.branch || !flight.released || !flight.actorId) continue;
      let ridge = this.ridges.find(r => r.live && r.actor === flight.actorId && time - r.seen < .2);
      if (!ridge) {
        ridge = this.ridges.find(r => !r.live) ?? this.ridges[0];
        ridge.actor = flight.actorId; ridge.live = true; ridge.reach = 0;
        ridge.origin.copy(flight.origin ?? flight.position); ridge.heading.copy(flight.heading).setY(0); if (ridge.heading.lengthSq() < 1e-6) ridge.heading.set(0, 0, 1); ridge.heading.normalize();
        ridge.floor = fighters.get(flight.actorId)?.group.position.y ?? flight.position.y - 1.1;
        ridge.born = time - Math.max(0, this.p.subVectors(flight.position, ridge.origin).dot(ridge.heading)) / speed;
      }
      ridge.reach = Math.max(ridge.reach, this.p.subVectors(flight.position, ridge.origin).dot(ridge.heading)); ridge.seen = time;
      this.a.set(flight.position.x, ridge.floor, flight.position.z);
      reaction(st, this.a, .8, 1.5, ALCH, 1, time, ridge.born * 29, 4);
      st.glow(this.b.copy(this.a).setY(ridge.floor + .6), 1, ALCH.main, .7); st.glow(this.b, .32, ALCH.core, .9, STAR, .2, Math.floor(time * 24));
      st.light(this.b, 6, ALCH, 1);
    }
    for (const ridge of this.ridges) {
      if (!ridge.live) continue;
      const gone = time - ridge.seen;
      if (gone > STANDS + SINKS || gone < -.5) { ridge.live = false; continue; }
      const sunk = clamp((gone - STANDS) / SINKS);
      for (let i = 1, n = Math.min(30, Math.floor(ridge.reach / SPACING)); i <= n; i++) {
        const along = i * SPACING, passed = time - (ridge.born + along / speed), rise = clamp(passed / RISE) * (1 - sunk);
        if (rise <= .02) continue;
        const wide = (hash(i * 3.3 + ridge.born) - .5) * .5, tall = (.7 + .55 * hash(i * 2.1 + ridge.born)) * (1 + Math.min(.5, along * .03));
        this.p.copy(ridge.origin).addScaledVector(ridge.heading, along).setY(ridge.floor - .05); this.p.x += ridge.heading.z * wide; this.p.z -= ridge.heading.x * wide;
        this.stones.pillar(this.p, UP, .62 + .2 * hash(i + ridge.born), tall * rise, i * 1.3, i % 3 ? STONE : STONE_DARK);
      }
    }
  }

  private gather(actor: Fighter, victim: Fighter, c: Confirm, elapsed: number, time: number) {
    const st = this.stage, g = clamp((elapsed - FIRST) / (LAST - FIRST)), seed = c.seq * 2.1, feet = actor.group.position, heading = this.face(actor);
    const prey = bodyCentre(victim, this.c);
    this.dir.subVectors(prey, feet).setY(0); if (this.dir.lengthSq() < .01) this.dir.copy(heading); this.dir.normalize();
    const centre = this.ground.set(feet.x + (prey.x - feet.x) * .7, c.floor, feet.z + (prey.z - feet.z) * .7);
    st.dim(.3 + .45 * g, c.actor, c.target);
    transmutationCircle(st, centre, 2.6 + 2.6 * clamp(g * 1.6), ALCH, clamp((elapsed - FIRST) / .5), .5 + .2 * g, time * .3, .6);
    this.p.set(prey.x, c.floor, prey.z).addScaledVector(this.dir, .6);
    reaction(st, this.p, 1.8 + 2.2 * g, 1.4 + 1.4 * g, ALCH, .5 + .5 * g, time, seed, 5 + Math.round(4 * g));
    st.light(this.p.setY(c.floor + .8), 6 + 2 * g, ALCH, .3 + .3 * g);
    const across = this.across.set(this.dir.z, 0, -this.dir.x);
    for (let i = -3; i <= 3; i++) {
      const rise = clamp((elapsed - FIRST - .35 - Math.abs(i) * .16) / .2); if (rise <= 0) continue;
      const ang = i * .52;
      this.p.set(prey.x, c.floor - .05, prey.z).addScaledVector(this.dir, 3 * Math.cos(ang) + .3).addScaledVector(across, 3.4 * Math.sin(ang));
      this.stones.pillar(this.p, UP, 1.55 - .1 * Math.abs(i), (3.6 - .4 * Math.abs(i)) * rise, i * 1.7 + seed, i % 2 ? STONE_DARK : STONE);
    }
    this.a.copy(actor.handR).lerp(actor.handL, .5);
    st.glow(this.a, .22 + .1 * g, ALCH.core, .6 + .3 * g, STAR, .2, Math.floor(time * 24));
    if (g > .8) st.speed(.5 * (g - .8) / .2, c.actor, c.target);
  }

  private fist(base: THREE.Vector3, dir: THREE.Vector3, across: THREE.Vector3, wide: number, tall: number, turn: number) {
    if (tall <= .05) return;
    this.stones.pillar(base, dir, wide, tall, turn, STONE);
    for (let j = 0; j < 4; j++) {
      this.b.copy(base).addScaledVector(dir, tall * .9).addScaledVector(across, (j - 1.5) * wide * .24);
      this.stones.pillar(this.b, dir, wide * .3, Math.min(tall, wide * .55), turn + j * 1.7, j % 2 ? STONE_DARK : STONE);
    }
  }
  private drawMark(m: Mark, age: number, time: number) {
    const st = this.stage, w = age / m.life, rise = clamp(age / .1), sunk = clamp((w - .6) / .4), up = rise * (1 - sunk * sunk), across = this.across.set(m.dir.z, 0, -m.dir.x), lit = (1 - w) * (1 - w);
    this.p.copy(m.at); this.p.y -= .05;
    if (m.kind === SLAB) {
      for (let i = -1; i <= 1; i += 2) {
        this.a.copy(this.p).addScaledVector(across, i * 1.7 * m.size).addScaledVector(m.dir, .5);
        this.d.copy(UP).addScaledVector(across, i * .3).normalize();
        this.stones.pillar(this.a, this.d, 1.15 * m.size, 2.1 * m.size * up, m.seed + i, STONE);
        this.stones.pillar(this.b.copy(this.a).addScaledVector(m.dir, 1.3).addScaledVector(across, i * .25), this.d, .8 * m.size, 1.2 * m.size * up, m.seed + i * 3, STONE_DARK);
      }
      reaction(st, this.a.copy(this.p).addScaledVector(m.dir, .8), 1.4 * m.size, 1.5, ALCH, lit, time, m.seed, 4);
      st.light(this.b.copy(this.p).addScaledVector(m.dir, .8).setY(m.at.y + 1), 4.5, ALCH, .4 * lit);
      return;
    }
    if (m.kind === FIST) this.fist(this.p, this.d.copy(UP).addScaledVector(m.dir, .14).normalize(), across, 1.05 * m.size, 3.1 * m.size * up, m.seed);
    else {
      this.fist(this.p, this.d.copy(UP).addScaledVector(m.dir, .1).normalize(), across, 1.25, 4.2 * up, m.seed);
      for (let i = -1; i <= 1; i += 2) {
        this.a.copy(this.p).addScaledVector(across, i * 3).addScaledVector(m.dir, .5);
        this.fist(this.a, this.d.copy(across).multiplyScalar(-i * .62).addScaledVector(UP, .78).normalize(), m.dir, 1.2, 4 * up, m.seed + i * 3);
      }
    }
    const many = m.kind === FISTS;
    reaction(st, this.a.copy(this.p).addScaledVector(m.dir, many ? 1.2 : .3), (many ? 2.6 : 1.3) * m.size, (many ? 3 : 1.8) * m.size, ALCH, lit, time, m.seed, many ? 9 : 5);
    st.light(this.a.copy(m.at).setY(m.at.y + 1), (many ? 8 : 5) * Math.max(.7, m.size), ALCH, .6 * lit);
  }

  private awakening(f: Fighter, time: number) {
    const st = this.stage, w = clamp(f.state.actionTime), B = ALPHONSE_ELRIC_AWAKENING.beats, tick = Math.floor(time * 30);
    if (w < B.clap || w > .97) return;
    this.face(f);
    const hands = this.a.copy(f.handR).lerp(f.handL, .5), clap = 1 - clamp((w - B.clap) / .1), fade = clamp((.97 - w) / .1);
    if (clap > 0) { st.glow(hands, .45 + .4 * clap, ALCH.core, clap, STAR, .22, tick); st.light(hands, 3.5, ALCH, .6 * clap); }
    transmutationCircle(st, f.group.position, 1.5, ALCH, clamp((w - B.clap) / .15), .8 * fade, time * .5);
    if (w > B.brace) reaction(st, f.group.position, 1.3, 1.3, ALCH, .7 * fade, time, 3, 4);
  }
  reset() {
    for (const c of this.confirms) c.actor = ''; for (const m of this.marks) m.live = false; for (const r of this.ridges) r.live = false;
    this.seen.fill(-1); this.seenTime.fill(-1); this.cursor = this.confirmCursor = this.markCursor = 0;
    this.stones.begin(); this.stones.end(); this.stage.reset();
  }
  dispose() { if (this.disposed) return; this.reset(); this.disposed = true; this.stones.dispose(); this.stage.release(); }
}
