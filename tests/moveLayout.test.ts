import { afterEach, describe, expect, it } from 'vitest';
import { FIGHTERS, MOVE_LAYOUT_OPTIONS, loadSettings } from '../src/config';
import type { FighterId } from '../src/game/types';
import { moveFor } from '../src/game/awakening';
import { areaCardName, areaMoveCard, cardLines } from '../src/ui/hud/cardNames';

describe('the move layout (the owner, 11 October 2026)', () => {
  afterEach(() => { delete (globalThis as { localStorage?: Storage }).localStorage; });
  const saved = (value: object) => {
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: () => JSON.stringify(value) };
  };

  it('keep the row by default and offer the Pocket Pad in Settings', () => {
    expect(loadSettings().moveLayout).toBe('row');
    expect(MOVE_LAYOUT_OPTIONS.map(([value]) => value)).toEqual(['row', 'pad']);
    saved({ moveLayout: 'pad' });
    expect(loadSettings().moveLayout).toBe('pad');
    saved({ moveLayout: 'diamond' });
    expect(loadSettings().moveLayout).toBe('row');
  });

  it('name every card in two lines at most, so no name runs into the next', () => {
    const long: string[] = [];
    for (const id of Object.keys(FIGHTERS) as FighterId[]) {
      const names = [...(FIGHTERS[id].shortMoves ?? []), areaMoveCard(moveFor(id, 'area', false)), areaMoveCard(moveFor(id, 'area', true))];
      for (const name of names) if (cardLines(name) > 2) long.push(`${id}: ${name}`);
    }
    expect(long).toEqual([]);
  });

  it('call the longest area moves by their short name', () => {
    expect(areaCardName('Big Ball Rasengan Barrage')).toBe('BIG BALL RASENGAN');
    expect(areaCardName('Godspeed: Speed of Lightning')).toBe('SPEED OF LIGHTNING');
    expect(areaCardName('Star Platinum: Ground Smash')).toBe('STAR PLATINUM: GROUND SMASH');
    expect(areaCardName('Dragon Fist Explosion')).toBe('DRAGON FIST EXPLOSION');
  });
});
