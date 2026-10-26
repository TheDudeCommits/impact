// Pheasant Beak as the bird it is in canon: a pheasant of ice, launched from the hand. Built from shards in the ice
// kit's shard batch (the VFX Armory's crystal shading; notices in ./LICENSE.upstream.txt), its wake placed the way
// hand-cast-abilities' GlacialSpine places the Glacial Shard Storm's (where the head was when it shed each piece).
// The silhouette itself is this file's: a body of overlapping shards, a raised neck and crest, a beak, two wings of
// primaries and coverts that beat, and the long tail a pheasant is known by.
import * as THREE from 'three';
import { PooledEffect, tierCount, type CancelReason, type CueContext, type EffectFrame, type PerTier } from '../Effect';
import type { IceKit } from './IceKit';
import { icePreset, type IcePreset } from './preset';
import { CRYSTAL } from './geometry';
import { IceType, TAU, UP, alongY, clamp01, lerp, scratch } from './common';

export interface IcePheasantParams {
  /** Wingspan in flight (metres). */
  span?: number;
  /** Wake pieces per tier, metres between them, and seconds each lasts. */
  wake?: PerTier;
  spacing?: number;
  wakeLife?: number;
  /** Its speed (metres a second) for the wake's ages. */
  speed?: number;
  /** Seconds of charge before it is let go, over which the shards gather in the palm. */
  charge?: number;
  /** Beats a second. */
  beat?: number;
}

/** Parts of the bird. */
const BODY = 0, WING_L = 1, WING_R = 2, TAIL = 3, HEAD = 4;
interface Feather { root: [number, number, number]; dir: [number, number, number]; length: number; width: number; part: number; tier: number }

/** The bird at a 3.4 m wingspan, looking down +z, up +y. `tier` 0 is drawn on every preset, 1 from Medium, 2 on High. */
function pheasant(): Feather[] {
  const out: Feather[] = [];
  const add = (root: [number, number, number], dir: [number, number, number], length: number, width: number, part: number, tier = 0) => {
    const l = Math.hypot(...dir); out.push({ root, dir: [dir[0] / l, dir[1] / l, dir[2] / l], length, width, part, tier });
  };
  // Plumage laid back along the body's crystal, round its axis.
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + .3, z = .5 - (i % 3) * .3, r = .2;
    add([Math.cos(a) * r * 1.2, Math.sin(a) * r + .02, z], [Math.cos(a) * .35, Math.sin(a) * .25, -1], .55, .24, BODY, i < 6 ? 1 : 2);
  }
  // The neck rising, the crest, the head and a long sharp beak.
  add([0, .1, .42], [0, .85, .55], .42, .17, HEAD); add([.05, .14, .48], [.05, .8, .6], .34, .12, HEAD, 1); add([-.05, .14, .48], [-.05, .8, .6], .34, .12, HEAD, 1);
  add([0, .44, .64], [0, .25, 1], .28, .15, HEAD);
  add([0, .43, .86], [0, -.12, 1], .36, .07, HEAD);
  add([0, .5, .62], [0, 1, -.55], .26, .07, HEAD, 1); add([.04, .48, .6], [.25, .9, -.5], .2, .06, HEAD, 2); add([-.04, .48, .6], [-.25, .9, -.5], .2, .06, HEAD, 2);
  // Two wings: primaries swept back from the leading edge, longer toward the tip, and a row of coverts over them.
  for (const side of [-1, 1]) {
    const part = side < 0 ? WING_L : WING_R;
    for (let i = 0; i < 12; i++) {
      const u = i / 11, x = side * (.16 + 1.5 * u), y = .12 + .1 * Math.sin(Math.PI * u), z = .22 - .28 * u * u;
      add([x, y, z], [side * (.18 + .7 * u), -.04, -1], .42 + .5 * u, .22 + .08 * u, part, i % 3 === 1 ? 1 : 0);
    }
    for (let i = 0; i < 6; i++) {
      const u = (i + .5) / 6, x = side * (.18 + 1.05 * u), z = .26 - .18 * u * u;
      add([x, .17, z], [side * (.2 + .4 * u), .02, -1], .3 + .14 * u, .18, part, 2);
    }
  }
  // The tail: a pheasant's, longer than its body, the middle feathers longest.
  for (let i = 0; i < 5; i++) {
    const o = i - 2;
    add([o * .05, .02, -.42], [o * .1, -.06, -1], [1.25, 1.75, 2.15, 1.75, 1.25][i], .15, TAIL, Math.abs(o) === 2 ? 1 : 0);
  }
  return out;
}

