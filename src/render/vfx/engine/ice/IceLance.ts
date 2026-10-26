// The body is the glacial core of the VFX Armory's hand-cast-abilities (src/assets/GlacialGeometry.js,
// mohamedachrefelouafi, MIT; notices in ./LICENSE.upstream.txt), and the wake follows its src/materials/GlacialSpine.js:
// every wake piece is placed where the head was when it shed it (`s_birth = front - age * speed`), so the wake keeps
// no history and allocates nothing. Changes: a straight path (the game's shot flies straight), the core drawn in the
// shared crystal batch, forming in the palm through the charge and shattering where the shot stops.
import * as THREE from 'three';
import { PooledEffect, tierCount, type CancelReason, type CueContext, type EffectFrame, type PerTier } from '../Effect';
import type { IceKit } from './IceKit';
import { CRYSTAL } from './geometry';
import { icePreset, type IcePreset } from './preset';
import { IceType, TAU, UP, alongY, clamp01, lerp, scratch } from './common';

export interface IceLanceParams {
  /** The lance's length and its girdle's radius in flight (metres). */
  length?: number;
  girdle?: number;
  /** How big it is in the palm at the release, against its flight size. */
  palm?: number;
  /** Wake pieces per tier, and metres between them. */
  wake?: PerTier;
  spacing?: number;
  /** Seconds a wake piece lasts. */
  wakeLife?: number;
  /** Pieces it shatters into where it stops, per tier. */
  burst?: PerTier;
  /** Its speed (metres a second) for the wake's ages. */
  speed?: number;
  /** Seconds of charge before it is let go (the move's first contact), over which it forms in the palm. */
  charge?: number;
}

const WAKE_MAX = 40, BURST_MAX = 24, BURST_LIFE = .45, GRAVITY = 9;
const fract = (v: number) => v - Math.floor(v);

class IceLance extends PooledEffect<IceLanceParams> {
  private cue?: CueContext;
  private preset: IcePreset = icePreset('ice/aokiji');
  private length = 2.6; private girdle = .34; private palm = .28; private spacing = .7; private wakeLife = .5; private speed = 27; private charge = .7;
  private wake = 0; private burst = 0;
  private released = false;
  private releasedAt = 0;
  /** Where it was let go, the way it flies, how far it has gone. */
  private readonly launch = new THREE.Vector3();
  private readonly dir = new THREE.Vector3(0, 0, 1);
  private readonly head = new THREE.Vector3();
  private readonly last = new THREE.Vector3();
  private travelled = 0;
  /** When it stopped (shattering), on its own clock. */
  private endedAt = Infinity;
  private ageNow = 0;
  private gone = false;
  private seed = 0;
  constructor(private readonly kit: IceKit) { super(); }

  start(p: IceLanceParams, cue: CueContext) {
    this.reset();
    this.cue = cue; this.preset = icePreset(cue.preset);
    this.length = p.length ?? 2.6; this.girdle = p.girdle ?? .34; this.palm = p.palm ?? .28; this.spacing = p.spacing ?? .7; this.wakeLife = p.wakeLife ?? .5; this.speed = p.speed ?? 27; this.charge = p.charge ?? .7;
    this.wake = Math.min(WAKE_MAX, tierCount(p.wake ?? { low: 6, medium: 12, high: 18 }, cue.tier, cue.density));
    this.burst = Math.min(BURST_MAX, tierCount(p.burst ?? { low: 6, medium: 10, high: 14 }, cue.tier, cue.density, 3));
    this.dir.copy(cue.heading); this.head.copy(cue.anchor.point); this.last.copy(this.head);
    this.seed = (cue.seed % 1009) / 1009;
  }

  update(age: number, _dt: number, frame: EffectFrame) {
    const cue = this.cue;
    if (!cue || this.gone) return false;
    this.ageNow = age;
    const flight = cue.anchor.flight ? frame.flights.get(cue.anchor.flight) : undefined;
    if (this.endedAt === Infinity) {
      if (flight) {
        if (flight.released && !this.released) {
          this.released = true; this.releasedAt = age;
          this.launch.copy(flight.origin ?? flight.position);
        }
        this.last.copy(this.head); this.head.copy(flight.position);
        // The way it is really going (it can be led up or down at a jumping target); the floor's heading until it moves.
        if (this.released) {
          scratch.d.subVectors(this.head, this.launch);
          const span = scratch.d.length();
          if (span > .05) { this.dir.copy(scratch.d).divideScalar(span); this.travelled = span; }
          else if (flight.heading.lengthSq() > 1e-8) this.dir.copy(flight.heading);
        } else if (flight.heading.lengthSq() > 1e-8) this.dir.copy(flight.heading);
      } else if (this.released || age > 2.5) this.endedAt = age;
      else {
        // The first frame, before the cast's flight is published: the thrower's hand.
        const actor = frame.fighters.get(cue.actorId);
        if (actor) this.head.copy(actor.handR);
      }
    }
    if (this.endedAt < Infinity) { this.glow(frame, 10 * Math.exp(-12 * (age - this.endedAt))); return this.shatter(age - this.endedAt); }
    if (!this.released) this.forming(age);
    else { this.flying(age); this.glow(frame, 9 * clamp01(this.travelled / 1.5)); }
    return true;
  }

