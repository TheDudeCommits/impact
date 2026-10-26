import { describe, expect, it } from 'vitest';
import { GameRenderer } from '../src/render/GameRenderer';

const old = (frameTimes: number[]) => { const frames = frameTimes.slice().sort((a, b) => a - b); const avg = frames.reduce((a, b) => a + b, 0) / Math.max(1, frames.length); return { fps: 1000 / avg, p95: frames[Math.floor(frames.length * .95)] ?? 0, samples: frames.length }; };
const rng = (seed: number) => () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const stand = (frameTimes: number[]) => ({ frameTimes, perfTimes: new Float64Array(600), governor: { scale: 1 }, renderer: { info: { render: { calls: 3, triangles: 4 }, memory: { geometries: 5, textures: 6 } }, getPixelRatio: () => 1.5 } });

describe('the renderer\'s frame statistics', () => {
  it('give exactly what the comparator sort gave, for any window of frame times', () => {
    const perf = GameRenderer.prototype.perf;
    for (let seed = 1; seed <= 40; seed++) {
      const r = rng(seed), n = seed === 1 ? 0 : seed === 2 ? 1 : Math.floor(r() * 601);
      const times = Array.from({ length: n }, () => r() < .1 ? 16.7 : r() < .05 ? 0 : r() * 70);
      const s = stand(times), a = perf.call(s as never), b = old(times);
      expect([a.fps, a.p95, a.samples]).toEqual([b.fps, b.p95, b.samples]);
      expect(s.frameTimes).toEqual(times);
    }
  });
  it('grows its buffer for a window longer than it was made for', () => {
    const times = Array.from({ length: 900 }, (_, i) => (i * 7919) % 97 / 3), s = stand(times), a = GameRenderer.prototype.perf.call(s as never), b = old(times);
    expect([a.fps, a.p95]).toEqual([b.fps, b.p95]);
  });
});
