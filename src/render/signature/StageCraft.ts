import * as THREE from 'three';
import type { CombatEvent, FighterId } from '../../game/types';
import type { Fighter } from '../Fighter';
import { bodyCentre } from '../vfx/VfxKit';
import { blowFloor } from './blowFloor';
import { STAR } from './GlowBatch';
import { BURN, SHEEN, type MoveStage, type StageLook } from './MoveStage';


const UP = new THREE.Vector3(0, 1, 0), TAU = Math.PI * 2;
const _p = new THREE.Vector3(), _q = new THREE.Vector3(), _u = new THREE.Vector3(), _v = new THREE.Vector3(), _b = new THREE.Vector3(), _t = new THREE.Vector3();
export const hash = (x: number) => { const v = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
export const clamp01 = (v: number) => v < 0 ? 0 : v > 1 ? 1 : v;
const easeOut = (v: number) => 1 - (1 - clamp01(v)) * (1 - clamp01(v)) * (1 - clamp01(v));

export interface Blow {
  event: CombatEvent; actor?: Fighter; target?: Fighter;
  readonly point: THREE.Vector3;
  readonly ground: THREE.Vector3;
  readonly dir: THREE.Vector3;
  readonly side: THREE.Vector3;
  floor: number; t: number; seq: number;
  index: number;
  final: boolean;
}
export interface Gather { actor: string; target: string; seq: number; final: boolean; floor: number; at: number; readonly endpoint: THREE.Vector3 }

export class CastBook {
  private readonly seen = new Float64Array(128).fill(-1);
  private readonly seenAt = new Float64Array(128).fill(-1);
  private cursor = 0; private gatherCursor = 0;
  readonly gathers: Gather[] = Array.from({ length: 8 }, () => ({ actor: '', target: '', seq: -1, final: false, floor: 0, at: 0, endpoint: new THREE.Vector3() }));
  private readonly blow: Blow = { event: undefined as unknown as CombatEvent, point: new THREE.Vector3(), ground: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, 1), side: new THREE.Vector3(1, 0, 0), floor: 0, t: 0, seq: -1, index: 0, final: false };
  constructor(private readonly fighter: FighterId, private readonly contacts: number) {}

  take(e: CombatEvent, fighters?: ReadonlyMap<string, Fighter>): Blow | undefined {
    if (e.kind === 'eliminated' || e.kind === 'respawn') { this.cancel(e.actorId, true); return undefined; }
    if (e.fighter !== this.fighter) return undefined;
    if (e.kind === 'whiff' || e.kind === 'rejected') { this.cancel(e.actorId); return undefined; }
    if (e.kind !== 'hit' && e.kind !== 'confirm') return undefined;
    for (let i = 0; i < this.seen.length; i++) if (this.seen[i] === e.id && this.seenAt[i] === e.serverTime) return undefined;
    const slot = this.cursor++ % this.seen.length; this.seen[slot] = e.id; this.seenAt[slot] = e.serverTime;
    const actor = fighters?.get(e.actorId), target = e.targetId ? fighters?.get(e.targetId) : undefined, seq = e.actionSeq ?? actor?.state.actionSeq ?? -1;
    let floor = blowFloor(actor, target, (e.endpoint?.y ?? 1.1) - 1.1);
    if (e.kind === 'confirm') {
      if (e.slot === 'ultimate' && !e.branch && e.targetId) { const g = this.gathers[this.gatherCursor++ % this.gathers.length]; g.actor = e.actorId; g.target = e.targetId; g.seq = seq; g.final = false; g.floor = floor; g.at = e.serverTime; }
      return undefined;
    }
    if (!target && !e.endpoint) return undefined;
    const b = this.blow, point = b.point;
    if (target) bodyCentre(target, point); else point.set(e.endpoint!.x, e.endpoint!.y, e.endpoint!.z);
    b.event = e; b.actor = actor; b.target = target; b.t = e.serverTime; b.seq = seq; b.index = e.contactIndex ?? 0;
    b.final = e.slot === 'ultimate' && !e.branch && b.index >= this.contacts - 1;
    if (b.final) for (const g of this.gathers) if (g.actor === e.actorId && g.seq === seq) { g.final = true; g.endpoint.copy(point); floor = g.floor; }
    const dir = b.dir;
    if (actor) { dir.subVectors(point, actor.group.position).setY(0); if (dir.lengthSq() < .01) dir.set(Math.sin(actor.state.yaw ?? 0), 0, Math.cos(actor.state.yaw ?? 0)); dir.normalize(); } else dir.set(0, 0, 1);
    b.side.set(dir.z, 0, -dir.x); b.floor = floor; b.ground.set(point.x, floor, point.z);
    return b;
  }
  cancel(id: string, victim = false) { for (const g of this.gathers) if (g.actor === id || victim && g.target === id && !g.final) g.actor = ''; }
  each(fighters: ReadonlyMap<string, Fighter>, end: number, draw: (actor: Fighter, gather: Gather, elapsed: number, victim: Fighter | undefined) => void) {
    for (const g of this.gathers) {
      if (!g.actor) continue;
      const actor = fighters.get(g.actor), victim = fighters.get(g.target), s = actor?.state;
      if (!actor || !s?.alive || !victim?.state.alive && !g.final || s.action !== 'ultimate' || s.branch || (s.actionSeq ?? -1) !== g.seq || s.whiffedAt !== undefined) { g.actor = ''; continue; }
      const elapsed = s.actionTime * s.actionDuration;
      if (elapsed > end) { g.actor = ''; continue; }
      draw(actor, g, elapsed, victim);
    }
  }
  reset() { for (const g of this.gathers) g.actor = ''; this.seen.fill(-1); this.seenAt.fill(-1); this.cursor = this.gatherCursor = 0; }
}

