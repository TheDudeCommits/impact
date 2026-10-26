import { describe, expect, it } from 'vitest';
import { frameSteps, WORLD_MAX_STEP } from '../src/render/frameClock';

describe('what a render frame hands each consumer', () => {
  it('clamps the world and not the camera or the correction', () => {
    const long = frameSteps(.2);
    expect(long.world).toBe(WORLD_MAX_STEP);
    expect(long.camera).toBe(.2);
    expect(long.correction).toBe(.2);
    const short = frameSteps(1 / 60);
    expect(short.world).toBeCloseTo(1 / 60, 9);
    expect(short.camera).toBeCloseTo(1 / 60, 9);
  });
  it('treats a frame with no usable time as no time at all', () => {
    for (const bad of [NaN, -1, Infinity]) {
      const steps = frameSteps(bad);
      expect(steps.world).toBe(0); expect(steps.camera).toBe(0); expect(steps.correction).toBe(0);
    }
  });
});
