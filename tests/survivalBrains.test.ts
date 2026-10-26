import { describe, expect, it } from 'vitest';
import { EnemyBrain, TokenPool, type BrainWorld } from '../src/survival/brains';
import { ENEMIES } from '../src/survival/enemies';
import type { PlayerState } from '../src/game/types';

const body = (over: Partial<PlayerState>): PlayerState => ({
  id: 'x', name: 'x', fighter: 'goku', x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000, stamina: 100, ultimate: 0, action: 'idle', actionStarted: 0, actionDuration: 0,
  actionTime: 0, target: null, alive: true, isBot: false, grounded: true, guarding: false, kills: 0, damageDealt: 0, damageTaken: 0,
  cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 }, ...over,
} as PlayerState);
function world(now: number, target: PlayerState, rank = 4, seed = .01): BrainWorld {
  const sim = { setMove: () => {}, addMeter: () => {} } as unknown as BrainWorld['sim'];
  return { sim, now, target, tokens: new TokenPool({ melee: 7, shots: 4, brutes: 3 }), random: () => seed, crowd: [], wave: rank * 2 + 2, rank };
}
const boss = () => new EnemyBrain('b', ENEMIES.akainu, 0, () => .5);

describe('a boss that fights', () => {
  it('steps out of a blow thrown at it from close, and owes an answer', () => {
    const brain = boss();
    const self = body({ id: 'b', x: 0, z: 0, yaw: 0 });
    const fighter = body({ id: 'p', x: 0, z: 2.5, yaw: Math.PI, action: 'heavy', actionStarted: 9.95, actionDuration: .9 });
    const command = brain.think(self, world(10, fighter, 0));
    expect(command.dash).toBe(true);
    expect(command.moveZ).toBeLessThan(0);
    const furious = boss().think(self, world(10, fighter, 5));
    expect(furious.dash).toBe(true);
    expect(furious.moveZ).toBeGreaterThan(0);
  });

  it('punishes a fighter committed to a long move, with its quickest blow in reach', () => {
    const brain = boss();
    const self = body({ id: 'b', x: 0, z: 0 });
    const fighter = body({ id: 'p', x: 0, z: 2, yaw: 0, action: 'special', actionStarted: 9.4, actionDuration: 1.5 });
    const command = brain.think(self, world(10, fighter));
    expect(command.attack).toBe('light');
  });

  it('dashes in on a fighter who keeps away, rather than walking', () => {
    const brain = boss();
    const self = body({ id: 'b', x: 0, z: 0 });
    const fighter = body({ id: 'p', x: 0, z: 9, yaw: 0 });
    const command = brain.think(self, world(10, fighter));
    expect(command.dash).toBe(true);
    expect(command.moveZ).toBeGreaterThan(.9);
  });

  it('fights at every rank: a rank F boss still strings and punishes', () => {
    const brain = boss();
    const self = body({ id: 'b', x: 0, z: 0 });
    const fighter = body({ id: 'p', x: 0, z: 2, yaw: 0, action: 'ultimate', actionStarted: 9.2, actionDuration: 2 });
    expect(brain.think(self, world(10, fighter, 0)).attack).toBeDefined();
  });
});