export function jag(st: MoveStage, a: THREE.Vector3, b: THREE.Vector3, width: number, color: THREE.Color, intensity: number, seed: number, sway = .16, steps = 5, core = 0) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, len = Math.hypot(dx, dy, dz);
  if (len < .03 || intensity <= .01) return;
  _t.set(dx / len, dy / len, dz / len);
  _u.set(Math.abs(_t.y) < .9 ? 0 : 1, Math.abs(_t.y) < .9 ? 1 : 0, 0).cross(_t).normalize(); _v.crossVectors(_t, _u);
  let px = a.x, py = a.y, pz = a.z;
  for (let i = 1; i <= steps; i++) {
    const s = i / steps, off = i < steps ? len * sway * (1 - s * .4) : 0, ju = (hash(seed + i * 7.31) - .5) * 2 * off, jv = (hash(seed * 1.7 + i * 3.17) - .5) * 2 * off;
    const nx = a.x + dx * s + _u.x * ju + _v.x * jv, ny = a.y + dy * s + _u.y * ju + _v.y * jv, nz = a.z + dz * s + _u.z * ju + _v.z * jv;
    st.streak(_p.set(px, py, pz), _q.set(nx, ny, nz), width * (1.15 - .8 * s), color, intensity, core);
    px = nx; py = ny; pz = nz;
  }
}

export function arc(st: MoveStage, centre: THREE.Vector3, u: THREE.Vector3, v: THREE.Vector3, radius: number, from: number, to: number, width: number, color: THREE.Color, intensity: number, core = 0, steps = 10) {
  if (intensity <= .01 || radius <= .02) return;
  for (let i = 0; i < steps; i++) {
    const s0 = i / steps, s1 = (i + 1) / steps, taper = Math.pow(Math.sin(Math.PI * (s0 + s1) * .5), .7), a0 = from + (to - from) * s0, a1 = from + (to - from) * s1;
    _p.copy(centre).addScaledVector(u, Math.cos(a0) * radius).addScaledVector(v, Math.sin(a0) * radius);
    _q.copy(centre).addScaledVector(u, Math.cos(a1) * radius).addScaledVector(v, Math.sin(a1) * radius);
    st.streak(_p, _q, Math.max(.012, width * taper), color, intensity * (.35 + .65 * taper), core);
  }
}

