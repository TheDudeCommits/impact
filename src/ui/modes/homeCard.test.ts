import { describe, expect, it } from 'vitest';
import { HOME_RAIL } from '../MangaHome';
import { MODE_OF_HOME } from './catalogue';

describe("the home rail's cards (overnight UX, 8 October 2026)", () => {
  it('no card pins a way to play: PLAY opens each mode on the way used last (a first visit: its first way)', () => {
    for (const card of HOME_RAIL) expect(MODE_OF_HOME[card].variant).toBeUndefined();
  });
  it('the legacy ids invites and parties still use keep their ways', () => {
    expect(MODE_OF_HOME.players).toEqual({ mode: 'royale', variant: 'online' });
    expect(MODE_OF_HOME.private).toEqual({ mode: 'royale', variant: 'friends' });
  });
});
