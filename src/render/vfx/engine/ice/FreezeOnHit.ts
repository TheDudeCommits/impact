// After hand-cast-abilities' src/effects/IceStatue.js (mohamedachrefelouafi, MIT; notices in ./LICENSE.upstream.txt):
// a body turned to ice, held for a beat, then broken along its seams into pieces that fly and fall. The statue there
// bakes the posed skin into a new mesh on the CPU and cuts it into Voronoi cells; a fighter's rig is tens of thousands
// of vertices and baking one at the finisher would stall that very frame, so here the shell is built from the body's
// standard joints instead: a frosted column round every limb and the torso (riding the joints, so it holds the pose as
// the body is thrown), rime needles out of it, ice over the feet if they are on the floor, and on the break each piece
// carries on along the blow and comes apart. Pooled, drawn in the shared crystal and shard batches; nothing is made
// at the moment of the freeze.
import * as THREE from 'three';
import { PooledEffect, tierCount, type CancelReason, type CueContext, type EffectFrame, type PerTier, type StandardJoint } from '../Effect';
import type { Fighter } from '../../../Fighter';
import { bodyCentre } from '../../VfxKit';
import type { IceKit } from './IceKit';
import { CRYSTAL } from './geometry';
import { icePreset, type IcePreset } from './preset';
import { IceType, TAU, UP, clamp01, scratch } from './common';

export interface FreezeOnHitParams {
  /** Seconds to close over the body (from the feet up), to hold, and to break. */
  grow?: number;
  hold?: number;
  shatter?: number;
  /** Rime needles per piece, per tier. */
  spikes?: PerTier;
  /** How much wider than the limb the shell stands. */
  bulk?: number;
}

/** The shell's pieces: from joint to joint, its radius in metres at a 1.8 m body. */
const PIECES: readonly (readonly [StandardJoint, StandardJoint | 'crown', number])[] = [
  ['Hips', 'Spine1', .19], ['Spine1', 'Neck', .2], ['Neck', 'Head', .1], ['Head', 'crown', .14],
  ['LeftArm', 'LeftForeArm', .08], ['LeftForeArm', 'LeftHand', .07], ['RightArm', 'RightForeArm', .08], ['RightForeArm', 'RightHand', .07],
  ['LeftUpLeg', 'LeftLeg', .1], ['LeftLeg', 'LeftFoot', .085], ['RightUpLeg', 'RightLeg', .1], ['RightLeg', 'RightFoot', .085],
];
const N = PIECES.length, SPIKES_MAX = 3, FEET = 6, GRAVITY = 10;
const fract = (v: number) => v - Math.floor(v);

class FreezeOnHit extends PooledEffect<FreezeOnHitParams> {
  private cue?: CueContext;
  private preset: IcePreset = icePreset('ice/aokiji');
  private grow = .1; private hold = .5; private breakFor = .4; private bulk = 1.35; private spikes = 2;
  private readonly from = Array.from({ length: N }, () => new THREE.Vector3());
  private readonly to = Array.from({ length: N }, () => new THREE.Vector3());
  /** Where each piece's height sits between the lowest and the highest (the freeze climbs the body). */
  private readonly rank = new Float32Array(N);
  private readonly has = new Uint8Array(N);
  private size = 1;
  private checkedFeet = false;
  private readonly centre = new THREE.Vector3();
  private readonly push = new THREE.Vector3();
  private floor = 0;
  private feet = false;
  private lastAge = 0;
  private brokeAt = Infinity;
  private gone = false;
  private seed = 0;
  constructor(private readonly kit: IceKit) { super(); }

  start(p: FreezeOnHitParams, cue: CueContext) {
    this.reset();
    this.cue = cue; this.preset = icePreset(cue.preset);
    this.grow = p.grow ?? .1; this.hold = p.hold ?? .5; this.breakFor = p.shatter ?? .4; this.bulk = p.bulk ?? 1.35;
    this.spikes = Math.min(SPIKES_MAX, tierCount(p.spikes ?? { low: 0, medium: 1, high: 2 }, cue.tier, cue.density));
    this.floor = cue.anchor.floor; this.seed = (cue.seed % 1019) / 1019;
    this.push.copy(cue.heading).setY(0);
    if (this.push.lengthSq() < 1e-8) this.push.set(0, 0, 1);
    this.push.normalize();
  }

