// The layout and the eruption are adapted from the VFX Armory (MIT; notices in ./LICENSE.upstream.txt):
// ability-project-27 src/abilities/frostLance/FrostLanceField.ts (itzmitto, from LinearAbilityExtThreeJS's IceAbility by
// mohamedachrefelouafi) - records laid out once per cast, the band that widens down the line, rubble demoted to ankle
// height, the outward lean, the quintic punch out of the floor with an overshoot, staggered neighbours and the sink back
// into it - and its LOW/MED/MAX crystal budgets (80/140/190 over a fifteen-metre line), scaled here to a fighting
// game's arena; ability-project-27 src/abilities/ice/IceSpikeField.ts for the radial field round an impact.
// Changes: rings and discs radiate in seeded spokes with heights falling away from the centre; the front can follow a
// projectile; each crystal keeps its own life (a trail melts behind the shot, a disc from the middle out); a shatter
// ending into chips; seeded from the cast, so every screen lays it out the same.
import * as THREE from 'three';
import { PooledEffect, Seeded, tierCount, type CancelReason, type CueContext, type EffectFrame, type PerTier } from '../Effect';
import { SIGNATURE } from '../../../signature/context';
import type { IceKit } from './IceKit';
import { CRYSTAL } from './geometry';
import { icePreset, type IcePreset } from './preset';
import { IceType, TAU, UP, clamp01, emergence, lerp, scratch } from './common';

export interface CrystalFieldParams {
  /** `line` along the attack, `ring` round a point, `disc` filling a radius round it. Default `disc`. */
  layout?: 'line' | 'ring' | 'disc';
  /** Crystals per tier (before settings.effects). */
  count?: PerTier;
  /** The line's length, or the ring's / disc's radius (metres). */
  reach?: number;
  /** Ring and disc: metres kept clear round the centre, where the body stands. */
  clear?: number;
  /** Line: half-width at its start and at its far end (metres). */
  width?: readonly [number, number];
  /** Metres a second the eruption runs out (0: all at once). A line on a projectile (`anchor.socket = 'flight'`)
   *  erupts under the projectile instead, as it passes. */
  spread?: number;
  /** The tallest crystals: near the centre (the line's start), and at the edge (its end). Metres. */
  height?: readonly [number, number];
  /** A crystal's base radius (metres). */
  radius?: number;
  /** The fraction demoted to ankle-high rubble. */
  rubble?: number;
  /** Radians the crystals lean away from the centre (the line). */
  lean?: number;
  /** Seconds: out of the floor, standing, and going. */
  rise?: number;
  hold?: number;
  sink?: number;
  /** Sink back into the floor, or shatter into chips. */
  end?: 'sink' | 'shatter';
  /** Chips thrown by each crystal as it erupts, per tier. */
  chips?: PerTier;
  /** Line: how much the crystals crowd its near end (>1). */
  bias?: number;
  /** Radiating spokes a disc's crystals gather on (0: scattered evenly). */
  spokes?: number;
  /** The frame's impact flash when it starts, for the local player's own blow or the blow they take. */
  impactFrame?: number;
  /** The crystals' colour (hex), over the preset's: the paler crystals are this lifted toward white. */
  tint?: number;
  /** The cold light it throws as it erupts (the light pool's candela; 0 for none). */
  light?: number;
}

/** The most crystals one field can lay out (the High budget's ceiling). */
export const FIELD_MAX = 128;
const CHIP_LIFE = .55, SHATTER_CHIPS = 3, GRAVITY = 11;
const fract = (v: number) => v - Math.floor(v);

