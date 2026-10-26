import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import type { CombatEvent, FighterId } from '../src/game/types';

function spar(botFighter: FighterId, skill: number, seed: number, jab: boolean, slot: 'light' | 'heavy' = 'light') {
  const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, seed });
  sim.addPlayer('me', 'zoro', 'Me', false, { x: 0, y: 0, z: 0 });
  sim.addPlayer('bot', botFighter, 'Bot', true, { x: 0, y: 0, z: 3 });
  sim.actors.get('bot')!.botSkill = skill;
  const events: CombatEvent[] = [];
  let seq = 0;
  for (let i = 0; i < 60 * 30; i++) {
    const me = sim.getPlayer('me')!, bot = sim.getPlayer('bot')!;
    sim.submitInput('me', { seq: seq++, moveX: 0, moveZ: 0, yaw: Math.atan2(bot.x - me.x, bot.z - me.z), targetId: 'bot',
      attack: jab && i % 54 === 0 ? slot : undefined });
    sim.step(); events.push(...sim.snapshot(true).events);
  }
  sim.dispose();
  return events.filter(e => e.actorId === 'bot');
}

describe('bots fight with the rush', () => {
  const fighters: FighterId[] = ['goku', 'sasuke', 'luffy', 'ace'];

  it('carry a landed string on through its stages, and sometimes finish it heavier', () => {
    let finishes = 0;
    for (const fighter of fighters) {
      const casts = spar(fighter, .5, 8, true).filter(e => e.kind === 'cast');
      expect(casts.filter(e => (e.chain ?? 0) >= 1).length, `${fighter} continues its strings`).toBeGreaterThan(3);
      for (let i = 1; i < casts.length; i++) {
        const before = casts[i - 1], after = casts[i];
        if ((after.slot === 'heavy' || after.slot === 'special') && before.slot === 'light' && (before.chain ?? 0) >= 1
          && after.serverTime - before.serverTime < .6) finishes++;
      }
    }
    expect(finishes, 'out of a string into something heavier').toBeGreaterThan(0);
  });

  it('parry into a vanish, far more often the more skilled they are', { timeout: 60_000 }, () => {
    let raw = 0, skilled = 0;
    for (const fighter of fighters) for (const seed of [3, 8, 13]) {
      raw += spar(fighter, 0, seed, true, 'heavy').filter(e => e.kind === 'vanish').length;
      skilled += spar(fighter, 1, seed, true, 'heavy').filter(e => e.kind === 'vanish').length;
    }
    expect(skilled, 'a skilled bot vanishes').toBeGreaterThan(0);
    expect(skilled, `${skilled} vanishes skilled against ${raw} raw`).toBeGreaterThan(raw * 2);
  });

  it('chase their own launches', () => {
    let chases = 0;
    for (const fighter of fighters) for (const seed of [3, 8]) chases += spar(fighter, 1, seed, false).filter(e => e.kind === 'chase').length;
    expect(chases).toBeGreaterThan(0);
  });
});