const FEATHERS = pheasant();
/** The bird's solid: its body and neck are glacial cores and its head a spike, drawn in the crystal batch, so it
 *  reads as a body of ice from any side and not only as wings. From, to (bird space, 3.4 m span), radius, shape. */
const SOLIDS: readonly (readonly [readonly [number, number, number], readonly [number, number, number], number, number])[] = [
  [[0, -.02, -.66], [0, .05, .66], .29, CRYSTAL.core],
  [[0, .06, .3], [0, .5, .68], .12, CRYSTAL.core],
  [[0, .43, .55], [0, .4, 1.05], .085, CRYSTAL.spike],
];
const SPAN = 3.4, WAKE_MAX = 32, SWIRL = 12, BURST_LIFE = .42, GRAVITY = 9;
const fract = (v: number) => v - Math.floor(v);

class IcePheasant extends PooledEffect<IcePheasantParams> {
  private cue?: CueContext;
  private preset: IcePreset = icePreset('ice/aokiji');
  private scale = 1; private spacing = .6; private wakeLife = .55; private speed = 27; private charge = .7; private beat = 2.6;
  private wake = 0; private tier = 2;
  private released = false;
  private releasedAt = 0;
  private readonly launch = new THREE.Vector3();
  private readonly dir = new THREE.Vector3(0, 0, 1);
  private readonly head = new THREE.Vector3();
  private readonly basis = new THREE.Matrix4();
  private readonly x = new THREE.Vector3(); private readonly y = new THREE.Vector3();
  private travelled = 0;
  private endedAt = Infinity;
  private ageNow = 0;
  private gone = false;
  private seed = 0;
  constructor(private readonly kit: IceKit) { super(); }

  start(p: IcePheasantParams, cue: CueContext) {
    this.reset();
    this.cue = cue; this.preset = icePreset(cue.preset);
    this.scale = (p.span ?? SPAN) / SPAN; this.spacing = p.spacing ?? .75; this.wakeLife = p.wakeLife ?? .7; this.speed = p.speed ?? 27; this.charge = p.charge ?? .7; this.beat = p.beat ?? 2.6;
    this.wake = Math.min(WAKE_MAX, tierCount(p.wake ?? { low: 6, medium: 12, high: 20 }, cue.tier, cue.density));
    this.tier = cue.tier === 'high' ? 2 : cue.tier === 'medium' ? 1 : 0;
    this.dir.copy(cue.heading); this.head.copy(cue.anchor.point);
    this.seed = (cue.seed % 1013) / 1013;
  }

  update(age: number, _dt: number, frame: EffectFrame) {
    const cue = this.cue;
    if (!cue || this.gone) return false;
    this.ageNow = age;
    const flight = cue.anchor.flight ? frame.flights.get(cue.anchor.flight) : undefined;
    if (this.endedAt === Infinity) {
      if (flight) {
        if (flight.released && !this.released) { this.released = true; this.releasedAt = age; this.launch.copy(flight.origin ?? flight.position); }
        this.head.copy(flight.position);
        if (this.released) {
          scratch.d.subVectors(this.head, this.launch);
          const span = scratch.d.length();
          if (span > .05) { this.dir.copy(scratch.d).divideScalar(span); this.travelled = span; }
          else if (flight.heading.lengthSq() > 1e-8) this.dir.copy(flight.heading);
        } else if (flight.heading.lengthSq() > 1e-8) this.dir.copy(flight.heading);
      } else if (this.released || age > 2.5) this.endedAt = age;
      else { const actor = frame.fighters.get(cue.actorId); if (actor) this.head.copy(actor.handR); }
    }
    this.frame();
    if (this.endedAt < Infinity) { this.glow(frame, 10 * Math.exp(-12 * (age - this.endedAt))); return this.burst(age - this.endedAt); }
    if (!this.released) this.gather(age);
    else { this.fly(age); this.glow(frame, 9 * clamp01(this.travelled / 1.5)); }
    return true;
  }

