import { describe, expect, it } from 'vitest';
import { lookHintAllowed, QUIET_MS, sweepDetected, SWEEP_EVENTS, SWEEP_MS, SWEEP_SHARE, type LookState } from './LookHint';

const ok: LookState = { fighting: true, sinceActive: QUIET_MS + 1, input: 'keyboard', touch: false, alive: true, pointerFree: true, captured: false, shown: false };

describe('the look hint: only when truly needed', () => {
  it('may show in an active match, after the quiet start, on a keyboard with the pointer free', () => {
    expect(lookHintAllowed(ok)).toBe(true);
  });
  it('never at the start, on touch or a pad, while down, with the pointer held or a menu up', () => {
    expect(lookHintAllowed({ ...ok, sinceActive: QUIET_MS - 1 })).toBe(false);
    expect(lookHintAllowed({ ...ok, fighting: false })).toBe(false);
    expect(lookHintAllowed({ ...ok, touch: true })).toBe(false);
    expect(lookHintAllowed({ ...ok, input: 'controller' })).toBe(false);
    expect(lookHintAllowed({ ...ok, alive: false })).toBe(false);
    expect(lookHintAllowed({ ...ok, pointerFree: false })).toBe(false);
  });
  it('at most once a session, and never again on a device that has held the pointer', () => {
    expect(lookHintAllowed({ ...ok, shown: true })).toBe(false);
    expect(lookHintAllowed({ ...ok, captured: true })).toBe(false);
  });
  it('reads a look as a sustained sideways sweep over the arena, not a nudge', () => {
    const width = 1600, now = 10_000;
    const step = Math.ceil(SWEEP_SHARE * width / SWEEP_EVENTS) + 5;
    const sweep = Array.from({ length: SWEEP_EVENTS }, (_, i) => [now - i * 40, step] as const).reverse();
    expect(sweepDetected(sweep, now, width)).toBe(true);
    expect(sweepDetected(sweep.slice(0, SWEEP_EVENTS - 1).map(([t]) => [t, 400] as const), now, width)).toBe(false);
    expect(sweepDetected(sweep.map(([t]) => [t, 3] as const), now, width)).toBe(false);
    expect(sweepDetected(sweep, now + SWEEP_MS + 1000, width)).toBe(false);
  });
});
