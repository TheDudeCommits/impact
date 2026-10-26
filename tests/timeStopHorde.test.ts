import { afterEach, describe, expect, it } from 'vitest';
import { ArenaSimulation, type ExternalTargets } from '../src/game/simulation';
import { MOVES } from '../src/game/moves';

const sims: ArenaSimulation[] = [];
afterEach(() => { for (const s of sims.splice(0)) s.dispose(); });

describe("Gojo's Domain, closed on nobody", () => {
  it('lets a fighter walk in, plays its barrage through and never asks the horde for nobody', () => {
    const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false }); sims.push(sim);
    const asked: unknown[] = [];
    const horde: ExternalTargets = {
      query: () => 0, receive: () => null, freeze: () => {},
      locate: id => { asked.push(id); if (typeof id !== 'string') throw new TypeError(`locate(${String(id)})`); return undefined; },
    };
    sim.external = horde;
    sim.addPlayer('g', 'gojo', 'G', false, { x: 0, y: 0, z: 0 });
    sim.addPlayer('b', 'naruto', 'B', true, { x: 0, y: 0, z: 30 });
    const actors = (sim as unknown as { actors: Map<string, { state: { ultimate: number; team?: string }; cast: { tour?: { order?: string[]; visited?: number } } | null }> }).actors;
    const g = actors.get('g')!;
    g.state.team = 'hero'; actors.get('b')!.state.team = 'rift';
    g.state.ultimate = 100;
    sim.submitInput('g', { seq: 1, moveX: 0, moveZ: 0, yaw: 0, attack: 'ultimate' });
    const move = MOVES.gojo.ultimate, stop = move.timeStop!;
    let walkedIn = false, longest = 0;
    for (let i = 0; i < 60 * (move.duration + 1); i++) {
      sim.submitInput('g', { seq: 2 + i, moveX: 0, moveZ: 0, yaw: 0 });
      sim.step();
      const tour = g.cast?.tour;
      if (tour?.order && !walkedIn) { expect(tour.order).toEqual([]); expect(tour.visited).toBe(0); sim.place('b', { x: 0, y: 0, z: 2 }); walkedIn = true; }
      longest = Math.max(longest, tour?.order?.length ?? 0);
    }
    expect(walkedIn).toBe(true);
    expect(longest, 'the Domain took in the fighter who walked in').toBe(1);
    expect(asked.filter(id => typeof id !== 'string')).toEqual([]);
    expect(stop.radius).toBeGreaterThan(2);
  });
});
