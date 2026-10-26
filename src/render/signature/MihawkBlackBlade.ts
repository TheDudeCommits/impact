import * as THREE from 'three';
import type { CombatEvent } from '../../game/types';
import { MIHAWK_MOVES } from '../../game/fighters/mihawk';
import type { Fighter } from '../Fighter';
import type { Flight } from '../CombatEffects';
import { bodyCentre, type VfxKit } from '../vfx/VfxKit';
import { SIGNATURE, involvesLocal } from './context';
import { STAR } from './GlowBatch';
import { MoveStage, SHEEN, type StageLook } from './MoveStage';
import { blowFloor } from './blowFloor';
import { Crescents, crescentGeometry, ENERGY, type CrescentStyle } from './Crescent';
import { FloorGashes } from './FloorGash';

export const isMihawkBlackBlade = (id: string | undefined) => id === 'mihawk';
export const MIHAWK_BLACK_BLADE_LIMITS = Object.freeze({ crescents: 8, gashes: 10, cuts: 16, waves: 4, confirms: 6 });
const lin = (r: number, g: number, b: number) => new THREE.Color(r, g, b);
export const YORU: StageLook = { core: lin(2.5, 3.2, 2.2), main: lin(.3, 1.85, .6), rim: lin(.04, .34, .1), light: lin(.5, 1.2, .58),
  element: { spike: 0xeafff0, rim: 0x3fd97a, light: 0x9cf0b0, ink: 0x08140c }, shell: 0x4fe07e, edge: 0x0c3a1c, flame: -1, dark: false, heart: 0 };
const WAVE: CrescentStyle = { mode: ENERGY, edge: lin(2.6, 3.3, 2.3), body: lin(.2, 1.25, .42), glow: lin(.2, 1.5, .5), light: lin(.4, 1.2, .52) };
const GASH = lin(.5, 2.4, .85);
const ARC = 1.05, UP = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0);
const HEAVY = MIHAWK_MOVES.heavy, SPECIAL = MIHAWK_MOVES.special, ULT = MIHAWK_MOVES.ultimate;
const FINAL = ULT.contacts.length - 1;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number, a: number, b: number) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

const LINE = 0, FLY = 1, SPLIT = 2;
type Cut = { kind: number; live: boolean; born: number; life: number; at: THREE.Vector3; dir: THREE.Vector3; size: number; reach: number; roll: number; seed: number; floor: number };
type Wave = { live: boolean; actor: string; id: number; born: number; origin: THREE.Vector3; end: THREE.Vector3; hitAt: number; floor: number; big: number };
type Confirm = { actor: string; target: string; seq: number; floor: number; final: boolean };

