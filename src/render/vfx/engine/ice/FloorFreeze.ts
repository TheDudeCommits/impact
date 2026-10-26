// Adapted from the VFX Armory (MIT; notices in ./LICENSE.upstream.txt): the spreading frost of ability-project-27
// src/abilities/ice/FrostGroundEffect.ts and its ColdMist.ts (itzmitto), and the freeze-then-thaw of elemental-sandbox
// src/abilities/frost/BlackIceAbility.js with the sheet-ice plates of src/vfx/GroundField.js (PLATE): a thaw that runs
// the freeze backwards, plate by plate, rather than fading it. The planar reflection Black Ice pays a whole scene
// render for is left out; the plates and the cracks carry the ice.
// Changes: one instanced quad per freeze in the shared IceKit (a disc spreading from a point, or a strip down a
// projectile's path), its front in metres, the mist as a handful of seeded cards.
import * as THREE from 'three';
import { PooledEffect, tierCount, type CancelReason, type CueContext, type EffectFrame, type PerTier } from '../Effect';
import type { IceKit } from './IceKit';
import { icePreset, type IcePreset } from './preset';
import { IceType, TAU, clamp01, scratch, smooth } from './common';

export interface FloorFreezeParams {
  /** A disc spreading from the anchor, or a strip down a projectile's path (anchor socket `flight`). */
  shape?: 'disc' | 'strip';
  /** The disc's radius, or the strip's longest (metres). */
  reach?: number;
  /** The strip's half-width (metres). */
  width?: number;
  /** Seconds for the disc to spread to its edge (a strip follows its shot). */
  grow?: number;
  /** Seconds it stays frozen once it is all down. */
  hold?: number;
  /** Seconds the thaw takes. */
  thaw?: number;
  /** Cold mist cards over it, per tier (0: none). */
  mist?: PerTier;
  /** The sheet's opacity at its densest. */
  opacity?: number;
}

const MIST_MAX = 16;
const FLOOR_REACH = { low: .7, medium: .85, high: 1 } as const;
const ZUP = new THREE.Vector3(0, 0, 1);

class FloorFreeze extends PooledEffect<FloorFreezeParams> {
  private cue?: CueContext;
  private preset: IcePreset = icePreset('ice/aokiji');
  private strip = false;
  private reach = 6; private width = 1; private grow = .6; private hold = 1.2; private thaw = .6; private opacity = .9;
  private mist = 0;
  private readonly origin = new THREE.Vector3();
  private readonly dir = new THREE.Vector3(0, 0, 1);
  private readonly q = new THREE.Quaternion();
  private floor = 0;
  private front = 0;
  private released = false;
  /** Age at which it was all down (a disc: `grow`; a strip: when its shot stopped). */
  private down = Infinity;
  private cutAt = Infinity;
  private ageNow = 0;
  private gone = false;
  private readonly mistA = new Float32Array(MIST_MAX);
  private readonly mistR = new Float32Array(MIST_MAX);
  private readonly mistS = new Float32Array(MIST_MAX);
  private readonly mistT = new Float32Array(MIST_MAX);
  private seed = 0;
  constructor(private readonly kit: IceKit) { super(); }

  start(p: FloorFreezeParams, cue: CueContext) {
    this.reset();
    this.cue = cue; this.preset = icePreset(cue.preset);
    this.strip = p.shape === 'strip';
    this.reach = p.reach ?? 6; this.width = p.width ?? 1; this.grow = p.grow ?? .6; this.hold = p.hold ?? 1.2; this.thaw = p.thaw ?? .6; this.opacity = p.opacity ?? .9;
    // A frozen floor's cost is the floor it covers (measured: about 0.4 ms for an 8.5 m disc at 1080p on an M4), so a
    // disc is smaller on the lower presets: 72% of the area on Medium, half on Low.
    if (!this.strip) this.reach *= FLOOR_REACH[cue.tier];
    this.floor = cue.anchor.floor;
    this.origin.copy(cue.anchor.point); this.origin.y = this.floor;
    this.dir.copy(cue.heading).setY(0); if (this.dir.lengthSq() < 1e-8) this.dir.set(0, 0, 1); this.dir.normalize();
    this.seed = (cue.seed % 997) / 997;
    if (!this.strip) this.down = this.grow;
    this.mist = Math.min(MIST_MAX, tierCount(p.mist ?? { low: 0, medium: 0, high: 0 }, cue.tier, cue.density));
    for (let i = 0; i < this.mist; i++) {
      const h = Math.sin((cue.seed % 9973 + i * 17.13) * 12.9898) * 43758.5453, u = h - Math.floor(h), v = h * 7.31 - Math.floor(h * 7.31);
      this.mistA[i] = (i / Math.max(1, this.mist)) * TAU + u * .9; this.mistR[i] = .3 + .65 * v; this.mistS[i] = .8 + u * .6; this.mistT[i] = v * .35;
    }
  }

