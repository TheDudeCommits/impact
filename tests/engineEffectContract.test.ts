import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { EffectPool, EffectRegistry, PooledEffect, Seeded, tierCount, type CancelReason, type CueContext, type EffectFrame } from '../src/render/vfx/engine/Effect';
import { InstancedBatch } from '../src/render/vfx/engine/InstancedBatch';

class Probe extends PooledEffect<{ n?: number }> {
  started = 0; params?: { n?: number }; cancelled?: CancelReason; ages: number[] = [];
  start(params: { n?: number }, _cue: CueContext) { this.started++; this.params = params; }
  update(age: number, _dt: number, _frame: EffectFrame) { this.ages.push(age); return true; }
  cancel(reason: CancelReason) { this.cancelled = reason; }
  protected reset() { this.started = 0; this.params = undefined; this.cancelled = undefined; this.ages = []; }
}

describe('effect pool contract (VOL.2)', () => {
  it('makes every instance up front and never more than its capacity', () => {
    let made = 0;
    const pool = new EffectPool(3, () => { made++; return new Probe(); });
    expect(made).toBe(3);
    expect(pool.capacity).toBe(3);
    const a = pool.acquire(), b = pool.acquire(), c = pool.acquire();
    expect([a, b, c].every(Boolean)).toBe(true);
    expect(new Set([a, b, c]).size).toBe(3);
    expect(pool.live).toBe(3);
    expect(pool.acquire()).toBeNull();
    expect(pool.acquire()).toBeNull();
    expect(made).toBe(3);
  });

  it('release resets the instance and returns it to the pool; a second release is harmless', () => {
    const pool = new EffectPool(1, () => new Probe());
    const probe = pool.acquire() as Probe;
    probe.start({ n: 7 }, {} as CueContext); probe.update(.5, .016, {} as EffectFrame); probe.cancel('whiff');
    expect(probe.started).toBe(1); expect(probe.cancelled).toBe('whiff'); expect(probe.ages).toEqual([.5]);
    probe.release();
    expect(pool.live).toBe(0);
    expect(probe.started).toBe(0); expect(probe.params).toBeUndefined(); expect(probe.cancelled).toBeUndefined(); expect(probe.ages).toEqual([]);
    probe.release();
    expect(pool.live).toBe(0);
    expect(pool.acquire()).toBe(probe);
    expect(pool.acquire()).toBeNull();
  });

  it('refuses an instance it does not own or has not handed out', () => {
    const pool = new EffectPool(2, () => new Probe()), other = new EffectPool(1, () => new Probe());
    const mine = pool.acquire()!, theirs = other.acquire()!;
    expect(pool.give(theirs)).toBe(false);
    expect(pool.give(mine)).toBe(true);
    expect(pool.give(mine)).toBe(false);
    expect(pool.live).toBe(0); expect(other.live).toBe(1);
  });

  it('scales counts by tier and settings.effects, with a floor', () => {
    const count = { low: 10, medium: 20, high: 40 };
    expect(tierCount(count, 'low')).toBe(10);
    expect(tierCount(count, 'medium')).toBe(20);
    expect(tierCount(count, 'high')).toBe(40);
    expect(tierCount(count, 'high', .5)).toBe(20);
    expect(tierCount(count, 'high', 0)).toBe(12);
    expect(tierCount({ low: 0, medium: 0, high: 0 }, 'high', 1, 2)).toBe(2);
  });

  it('lays out from a seed the same way every time', () => {
    const a = new Seeded().seed(1234), b = new Seeded().seed(1234), c = new Seeded().seed(1235);
    const run = (s: Seeded) => Array.from({ length: 8 }, () => s.next());
    const first = run(a);
    expect(run(b)).toEqual(first);
    expect(run(c)).not.toEqual(first);
    expect(first.every(v => v >= 0 && v < 1)).toBe(true);
  });

  it('a registry begins and ends its layers once a frame and reports the declared cost', () => {
    const calls: string[] = [];
    const layer = { begin: (t: number) => calls.push(`begin ${t}`), end: () => calls.push('end'), reset: () => calls.push('reset'), dispose: () => calls.push('dispose') };
    const type = { id: 'test/probe', capacity: 2, cost: { draws: 1, gpuMs: .1 }, prewarm: () => calls.push('prewarm'), acquire: () => null };
    const registry = new EffectRegistry().layer(layer).layer(layer).register(type);
    registry.prewarm(new THREE.Scene()); registry.begin(3); registry.end(); registry.reset();
    expect(calls).toEqual(['prewarm', 'begin 3', 'end', 'reset']);
    expect(registry.get('test/probe')).toBe(type);
    expect(registry.cost).toEqual({ draws: 1, gpuMs: .1 });
    registry.dispose();
    expect(calls.at(-1)).toBe('dispose');
    expect(registry.get('test/probe')).toBeUndefined();
  });
});