export function flare(st: MoveStage, at: THREE.Vector3, radius: number, height: number, look: StageLook, k: number, seed = 0, count = 8, width = .1, lean = .14, lit = true) {
  k = clamp01(k); if (k <= .02) return;
  const time = st.time, tick = Math.floor(time * 12);
  for (let i = 0, n = st.n(count, 4); i < n; i++) {
    const ang = i * TAU / n + seed + time * .35, h = height * (.5 + .5 * hash(seed + i * 3.3)) * (.8 + .2 * Math.sin(time * 9 + i * 2.1)), cos = Math.cos(ang), sin = Math.sin(ang);
    _b.set(at.x + cos * radius, at.y + .02, at.z + sin * radius);
    _t.set(_b.x + cos * h * lean, at.y + h, _b.z + sin * h * lean);
    const shape = seed * 3.1 + i * 13 + tick + Math.floor(hash(i + seed) * 3);
    jag(st, _b, _t, width, look.main, k * (.65 + .35 * hash(i * 1.9 + seed)), shape, .11, 4);
    _b.set(at.x + cos * radius, at.y + .02, at.z + sin * radius); _t.set(_b.x + cos * h * lean, at.y + h, _b.z + sin * h * lean);
    jag(st, _b, _t, width * .34, look.core, k * 1.25, shape, .11, 4);
  }
  if (lit) st.light(_p.set(at.x, at.y + .5, at.z), radius * 1.4 + 1.6, look, .34 * k);
}

export function sheenAhead(st: MoveStage, feet: THREE.Vector3, heading: THREE.Vector3, radius: number, look: StageLook, strength: number, floor = feet.y) {
  st.disc(_p.set(feet.x + heading.x * (radius + .4), floor, feet.z + heading.z * (radius + .4)), radius, look.main, strength, SHEEN, 1);
}

interface Cut { at: THREE.Vector3; axis: THREE.Vector3; bow: THREE.Vector3; size: number; width: number; born: number; life: number; look: StageLook; live: boolean }
export class Cuts {
  private readonly cuts: Cut[];
  private cursor = 0;
  constructor(capacity = 12, private readonly fallback: StageLook) { this.cuts = Array.from({ length: capacity }, () => ({ at: new THREE.Vector3(), axis: new THREE.Vector3(1, 0, 0), bow: new THREE.Vector3(), size: 1, width: .1, born: 0, life: .3, look: fallback, live: false })); }
  add(at: THREE.Vector3, axis: THREE.Vector3, bow: THREE.Vector3 | undefined, size: number, width: number, look: StageLook, born: number, life = .3) {
    const c = this.cuts[this.cursor]; this.cursor = (this.cursor + 1) % this.cuts.length;
    c.at.copy(at); c.axis.copy(axis); if (bow) c.bow.copy(bow); else c.bow.set(0, 0, 0); c.size = size; c.width = width; c.look = look; c.born = born; c.life = life; c.live = true;
  }
  draw(st: MoveStage, time: number) {
    for (const c of this.cuts) {
      if (!c.live) continue;
      const age = time - c.born;
      if (age >= c.life) { c.live = false; continue; }
      if (age < 0) continue;
      const u = age / c.life, reach = Math.min(1, age / .05), fade = (1 - u) * (1 - u), steps = 8;
      for (let i = 0; i < steps; i++) {
        const s0 = (i / steps * 2 - 1) * reach, s1 = ((i + 1) / steps * 2 - 1) * reach, mid = (s0 + s1) * .5, taper = Math.pow(Math.max(0, 1 - mid * mid), .6);
        _p.copy(c.at).addScaledVector(c.axis, c.size * s0).addScaledVector(c.bow, 1 - s0 * s0);
        _q.copy(c.at).addScaledVector(c.axis, c.size * s1).addScaledVector(c.bow, 1 - s1 * s1);
        st.streak(_p, _q, Math.max(.012, c.width * taper * (.45 + .55 * fade)), c.look.main, .9 * fade);
        st.streak(_p, _q, Math.max(.008, c.width * .36 * taper * (.45 + .55 * fade)), c.look.core, 1.7 * fade);
      }
      if (c.size < 3) st.light(c.at, c.size * 1.5 + .8, c.look, .3 * fade);
    }
  }
  get live() { let n = 0; for (const c of this.cuts) if (c.live) n++; return n; }
  reset() { for (const c of this.cuts) c.live = false; }
}