  /** The light the lance carries (the projectile light the game gives every shot it does not dress itself). */
  private glow(frame: EffectFrame, intensity: number) {
    if (frame.light && intensity > .05) frame.light(this.head.x, this.head.y, this.head.z, this.preset.light, intensity, 7);
  }

  /** In the palm through the charge: a small lance pointing down the aim, growing as the release comes. */
  private forming(age: number) {
    const t = clamp01(age / Math.max(.05, this.charge)), grow = t * t * (3 - 2 * t);
    if (grow < .04) return;
    const k = this.palm * grow, p = scratch.p, q = scratch.q;
    // Its rear in the palm, its nose ahead.
    p.copy(this.head).addScaledVector(this.dir, -this.length * k * .3);
    alongY(this.dir, age * 2.2, q);
    scratch.color.copy(this.preset.pale).lerp(this.preset.frost, .25 + .3 * t);
    this.kit.crystals.add(p, q, this.girdle * 2 * k, this.length * k, this.girdle * 2 * k, scratch.color, .55 + .4 * grow, this.seed * 10, .2 + .25 * t, CRYSTAL.core, 0);
  }

  private flying(age: number) {
    const p = scratch.p, q = scratch.q, color = scratch.color, crystals = this.kit.crystals;
    const since = age - this.releasedAt, scale = lerp(this.palm, 1, clamp01(since / .08));
    // The body: nose at the head, turning slowly on its axis.
    p.copy(this.head).addScaledVector(this.dir, -this.length * scale * .75);
    alongY(this.dir, since * 3.1 + this.seed * TAU, q);
    color.copy(this.preset.body).lerp(this.preset.pale, .55);
    crystals.add(p, q, this.girdle * 2 * scale, this.length * scale, this.girdle * 2 * scale, color, .95, this.seed * 10, clamp01(1 - since / .25) * .8, CRYSTAL.core, 0);
    // The wake: pieces shed at fixed distances behind it, each placed where the head was when it passed.
    const shards = this.kit.shards;
    for (let k = 0; k < this.wake; k++) {
      const s = this.travelled - (k + 1) * this.spacing - this.length * .4;
      if (s < 0) break;
      const t = (this.travelled - s) / this.speed;
      if (t > this.wakeLife) continue;
      const h = fract(Math.sin((k + this.seed * 97) * 12.9898) * 43758.5453), g = fract(h * 61.7), fade = 1 - t / this.wakeLife;
      const swirl = h * TAU + t * 5, out = .18 + .55 * t;
      scratch.a.crossVectors(this.dir, UP); if (scratch.a.lengthSq() < 1e-6) scratch.a.set(1, 0, 0); scratch.a.normalize();
      scratch.b.crossVectors(scratch.a, this.dir);
      p.copy(this.launch).addScaledVector(this.dir, s).addScaledVector(scratch.a, Math.cos(swirl) * out).addScaledVector(scratch.b, Math.sin(swirl) * out - GRAVITY * .25 * t * t);
      q.setFromAxisAngle(scratch.n.set(g - .5, 1, h - .5).normalize(), t * 9 + h * TAU);
      const size = (.05 + g * .06) * (1 - t * .6);
      color.copy(this.preset.pale).lerp(this.preset.frost, .6);
      shards.add(p, q, size, size * 3, size, color, .9 * fade, h * 10, 0, 0, 0);
    }
  }

  /** Where it stopped, it comes apart: its pieces carry on along its line and fall. */
  private shatter(t: number) {
    if (!this.released || t > BURST_LIFE) return false;
    const p = scratch.p, q = scratch.q, color = scratch.color, shards = this.kit.shards, fade = 1 - t / BURST_LIFE;
    scratch.a.crossVectors(this.dir, UP); if (scratch.a.lengthSq() < 1e-6) scratch.a.set(1, 0, 0); scratch.a.normalize();
    scratch.b.crossVectors(scratch.a, this.dir);
    color.copy(this.preset.pale).lerp(this.preset.frost, .45);
    for (let i = 0; i < this.burst; i++) {
      const h = fract(Math.sin((i + this.seed * 131) * 78.233) * 12543.123), g = fract(h * 37.1), angle = (i / this.burst) * TAU + h;
      const out = 2 + g * 3.5, ahead = 3 + h * 4;
      p.copy(this.head).addScaledVector(this.dir, ahead * t * (1 - t * .6)).addScaledVector(scratch.a, Math.cos(angle) * out * t).addScaledVector(scratch.b, Math.sin(angle) * out * t);
      p.y -= GRAVITY * .5 * t * t;
      q.setFromAxisAngle(scratch.n.set(Math.cos(angle), g, Math.sin(angle)).normalize(), t * (8 + g * 8) + angle);
      const size = (.07 + g * .09) * (this.girdle / .34);
      shards.add(p, q, size, size * 2.8, size, color, fade, h * 10, clamp01(1 - t / .12), 0, 0);
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

/** Pheasant Beak as a lance: a glacial core flying the shot's line, shedding ice. */
export function iceLanceType(kit: IceKit, capacity = 4) {
  return new IceType<IceLanceParams, IceLance>('ice/lance', capacity, { draws: 0, gpuMs: .01 }, kit, k => new IceLance(k));
}
