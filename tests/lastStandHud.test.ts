import { describe, expect, it } from 'vitest';
import { tallyStrokes } from '../src/ui/hud/lastStand/brushQuest';
import { sideOf } from '../src/ui/hud/lastStand/inkThreat';
import { star4 } from '../src/ui/hud/lastStand/levelStar';

describe('Last Stand HUD (the owner\'s picks, 11 October 2026)', () => {
  it('tallies like 正: five strokes to a character, the next character after it', () => {
    expect(tallyStrokes(0)).toEqual([]);
    expect(tallyStrokes(3)).toHaveLength(3);
    const eight = tallyStrokes(8);
    expect(eight).toHaveLength(8);
    expect(eight[5][0] - eight[0][0]).toBe(64);
    expect(eight[5][1]).toBe(eight[0][1]);
  });
  it('puts a threat on its fallback side with no camera', () => {
    expect(sideOf(-20, 1.5, 10, -1)).toBe(-1);
    expect(sideOf(20, 1.5, 10, 1)).toBe(1);
  });
  it('draws the level star as a closed four-point star', () => {
    const path = star4(0, 0, 33, 10);
    expect(path.startsWith('M')).toBe(true);
    expect(path.endsWith('Z')).toBe(true);
    expect(path.match(/Q/g)).toHaveLength(4);
  });
});
