import { describe, expect, it } from 'vitest';
import { catchUp, INPUT_HZ, MAX_CATCH_UP, STALL_SECONDS } from '../src/game/catchUp';

const TICK = 1 / INPUT_HZ;

function keptUp(fps: number) {
  const elapsed = 1 / fps;
  let backlog = 0, ticks = 0;
  for (let i = 0; i < fps; i++) { const due = catchUp(backlog, elapsed); backlog = due.backlog; ticks += due.steps; }
  return ticks / INPUT_HZ;
}

describe('the local copy keeps up with real time', () => {
  it.each([60, 30, 20, 10, 5])('runs every tick at %i frames a second', fps => {
    const ratio = keptUp(fps);
    expect(ratio, `${fps} fps ran ${(ratio * 100).toFixed(0)}% of real time`).toBeGreaterThan(.98);
  });

  it('does not replay a tab that was away', () => {
    const due = catchUp(0, 60);
    expect(due.steps, 'a minute away replayed as input').toBe(1);
    expect(due.backlog).toBeLessThan(TICK);
  });

  it('never runs away with the main thread', () => {
    for (const elapsed of [0, .001, TICK, .1, STALL_SECONDS - .001, STALL_SECONDS + .001, 5])
      expect(catchUp(0, elapsed).steps).toBeLessThanOrEqual(MAX_CATCH_UP);
  });

  it('carries the remainder rather than dropping it', () => {
    let backlog = 0, ticks = 0;
    for (let i = 0; i < 90; i++) { const due = catchUp(backlog, 1 / 90); backlog = due.backlog; ticks += due.steps; }
    expect(ticks, `90 Hz ran ${ticks} ticks in a second`).toBe(INPUT_HZ);
  });
});
