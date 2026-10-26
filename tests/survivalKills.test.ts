import { describe, expect, it } from 'vitest';
import { SurvivalGame, PLAYER_ID } from '../src/survival/SurvivalGame';
import { GF } from '../src/survival/horde/Horde';

const idle = (() => { let seq = 0; return () => ({ seq: ++seq, moveX: 0, moveZ: 0, yaw: 0 }); })();
const call = (game: SurvivalGame, name: string, ...args: unknown[]) => (game as unknown as Record<string, (...a: unknown[]) => unknown>)[name](...args);
type HordeInside = { capacity: number; isAlive(i: number): boolean; flags: Uint16Array; x: Float32Array; z: Float32Array };

describe('the kills the party wears effects for', () => {
  it('logs a kill by the killer\'s seat, marks an elite, and keeps it half a second', () => {
    const game = new SurvivalGame({ heroes: [{ id: PLAYER_ID, fighter: 'goku', name: 'You' }, { id: 'friend', fighter: 'zoro', name: 'Friend' }], seed: 7, god: true, slowMotion: false, quiet: true });
    for (let t = 0; t < 60 * 4; t++) game.tick(idle());
    const h = game.horde as unknown as HordeInside;
    const slots = [0, 1, 2].map(i => call(game, 'spawnGrunt', 0, { x: 4 + i * 2, y: 0, z: -3 }, i === 2) as number);
    expect(slots.every(slot => h.isAlive(slot))).toBe(true);
    expect(h.flags[slots[2]] & GF.ELITE).toBeTruthy();
    call(game, 'gruntKilled', slots[0], PLAYER_ID);
    call(game, 'gruntKilled', slots[1], 'friend');
    call(game, 'gruntKilled', slots[2], 'friend');
    call(game, 'gruntKilled', slots[0], undefined);
    const view = game.view(PLAYER_ID), slain = view.slain!;
    expect(slain).toHaveLength(12);
    expect([slain[1], slain[5], slain[9]]).toEqual([0, 1, 1 + 8]);
    expect(slain[2]).toBe(Math.round(h.x[slots[0]] * 10)); expect(slain[3]).toBe(Math.round(h.z[slots[0]] * 10));
    expect(slain[4]).toBeGreaterThan(slain[0]); expect(slain[8]).toBeGreaterThan(slain[4]);
    const friend = view.party.find(member => member.id === 'friend')!;
    expect(friend.seat).toBe(1); expect(friend.kills).toBe(2);
    expect(view.party.find(member => member.id === PLAYER_ID)!.kills).toBe(1);
    for (let t = 0; t < 45; t++) game.tick(idle());
    expect(game.view(PLAYER_ID).slain?.some((_, i, all) => i % 4 === 0 && all[i] <= slain[8]) ?? false).toBe(false);
    game.dispose();
  }, 60000);
});
