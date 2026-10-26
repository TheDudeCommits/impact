import { describe, expect, it } from 'vitest';
import { SurvivalGame, PLAYER_ID } from '../src/survival/SurvivalGame';
import { drawPaths, PATHS, type PathKind } from '../src/survival/paths';

function random(seed: number) {
  let n = seed;
  return () => { n = Math.imul(n, 1664525) + 1013904223 | 0; return (n >>> 0) / 4294967296; };
}

describe('Arcade forks present distinct reasons to keep playing', () => {
  it('offers recovery/supplies, a challenge and a new objective at every seeded fork', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      const paths = drawPaths(7, true, undefined, 'hurt', random(seed));
      expect(paths).toHaveLength(3); expect(new Set(paths).size).toBe(3);
      expect(paths.some(kind => kind === 'treasure' || kind === 'spring')).toBe(true);
      expect(paths.some(kind => kind === 'trial' || kind === 'cursed')).toBe(true);
      expect(paths.some(kind => kind === 'ward' || kind === 'night')).toBe(true);
      expect(drawPaths(7, true, undefined, 'hurt', random(seed))).toEqual(paths);
      seen.add(paths.join(','));
    }
    expect(seen.size).toBeGreaterThan(15);
  });
  it('always gives a healthy party useful supplies even after taking the treasure route', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const choices = drawPaths(7, true, 'treasure', 'healthy', random(seed));
      expect(choices).toContain('treasure'); expect(choices).not.toContain('spring');
    }
  });
  it('reads actual party health when opening portals', () => {
    const game = new SurvivalGame({ fighter: 'goku', seed: 5, round: 3, slowMotion: false });
    try {
      const internal = game as unknown as { offerForks(): void };
      const state = game.sim.actors.get(PLAYER_ID)!.state;
      state.hp = state.maxHp; internal.offerForks();
      expect(game.view().forks?.map(f => f.kind)).not.toContain('spring');
      state.hp = state.maxHp * .4; internal.offerForks();
      expect(game.view().forks?.map(f => f.kind)).toContain('spring');
    } finally { game.dispose(); }
  });
  it('respects the first-round curse gate and depth rules while helping a wounded party', () => {
    for (let seed = 1; seed <= 50; seed++) {
      expect(drawPaths(1, true, undefined, 'hurt', random(seed))).not.toContain('cursed');
      expect(drawPaths(9, false, undefined, 'critical', random(seed))).not.toContain('spring');
      expect(drawPaths(9, true, 'spring', 'critical', random(seed))).toContain('spring');
    }
  });
  it('avoids the previous chosen path when its category has another valid door', () => {
    for (const previous of PATHS) for (let seed = 1; seed <= 30; seed++) {
      expect(drawPaths(5, true, previous as PathKind, 'hurt', random(seed))).not.toContain(previous);
    }
  });
});
