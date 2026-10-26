import { describe, expect, it } from 'vitest';
import { ITEM, ITEMS } from '../src/game/economy/catalog';
import { PACE, PER_MATCH, REGULAR_DAY, ROAD, UNLOCKS } from '../src/game/economy/unlocks';
import { dayOfLevel, dayOfSumi, play, PLAYERS } from './pace';

const regular = play(90, PLAYERS.regular).days, casual = play(140, PLAYERS.casual).days;

describe('the pace of the shop and the road', () => {
  it('gives a regular player the road\'s first fighter within days, and a casual one within the week', () => {
    const first = ROAD.find(step => step.id.startsWith('fighter-'))!;
    expect(dayOfLevel(regular, first.level)).toBeLessThanOrEqual(PACE.firstFighter);
    expect(dayOfLevel(casual, first.level)).toBeLessThanOrEqual(7);
  });

  it('never leaves a regular player more than a few days from the road\'s next reward, to its end', () => {
    let last = 0;
    for (const step of ROAD) {
      const day = dayOfLevel(regular, step.level);
      expect(day - last, `level ${step.level}: ${step.id}`).toBeLessThanOrEqual(PACE.roadGap);
      last = day;
    }
    expect(last).toBeLessThan(90);
  });

  it('buys any fighter with a few days of a regular player\'s Sumi, not weeks', () => {
    const fighters = ITEMS.filter(item => item.kind === 'fighter' && item.stage === 'live');
    expect(fighters.length).toBe(20);
    for (const item of fighters) expect(dayOfSumi(regular, item.price!), item.id).toBeLessThanOrEqual(PACE.fighterDays);
    const all = fighters.filter(item => item.level === undefined).reduce((sum, item) => sum + item.price!, 0);
    expect(dayOfSumi(regular, all)).toBeLessThanOrEqual(70);
  });

  it('says "about N matches" from what a regular player\'s match really brings', () => {
    const month = regular[29], matches = 30 * REGULAR_DAY;
    expect(Math.abs(month.earned / matches - PER_MATCH.sumi) / PER_MATCH.sumi).toBeLessThan(1 / 6 + .02);
    expect(Math.abs(month.xp / matches - PER_MATCH.xp) / PER_MATCH.xp).toBeLessThan(1 / 6 + .02);
  });

  it('keeps every number in the one table, and every price a round one', () => {
    for (const [id, how] of Object.entries(UNLOCKS)) {
      if (how.price !== undefined) expect(how.price % 100, id).toBe(0);
      if (how.level !== undefined) expect(ITEM.get(id)?.level, id).toBe(how.level);
    }
  });
});