interface Rift { from: THREE.Vector3; dir: THREE.Vector3; length: number; width: number; born: number; life: number; look: StageLook; seed: number; rise: number; lit: boolean; live: boolean }
export class Rifts {
  private readonly rifts: Rift[];
  private cursor = 0;
  constructor(capacity = 8, fallback: StageLook) { this.rifts = Array.from({ length: capacity }, () => ({ from: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, 1), length: 1, width: .1, born: 0, life: 1.5, look: fallback, seed: 0, rise: 1, lit: true, live: false })); }
  add(from: THREE.Vector3, dir: THREE.Vector3, length: number, look: StageLook, born: number, life = 1.6, rise = 1.2, width = .1, lit = true) {
    const r = this.rifts[this.cursor]; this.cursor = (this.cursor + 1) % this.rifts.length;
    r.from.copy(from); r.dir.copy(dir).setY(0).normalize(); r.length = length; r.look = look; r.born = born; r.life = life; r.rise = rise; r.width = width; r.lit = lit; r.live = true;
    r.seed = Math.abs(from.x * 13.7 + from.z * 7.9 + born * 3.3) % 89;
  }
  draw(st: MoveStage, time: number) {
    for (const r of this.rifts) {
      if (!r.live) continue;
      const age = time - r.born;
      if (age >= r.life) { r.live = false; continue; }
      if (age < 0) continue;
      const u = age / r.life, grow = easeOut(age / .14), heat = (1 - u) * (1 - u * .4), steps = Math.max(4, Math.min(16, Math.round(r.length / (r.lit ? .85 : 1.5)))), sx = r.dir.z, sz = -r.dir.x;
      let px = r.from.x, pz = r.from.z;
      for (let i = 1; i <= steps; i++) {
        const s = i / steps; if (s > grow + 1e-3) break;
        const off = i < steps ? (hash(r.seed + i * 5.7) - .5) * .7 : 0, nx = r.from.x + r.dir.x * r.length * s + sx * off, nz = r.from.z + r.dir.z * r.length * s + sz * off, thin = 1.1 - .6 * s;
        _p.set(px, r.from.y + .05, pz); _q.set(nx, r.from.y + .05, nz);
        st.streak(_p, _q, r.width * 2.6 * thin, r.look.main, .75 * heat); st.streak(_p, _q, r.width * .8 * thin, r.look.core, 1.6 * heat);
        if (r.lit && (i % 2 === 1 || steps <= 6)) {
          const h = r.rise * (.45 + .75 * hash(r.seed + i * 2.9)) * Math.max(0, 1 - u * 1.6) * (.8 + .2 * Math.sin(time * 11 + i * 1.7));
          if (h > .06) { _b.set(nx, r.from.y + .05, nz); _t.set(nx + sx * (hash(i + r.seed) - .5) * h * .3, r.from.y + h, nz + sz * (hash(i * 3 + r.seed) - .5) * h * .3); jag(st, _b, _t, r.width * 1.5, r.look.main, .9 * heat, r.seed + i * 11 + Math.floor(time * 12), .12, 3); }
        }
        px = nx; pz = nz;
      }
      if (r.lit) for (let i = 0, n = Math.max(1, Math.min(3, Math.round(r.length / 4))); i < n; i++) {
        const s = (i + .5) / n * grow;
        _p.set(r.from.x + r.dir.x * r.length * s, r.from.y, r.from.z + r.dir.z * r.length * s);
        st.disc(_p, Math.min(2.6, r.length / n * .6 + .5), r.look.main, 1, BURN, heat, r.seed + i);
        if (i !== 1 || n < 3) st.light(_q.copy(_p).setY(_p.y + .4), Math.min(8, r.length / n * .8 + 2.2), r.look, .38 * heat);
      }
    }
  }
  get live() { let n = 0; for (const r of this.rifts) if (r.live) n++; return n; }
  reset() { for (const r of this.rifts) r.live = false; }
}

