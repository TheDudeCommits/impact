import { describe, expect, it } from 'vitest';
import { FIGHTERS } from '../src/config';
import type { FighterId } from '../src/game/types';

describe('move cards', () => {
  it.each(Object.keys(FIGHTERS) as FighterId[])('%s names every card after its move', id => {
    const labels = FIGHTERS[id].shortMoves;
    expect(labels, `${id} has card labels`).toHaveLength(4);
    for (const label of labels!) {
      expect(label.trim().length).toBeGreaterThan(0);
      expect(label, 'printed in capitals like the rest of the HUD').toBe(label.toUpperCase());
      expect(['LIGHT', 'HEAVY', 'SPECIAL', 'ULTIMATE']).not.toContain(label);
    }
  });

  it('gives Luffy his moves', () => {
    expect(FIGHTERS.luffy.shortMoves).toEqual(['PISTOL', 'BAZOOKA', 'HAWK GATLING', 'BAJRANG GUN']);
  });
});
