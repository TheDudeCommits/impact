import type * as THREE from 'three';
import type { Element } from '../palette';
import type { Fighter } from '../../Fighter';
import type { Flight } from '../../CombatEffects';
import type { Canonical } from '../../skeleton';


export type Tier = 'low' | 'medium' | 'high';
export const TIERS: readonly Tier[] = ['low', 'medium', 'high'];
export type PerTier<T = number> = Readonly<Record<Tier, T>>;
export function tierCount(count: PerTier, tier: Tier, density = 1, floor = 0) {
  return Math.max(floor, Math.round(count[tier] * Math.max(.3, Math.min(1, density))));
}

export type CancelReason = 'whiff' | 'interrupt' | 'clash' | 'despawn';

export type StandardJoint = Canonical;
export type Socket = 'centre' | 'floor' | 'strike' | 'hand' | 'flight' | 'origin' | 'endpoint';

export interface EffectAnchor {
  readonly point: THREE.Vector3;
  readonly fighter?: string;
  readonly joint?: StandardJoint;
  readonly socket?: Socket;
  readonly flight?: string;
  readonly follow: boolean;
  readonly floor: number;
}

export interface CueContext {
  readonly seed: number;
  readonly palette: Element;
  readonly preset: string;
  readonly anchor: EffectAnchor;
  readonly tier: Tier;
  readonly density: number;
  readonly local: boolean;
  readonly actorId: string;
  readonly targetId?: string;
  readonly heading: THREE.Vector3;
}

export interface EffectFrame {
  readonly time: number;
  readonly fighters: ReadonlyMap<string, Fighter>;
  readonly flights: ReadonlyMap<string, Flight>;
  locate(anchor: EffectAnchor, out: THREE.Vector3): boolean;
  light?(x: number, y: number, z: number, hex: number, intensity: number, distance: number): void;
}

export interface EffectInstance<P> {
  start(params: P, cue: CueContext): void;
  update(age: number, dt: number, frame: EffectFrame): boolean;
  cancel(reason: CancelReason): void;
  release(): void;
}

export interface EffectType<P> {
  readonly id: string;
  readonly capacity: number;
  readonly cost: { readonly draws: number; readonly gpuMs: number };
  prewarm(scene: THREE.Scene): void;
  acquire(): EffectInstance<P> | null;
}

export interface EffectLayer {
  begin(time: number, owner?: object): void;
  end(owner?: object): void;
  reset(): void;
  dispose(): void;
}

export abstract class PooledEffect<P> implements EffectInstance<P> {
  private home?: EffectPool<PooledEffect<P>>;
  adopt(pool: EffectPool<PooledEffect<P>>) { this.home = pool; }
  abstract start(params: P, cue: CueContext): void;
  abstract update(age: number, dt: number, frame: EffectFrame): boolean;
  abstract cancel(reason: CancelReason): void;
  protected abstract reset(): void;
  release() { if (this.home?.owns(this)) { this.reset(); this.home.give(this); } }
}

export class EffectPool<I extends EffectInstance<unknown>> {
  readonly capacity: number;
  private readonly items: I[];
  private readonly out: Uint8Array;
  private used = 0;
  constructor(capacity: number, make: (index: number) => I) {
    this.capacity = Math.max(0, Math.floor(capacity));
    this.items = Array.from({ length: this.capacity }, (_, i) => make(i));
    this.out = new Uint8Array(this.capacity);
    for (const item of this.items) (item as unknown as { adopt?(pool: unknown): void }).adopt?.(this);
  }
  acquire(): I | null {
    if (this.used >= this.capacity) return null;
    for (let i = 0; i < this.capacity; i++) if (!this.out[i]) { this.out[i] = 1; this.used++; return this.items[i]; }
    return null;
  }
  owns(item: unknown) { const i = this.items.indexOf(item as I); return i >= 0 && this.out[i] === 1; }
  give(item: I) {
    const i = this.items.indexOf(item);
    if (i < 0 || !this.out[i]) return false;
    this.out[i] = 0; this.used--; return true;
  }
  get live() { return this.used; }
  get all(): readonly I[] { return this.items; }
}

export class EffectRegistry {
  private readonly types = new Map<string, EffectType<unknown>>();
  private readonly layers: EffectLayer[] = [];
  register<P>(type: EffectType<P>) { this.types.set(type.id, type as EffectType<unknown>); return this; }
  layer(layer: EffectLayer) { if (!this.layers.includes(layer)) this.layers.push(layer); return this; }
  get(id: string) { return this.types.get(id); }
  unregister(id: string) { this.types.delete(id); return this; }
  get ids() { return [...this.types.keys()]; }
  prewarm(scene: THREE.Scene) { for (const type of this.types.values()) type.prewarm(scene); }
  begin(time: number) { for (const layer of this.layers) layer.begin(time, this); }
  end() { for (const layer of this.layers) layer.end(this); }
  reset() { for (const layer of this.layers) layer.reset(); }
  dispose() { for (const layer of this.layers) layer.dispose(); this.layers.length = 0; this.types.clear(); }
  get cost() { let draws = 0, gpuMs = 0; for (const t of this.types.values()) { draws += t.cost.draws; gpuMs += t.cost.gpuMs; } return { draws, gpuMs }; }
}

export class Seeded {
  private s = 1;
  seed(value: number) { this.s = (Math.floor(Math.abs(value)) ^ 0x9e3779b9) >>> 0 || 1; return this; }
  next() {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  signed() { return this.next() * 2 - 1; }
}
