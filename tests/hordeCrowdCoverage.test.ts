import { describe, expect, it } from 'vitest';
import { crowdCoverage, riftCrowdCoverage } from '../src/render/horde/crowdCoverage';

describe('per-instance camera cutaway', () => {
  it('keeps a tall Rift enemy visible near the hero, with full cutaway only inside the lens', () => {
    expect(riftCrowdCoverage(0, 0, -3, 4, 0, 0, -9)).toBe(.45);
    expect(riftCrowdCoverage(0, 0, -.5, 4, 0, 0, -9)).toBe(1);
    expect(riftCrowdCoverage(0, 0, -12, 4, 0, 0, -9)).toBe(0);
  });
  it('reveals the fighter behind an intervening body without hiding the enemy beyond them', () => {
    expect(crowdCoverage(0, 0, -5, 2, 0, 0, -9)).toBe(1);
    expect(crowdCoverage(0, 0, -11, 2, 0, 0, -9)).toBe(0);
    expect(crowdCoverage(4, 0, -5, 2, 0, 0, -9)).toBe(0);
  });
  it('scales near-camera fading with the body size and keeps the edge gradual', () => {
    expect(crowdCoverage(0, 0, -3, 3, 0, 0, 0)).toBe(1);
    expect(crowdCoverage(0, 0, -3, 1, 0, 0, 0)).toBe(0);
    const edge = crowdCoverage(0, 0, -2.8, 2, 0, 0, 0);
    expect(edge).toBeGreaterThan(0); expect(edge).toBeLessThan(1);
  });
  it('stays finite at the camera plane and when there is no followed fighter', () => {
    for (const z of [-.001, 0, .001, 10]) for (const tall of [.5, 2, 4]) {
      const coverage = crowdCoverage(.1, -.2, z, tall, 0, 0, 0);
      expect(Number.isFinite(coverage)).toBe(true); expect(coverage).toBeGreaterThanOrEqual(0); expect(coverage).toBeLessThanOrEqual(1);
    }
  });
});