class CrystalField extends PooledEffect<CrystalFieldParams> {
  // Per crystal, laid out at the start.
  private readonly dist = new Float32Array(FIELD_MAX);
  private readonly lat = new Float32Array(FIELD_MAX);
  private readonly ox = new Float32Array(FIELD_MAX);
  private readonly oz = new Float32Array(FIELD_MAX);
  private readonly outX = new Float32Array(FIELD_MAX);
  private readonly outZ = new Float32Array(FIELD_MAX);
  private readonly tall = new Float32Array(FIELD_MAX);
  private readonly wide = new Float32Array(FIELD_MAX);
  private readonly tilt = new Float32Array(FIELD_MAX);
  private readonly yaw = new Float32Array(FIELD_MAX);
  private readonly stagger = new Float32Array(FIELD_MAX);
  private readonly shade = new Float32Array(FIELD_MAX);
  private readonly shape = new Uint8Array(FIELD_MAX);
  private readonly erupt = new Float32Array(FIELD_MAX).fill(-1);
  private readonly seedOf = new Float32Array(FIELD_MAX);
  private n = 0;
  private chips = 0;
  private layout: 'line' | 'ring' | 'disc' = 'disc';
  private rise = .15; private hold = .8; private sink = .5; private shatter = false;
  private flightDriven = false;
  private cue?: CueContext;
  private preset: IcePreset = icePreset('ice/aokiji');
  /** The field's two crystal colours: the preset's, or the cue's tint. */
  private readonly body = new THREE.Color();
  private readonly pale = new THREE.Color();
  private readonly origin = new THREE.Vector3();
  private readonly dir = new THREE.Vector3(0, 0, 1);
  private readonly side = new THREE.Vector3(1, 0, 0);
  private floor = 0;
  private reach = 4;
  private released = false;
  private front = 0;
  private flightGone = false;
  private cutAt = Infinity;
  private ageNow = 0;
  private gone = false;
  private glow = 0;
  private firstErupt = 0;
  private readonly rng = new Seeded();
  private readonly here = new THREE.Vector3();

  constructor(private readonly kit: IceKit) { super(); }

  start(p: CrystalFieldParams, cue: CueContext) {
    this.reset();
    this.cue = cue; this.preset = icePreset(cue.preset);
    if (p.tint === undefined) { this.body.copy(this.preset.body); this.pale.copy(this.preset.pale); }
    else { this.body.setHex(p.tint); this.pale.copy(this.body).lerp(this.preset.frost, .4); }
    const rng = this.rng.seed(cue.seed * 7919 + 13);
    this.layout = p.layout ?? 'disc';
    this.rise = p.rise ?? .15; this.hold = p.hold ?? .8; this.sink = p.sink ?? .5; this.shatter = p.end === 'shatter';
    this.reach = p.reach ?? 4;
    this.flightDriven = this.layout === 'line' && cue.anchor.socket === 'flight';
    this.n = Math.min(FIELD_MAX, tierCount(p.count ?? { low: 16, medium: 28, high: 40 }, cue.tier, cue.density, 1));
    this.chips = tierCount(p.chips ?? { low: 0, medium: 1, high: 2 }, cue.tier, cue.density);
    this.floor = cue.anchor.floor;
    this.origin.copy(cue.anchor.point); this.origin.y = this.floor;
    this.aim(cue.heading);
    const clear = Math.min(this.reach * .9, p.clear ?? .7), heights = p.height ?? [1.8, .5], radius = p.radius ?? .3, rubble = p.rubble ?? .3;
    const lean = p.lean ?? .4, spread = p.spread ?? 12, widths = p.width ?? [.3, .9], bias = p.bias ?? 1.25;
    const spokes = Math.max(0, Math.round(p.spokes ?? 0)), spokeTurn = rng.next() * TAU;
    for (let i = 0; i < this.n; i++) {
      const u = rng.next(), small = rng.next() < rubble, jitter = rng.signed();
      let along: number;
      if (this.layout === 'line') {
        along = Math.pow((i + u) / this.n, bias);
        const half = lerp(widths[0], widths[1], along);
        this.dist[i] = along * this.reach;
        this.lat[i] = (Math.sign(jitter) * Math.pow(Math.abs(jitter), 1.35) + rng.signed() * .35) * half;
      } else {
        let angle: number, r: number;
        if (this.layout === 'ring') { angle = (i + .5 + jitter * .35) / this.n * TAU + spokeTurn; r = this.reach * (1 + rng.signed() * .12); along = 0; }
        else {
          // On a spoke (most of them) or anywhere: the field radiates from the blow.
          const onSpoke = spokes > 0 && rng.next() < .72;
          angle = onSpoke ? spokeTurn + Math.floor(rng.next() * spokes) / spokes * TAU + rng.signed() * .13 : rng.next() * TAU;
          along = Math.sqrt(u);
          r = clear + (this.reach - clear) * along;
        }
        this.ox[i] = Math.cos(angle) * r; this.oz[i] = Math.sin(angle) * r;
        this.outX[i] = Math.cos(angle); this.outZ[i] = Math.sin(angle);
        this.dist[i] = r;
      }
      let h = lerp(heights[0], heights[1], Math.pow(along, .8)) * (1 + rng.signed() * .35);
      if (small) h *= .32;
      this.tall[i] = Math.max(.08, h);
      this.wide[i] = Math.max(.04, radius * (1 + rng.signed() * .45) * (small ? 1.25 : 1) * lerp(1.1, .8, along));
      this.tilt[i] = lean * (.45 + .55 * along) * (1 + rng.signed() * .6);
      this.yaw[i] = rng.next() * TAU;
      this.stagger[i] = rng.next();
      this.shade[i] = rng.next();
      this.shape[i] = small ? CRYSTAL.rubble : rng.next() < .55 ? CRYSTAL.spike : CRYSTAL.blade;
      this.seedOf[i] = rng.next() * 10;
      this.erupt[i] = this.flightDriven ? -1 : spread > 0 ? this.dist[i] / spread + this.stagger[i] * .08 : this.stagger[i] * .06;
    }
    if (this.layout === 'line') this.placeLine();
    this.glow = p.light ?? (this.layout === 'disc' ? 14 : this.layout === 'ring' ? 6 : 5);
    this.firstErupt = Infinity;
    for (let i = 0; i < this.n; i++) if (this.erupt[i] >= 0 && this.erupt[i] < this.firstErupt) this.firstErupt = this.erupt[i];
    if (p.impactFrame && cue.local) SIGNATURE.screen?.impactFrame?.(p.impactFrame, cue.anchor.point);
  }