  /** The body's joints into `from` / `to`; false when it has too few to read (a body without a standard rig). */
  private pose(body: Fighter) {
    const drawn = body as Fighter & { drawnJoint?(name: string): THREE.Object3D | undefined };
    const joint = (name: StandardJoint) => drawn.drawnJoint?.(name) ?? body.joints?.get(name);
    let low = Infinity, high = -Infinity, found = 0;
    for (let i = 0; i < N; i++) {
      this.has[i] = 0;
      const [a, b] = PIECES[i], ja = joint(a);
      if (!ja) continue;
      ja.getWorldPosition(this.from[i]);
      if (b === 'crown') {
        const neck = joint('Neck');
        if (neck) { neck.getWorldPosition(scratch.a); this.to[i].copy(this.from[i]).add(scratch.a.subVectors(this.from[i], scratch.a).multiplyScalar(1.1)); }
        else this.to[i].copy(this.from[i]).addScaledVector(UP, .22);
      } else {
        const jb = joint(b);
        if (!jb) continue;
        jb.getWorldPosition(this.to[i]);
      }
      this.has[i] = 1; found++;
      const y = Math.min(this.from[i].y, this.to[i].y);
      this.rank[i] = y; if (y < low) low = y; if (y > high) high = y;
    }
    for (let i = 0; i < N; i++) if (this.has[i]) this.rank[i] = clamp01((this.rank[i] - low) / Math.max(.2, high - low));
    // The body's size from its hips to its crown, whatever way up it is.
    this.size = this.has[0] && this.has[3] ? Math.max(.6, Math.min(1.6, this.from[0].distanceTo(this.to[3]) / .85)) : 1;
    bodyCentre(body, this.centre);
    return found >= 4;
  }

