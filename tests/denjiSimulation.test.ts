import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import type { FighterId } from '../src/game/types';

function encounter(distance: number, pressUltimate: boolean) {
  const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, seed: 7 });
  try {
    sim.addPlayer('a', 'denji' as FighterId, 'Denji', false, { x: 0, y: 0, z: 0 });
    sim.addPlayer('b', 'goku', 'Dummy', false, { x: 0, y: 0, z: distance });
    const player = sim.actors.get('a')!.state;
    player.ultimate = 100;
    const hits: { damage: number; contact: number; time: number }[] = [];
    let confirmed = false;
    for (let tick = 0; tick < 300; tick++) {
      sim.submitInput('a', { seq: tick + 1, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b',
        attack: pressUltimate && tick === 0 ? 'ultimate' : undefined });
      sim.step(1 / 60);
      for (const event of sim.drainEvents()) {
        if (event.actorId !== 'a') continue;
        if (event.kind === 'confirm') confirmed = true;
        if (event.kind === 'hit' && event.targetId === 'b')
          hits.push({ damage: event.damage ?? 0, contact: event.contactIndex ?? 0, time: tick / 60 });
      }
    }
    return { hits, confirmed, action: player.action };
  } finally {
    sim.dispose();
  }
}

describe('Denji manual ultimate in the real arena simulation', () => {
  it('lands four authored contacts and the intended 290 damage after combo scaling', () => {
    const result = encounter(2, true);
    expect(result.confirmed).toBe(true);
    expect(result.hits.map(h => h.contact)).toEqual([0, 1, 2, 3]);
    expect(result.hits.map(h => h.damage)).toEqual([38, 31, 28, 193]);
    expect(result.hits.reduce((sum, h) => sum + h.damage, 0)).toBe(290);
    expect(result.action).toBe('idle');
  });
  it('never starts its saw sequence without a press or after a missed opener', () => {
    expect(encounter(2, false).hits).toEqual([]);
    const miss = encounter(20, true);
    expect(miss.confirmed).toBe(false);
    expect(miss.hits).toEqual([]);
    expect(miss.action).toBe('idle');
  });
});