  /** The light the bird carries. */
  private glow(frame: EffectFrame, intensity: number) {
    if (frame.light && intensity > .05) frame.light(this.head.x, this.head.y + .3, this.head.z, this.preset.light, intensity, 7.5);
  }

  /** The bird's axes: forward along the flight, up as near the world's as that allows. */
  private frame() {
    this.y.copy(UP).addScaledVector(this.dir, -this.dir.y);
    if (this.y.lengthSq() < 1e-6) this.y.set(0, 0, 1);
    this.y.normalize();
    this.x.crossVectors(this.y, this.dir).normalize();
    this.basis.makeBasis(this.x, this.y, this.dir);
  }

  /** In the palm through the charge: shards circling in, tighter and faster as the release comes. */
  private gather(age: number) {
    const t = clamp01(age / Math.max(.05, this.charge));
    if (t < .1) return;
    const p = scratch.p, q = scratch.q, color = scratch.color, shards = this.kit.shards;
    color.copy(this.preset.pale).lerp(this.preset.frost, .5);
    for (let i = 0; i < SWIRL; i++) {
      const a = (i / SWIRL) * TAU + age * (6 + 6 * t), r = lerp(.75, .16, t) * this.scale, tilt = (i % 3 - 1) * .5;
      p.copy(this.head).addScaledVector(this.x, Math.cos(a) * r).addScaledVector(this.y, Math.sin(a) * r * .6 + tilt * r * .3).addScaledVector(this.dir, Math.sin(a * 2) * r * .2);
      scratch.a.copy(this.x).multiplyScalar(-Math.sin(a)).addScaledVector(this.y, Math.cos(a) * .6).normalize();
      q.setFromUnitVectors(UP, scratch.a);
      const s = (.05 + .03 * (i % 2)) * this.scale;
      shards.add(p, q, s, s * 3.2, s * .7, color, .4 + .55 * t, i, .3 * t, 0, 0);
    }
  }

  /** Where feather `f` is: its root and direction in the world, with the wings beating and the tail swaying. */
  private feather(f: Feather, time: number, k: number, root: THREE.Vector3, dir: THREE.Vector3) {
    let [rx, ry, rz] = f.root, [dx, dy, dz] = f.dir;
    if (f.part === WING_L || f.part === WING_R) {
      // The beat: the wing turns about the shoulder's long axis.
      const side = f.part === WING_L ? -1 : 1, angle = Math.sin(time * this.beat * TAU) * .5 * side, c = Math.cos(angle), s = Math.sin(angle);
      const sx = .14 * side, ox = rx - sx, oy = ry - .12;
      rx = sx + ox * c - oy * s; ry = .12 + ox * s + oy * c;
      const ddx = dx * c - dy * s, ddy = dx * s + dy * c; dx = ddx; dy = ddy;
    } else if (f.part === TAIL) {
      dx += Math.sin(time * 6 + rx * 20) * .08;
    }
    root.set(rx * k, ry * k, rz * k).applyMatrix4(this.basis).add(this.head);
    dir.set(dx, dy, dz).transformDirection(this.basis);
  }

  /** A feather lies flat in the wing: its length along `dir`, its breadth across the bird, its thin side up. */
  private lay(dir: THREE.Vector3, out: THREE.Quaternion) {
    scratch.a.crossVectors(dir, this.y);
    if (scratch.a.lengthSq() < 1e-6) scratch.a.copy(this.x);
    scratch.a.normalize();
    scratch.b.crossVectors(scratch.a, dir).normalize();
    return out.setFromRotationMatrix(scratch.m.makeBasis(scratch.a, dir, scratch.b));
  }

