import { ROSTER_PROTOCOL } from '../src/game/rosterProtocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Client, FixedTimestepCallback } from 'colyseus';
import { ArenaSimulation } from '../src/game/simulation';
import { BotArenaRoom, draftBots } from '../src/server/ArenaRoom';
import { MOVES } from '../src/game/moves';
import type { FighterId } from '../src/game/types';

const roster = Object.keys(MOVES) as FighterId[];
const client = (sessionId: string) => ({ sessionId, send: vi.fn() } as unknown as Client);
afterEach(() => vi.restoreAllMocks());

async function royale(players: number) {
  const room = new BotArenaRoom();
  let tick!: FixedTimestepCallback, frame = 0;
  vi.spyOn(room, 'setPrivate').mockResolvedValue(undefined);
  vi.spyOn(room, 'setMetadata').mockResolvedValue(undefined);
  vi.spyOn(room, 'broadcast').mockImplementation(() => {});
  vi.spyOn(room, 'lock').mockResolvedValue(undefined);
  vi.spyOn(room, 'setFixedTimestep').mockImplementation(callback => { tick = callback; });
  await room.onCreate({rosterProtocol:ROSTER_PROTOCOL, players });
  const advance = (n = 1) => { for (let i = 0; i < n; i++) tick({ dt: 1 / 60, dtMs: 1000 / 60, tick: ++frame, subSteps: 1, subDt: 1 / 60, subDtMs: 1000 / 60 }); };
  const join = (id: string, fighter: FighterId) => { const c = client(id); room.clients.push(c); room.onJoin(c, {rosterProtocol:ROSTER_PROTOCOL, fighter, name: 'Owner' }); return c; };
  return { room, advance, join };
}