export class MihawkBlackBlade {
  private readonly stage: MoveStage;
  private readonly crescents: Crescents;
  private readonly gashes: FloorGashes;
  private cuts: Cut[] = Array.from({ length: MIHAWK_BLACK_BLADE_LIMITS.cuts }, () => ({ kind: 0, live: false, born: 0, life: 0, at: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, 1), size: 1, reach: 0, roll: 0, seed: 0, floor: 0 }));
  private waves: Wave[] = Array.from({ length: MIHAWK_BLACK_BLADE_LIMITS.waves }, () => ({ live: false, actor: '', id: -1, born: 0, origin: new THREE.Vector3(), end: new THREE.Vector3(), hitAt: -1, floor: 0, big: 1 }));
  private confirms: Confirm[] = Array.from({ length: MIHAWK_BLACK_BLADE_LIMITS.confirms }, () => ({ actor: '', target: '', seq: -1, floor: 0, final: false }));
  private seen = new Float64Array(128).fill(-1); private seenTime = new Float64Array(128).fill(-1);
  private cursor = 0; private cutCursor = 0; private waveCursor = 0; private confirmCursor = 0; private disposed = false;
  private p = new THREE.Vector3(); private a = new THREE.Vector3(); private b = new THREE.Vector3(); private tip = new THREE.Vector3();
  private heading = new THREE.Vector3(); private dir = new THREE.Vector3(); private ground = new THREE.Vector3(); private side = new THREE.Vector3(); private centre = new THREE.Vector3();
  private basis = new THREE.Matrix4(); private q = new THREE.Quaternion(); private turn = new THREE.Quaternion();
  constructor(scene: THREE.Scene, kit: Pick<VfxKit, 'budget'> & Partial<VfxKit>) {
    this.stage = MoveStage.for(scene, kit);
    this.crescents = new Crescents(scene, crescentGeometry(ARC, .3, .62), MIHAWK_BLACK_BLADE_LIMITS.crescents, 'mihawk-yoru-crescent');
    this.gashes = new FloorGashes(scene, MIHAWK_BLACK_BLADE_LIMITS.gashes, 'mihawk-yoru-cut');
  }
  load(_ids: readonly string[]) { return Promise.resolve(); }
  private cancel(id: string, victim = false) { for (const c of this.confirms) if (c.actor === id || victim && c.target === id && !c.final) c.actor = ''; }
  private cut(kind: number, at: THREE.Vector3, dir: THREE.Vector3, size: number, born: number, life: number, floor: number, reach = 0, roll = 0) {
    const c = this.cuts[this.cutCursor++ % this.cuts.length];
    c.kind = kind; c.live = true; c.born = born; c.life = life; c.at.copy(at); c.dir.copy(dir); c.size = size; c.reach = reach; c.roll = roll; c.floor = floor; c.seed = Math.abs(at.x * 13.7 + at.z * 7.3 + born * 3.1) % 97;
  }

  handle(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    if (this.disposed) return;
    if (event.kind === 'eliminated' || event.kind === 'respawn') { this.cancel(event.actorId, true); return; }
    if (!isMihawkBlackBlade(event.fighter)) return;
    if (event.kind === 'whiff' || event.kind === 'rejected') { this.cancel(event.actorId); return; }
    if (event.kind !== 'hit' && event.kind !== 'confirm' && event.kind !== 'release') return;
    for (let i = 0; i < this.seen.length; i++) if (this.seen[i] === event.id && this.seenTime[i] === event.serverTime) return;
    const index = this.cursor++ % this.seen.length; this.seen[index] = event.id; this.seenTime[index] = event.serverTime;
    const actor = fighters?.get(event.actorId), victim = event.targetId ? fighters?.get(event.targetId) : undefined, seq = event.actionSeq ?? actor?.state.actionSeq ?? -1;
    let floor = blowFloor(actor, victim, 0);
    if (event.kind === 'release') {
      if (event.slot !== 'special' || event.branch || !event.origin || !event.endpoint) return;
      const wave = this.waves[this.waveCursor++ % this.waves.length];
      wave.live = true; wave.actor = event.actorId; wave.id = event.id; wave.born = event.serverTime; wave.hitAt = -1; wave.floor = actor?.group.position.y ?? event.origin.y - 1.1; wave.big = actor?.state.awakened ? 1.15 : 1;
      wave.origin.set(event.origin.x, event.origin.y, event.origin.z); wave.end.set(event.endpoint.x, event.endpoint.y, event.endpoint.z);
      return;
    }
    if (event.kind === 'confirm') {
      if (event.slot === 'ultimate' && !event.branch && event.targetId) Object.assign(this.confirms[this.confirmCursor++ % this.confirms.length], { actor: event.actorId, target: event.targetId, seq, floor, final: false });
      return;
    }
    if (!victim && !event.endpoint) return;
    const point = this.p, st = this.stage, t = event.serverTime, big = actor?.state.awakened ? 1.15 : 1;
    if (victim) bodyCentre(victim, point); else point.set(event.endpoint!.x, event.endpoint!.y, event.endpoint!.z);
    const dir = this.dir;
    if (actor) { dir.subVectors(point, actor.group.position).setY(0); if (dir.lengthSq() < .01) dir.set(Math.sin(actor.state.yaw ?? 0), 0, Math.cos(actor.state.yaw ?? 0)); dir.normalize(); } else dir.set(0, 0, 1);
    const ground = this.ground.set(point.x, floor, point.z), lean = (seq % 2 ? .5 : -.5);
    if (event.slot === 'light') { st.burst(point, YORU, .45, t, { dir, floor, clean: true }); this.cut(LINE, point, dir, 1.7, t, .2, floor, 0, lean * 1.6); return; }
    if (event.slot === 'heavy') {
      const k = event.branch ? .8 : 1;
      st.burst(this.b.copy(point).addScaledVector(dir, .5), YORU, .7 * k * big, t, { dir, floor, clean: true });
      this.cut(LINE, point, dir, 3.2 * k * big, t, .2, floor, 0, lean);
      st.shock(ground, YORU, 4.2 * k, t, .4);
      this.cut(SPLIT, this.a.copy(ground).addScaledVector(dir, -.4), dir, .2, t, 1.5, floor, 3.4 * k);
      return;
    }
    if (event.slot === 'special') {
      if (event.branch === 'airSpecial') { st.burst(point, YORU, 2, t, { floor }); st.shock(ground, YORU, 4.5, t, .45); st.scar(ground, YORU, 2.4, t + .05, 1.8); this.cut(LINE, point, dir, 5, t, .4, floor); return; }
      for (const wave of this.waves) if (wave.live && wave.actor === event.actorId && wave.hitAt < 0 && t >= wave.born - .05) { wave.hitAt = t; wave.end.copy(point); }
      const k = (event.branch ? .7 : 1) * big;
      st.burst(point, YORU, 2 * k, t, { dir, floor });
      this.cut(LINE, point, dir, 7.5 * k, t, .55, floor);
      st.erupt(ground, UP, YORU, .3 * k, 6.5 * k, t, .42);
      st.shock(ground, YORU, 5.2 * k, t, .45);
      this.cut(SPLIT, this.a.copy(ground).addScaledVector(dir, -1.6), dir, .3, t, 2.1, floor, 7 * k);
      st.scar(ground, YORU, 2.3 * k, t + .05, 1.9);
      return;
    }
    if (event.slot !== 'ultimate' || event.branch) return;
    const final = (event.contactIndex ?? 0) >= FINAL;
    if (!final) { st.burst(point, YORU, 1.25, t, { dir, floor }); this.cut(LINE, point, dir, 4.6, t, .34, floor, 0, -.55); st.shock(ground, YORU, 4.4, t, .4); return; }
    let confirmed = false;
    for (const c of this.confirms) if (c.actor === event.actorId && c.seq === seq) { c.final = true; floor = c.floor; confirmed = true; }
    if (!confirmed) return;
    ground.y = floor;
    if (involvesLocal(event.actorId, event.targetId)) SIGNATURE.screen?.impactFrame?.(.5, point);
    const from = this.a.copy(point).addScaledVector(dir, -2.4); from.y = floor;
    this.cut(FLY, from, dir, 5.6, t, .62, floor, 17);
    this.cut(LINE, point, dir, 14, t, .7, floor);
    this.cut(SPLIT, from, dir, .55, t, 2.5, floor, 17);
    st.erupt(ground, UP, YORU, .34, 12, t, .5);
    for (let i = 1; i <= 2; i++) st.erupt(this.b.copy(ground).addScaledVector(dir, i * 4), UP, YORU, .2, 6.5 - i * 1.5, t + .05 + i * .08, .4);
    st.burst(point, YORU, 2.3, t, { dir, floor });
    st.shock(ground, YORU, 9, t, .6);
    st.scar(ground, YORU, 3, t + .1, 2);
  }

  private crescent(head: THREE.Vector3, dir: THREE.Vector3, size: number, roll: number, fade: number, seed: number, time: number, heat = 1.1) {
    this.side.crossVectors(dir, UP); if (this.side.lengthSq() < 1e-6) this.side.set(1, 0, 0); this.side.normalize();
    this.b.crossVectors(this.side, dir).normalize();
    this.basis.makeBasis(dir, this.b, this.centre.crossVectors(dir, this.b)); this.q.setFromRotationMatrix(this.basis);
    if (roll) this.q.multiply(this.turn.setFromAxisAngle(X, roll));
    this.centre.copy(head).addScaledVector(dir, -size);
    this.crescents.add(this.centre, this.q, size, size, size, WAVE, fade, seed, time, heat, .035);
  }
  private edge(grip: THREE.Vector3, tip: THREE.Vector3, k: number, wide = 1) {
    if (k <= .02) return;
    const st = this.stage, from = this.a.copy(grip).lerp(tip, .22), to = this.b.copy(from).lerp(tip, .25 + .75 * k);
    st.streak(from, to, .15 * wide, YORU.main, .5 * k); st.streak(from, to, .045 * wide, YORU.core, 1.5 * k);
    st.glow(to, .2 * wide, YORU.core, .8 * k, STAR, .22, Math.floor(st.time * 24));
  }

  update(time: number, fighters: ReadonlyMap<string, Fighter>, _flights: ReadonlyMap<string, Flight>) {
    if (this.disposed) return;
    const st = this.stage.open(time);
    this.crescents.begin(); this.gashes.begin();
    for (const f of fighters.values()) {
      const s = f.state; if (!isMihawkBlackBlade(s.fighter) || !s.alive) continue;
      if (!['light', 'heavy', 'special', 'ultimate'].includes(s.action) || s.whiffedAt !== undefined) continue;
      const elapsed = s.actionTime * s.actionDuration, seed = (s.actionSeq ?? 0) * 6.1, yaw = s.yaw ?? f.group.rotation.y, big = s.awakened ? 1.15 : 1;
      const heading = this.heading.set(Math.sin(yaw), 0, Math.cos(yaw)), feet = f.group.position, tip = f.strikePoint(this.tip), grip = f.handR;
      if (s.action === 'light') {
        const k = Math.sin(clamp(s.actionTime) * Math.PI);
        this.edge(grip, tip, k, .8); st.light(tip, 2.2, YORU, .22 * k);
      } else if (s.action === 'heavy') {
        const contact = s.branch ? s.actionDuration * .5 : HEAVY.contacts[0];
        if (elapsed < contact) { const k = clamp(elapsed / contact); this.edge(grip, tip, k); st.charge(tip, YORU, .15 * big, k, seed); }
        else if (elapsed < contact + .15) {
          const u = (elapsed - contact) / .15;
          const size = (.8 + .2 * u) * big;
          this.p.copy(feet).addScaledVector(heading, size + .55 + .4 * u); this.p.y = feet.y + 1.1;
          this.crescent(this.p, heading, size, (s.actionSeq ?? 0) % 2 ? .5 : -.5, (1 - u) * .85, seed, time);
          st.light(this.a.copy(this.p).addScaledVector(heading, .6), 1.7, YORU, .32 * (1 - u));
        }
      } else if (s.action === 'special' && !s.branch) {
        const release = SPECIAL.contacts[0];
        if (elapsed < release) {
          const k = clamp(elapsed / release);
          this.edge(grip, tip, Math.min(1, k * 1.6), 1.2); st.charge(tip, YORU, .36 * big, k, seed);
          st.disc(this.p.copy(feet), 1.6 + 1.6 * k, YORU.main, .55 * k, SHEEN, 1, seed);
        }
      } else if (s.action === 'ultimate' && !s.branch && s.confirmedAt === undefined && elapsed < ULT.contacts[0] + .12) {
        const k = clamp(elapsed / ULT.contacts[0]);
        this.edge(grip, tip, k, 1.1); st.charge(tip, YORU, .28, k, seed);
      }
    }
    for (const wave of this.waves) {
      if (!wave.live) continue;
      const age = time - wave.born, range = SPECIAL.range, speed = SPECIAL.speed ?? 30;
      if (age < -.05 || age > range / speed + .2 || wave.hitAt >= 0 && time - wave.hitAt > .26) { wave.live = false; continue; }
      if (age < 0) continue;
      const span = Math.hypot(wave.end.x - wave.origin.x, wave.end.z - wave.origin.z);
      if (span < .05) { wave.live = false; continue; }
      const dir = this.dir.set((wave.end.x - wave.origin.x) / span, 0, (wave.end.z - wave.origin.z) / span);
      const after = wave.hitAt >= 0 ? time - wave.hitAt : -1, flown = after >= 0 ? Math.min(range, (wave.hitAt - wave.born) * speed) + after * speed * .5 : Math.min(range, age * speed);
      const fade = after >= 0 ? 1 - smooth(after, .04, .26) : 1 - smooth(flown, range - 4, range), grow = (.4 + .6 * smooth(age, 0, .09)) * wave.big, size = 2.35 * grow;
      const head = this.p.set(wave.origin.x + dir.x * (flown + .5), wave.floor + size * Math.sin(ARC) * .93, wave.origin.z + dir.z * (flown + .5));
      this.crescent(head, dir, size, .3, fade, wave.id * 3.7, time, 1.1 + .12 * Math.sin(time * 37));
      st.glow(head, size * .75, YORU.main, .3 * fade); st.glow(this.a.copy(head).setY(wave.floor + .5), size * .5, YORU.core, .22 * fade);
      st.light(this.a.copy(head).setY(wave.floor + 1), 6.5, YORU, .9 * fade);
      st.light(this.a.copy(head).addScaledVector(dir, -3.2).setY(wave.floor + .6), 4.5, YORU, .45 * fade);
      this.gashes.add(this.a.set(wave.origin.x + dir.x * 1.2, wave.floor, wave.origin.z + dir.z * 1.2), this.b.set(head.x, wave.floor, head.z), .24 * wave.big, fade, GASH, wave.id);
    }
    for (const c of this.cuts) {
      if (!c.live) continue;
      const age = time - c.born;
      if (age >= c.life) { c.live = false; continue; }
      if (age < 0) continue;
      const u = age / c.life;
      if (c.kind === LINE) {
        const fade = u < .35 ? 1 : 1 - (u - .35) / .65, half = c.size * .5 * Math.min(1, age / .05);
        this.side.set(c.dir.z, 0, -c.dir.x); const axis = this.b.copy(UP).multiplyScalar(Math.cos(c.roll)).addScaledVector(this.side, Math.sin(c.roll));
        const low = Math.min(half, Math.max(.3, (c.at.y - c.floor) / Math.max(.2, Math.cos(c.roll))));
        const from = this.a.copy(c.at).addScaledVector(axis, -low), to = this.p.copy(c.at).addScaledVector(axis, half * 2 - low);
        st.streak(from, to, Math.min(.5, .1 + c.size * .022), YORU.main, .6 * fade); st.streak(from, to, Math.min(.16, .035 + c.size * .008) * (.4 + .6 * fade), YORU.core, 1.7 * fade);
        st.glow(c.at, Math.min(1.5, .3 + c.size * .1), YORU.core, .7 * fade, STAR, .2, c.seed);
        st.light(c.at, Math.min(7, 2 + c.size * .5), YORU, .36 * fade * Math.min(1, c.size / 5));
      } else if (c.kind === FLY) {
        const fade = 1 - smooth(u, .62, 1), size = c.size * (.45 + .55 * smooth(age, 0, .1)), flown = c.reach * u;
        const head = this.p.copy(c.at).addScaledVector(c.dir, flown + size * .5); head.y = c.floor + size * Math.sin(ARC) * .93;
        this.crescent(head, c.dir, size, c.roll, fade, c.seed, time, 1.2 + .15 * Math.sin(time * 41));
        st.glow(this.a.copy(head).setY(c.floor + size * .5), size * .55, YORU.main, .32 * fade);
        st.light(this.a.copy(head).setY(c.floor + 1.2), Math.min(8, size * 1.2 + 2), YORU, .5 * fade);
      } else {
        const heat = (1 - u) * Math.min(1, age / .04), grow = smooth(age, 0, .16);
        this.gashes.add(c.at, this.a.copy(c.at).addScaledVector(c.dir, c.reach * grow), c.size, heat, GASH, c.seed);
        if (heat > .08) st.light(this.b.copy(c.at).addScaledVector(c.dir, c.reach * grow * .5).setY(c.floor + .4), Math.min(7, c.reach * .45 + 1.5), YORU, .28 * heat * heat);
      }
    }
    for (const c of this.confirms) {
      if (!c.actor) continue;
      const actor = fighters.get(c.actor), victim = fighters.get(c.target), s = actor?.state;
      if (!actor || !s?.alive || !victim?.state.alive && !c.final || s.action !== 'ultimate' || s.branch || (s.actionSeq ?? -1) !== c.seq || s.whiffedAt !== undefined) { c.actor = ''; continue; }
      const elapsed = s.actionTime * s.actionDuration;
      if (elapsed > ULT.duration) { c.actor = ''; continue; }
      if (!c.final && elapsed < ULT.contacts[FINAL]) this.gather(actor, c, elapsed, time);
    }
    this.crescents.end(); this.gashes.end();
    st.close();
  }

  private gather(actor: Fighter, c: Confirm, elapsed: number, time: number) {
    const st = this.stage, g = clamp((elapsed - ULT.contacts[0]) / (ULT.contacts[FINAL] - ULT.contacts[0])), seed = c.seq * 4.3;
    const feet = this.ground.copy(actor.group.position).setY(c.floor), tip = actor.strikePoint(this.tip);
    st.dim(.3 + .45 * g, c.actor, c.target);
    st.pool(feet, 2.6 + 2.6 * g, YORU, .35 + .65 * g, seed);
    st.disc(feet, 3.2 + 3.4 * g, YORU.main, .5 + .4 * g, SHEEN, 1, seed);
    for (let i = 0, n = st.n(12, 6); i < n; i++) {
      const clock = time * (1.3 + 1.5 * g) + i * .618, cycle = Math.floor(clock), phase = clock - cycle;
      if (phase > .5) continue;
      const h = cycle * 7.13 + i * 3.7 + seed, ang = i * 2.399963 + h, r = 2.1 + 1.3 * Math.abs(Math.sin(h * 1.3)), tilt = Math.sin(h * 2.1) * 1.25, len = (.7 + 1.2 * g) * Math.min(1, phase / .08), fade = phase < .2 ? 1 : 1 - (phase - .2) / .3;
      this.a.set(feet.x + Math.cos(ang) * r, c.floor + .9 + 1.3 * Math.abs(Math.sin(h * .7)), feet.z + Math.sin(ang) * r);
      this.side.set(-Math.sin(ang), 0, Math.cos(ang)); this.b.copy(UP).multiplyScalar(Math.cos(tilt)).addScaledVector(this.side, Math.sin(tilt));
      this.centre.copy(this.a).addScaledVector(this.b, len); this.a.addScaledVector(this.b, -len);
      st.streak(this.a, this.centre, .1, YORU.main, .5 * fade); st.streak(this.a, this.centre, .03, YORU.core, 1.5 * fade);
    }
    st.light(this.a.copy(feet).setY(c.floor + 1), 5 + 3 * g, YORU, .35 + .45 * g);
    this.edge(actor.handR, tip, 1, 1.2 + .8 * g);
    st.charge(tip, YORU, .3 + .34 * g, Math.max(.4, g), seed);
    if (g > .75) st.speed(.5 * (g - .75) / .25, c.actor, c.target);
  }

  reset() {
    for (const c of this.confirms) c.actor = ''; for (const c of this.cuts) c.live = false; for (const w of this.waves) w.live = false;
    this.seen.fill(-1); this.seenTime.fill(-1); this.cursor = this.cutCursor = this.waveCursor = this.confirmCursor = 0;
    this.crescents.begin(); this.crescents.end(); this.gashes.begin(); this.gashes.end(); this.stage.reset();
  }
  dispose() { if (this.disposed) return; this.reset(); this.disposed = true; this.crescents.dispose(); this.gashes.dispose(); this.stage.release(); }
}
