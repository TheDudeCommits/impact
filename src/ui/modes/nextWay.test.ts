import { describe, expect, it } from 'vitest';
import { nextWay } from './ModeSheet';

describe('choosing the way to play with ← → or the D-pad (overnight UX, 8 October 2026)', () => {
  const all = ['offline', 'online', 'friends'] as const;
  it('steps through the mode\'s ways in order and wraps', () => {
    expect(nextWay(all, 'offline', 1)).toBe('online');
    expect(nextWay(all, 'friends', 1)).toBe('offline');
    expect(nextWay(all, 'offline', -1)).toBe('friends');
    expect(nextWay(all, 'online', -1)).toBe('offline');
  });
  it('stays put in a mode with one way (Training)', () => {
    expect(nextWay(['offline'], 'offline', 1)).toBe('offline');
    expect(nextWay(['offline'], 'offline', -1)).toBe('offline');
  });
});