  update(age: number, _dt: number, frame: EffectFrame) {
    const cue = this.cue;
    if (!cue || this.gone) return false;
    const body = cue.targetId ? frame.fighters.get(cue.targetId) : undefined;
    // Held, the shell rides the body; once broken (or with the body gone) the pieces fly from where they were.
    if (this.brokeAt === Infinity) {
      if (age >= this.grow + this.hold) this.brokeAt = this.grow + this.hold;
      else if (!body) this.brokeAt = this.lastAge;
    }
    if (this.brokeAt === Infinity && body) {
      if (!this.pose(body)) return false;
      if (!this.checkedFeet) { this.checkedFeet = true; this.feet = body.state?.grounded !== false && Math.abs(body.group.position.y - this.floor) < .4; }
    }
    this.lastAge = age;
    const t = age - this.brokeAt;
    if (t > this.breakFor) return false;
    const breaking = t >= 0, k = breaking ? t / this.breakFor : 0, fade = 1 - k * k;
    const crystals = this.kit.crystals, shards = this.kit.shards, p = scratch.p, d = scratch.d, q = scratch.q, color = scratch.color;
    const scaleBody = this.size;
    for (let i = 0; i < N; i++) {
      if (!this.has[i]) continue;
      // The freeze climbs from the feet to the crown.
      const appear = clamp01((age - this.rank[i] * this.grow * .8) / (this.grow * .45 + .02));
      if (appear <= 0) continue;
      const h = fract(Math.sin((i + this.seed * 113) * 12.9898) * 43758.5453), g = fract(h * 47.3);
      d.subVectors(this.to[i], this.from[i]);
      const length = d.length();
      if (length < .02) continue;
      d.divideScalar(length);
      const r = PIECES[i][2] * this.bulk * scaleBody * (.75 + .25 * appear);
      p.copy(this.from[i]).addScaledVector(d, -length * .08);
      if (breaking) {
        // Off along the blow and out from the body's middle, falling, turning.
        scratch.a.subVectors(p, this.centre).setY(0);
        const out = scratch.a.lengthSq() > 1e-6 ? scratch.a.normalize() : scratch.a.set(Math.cos(h * TAU), 0, Math.sin(h * TAU));
        p.addScaledVector(this.push, (2.2 + 2 * h) * t).addScaledVector(out, (1.4 + 1.6 * g) * t);
        p.y += (1.6 + g * 2) * t - .5 * GRAVITY * t * t;
        d.applyAxisAngle(scratch.n.set(g - .5, .3, h - .5).normalize(), t * (5 + h * 8));
      }
      q.setFromUnitVectors(UP, d).multiply(scratch.r.setFromAxisAngle(UP, h * TAU));
      color.copy(this.preset.pale).lerp(this.preset.frost, .25 + .2 * g);
      const birth = clamp01(1 - (age - this.rank[i] * this.grow * .8) / .25) * .8 + (breaking ? clamp01(1 - t / .1) : 0);
      crystals.add(p, q, r * 2, length * 1.16 * (breaking ? 1 - k * .5 : 1), r * 2 * (.85 + .3 * h), color, .92 * fade, i + this.seed * 10, birth, CRYSTAL.column, 1);
      // Rime needles standing out of the shell.
      for (let s = 0; s < this.spikes; s++) {
        const a = h * TAU + s * 2.4, along = .25 + .5 * fract(h * (s + 3.1));
        scratch.a.set(Math.cos(a), .35 + .4 * g, Math.sin(a)).normalize();
        scratch.b.copy(p).addScaledVector(d, length * along).addScaledVector(scratch.a, r * .8);
        q.setFromUnitVectors(UP, scratch.a);
        const size = r * (.35 + .25 * g) * appear;
        shards.add(scratch.b, q, size * .6, size * 2.2, size * .6, color, .9 * fade, i * 3 + s, birth, 0, 0);
      }
    }
    // The cold flash of the freeze, on the body.
    if (frame.light && age < .45) frame.light(this.centre.x, this.centre.y + .4, this.centre.z, this.preset.light, 8 * Math.min(1, age / .03) * Math.exp(-5 * age), 5);
    // Ice over the feet, rooting the body to the floor while it holds.
    if (this.feet && !breaking) {
      for (let i = 0; i < FEET; i++) {
        const a = (i / FEET) * TAU + this.seed * 5, h = fract(Math.sin((i + this.seed * 7) * 78.233) * 1543.1);
        const appear = clamp01(age / (this.grow * .6 + .02));
        p.set(this.centre.x + Math.cos(a) * .32, this.floor - .03, this.centre.z + Math.sin(a) * .32);
        scratch.a.set(-Math.cos(a) * .55, 1, -Math.sin(a) * .55).normalize();
        q.setFromUnitVectors(UP, scratch.a).multiply(scratch.r.setFromAxisAngle(UP, h * TAU));
        color.copy(this.preset.body).lerp(this.preset.pale, .5);
        const tall = (.45 + .4 * h) * appear * scaleBody;
        crystals.add(p, q, .26 * appear, tall, .22 * appear, color, .9, 40 + i, .5, CRYSTAL.blade, 0);
      }
    }
    return true;
  }

  cancel(reason: CancelReason) {
    if (reason === 'despawn') { this.gone = true; return; }
    if (this.brokeAt === Infinity) this.brokeAt = this.lastAge;
    this.breakFor = Math.min(this.breakFor, .15);
  }

  protected reset() {
    this.cue = undefined; this.feet = false; this.checkedFeet = false; this.lastAge = 0; this.brokeAt = Infinity; this.gone = false; this.has.fill(0); this.size = 1;
  }
}

/** A brief ice-statue shell on a body, broken off it by the blow. */
export function freezeOnHitType(kit: IceKit, capacity = 3) {
  return new IceType<FreezeOnHitParams, FreezeOnHit>('ice/freeze', capacity, { draws: 0, gpuMs: .02 }, kit, k => new FreezeOnHit(k));
}
