import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../simulation';
import { DuelSet } from './DuelSet';

describe('Duel sets', () => {
  it('supports a deciding third round, a draw replay and unanimous online runback', () => {
    const sim = new ArenaSimulation({ roomMode: 'match' }), set = new DuelSet();
    try {
      sim.addPlayer('a', 'naruto', 'A'); sim.addPlayer('b', 'goku', 'B'); sim.startMatch(); set.step(sim);
      const end = (winner: string | null) => { sim.status = 'finished'; sim.winnerId = winner; set.step(sim); };
      const next = () => { sim.serverTime += 3.1; set.step(sim); };
      end('a'); expect(set.snapshot(sim.snapshot()).status).toBe('waiting'); next();
      end('b'); expect(set.view.scores).toEqual({ a: 1, b: 1 }); next();
      end(null); expect(set.view.phase).toBe('interval'); expect(set.view.scores).toEqual({ a: 1, b: 1 }); next();
      end('a'); expect(set.view.phase).toBe('complete'); expect(set.view.winner).toBe('a');
      expect(set.request(sim, 'stranger')).toBe(false); expect(set.request(sim, 'a')).toBe(false);
      expect(set.view.phase).toBe('complete'); expect(set.request(sim, 'b')).toBe(true);
      expect(set.view.set).toBe(2); expect(set.view.scores).toEqual({}); next(); expect(sim.status).toBe('active');
    } finally { sim.dispose(); }
  });
  it('ends the set immediately when a rival forfeits, including between rounds', () => {
    const sim = new ArenaSimulation({ roomMode: 'match' }), set = new DuelSet();
    try {
      sim.addPlayer('a', 'naruto', 'A'); sim.addPlayer('b', 'goku', 'B'); sim.startMatch(); set.step(sim);
      sim.status = 'finished'; sim.winnerId = 'b'; set.step(sim);
      sim.removePlayer('b'); set.forfeit(sim, 'a');
      expect(set.view.phase).toBe('complete'); expect(set.view.winner).toBe('a'); expect(sim.winnerId).toBe('a');
      expect(set.request(sim, 'a')).toBe(false);
    } finally { sim.dispose(); }
  });
});