describe('the sparring partner is drawn against the human', () => {
  it('is never the human\'s own fighter, and not the same fighter every session', () => {
    const seen = new Set<FighterId>();
    for (let seed = 1; seed <= 40; seed++) {
      const sim = new ArenaSimulation({ roomMode: 'training', seed });
      sim.addPlayer('me', 'naruto', 'Me');
      const bot = sim.getPlayer('sparring-bot')!;
      expect(bot.isBot).toBe(true);
      expect(bot.name).toBe('Sparring bot');
      expect(bot.fighter, `seed ${seed} drew a mirror match`).not.toBe('naruto');
      expect(sim.getPlayer('me')!.target, 'the human still locks onto the bot by default').toBe('sparring-bot');
      seen.add(bot.fighter);
      sim.dispose();
    }
    expect(seen.size, `forty sessions only ever drew ${[...seen].join(', ')}`).toBeGreaterThan(3);
  });

  it('is drawn against whatever the first human picked', () => {
    for (const pick of roster) for (let seed = 1; seed <= 6; seed++) {
      const sim = new ArenaSimulation({ roomMode: 'training', seed });
      sim.addPlayer('me', pick, 'Me');
      expect(sim.getPlayer('sparring-bot')!.fighter, `${pick} with seed ${seed}`).not.toBe(pick);
      sim.dispose();
    }
  });

  it('draws unseeded rooms from the clock rather than from one fixed seed', () => {
    const seen = new Set<FighterId>();
    for (let i = 0; i < 30; i++) {
      const sim = new ArenaSimulation({ roomMode: 'training' });
      sim.addPlayer('me', 'goku', 'Me');
      seen.add(sim.getPlayer('sparring-bot')!.fighter);
      sim.dispose();
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('still replays identically under one seed', () => {
    const run = () => {
      const sim = new ArenaSimulation({ roomMode: 'training', seed: 9 });
      sim.addPlayer('me', 'zoro', 'Me');
      for (let i = 0; i < 120; i++) sim.step();
      const out = sim.snapshot();
      sim.dispose();
      return out;
    };
    expect(run()).toEqual(run());
  });
});

describe('the bot draft is shuffled', () => {
  it('deals every other fighter before repeating one, in an order that changes per room', () => {
    const openers = new Set<FighterId>();
    for (let seed = 1; seed <= 40; seed++) {
      const sim = new ArenaSimulation({ roomMode: 'match', seed });
      const draft = draftBots(['zoro'], 11, items => sim.shuffle(items));
      expect(draft).toHaveLength(11);
      expect(draft, 'never a mirror of the human').not.toContain('zoro');
      expect(new Set(draft.slice(0, 9)).size, 'nine distinct fighters before any repeat').toBe(9);
      openers.add(draft[0]);
      sim.dispose();
    }
    expect(openers.size, `the first rival was only ever ${[...openers].join(', ')}`).toBeGreaterThan(3);
  });

  it('skips every human\'s pick when there are several', () => {
    const sim = new ArenaSimulation({ roomMode: 'match', seed: 3 });
    const draft = draftBots(['goku', 'naruto', 'luffy'], 7, items => sim.shuffle(items));
    for (const taken of ['goku', 'naruto', 'luffy']) expect(draft).not.toContain(taken);
    expect(new Set(draft).size).toBe(7);
    sim.dispose();
  });

  it('varies the seat-one rival across forty solo royales', async () => {
    const rivals = new Set<FighterId>();
    for (let i = 0; i < 40; i++) {
      const { room, join } = await royale(4);
      try {
        join('owner', 'goku');
        const players = room.simulation.snapshot().players;
        const bots = players.filter(p => p.isBot);
        expect(bots).toHaveLength(3);
        expect(bots.map(p => p.fighter)).not.toContain('goku');
        expect(new Set(bots.map(p => p.fighter)).size, 'three different fighters').toBe(3);
        rivals.add(players.find(p => p.id === 'bot-1')!.fighter);
      } finally { room.onDispose(); }
    }
    expect(rivals.size, `the first rival was only ever ${[...rivals].join(', ')}`).toBeGreaterThan(3);
  });
});

describe('spawn seats are drawn per match', () => {
  it('does not always seat the first entrant in the same sector with the same rival opposite', () => {
    const seats = new Set<string>(), opposite = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const sim = new ArenaSimulation({ roomMode: 'match', seed });
      sim.addPlayer('a', 'goku'); sim.addPlayer('b', 'naruto'); sim.addPlayer('c', 'zoro'); sim.addPlayer('d', 'luffy');
      expect(sim.startMatch()).toBe(true);
      const players = sim.snapshot().players;
      const a = players.find(p => p.id === 'a')!;
      seats.add(`${a.x.toFixed(0)},${a.z.toFixed(0)}`);
      const far = players.filter(p => p.id !== 'a').sort((p, q) => Math.hypot(q.x - a.x, q.z - a.z) - Math.hypot(p.x - a.x, p.z - a.z))[0];
      opposite.add(far.id);
      for (const p of players) {
        expect(Math.abs(p.x)).toBeLessThanOrEqual(sim.bounds.halfX);
        expect(Math.abs(p.z)).toBeLessThanOrEqual(sim.bounds.halfZ);
        for (const q of players) if (p.id !== q.id) expect(Math.hypot(p.x - q.x, p.z - q.z)).toBeGreaterThan(2);
      }
      sim.dispose();
    }
    expect(seats.size, 'the first entrant stood in the same place every match').toBeGreaterThan(3);
    expect(opposite.size, 'and always faced the same rival').toBeGreaterThan(1);
  });

  it('spreads a small field round the ring rather than bunching it in the first sectors', () => {
    const sim = new ArenaSimulation({ roomMode: 'match', seed: 2 });
    sim.addPlayer('a', 'goku'); sim.addPlayer('b', 'naruto');
    sim.startMatch();
    const [a, b] = sim.snapshot().players;
    const bearing = Math.abs(Math.atan2(a.x, a.z) - Math.atan2(b.x, b.z));
    expect(Math.min(bearing, Math.PI * 2 - bearing), 'a duel starts across the ring').toBeCloseTo(Math.PI, 1);
    sim.dispose();
  });
});
