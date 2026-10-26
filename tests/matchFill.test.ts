import { ROSTER_PROTOCOL } from '../src/game/rosterProtocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Client, FixedTimestepCallback } from 'colyseus';
import { ArenaRoom, MATCH_COUNTDOWN, PrivateArenaRoom, SOLO_COUNTDOWN } from '../src/server/ArenaRoom';
import { COMBO_HP, MAX_PLAYERS, MIN_MATCH_FIELD } from '../src/game/moves';
import type { FighterId } from '../src/game/types';
import { lockedOut } from '../src/game/economy/fighters';

const client = (sessionId: string) => ({ sessionId, send: vi.fn() } as unknown as Client);
afterEach(() => vi.restoreAllMocks());

async function publicRoom(room: ArenaRoom = new ArenaRoom(), options: Record<string, unknown> = { mode: 'match' }) {
  let tick!: FixedTimestepCallback, frame = 0;
  vi.spyOn(room, 'setPrivate').mockResolvedValue(undefined);
  vi.spyOn(room, 'setMetadata').mockResolvedValue(undefined);
  vi.spyOn(room, 'broadcast').mockImplementation(() => {});
  vi.spyOn(room, 'lock').mockResolvedValue(undefined);
  vi.spyOn(room, 'setFixedTimestep').mockImplementation(callback => { tick = callback; });
  await room.onCreate({rosterProtocol:ROSTER_PROTOCOL,...options});
  const advance = (n = 1) => { for (let i = 0; i < n; i++) tick({ dt: 1 / 60, dtMs: 1000 / 60, tick: ++frame, subSteps: 1, subDt: 1 / 60, subDtMs: 1000 / 60 }); };
  const join = (id: string, fighter: FighterId = 'goku', more: Record<string, unknown> = {}) => {
    const c = client(id); room.clients.push(c); room.onJoin(c, {rosterProtocol:ROSTER_PROTOCOL, fighter, name: id, ...more }); return c;
  };
  const untilActive = (seconds: number) => { for (let i = 0; i < seconds * 60 && room.simulation.status === 'waiting'; i++) advance(); };
  return { room, advance, join, untilActive };
}

