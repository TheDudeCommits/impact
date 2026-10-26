import { describe, expect, it } from 'vitest';
import { COMBO_KEYS } from '../src/game/combos';
import { ArenaSimulation } from '../src/game/simulation';
import type { CombatEvent, FighterId } from '../src/game/types';

function fight(a: FighterId, b: FighterId, seed: number, seconds = 40) {
  const sim = new ArenaSimulation({ roomMode: 'match', trainingBot: false, seed });
  sim.addPlayer('a', a, 'A', true, { x: 0, y: 0, z: 0 });
  sim.addPlayer('b', b, 'B', true, { x: 0, y: 0, z: 4 });
  sim.startMatch();
  for (const id of ['a', 'b']) sim.actors.get(id)!.botSkill = .7;
  const events: CombatEvent[] = [];
  let sound = true;
  try {
    for (let t = 0; t < 60 * seconds; t++) {
      sim.step(); events.push(...sim.snapshot(true).events);
      for (const id of ['a', 'b']) { const p = sim.getPlayer(id)!; if (![p.x, p.y, p.z, p.hp].every(Number.isFinite) || p.hp < 0) sound = false; }
    }
  } finally { sim.dispose(); }
  return { events, sound };
}

describe('the main game\'s bots fight with their enders', () => {
  it('end landed strings with them, every kind of them, and keep the fight sound', { timeout: 120_000 }, () => {
    const keys = new Set<string>();
    for (const [a, b, seed] of [['luffy', 'zoro', 3], ['zoro', 'gojo', 3], ['ichigo', 'guts', 3], ['guts', 'sanji', 8], ['killua', 'vegeta', 8],
      ['law', 'goku', 8], ['dio', 'luffy', 3], ['sasuke', 'law', 6], ['vegeta', 'ichigo', 8]] as [FighterId, FighterId, number][]) {
      const { events, sound } = fight(a, b, seed);
      expect(sound, `${a} against ${b}: positions and health stay real`).toBe(true);
      const enders = events.filter(e => e.kind === 'cast' && e.actorId === 'a' && e.branch);
      expect(enders.length, `${a} against ${b} (seed ${seed}) ends a string`).toBeGreaterThan(0);
      for (const e of enders) { expect(COMBO_KEYS).toContain(e.branch); keys.add(e.branch!); }
      for (const release of events.filter(e => e.kind === 'release' && e.actorId === 'a' && e.branch === 'airSpecial'))
        expect(release.endpoint!.y, `${a}'s ground smash`).toBeLessThan(.8);
    }
    expect(keys.size, [...keys].join(', ')).toBe(COMBO_KEYS.length);
  });
});
