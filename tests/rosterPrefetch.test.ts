import { afterEach, describe, expect, it, vi } from 'vitest';
import { FighterLibrary } from '../src/render/Fighter';
import { RELEASED_FIGHTERS } from '../src/game/rosterAvailability';
import { rosterPrefetch, BACKGROUND_FIGHTER_LIMIT } from '../src/loading/rosterPrefetch';

afterEach(() => vi.restoreAllMocks());
describe('bounded model prefetch as the roster expands', () => {
  it('keeps every selection inside the independent 16-model budget as display pages grow', () => {
    const roster = Array.from({ length:93 }, (_, i) => `fighter-${i}`);
    expect(BACKGROUND_FIGHTER_LIMIT).toBe(16);
    for (const selected of roster) {
      const fetched = rosterPrefetch(roster, selected);
      expect(new Set(fetched).size).toBe(fetched.length);
      expect(fetched).toContain(selected);
      expect(fetched.length).toBeLessThanOrEqual(16);
    }
    expect(rosterPrefetch([], undefined)).toEqual([]);
  });
  it('loads the requested model first, then its bounded released batch at background priority', async () => {
    const library = new FighterLibrary();
    const ensure = vi.spyOn(library, 'ensure').mockResolvedValue();
    const selected = RELEASED_FIGHTERS.at(-1)!;
    const progress = () => {};
    await library.load(progress, selected);
    expect(ensure).toHaveBeenNthCalledWith(1, [selected], progress);
    expect(ensure).toHaveBeenNthCalledWith(2, rosterPrefetch(RELEASED_FIGHTERS, selected), progress, 0);
    expect(ensure).toHaveBeenCalledTimes(2);
  });
  it('never fills a laboratory selection with unrelated released fighters', async () => {
    const library = new FighterLibrary();
    const ensure = vi.spyOn(library, 'ensure').mockResolvedValue();
    expect(rosterPrefetch(RELEASED_FIGHTERS as readonly string[], 'future-lab-candidate')).toEqual([]);
    await library.load(() => {});
    expect(ensure.mock.calls[0][0]).toEqual(RELEASED_FIGHTERS.slice(0, BACKGROUND_FIGHTER_LIMIT));
    expect(ensure.mock.calls[0][2]).toBe(0);
  });
});
