import * as THREE from 'three';
import { EffectPool, type EffectInstance, type EffectType, type PooledEffect } from '../Effect';
import type { IceKit } from './IceKit';

/** An effect type whose instances draw into the scene's IceKit: a fixed pool, made in `prewarm`. */
export class IceType<P, I extends PooledEffect<P>> implements EffectType<P> {
  private pool?: EffectPool<I>;
  constructor(readonly id: string, readonly capacity: number, readonly cost: { draws: number; gpuMs: number }, readonly kit: IceKit, private readonly make: (kit: IceKit) => I) {}
  prewarm(_scene: THREE.Scene) { if (!this.pool) this.pool = new EffectPool<I>(this.capacity, () => this.make(this.kit)); }
  acquire(): EffectInstance<P> | null { return this.pool?.acquire() ?? null; }
  /** How many are running. */
  get live() { return this.pool?.live ?? 0; }
  /** The pool, once prewarmed (tests). */
  get instances(): readonly I[] { return this.pool?.all ?? []; }
}

export const TAU = Math.PI * 2;
export const UP = Object.freeze(new THREE.Vector3(0, 1, 0));
export const clamp01 = (v: number) => v < 0 ? 0 : v > 1 ? 1 : v;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (a: number, b: number, v: number) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

/** How far out of the floor a crystal is, `elapsed` seconds after it began to rise (FrostLanceField `emergence`):
 *  -1 before, a quintic punch up to full height over `rise`, then one quick overshoot that settles. */
export function emergence(elapsed: number, rise: number, overshoot = .18, settle = .12) {
  if (elapsed < 0) return -1;
  if (elapsed <= rise) return 1 - Math.pow(1 - clamp01(elapsed / Math.max(1e-3, rise)), 5);
  const after = elapsed - rise;
  return 1 + overshoot * Math.sin(after * 14) * Math.exp(-after / settle);
}

/** Scratch shared by the kit's instances inside one update (never held across calls). */
export const scratch = {
  p: new THREE.Vector3(), a: new THREE.Vector3(), b: new THREE.Vector3(), d: new THREE.Vector3(), n: new THREE.Vector3(),
  q: new THREE.Quaternion(), r: new THREE.Quaternion(), color: new THREE.Color(), m: new THREE.Matrix4(),
};

/** A quaternion turning +y onto `dir` (unit), then `roll` about it. */
export function alongY(dir: THREE.Vector3, roll: number, out: THREE.Quaternion) {
  out.setFromUnitVectors(UP, dir);
  if (roll) out.multiply(scratch.r.setFromAxisAngle(UP, roll));
  return out;
}