describe('a public match fills its field with bots at kickoff', () => {
  it('starts a lone entrant after the solo countdown, with the seats made up by bots', async () => {
    const { room, advance, join, untilActive } = await publicRoom();
    try {
      const solo = join('solo', 'zoro');
      advance();
      const lobby = room.snapshot().lobby!;
      expect(lobby.startsAt, 'one human is enough to start the clock').not.toBeNull();
      expect(lobby.startsAt! - room.simulation.serverTime).toBeCloseTo(SOLO_COUNTDOWN, 1);
      advance((SOLO_COUNTDOWN - 1) * 60);
      expect(room.simulation.status).toBe('waiting');
      expect(room.simulation.snapshot().players.filter(p => p.isBot)).toHaveLength(0);
      expect(solo.send).toHaveBeenCalledWith('welcome', expect.objectContaining({ botCount: 0 }));
      untilActive(3);
      expect(room.simulation.status).toBe('active');
      const players = room.simulation.snapshot().players;
      expect(players).toHaveLength(MIN_MATCH_FIELD);
      const bots = players.filter(p => p.isBot);
      expect(bots).toHaveLength(MIN_MATCH_FIELD - 1);
      expect(room.botCount()).toBe(MIN_MATCH_FIELD - 1);
      expect(new Set(bots.map(p => p.fighter)).size, 'a field of different fighters').toBe(bots.length);
      expect(bots.map(p => p.fighter), 'and none of them a mirror of the human').not.toContain('zoro');
      expect(bots.every(p => p.name.length > 0 && p.alive && p.hp === COMBO_HP)).toBe(true);
      for (const p of players) {
        expect(Math.abs(p.x)).toBeLessThanOrEqual(room.simulation.bounds.halfX);
        expect(Math.abs(p.z)).toBeLessThanOrEqual(room.simulation.bounds.halfZ);
        for (const q of players) if (p.id !== q.id) expect(Math.hypot(p.x - q.x, p.z - q.z)).toBeGreaterThan(2);
      }
      expect(room.lock).toHaveBeenCalled();
    } finally { room.onDispose(); }
  });

  it('drops to the match countdown when a second human arrives, and fills only the remaining seats', async () => {
    const { room, advance, join, untilActive } = await publicRoom();
    try {
      join('a', 'goku');
      advance(60);
      join('b', 'naruto');
      advance();
      const remaining = room.snapshot().lobby!.startsAt! - room.simulation.serverTime;
      expect(remaining, 'two humans wait the shorter clock').toBeLessThanOrEqual(MATCH_COUNTDOWN + .02);
      expect(remaining).toBeGreaterThan(MATCH_COUNTDOWN - 1);
      untilActive(MATCH_COUNTDOWN + 1);
      expect(room.simulation.status).toBe('active');
      const players = room.simulation.snapshot().players;
      expect(players.filter(p => !p.isBot)).toHaveLength(2);
      const bots = players.filter(p => p.isBot);
      expect(bots).toHaveLength(MIN_MATCH_FIELD - 2);
      for (const taken of ['goku', 'naruto']) expect(bots.map(p => p.fighter)).not.toContain(taken);
    } finally { room.onDispose(); }
  });

  it('adds nothing when enough humans are already in', async () => {
    const { room, join, untilActive } = await publicRoom();
    try {
      for (let i = 0; i < MIN_MATCH_FIELD; i++) join(`h${i}`);
      untilActive(MATCH_COUNTDOWN + 1);
      expect(room.simulation.status).toBe('active');
      expect(room.simulation.snapshot().players.filter(p => p.isBot)).toHaveLength(0);
      expect(room.simulation.snapshot().players).toHaveLength(MIN_MATCH_FIELD);
    } finally { room.onDispose(); }
  });

  it('starts a full room at once, without bots', async () => {
    const { room, join, advance } = await publicRoom();
    try {
      for (let i = 0; i < MAX_PLAYERS; i++) join(`h${i}`);
      advance();
      expect(room.simulation.status).toBe('active');
      expect(room.simulation.snapshot().players.filter(p => p.isBot)).toHaveLength(0);
    } finally { room.onDispose(); }
  });

  it('resets the clock when the room empties, and never seats a bot for nobody', async () => {
    const { room, join, advance } = await publicRoom();
    try {
      const a = join('a');
      advance(60);
      expect(room.snapshot().lobby!.startsAt).not.toBeNull();
      room.clients.splice(room.clients.indexOf(a), 1);
      room.onLeave(a);
      advance(SOLO_COUNTDOWN * 60 + 60);
      expect(room.simulation.status).toBe('waiting');
      expect(room.snapshot().lobby!.startsAt).toBeNull();
      expect(room.simulation.snapshot().players).toHaveLength(0);
    } finally { room.onDispose(); }
  });

  it('leaves a private room to its host', async () => {
    const { room, join, advance } = await publicRoom(new PrivateArenaRoom(), { mode: 'match', creationToken: '01234567-89ab-cdef-0123-456789abcdef' });
    try {
      join('host', 'goku', { code: room.snapshot().lobby!.code });
      advance((SOLO_COUNTDOWN + 5) * 60);
      expect(room.simulation.status, 'no solo countdown in a private room').toBe('waiting');
      expect(room.snapshot().lobby!.startsAt).toBeNull();
      expect(room.simulation.snapshot().players.filter(p => p.isBot)).toHaveLength(0);
    } finally { room.onDispose(); }
  });

  it('plans its bots as the countdown starts, tells every page, and seats those at kickoff', async () => {
    const { room, advance, join, untilActive } = await publicRoom();
    try {
      const plans = () => (room.broadcast as unknown as { mock: { calls: unknown[][] } }).mock.calls.filter(c => c[0] === 'planned-bots').map(c => c[1] as FighterId[]);
      join('solo', 'zoro');
      advance();
      expect(plans()).toHaveLength(1);
      const first = plans()[0];
      expect(first).toHaveLength(MIN_MATCH_FIELD - 1);
      expect(new Set(first).size, 'different fighters').toBe(first.length);
      expect(first, 'none of them a mirror of the human').not.toContain('zoro');
      expect(room.simulation.snapshot().players.filter(p => p.isBot), 'planned, not seated').toHaveLength(0);
      advance(60);
      expect(plans(), 'drafted again only as the humans change').toHaveLength(1);
      const pick = first.find(f => !lockedOut(f, undefined))!;
      const late = join('late', pick);
      expect(late.send).toHaveBeenCalledWith('planned-bots', first);
      advance();
      expect(plans()).toHaveLength(2);
      const second = plans()[1];
      expect(second).toEqual(first.filter(f => f !== pick));
      untilActive(SOLO_COUNTDOWN + 3);
      expect(room.simulation.status).toBe('active');
      expect(room.simulation.snapshot().players.filter(p => p.isBot).map(p => p.fighter), 'the kickoff seats the plan').toEqual(second);
    } finally { room.onDispose(); }
  });

  it('tops the plan up when a human leaves before the kickoff', async () => {
    const { room, advance, join, untilActive } = await publicRoom();
    try {
      const plans = () => (room.broadcast as unknown as { mock: { calls: unknown[][] } }).mock.calls.filter(c => c[0] === 'planned-bots').map(c => c[1] as FighterId[]);
      join('a', 'zoro'); const b = join('b', 'gojo');
      advance();
      const two = plans().at(-1)!;
      expect(two).toHaveLength(MIN_MATCH_FIELD - 2);
      room.clients.splice(room.clients.indexOf(b), 1); room.onLeave(b);
      advance();
      const one = plans().at(-1)!;
      expect(one).toHaveLength(MIN_MATCH_FIELD - 1);
      expect(one.slice(0, two.length), 'keeping every bot it had').toEqual(two);
      untilActive(SOLO_COUNTDOWN + 3);
      expect(room.simulation.snapshot().players.filter(p => p.isBot).map(p => p.fighter)).toEqual(one);
    } finally { room.onDispose(); }
  });
});
