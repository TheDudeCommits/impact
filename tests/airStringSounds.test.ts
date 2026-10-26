import { describe, expect, it } from 'vitest';
import { AIR_RUSH } from '../src/game/moves';
import { AIR_BLOWS } from '../src/audio/sfxPlan';

describe('air-string sounds', () => {
  it('has a blow for every named air-string stage', () => {
    const named = Object.values(AIR_RUSH).flatMap(stages => stages!.filter((n): n is string => !!n));
    expect(named.length).toBeGreaterThan(0);
    for (const name of named) expect(AIR_BLOWS[name], name).toBeDefined();
  });
});
