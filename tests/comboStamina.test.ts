import fs from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { COMBO_STAMINA } from '../src/game/moves';
import { ArenaSimulation } from '../src/game/simulation';
import { ObjectiveMatch } from '../src/game/objectives/ObjectiveMatch';

const sims: ArenaSimulation[] = [], games: ObjectiveMatch[] = [];
afterEach(() => { for (const s of sims.splice(0)) s.dispose(); for (const g of games.splice(0)) g.sim.dispose(); });

describe('the combo-era stamina bar', () => {
  it('is half again the old 100, and half again that', () => expect(COMBO_STAMINA).toBe(225));

  it('fills a room that asks for it, at spawn and as it refills', () => {
    const royale = new ArenaSimulation({ roomMode: 'match', maxStamina: COMBO_STAMINA }); sims.push(royale);
    royale.addPlayer('a', 'naruto', 'A'); royale.addPlayer('b', 'goku', 'B', true);
    expect(royale.getPlayer('a')!.maxStamina).toBe(225); expect(royale.getPlayer('b')!.stamina).toBe(225);
    const training = new ArenaSimulation({ roomMode: 'training', maxStamina: COMBO_STAMINA }); sims.push(training);
    training.addPlayer('t', 'naruto', 'T');
    const t = (training as unknown as { actors: Map<string, { state: { stamina: number } }> }).actors.get('t')!.state;
    expect(t.stamina).toBe(225);
    t.stamina = 40;
    for (let i = 0; i < 60 * 16; i++) training.step();
    expect(t.stamina).toBe(225);
  });

  it('leaves every other room at 100', () => {
    const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false }); sims.push(sim);
    sim.addPlayer('a', 'naruto', 'A');
    expect(sim.getPlayer('a')!.maxStamina).toBe(100); expect(sim.getPlayer('a')!.stamina).toBe(100);
    const stand = new ObjectiveMatch('last-stand'); games.push(stand);
    stand.add('d0', 'naruto', 'D');
    expect(stand.sim.getPlayer('d0')!.maxStamina).toBe(100);
  });

  it('reaches Bad Blood, with the villains\' boost on top', () => {
    const g = new ObjectiveMatch('bad-blood'); games.push(g);
    g.add('h0', 'naruto', 'H'); g.add('v0', 'dio', 'V');
    expect(g.sim.getPlayer('h0')!.maxStamina).toBe(225);
    expect(g.sim.getPlayer('v0')!.maxStamina).toBeCloseTo(292.5);
  });

  it('is passed by Duel, Training and the royale, local and on the server', () => {
    for (const file of ['src/network.ts', 'src/game/LocalRoyale.ts', 'src/game/duel/LocalDuel.ts'])
      expect(fs.readFileSync(file, 'utf8'), file).toMatch(/maxStamina: ?COMBO_STAMINA/);
    expect(fs.readFileSync('src/server/ArenaRoom.ts', 'utf8').match(/maxStamina: COMBO_STAMINA/g)?.length).toBe(2);
  });
});
