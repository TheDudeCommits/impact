import { describe, expect, it } from 'vitest';
import { SurvivalGame, PLAYER_ID } from '../src/survival/SurvivalGame';
import { PATHS, PATH_INFO, PATH_RULES, TIMED_PATHS } from '../src/survival/paths';

const idle = (() => { let seq = 0; return () => ({ seq: ++seq, moveX: 0, moveZ: 0, yaw: 0 }); })();
const call = <T,>(game: SurvivalGame, name: string, ...args: unknown[]) => (game as unknown as Record<string, (...a: unknown[]) => T>)[name](...args);
const set = (game: SurvivalGame, key: string, value: unknown) => { (game as unknown as Record<string, unknown>)[key] = value; };

function through(path: 'ward' | 'night') {
  const game = new SurvivalGame({ fighter: 'goku', seed: 40009, god: true, slowMotion: false });
  for (let t = 0; t < 60 * 8 && game.roundState !== 'horde'; t++) game.tick(idle());
  set(game, 'pathNext', path);
  call(game, 'startRound');
  return game;
}

describe('round types at the portal', () => {
  it('offers the ward and the long night among the doors, each saying what it is', () => {
    expect(PATHS).toContain('ward');
    expect(PATHS).toContain('night');
    for (const kind of TIMED_PATHS) expect(PATH_INFO[kind].line.length).toBeGreaterThan(10);
  });

  it('fills a ward round\'s bar only while a fighter stands in the ward, and pays a chest when it is held', () => {
    const game = through('ward');
    let view = game.view();
    expect(view.path).toBe('ward');
    const ward = view.ward!;
    expect(ward.radius).toBe(PATH_RULES.wardRadius);
    game.sim.place(PLAYER_ID, { x: ward.x + 20, y: 0, z: ward.z }, 0);
    for (let t = 0; t < 60 * 3; t++) game.tick(idle());
    expect(game.view().dungeon?.progress ?? 0).toBe(0);
    game.sim.place(PLAYER_ID, { x: ward.x, y: 0, z: ward.z }, 0);
    for (let t = 0; t < 60 * 10; t++) game.tick(idle());
    view = game.view();
    expect(view.ward?.held).toBe(true);
    const progress = view.dungeon?.progress ?? 0;
    expect(progress).toBeGreaterThan(9 / PATH_RULES.wardSeconds - .05);
    expect(progress).toBeLessThan(11.5 / PATH_RULES.wardSeconds);
    for (let t = 0; t < 60 * (PATH_RULES.wardSeconds - 9) && game.roundState === 'horde'; t++) { game.sim.place(PLAYER_ID, { x: ward.x, y: 0, z: ward.z }, 0); game.tick(idle()); }
    expect(game.roundState).not.toBe('horde');
    const orbs = (game as unknown as { orbs: { kind: string }[] }).orbs;
    expect(orbs.some(orb => orb.kind === 'chest') || game.view().feed.some(item => item.kind === 'chest')).toBe(true);
    expect(game.view().ward).toBeUndefined();
    game.dispose();
  }, 120000);

  it('fills a long night\'s bar by the clock, whatever is killed', () => {
    const game = through('night');
    for (let t = 0; t < 60 * 15; t++) game.tick(idle());
    const progress = game.view().dungeon?.progress ?? 0;
    expect(progress).toBeGreaterThan(14 / PATH_RULES.nightSeconds);
    expect(progress).toBeLessThan(16 / PATH_RULES.nightSeconds);
    for (let t = 0; t < 60 * (PATH_RULES.nightSeconds - 14) && game.roundState === 'horde'; t++) game.tick(idle());
    expect(game.roundState).not.toBe('horde');
    game.dispose();
  }, 120000);
});