  update(age: number, _dt: number, frame: EffectFrame) {
    if (!this.cue || this.gone) return false;
    this.ageNow = age;
    if (this.strip) this.follow(frame);
    else this.front = this.reach * (1 - Math.pow(1 - clamp01(age / Math.max(.01, this.grow)), 2));
    const thawStart = Math.min(this.down + this.hold, this.cutAt), thawFor = this.cutAt < this.down + this.hold ? .15 : this.thaw;
    const thaw = clamp01((age - thawStart) / thawFor);
    if (thaw >= 1) return false;
    if (this.front > .05) this.draw(age, thaw);
    // A cold glow off the ice while it spreads, from where it started.
    if (frame.light && !this.strip && age < this.grow + .5 && this.cutAt === Infinity) {
      const k = Math.sin(Math.PI * clamp01(age / (this.grow + .5)));
      frame.light(this.origin.x, this.floor + .7, this.origin.z, this.preset.light, 7 * k, this.reach * 1.3);
    }
    return true;
  }

  /** A strip follows its shot: frozen under it as far as it has flown, all down once it stops. */
  private follow(frame: EffectFrame) {
    const cue = this.cue!, flight = cue.anchor.flight ? frame.flights.get(cue.anchor.flight) : undefined;
    if (this.down < Infinity) return;
    if (!this.released) {
      if (!flight) { if (this.ageNow > 2.5) this.down = this.ageNow; return; }
      if (!flight.released) return;
      this.released = true;
      this.origin.copy(flight.origin ?? flight.position); this.origin.y = this.floor;
      if (flight.heading.lengthSq() > 1e-8) this.dir.copy(flight.heading).setY(0).normalize();
    }
    if (!flight) { this.down = this.ageNow; return; }
    scratch.a.copy(flight.position).sub(this.origin);
    this.front = Math.min(this.reach, Math.max(this.front, scratch.a.x * this.dir.x + scratch.a.z * this.dir.z));
  }

  private draw(age: number, thaw: number) {
    const floor = this.kit.floor, p = scratch.p, color = scratch.color;
    color.copy(this.preset.body).lerp(this.preset.pale, .35);
    if (this.strip) {
      // From its start to the far end of its longest; the shader draws only up to the front.
      const half = this.reach / 2;
      p.copy(this.origin).addScaledVector(this.dir, half); p.y = this.floor + .025;
      this.q.setFromUnitVectors(ZUP, this.dir);
      floor.add(p, this.q, this.width, 1, half, color, this.opacity, this.front, thaw, this.seed, 1);
    } else {
      p.copy(this.origin); p.y = this.floor + .025;
      floor.add(p, this.q.identity(), this.reach, 1, this.reach, color, this.opacity, this.front, thaw, this.seed, 0);
    }
    this.drawMist(age, thaw);
  }

  /** Cold mist off the ice: cards that rise and drift out once it is down, thinning as it thaws. */
  private drawMist(age: number, thaw: number) {
    if (!this.mist) return;
    const mist = this.kit.mist, p = scratch.p, q = scratch.q.identity(), color = this.preset.mist;
    for (let i = 0; i < this.mist; i++) {
      const t = age - this.mistT[i] - (this.strip ? 0 : this.grow * .5);
      if (t < 0) continue;
      const fade = smooth(0, .5, t) * (1 - thaw) * (1 - smooth(2.6, 3.6, t));
      if (fade <= .01) continue;
      let x: number, z: number, size = this.mistS[i] * (this.strip ? 1 : 1.25) * (1 + t * .2);
      if (this.strip) {
        const d = this.mistR[i] * this.front, across = (this.mistA[i] / TAU % 1 - .5) * this.width * 1.4;
        x = this.origin.x + this.dir.x * d + this.dir.z * across;
        z = this.origin.z + this.dir.z * d - this.dir.x * across;
      } else {
        const r = this.front * this.mistR[i] + t * .35;
        x = this.origin.x + Math.cos(this.mistA[i]) * r; z = this.origin.z + Math.sin(this.mistA[i]) * r;
        size *= .8 + this.reach / 10;
      }
      // Low: mist rolling over the ice, not a cloud standing on it.
      p.set(x, this.floor + size * .3 + t * .08, z);
      mist.add(p, q, size * 1.7, size * .62, 1, color, .14 * fade, this.mistA[i], 0, 0, 0);
    }
  }

  cancel(reason: CancelReason) {
    if (reason === 'despawn') { this.gone = true; return; }
    this.cutAt = Math.min(this.cutAt, this.ageNow);
  }

  protected reset() {
    this.cue = undefined; this.front = 0; this.released = false; this.down = Infinity; this.cutAt = Infinity; this.ageNow = 0; this.gone = false; this.mist = 0;
  }
}

/** A frost sheet spreading over the floor, holding, then thawing back. It owns the kit's floor and mist batches (two
 *  draws); an 8.5 m disc measured about 0.4 ms at 1080p on the M4, its mist about 0.035 ms a card. */
export function floorFreezeType(kit: IceKit, capacity = 4) {
  return new IceType<FloorFreezeParams, FloorFreeze>('ice/floor-freeze', capacity, { draws: 2, gpuMs: .4 }, kit, k => new FloorFreeze(k));
}