  private aim(heading: THREE.Vector3) {
    this.dir.copy(heading).setY(0); if (this.dir.lengthSq() < 1e-8) this.dir.set(0, 0, 1); this.dir.normalize();
    this.side.crossVectors(UP, this.dir).normalize();
  }

  /** A line's crystals on the current origin and direction, leaning on along it and out to its sides. */
  private placeLine() {
    for (let i = 0; i < this.n; i++) {
      const d = this.dist[i], lateral = this.lat[i], sign = lateral >= 0 ? 1 : -1;
      this.ox[i] = this.dir.x * d + this.side.x * lateral; this.oz[i] = this.dir.z * d + this.side.z * lateral;
      const ox = this.dir.x * .75 + this.side.x * sign * .85, oz = this.dir.z * .75 + this.side.z * sign * .85, ol = Math.hypot(ox, oz) || 1;
      this.outX[i] = ox / ol; this.outZ[i] = oz / ol;
    }
  }

  update(age: number, _dt: number, frame: EffectFrame) {
    const cue = this.cue;
    if (!cue || this.gone) return false;
    this.ageNow = age;
    if (this.flightDriven) this.follow(age, frame);
    const crystals = this.kit.crystals, color = scratch.color, p = scratch.p, q = scratch.q, r = scratch.r;
    let alive = this.flightDriven && !this.flightGone && this.cutAt === Infinity;
    for (let i = 0; i < this.n; i++) {
      const at = this.erupt[i];
      if (at < 0 || at > this.cutAt) continue;
      const elapsed = age - at;
      if (elapsed < 0) { alive = true; continue; }
      const natural = at + this.rise + this.hold, cut = natural > this.cutAt;
      const sinkStart = cut ? this.cutAt : natural, retract = clamp01((age - sinkStart) / (cut ? .15 : this.sink));
      const chipping = this.chips > 0 && elapsed < CHIP_LIFE, shattering = this.shatter && retract > 0 && age - sinkStart < CHIP_LIFE;
      if (retract < 1 || chipping || shattering) alive = true;
      const h = this.tall[i], w = this.wide[i];
      p.set(this.origin.x + this.ox[i], this.floor, this.origin.z + this.oz[i]);
      if (chipping) this.chipsAt(p, i, elapsed, h * .25, this.chips, 0);
      if (shattering) this.chipsAt(p, i, age - sinkStart, h * .5, SHATTER_CHIPS, 3.7);
      if (retract >= 1) continue;
      const emerge = emergence(elapsed, this.rise);
      const sinkY = this.shatter ? -retract * .25 * h : -Math.pow(retract, 3) * (h + w + .4);
      p.y = this.floor + (emerge - 1) * h * .85 + sinkY - .04;
      // Lean away from the centre about the axis across that direction, then a seeded turn about its own axis.
      scratch.a.set(-this.outZ[i], 0, this.outX[i]);
      q.setFromAxisAngle(scratch.a, -this.tilt[i]).multiply(r.setFromAxisAngle(UP, this.yaw[i]));
      const grow = lerp(.86, 1, Math.min(1, emerge)) * (this.shatter ? 1 - retract * retract : 1);
      color.copy(this.body).lerp(this.pale, this.shade[i] * .7);
      // The unit crystal's base is half a metre across its radius: twice `w` makes `w` the radius in metres.
      crystals.add(p, q, 2 * w * grow, h * grow, 2 * w * grow, color, .94, this.seedOf[i], clamp01(1 - elapsed / .25), this.shape[i], 0);
    }
    this.lightUp(age, frame);
    return alive;
  }

