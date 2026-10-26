import { expect, it } from 'vitest';
import { SurvivalGame, PLAYER_ID } from '../src/survival/SurvivalGame';

it('retires a transformed boss form without erasing the active form or final fight result', () => {
  const game = new SurvivalGame({ fighter: 'goku', seed: 5, round: 13, spawn: ['kaido'], bossHp: .01, god: true, slowMotion: false });
  try {
    const internal = game as unknown as {
      bossBorn: Map<string, number>; ultimates: Map<string, unknown[]>; teamReady: Map<string, number>;
      holds: Map<string, number>;
    };
    const hero = game.heroes.get(PLAYER_ID)!;
    let seq = 0;
    const tick = () => game.phase === 'draft' ? game.choose() : game.tick({ seq: ++seq, moveX: 0, moveZ: 0, yaw: 0 });
    for (let i = 0; i < 480 && !game.view().bosses.length; i++) tick();
    const first = game.view().bosses[0]; expect(first.enemy).toBe('kaido');
    expect(internal.bossBorn.has(first.id)).toBe(true); expect(hero.takenAt.has(first.id)).toBe(true);
    game.sim.damage(first.id, first.hp + 10, PLAYER_ID, 'Test');
    for (let i = 0; i < 300; i++) tick();
    const second = game.view().bosses.find(b => b.enemy === 'kaido-hybrid')!;
    expect(second).toBeDefined(); expect(game.sim.actors.has(first.id)).toBe(false);
    expect(internal.bossBorn.has(first.id)).toBe(false); expect(hero.takenAt.has(first.id)).toBe(false);
    expect(internal.bossBorn.has(second.id)).toBe(true); expect(hero.takenAt.has(second.id)).toBe(true);
    game.sim.damage(second.id, 1e7, PLAYER_ID, 'Test');
    for (let i = 0; i < 60 * 12; i++) tick();
    expect(game.sim.actors.has(second.id)).toBe(false); expect(internal.bossBorn.has(second.id)).toBe(false);
    expect(hero.takenAt.has(second.id)).toBe(false);
    expect(internal.ultimates.has(second.id)).toBe(false); expect(internal.teamReady.has(second.id)).toBe(false);
    expect(internal.holds.has(second.id)).toBe(false);
  } finally { game.dispose(); }
});