const SPINE = new Float32Array(3 * 12);
export function bolt(st: MoveStage, at: THREE.Vector3, height: number, width: number, look: StageLook, k: number, seed: number, lit = true, lean = .12) {
  if (k <= .02 || height <= .2) return;
  const steps = 9, tx = at.x + (hash(seed * 1.3) - .5) * height * lean * 2, tz = at.z + (hash(seed * 2.9) - .5) * height * lean * 2, heart = look.heart > 0 ? look.heart : .5;
  for (let i = 0; i <= steps; i++) {
    const s = i / steps, off = i > 0 && i < steps ? height * .07 * (1 - s * .3) : 0;
    SPINE[i * 3] = tx + (at.x - tx) * s + (hash(seed + i * 7.31) - .5) * 2 * off; SPINE[i * 3 + 1] = at.y + height * (1 - s); SPINE[i * 3 + 2] = tz + (at.z - tz) * s + (hash(seed * 1.7 + i * 3.17) - .5) * 2 * off;
  }
  for (let i = 0; i < steps; i++) {
    _p.set(SPINE[i * 3], SPINE[i * 3 + 1], SPINE[i * 3 + 2]); _q.set(SPINE[i * 3 + 3], SPINE[i * 3 + 4], SPINE[i * 3 + 5]);
    st.streak(_p, _q, width * (1.1 - .45 * i / steps), look.main, k, heart);
  }
  for (let b = 0; b < 2; b++) {
    const i = 3 + b * 3, az = hash(seed + b * 11.3) * TAU, reach = height * (.16 + .12 * hash(seed * 3.1 + b));
    _b.set(SPINE[i * 3], SPINE[i * 3 + 1], SPINE[i * 3 + 2]); _t.set(_b.x + Math.cos(az) * reach, _b.y - reach * .9, _b.z + Math.sin(az) * reach);
    jag(st, _b, _t, width * .55, look.main, k * .75, seed + b * 17, .2, 3, heart);
  }
  st.glow(at, Math.min(1.4, width * 9), look.core, .9 * k, STAR, .2, Math.floor(seed));
  if (lit) st.light(_p.set(at.x, at.y + .6, at.z), Math.min(8, height * .45 + 2.6), look, .5 * k);
}

interface Strike { at: THREE.Vector3; height: number; width: number; born: number; life: number; look: StageLook; seed: number; lit: boolean; live: boolean }
export class Strikes {
  private readonly strikes: Strike[];
  private cursor = 0;
  constructor(capacity = 10, fallback: StageLook) { this.strikes = Array.from({ length: capacity }, () => ({ at: new THREE.Vector3(), height: 6, width: .1, born: 0, life: .25, look: fallback, seed: 0, lit: true, live: false })); }
  add(at: THREE.Vector3, height: number, width: number, look: StageLook, born: number, life = .26, lit = true) {
    const s = this.strikes[this.cursor]; this.cursor = (this.cursor + 1) % this.strikes.length;
    s.at.copy(at); s.height = height; s.width = width; s.look = look; s.born = born; s.life = life; s.lit = lit; s.seed = Math.abs(at.x * 9.7 + at.z * 5.3 + born * 7.1) % 71; s.live = true;
  }
  draw(st: MoveStage, time: number) {
    for (const s of this.strikes) {
      if (!s.live) continue;
      const age = time - s.born;
      if (age >= s.life) { s.live = false; continue; }
      if (age < 0) continue;
      const u = age / s.life;
      bolt(st, s.at, s.height, s.width * (1 - u * .5), s.look, (1 - u) * (1 - u * .5), s.seed + Math.floor(age * 20) * 13, s.lit);
    }
  }
  get live() { let n = 0; for (const s of this.strikes) if (s.live) n++; return n; }
  reset() { for (const s of this.strikes) s.live = false; }
}
export { UP as STAGE_UP };
