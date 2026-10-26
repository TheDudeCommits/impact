import { describe, expect, it } from 'vitest';
import type { PlayerState } from '../../game/types';
import { standingNames } from '../MatchResults';

const p = (name: string, fighter: string, isBot: boolean) => ({ name, fighter, isBot }) as unknown as PlayerState;

describe('the full standings (overnight UX, 8 October 2026)', () => {
  it("names a bot on this device by its fighter, never by its id in lower case", () => {
    expect(standingNames(p('golden frieza', 'golden-frieza', true))).toEqual(['Golden Frieza', 'BOT']);
    expect(standingNames(p('gon', 'gon', true))).toEqual(['Gon Freecss', 'BOT']);
    expect(standingNames(p('sukuna', 'sukuna', true))[1]).toBe('BOT');
  });
  it("keeps a room bot's own name and a player's", () => {
    expect(standingNames(p('Rival', 'madara', true))).toEqual(['Rival', 'Madara Uchiha · BOT']);
    expect(standingNames(p('Kirin', 'naruto', false))).toEqual(['Kirin', 'Naruto']);
  });
  it('a player who kept the default name reads as their fighter, never FIGHTER', () => {
    expect(standingNames(p('Fighter', 'naruto', false))).toEqual(['Naruto', 'PLAYER']);
    expect(standingNames(p('', 'goku', false))).toEqual(['Goku', 'PLAYER']);
  });
});