  /** The cold light of the eruption: a snap up and a fall, from over the middle of the field (a line's: over its
   *  front, as it runs). */
  private lightUp(age: number, frame: EffectFrame) {
    if (!this.glow || !frame.light || this.cutAt < Infinity) return;
    if (this.flightDriven) {
      if (!this.released || this.flightGone) return;
      const p = scratch.p.copy(this.origin).addScaledVector(this.dir, this.front);
      frame.light(p.x, this.floor + .9, p.z, this.preset.light, this.glow, 6);
      return;
    }
    const t = age - this.firstErupt;
    if (t < 0 || t > 1.4) return;
    const k = Math.min(1, t / .04) * Math.exp(-2.6 * t);
    frame.light(this.origin.x, this.floor + 1.3, this.origin.z, this.preset.light, this.glow * k, this.reach * 1.7 + 2);
  }

  /** The line under a projectile: it erupts where the shot has passed over, and stops where the shot stopped. */
  private follow(age: number, frame: EffectFrame) {
    const cue = this.cue!, flight = cue.anchor.flight ? frame.flights.get(cue.anchor.flight) : undefined;
    if (this.flightGone) return;
    if (!this.released) {
      if (!flight) { if (age > 2.5) this.flightGone = true; return; }
      if (!flight.released) return;
      // Laid along the shot's own line, now it is known (aimed as it was let go).
      this.released = true;
      this.origin.copy(flight.origin ?? flight.position); this.origin.y = this.floor;
      this.aim(flight.heading.lengthSq() > 1e-8 ? flight.heading : cue.heading);
      this.placeLine();
    }
    if (!flight) { this.flightGone = true; return; }
    this.here.copy(flight.position).sub(this.origin);
    this.front = Math.max(this.front, this.here.x * this.dir.x + this.here.z * this.dir.z);
    for (let i = 0; i < this.n; i++) if (this.erupt[i] < 0 && this.dist[i] <= this.front) this.erupt[i] = age + this.stagger[i] * .05;
  }

  /** Chips off crystal `i`: thrown out and up, tumbling, gone in CHIP_LIFE. Stateless: where they are follows from
   *  the time alone. */
  private chipsAt(base: THREE.Vector3, i: number, t: number, lift: number, count: number, salt: number) {
    const shards = this.kit.shards, p = scratch.d, q = scratch.q, color = scratch.color, fade = 1 - t / CHIP_LIFE;
    color.copy(this.preset.pale).lerp(this.preset.frost, .5);
    for (let j = 0; j < count; j++) {
      const k = this.seedOf[i] * 13.7 + j * 2.31 + salt, a = fract(Math.sin(k * 12.9898) * 43758.5453), b = fract(Math.sin(k * 78.233) * 12543.123);
      const angle = a * TAU, speed = 2.4 + b * 2.8, up = 2.2 + a * 2.6;
      p.set(base.x + (this.outX[i] * .6 + Math.cos(angle) * .4) * speed * t, base.y + lift + up * t - .5 * GRAVITY * t * t, base.z + (this.outZ[i] * .6 + Math.sin(angle) * .4) * speed * t);
      if (p.y < this.floor + .02) p.y = this.floor + .02;
      scratch.a.set(Math.cos(angle + 1.3), .6, Math.sin(angle + 1.3)).normalize();
      q.setFromAxisAngle(scratch.a, t * (7 + b * 9) + a * TAU);
      const s = (.05 + b * .05) * (this.wide[i] / .3);
      shards.add(p, q, s, s * 2.6, s, color, .95 * fade, a * 10, 0, 0, 0);
    }
  }

  cancel(reason: CancelReason) {
    if (reason === 'despawn') { this.gone = true; return; }
    // Everything standing goes in a moment; nothing more erupts.
    this.cutAt = Math.min(this.cutAt, this.ageNow);
  }

  protected reset() {
    this.n = 0; this.cue = undefined; this.released = false; this.front = 0; this.flightGone = false; this.cutAt = Infinity; this.gone = false; this.ageNow = 0;
    this.erupt.fill(-1);
  }
}

/** Crystals erupting along a line, round a ring or across a disc. It owns the kit's crystal and shard batches (two
 *  draws, shared with every other ice effect); a 96-crystal disc measured about 0.02 ms on the M4. */
export function crystalFieldType(kit: IceKit, capacity = 8) {
  return new IceType<CrystalFieldParams, CrystalField>('ice/crystal-field', capacity, { draws: 2, gpuMs: .02 }, kit, k => new CrystalField(k));
}