  private fly(age: number) {
    const since = age - this.releasedAt, k = this.scale * lerp(.35, 1, clamp01(since / .1));
    const shards = this.kit.shards, p = scratch.p, d = scratch.d, q = scratch.q, color = scratch.color;
    const birth = clamp01(1 - since / .2);
    for (let i = 0; i < FEATHERS.length; i++) {
      const f = FEATHERS[i];
      if (f.tier > this.tier) continue;
      this.feather(f, age, k, p, d);
      this.lay(d, q);
      color.copy(f.part === BODY || f.part === HEAD ? this.preset.body : this.preset.pale).lerp(this.preset.frost, f.part === TAIL ? .45 : f.part === BODY ? .1 : .3);
      shards.add(p, q, f.width * k, f.length * k, f.width * k * .3, color, .95, i * .37 + this.seed * 10, birth, 0, 0);
    }
    const crystals = this.kit.crystals;
    color.copy(this.preset.body).lerp(this.preset.pale, .45);
    for (let i = 0; i < SOLIDS.length; i++) {
      const [from, to, radius, shape] = SOLIDS[i];
      p.set(from[0] * k, from[1] * k, from[2] * k).applyMatrix4(this.basis).add(this.head);
      d.set(to[0] - from[0], to[1] - from[1], to[2] - from[2]).transformDirection(this.basis);
      const length = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]) * k;
      alongY(d, i * 1.3, q);
      crystals.add(p, q, radius * 2 * k, length, radius * 2 * k, color, .95, this.seed * 10 + i, birth * .6, shape, 0);
    }
    this.drawWake();
  }

  /** Down shed along the path, each piece where the bird was when it lost it, drifting down and turning. */
  private drawWake() {
    const shards = this.kit.shards, p = scratch.p, q = scratch.q, color = scratch.color;
    color.copy(this.preset.pale).lerp(this.preset.frost, .65);
    for (let k = 0; k < this.wake; k++) {
      const s = this.travelled - (k + 1) * this.spacing - 1.2 * this.scale;
      if (s < 0) break;
      const t = (this.travelled - s) / this.speed;
      if (t > this.wakeLife) continue;
      const h = fract(Math.sin((k + this.seed * 89) * 12.9898) * 43758.5453), g = fract(h * 53.3), fade = 1 - t / this.wakeLife;
      p.copy(this.launch).addScaledVector(this.dir, s).addScaledVector(this.x, (h - .5) * 1.4 * this.scale);
      p.y += (g - .5) * .5 * this.scale - .5 * GRAVITY * .45 * t * t;
      q.setFromAxisAngle(scratch.n.set(h - .5, 1, g - .5).normalize(), t * 7 + h * TAU);
      const size = (.06 + g * .07) * this.scale;
      shards.add(p, q, size, size * 2.6, size * .6, color, .85 * fade, h * 10, 0, 0, 0);
    }
  }

  /** Where it stops, the bird comes apart: every feather flies on along its own line and falls. */
  private burst(t: number) {
    if (!this.released || t > BURST_LIFE) return false;
    const shards = this.kit.shards, p = scratch.p, d = scratch.d, q = scratch.q, color = scratch.color, fade = 1 - t / BURST_LIFE;
    color.copy(this.preset.pale).lerp(this.preset.frost, .4);
    for (let i = 0; i < FEATHERS.length; i++) {
      const f = FEATHERS[i];
      if (f.tier > this.tier) continue;
      this.feather(f, this.endedAt, this.scale, p, d);
      const h = fract(Math.sin((i + this.seed * 71) * 78.233) * 12543.123);
      scratch.a.copy(p).sub(this.head).setLength(2.5 + h * 3).addScaledVector(this.dir, 2.5);
      p.addScaledVector(scratch.a, t); p.y -= .5 * GRAVITY * t * t;
      this.lay(d, q).multiply(scratch.r.setFromAxisAngle(UP, t * (6 + h * 8)));
      shards.add(p, q, f.width * this.scale, f.length * this.scale * (1 - t), f.width * this.scale * .3, color, fade, i, 0, 0, 0);
    }
    return true;
  }

  cancel(reason: CancelReason) {
    if (reason === 'despawn' || !this.released) { this.gone = true; return; }
    if (this.endedAt === Infinity) this.endedAt = this.ageNow;
  }

  protected reset() {
    this.cue = undefined; this.released = false; this.releasedAt = 0; this.travelled = 0; this.endedAt = Infinity; this.ageNow = 0; this.gone = false;
  }
}

/** Pheasant Beak as a pheasant of ice shards, beating its wings down the shot's line. */
export function icePheasantType(kit: IceKit, capacity = 4) {
  return new IceType<IcePheasantParams, IcePheasant>('ice/pheasant', capacity, { draws: 0, gpuMs: .02 }, kit, k => new IcePheasant(k));
}

/** The feathers drawn per tier (tests and the budget). */
export const PHEASANT_FEATHERS = Object.freeze({ low: FEATHERS.filter(f => f.tier <= 0).length, medium: FEATHERS.filter(f => f.tier <= 1).length, high: FEATHERS.length });