describe('the shared instanced batch', () => {
  const material = () => new THREE.ShaderMaterial({ vertexShader: 'attribute vec4 tint; void main(){ gl_Position = vec4(0.); }', fragmentShader: 'void main(){ gl_FragColor = vec4(1.); }' });
  const p = new THREE.Vector3(1, 2, 3), q = new THREE.Quaternion(), white = new THREE.Color(1, 1, 1);

  it('holds to its capacity, skips what cannot be seen and uploads only what was drawn', () => {
    const scene = new THREE.Scene();
    const batch = new InstancedBatch(scene, { name: 'probe-batch', geometry: new THREE.BoxGeometry(), material: material(), capacity: 4, tint: 'tint', data: 'extra' });
    expect(scene.getObjectByName('probe-batch')).toBe(batch.mesh);
    expect(batch.mesh.frustumCulled).toBe(false);
    batch.begin();
    expect(batch.add(p, q, 1, 1, 1, white, 0)).toBe(false);
    expect(batch.add(p, q, 0, 1, 1, white, 1)).toBe(false);
    for (let i = 0; i < 4; i++) expect(batch.add(p, q, 1, 2, 3, white, .5, i)).toBe(true);
    expect(batch.add(p, q, 1, 1, 1, white, 1)).toBe(false);
    batch.end();
    expect(batch.mesh.count).toBe(4);
    expect(batch.mesh.instanceMatrix.updateRanges).toEqual([{ start: 0, count: 4 * 16 }]);
    const tint = batch.mesh.geometry.getAttribute('tint') as THREE.InstancedBufferAttribute;
    expect(tint.updateRanges).toEqual([{ start: 0, count: 4 * 4 }]);
    expect(tint.getW(0)).toBeCloseTo(.5);
    expect((batch.mesh.geometry.getAttribute('extra') as THREE.InstancedBufferAttribute).getX(3)).toBe(3);
    const m = new THREE.Matrix4(); batch.mesh.getMatrixAt(2, m);
    expect(new THREE.Vector3().setFromMatrixPosition(m).toArray()).toEqual([1, 2, 3]);
    batch.dispose();
    expect(scene.children).toHaveLength(0);
    batch.dispose();
  });

  it('stays visible until drawn once (its program links at load), then an empty batch costs no draw', () => {
    const batch = new InstancedBatch(null, { name: 'probe', geometry: new THREE.BoxGeometry(), material: material(), capacity: 2, clock: 'uTime' });
    batch.mesh.material.uniforms.uTime = { value: 0 };
    const fresh = new InstancedBatch(null, { name: 'probe2', geometry: new THREE.BoxGeometry(), material: Object.assign(material(), { uniforms: { uTime: { value: 0 } } }), capacity: 2, clock: 'uTime' });
    fresh.begin(4.5); fresh.end();
    expect(fresh.mesh.material.uniforms.uTime.value).toBe(4.5);
    expect(fresh.mesh.visible).toBe(true);
    (fresh.mesh.onAfterRender as () => void)();
    fresh.begin(5); fresh.end();
    expect(fresh.mesh.visible).toBe(false);
    fresh.begin(); fresh.add(p, q, 1, 1, 1, white, 1); fresh.end();
    expect(fresh.mesh.visible).toBe(true);
    batch.dispose(); fresh.dispose();
  });
});
