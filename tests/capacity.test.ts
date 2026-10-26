import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client, FixedTimestepCallback, Room as ColyseusRoom } from 'colyseus';
import { ARENAS_FULL_MESSAGE, isArenasFull } from '../src/game/arenasFull';
import { ROSTER_PROTOCOL } from '../src/game/rosterProtocol';
import { ArenasFullError, Capacity, LoadGauge, capacity, capacityFromEnv } from '../src/server/capacity';
import { ArenaRoom, BotArenaRoom, DuelRoom, FINISHED_ROOM_CLOSE, FINISHED_ROOM_SECONDS, PrivateArenaRoom } from '../src/server/ArenaRoom';
import { ObjectiveRoom } from '../src/server/objectives/ObjectiveRoom';
import { SurvivalRoom } from '../src/server/SurvivalRoom';
import { RESYNC_MS } from '../src/server/ResyncGate';
import { PrivateCodes, privateCodes } from '../src/server/privateCodes';
import { NetStats } from '../src/server/netStats';
import { closeMessage, joinFailure, Network, type NetworkAccess } from '../src/network';

const quiet = () => vi.fn();
const room = () => ({}) as object;

describe('the environment', () => {
  it('is off with nothing set: no cap, no shedding, nothing said', () => {
    const warn = quiet();
    expect(capacityFromEnv({}, warn)).toEqual({ roomCap: 0, shed: false, lagMs: 200, behindSeconds: 10, clearSeconds: 5 });
    expect(capacityFromEnv({ ROOM_CAP: '', LOAD_SHED: '' }, warn)).toMatchObject({ roomCap: 0, shed: false });
    expect(warn).not.toHaveBeenCalled();
  });
  it('reads ROOM_CAP, LOAD_SHED and the shedding knobs', () => {
    const warn = quiet();
    expect(capacityFromEnv({ ROOM_CAP: '40', LOAD_SHED: '1', LOAD_SHED_LAG_MS: '350', LOAD_SHED_SECONDS: '20', LOAD_SHED_CLEAR_SECONDS: '8' }, warn)).toEqual({ roomCap: 40, shed: true, lagMs: 350, behindSeconds: 20, clearSeconds: 8 });
    for (const on of ['1', 'true', 'TRUE', 'on', 'yes']) expect(capacityFromEnv({ LOAD_SHED: on }, warn).shed).toBe(true);
    for (const off of ['0', 'false', 'off', 'no']) expect(capacityFromEnv({ LOAD_SHED: off }, warn).shed).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });
  it('turns nonsense off, and says so in the log', () => {
    const warn = quiet();
    for (const bad of ['abc', '0', '-3', '2.5', 'NaN']) expect(capacityFromEnv({ ROOM_CAP: bad }, warn).roomCap).toBe(0);
    expect(warn).toHaveBeenCalledTimes(5);
    expect(warn.mock.calls[0][0]).toContain('ROOM_CAP="abc"');
    expect(capacityFromEnv({ LOAD_SHED: 'maybe' }, warn).shed).toBe(false);
    expect(warn.mock.calls.at(-1)![0]).toContain('LOAD_SHED="maybe"');
    expect(capacityFromEnv({ ROOM_CAP: '12', LOAD_SHED_SECONDS: 'x' }, quiet())).toMatchObject({ roomCap: 12, behindSeconds: 10 });
  });
});

describe('ROOM_CAP', () => {
  it('with nothing set admits any number of rooms and adds nothing to the [net] line', () => {
    const valve = new Capacity({}, quiet());
    for (let i = 0; i < 500; i++) expect(() => valve.admit(room())).not.toThrow();
    expect(valve.rooms).toBe(500);
    expect(valve.armed).toBe(false);
    expect(valve.report()).toBe('');
  });
  it('refuses the room over the cap, in the words the page shows, and takes it again when one has ended', () => {
    const log = quiet(), valve = new Capacity({ roomCap: 2 }, log);
    const a = room(), b = room(), c = room();
    valve.admit(a); valve.admit(b);
    expect(() => valve.admit(c)).toThrow(ArenasFullError);
    try { valve.admit(c); } catch (error) { expect((error as Error).message).toBe(ARENAS_FULL_MESSAGE); expect(isArenasFull(error)).toBe(true); expect((error as ArenasFullError).why).toBe('cap'); }
    expect(valve.rooms).toBe(2);
    valve.release(a);
    expect(() => valve.admit(c)).not.toThrow();
    expect(valve.rooms).toBe(2);
    expect(valve.refusedCap).toBe(2);
  });
  it('counts a room once however often it is admitted or released', () => {
    const valve = new Capacity({ roomCap: 1 }, quiet()), a = room();
    valve.admit(a); valve.admit(a);
    expect(valve.rooms).toBe(1);
    valve.release(a); valve.release(a);
    expect(valve.rooms).toBe(0);
    expect(() => valve.admit(room())).not.toThrow();
  });
  it('logs a refusal at most once every ten seconds, and the minute line carries the count', () => {
    let now = 0;
    const log = quiet(), valve = new Capacity({ roomCap: 1 }, log, () => now);
    valve.admit(room());
    for (let i = 0; i < 20; i++) { now = i * 400; expect(() => valve.admit(room())).toThrow(); }
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain('ROOM_CAP 1 reached');
    now = 10_500; expect(() => valve.admit(room())).toThrow();
    expect(log).toHaveBeenCalledTimes(2);
    const line = valve.report();
    expect(line).toContain('cap 1/1');
    expect(line).toContain('refused 21 (cap 21, load 0)');
    expect(valve.report()).toContain('refused 0');
  });
  it('prints its state in the [net] line only when armed, and leaves the line exactly as it was when not', () => {
    const stats = new NetStats();
    stats.census = () => ({ rooms: 2, players: 5 });
    stats.onTick(1);
    const plain = stats.line(60)!;
    stats.onTick(1);
    stats.extra = () => new Capacity({}, quiet()).report();
    expect(stats.line(60)).toMatch(/^\[net\] 60 s · 2 rooms 5 players/);
    stats.census = () => ({ rooms: 0, players: 0 });
    expect(stats.line(60)).toBeUndefined();
    stats.census = () => ({ rooms: 2, players: 5 });
    const valve = new Capacity({ roomCap: 9 }, quiet());
    valve.admit(room());
    stats.extra = () => valve.report();
    stats.onTick(1);
    expect(stats.line(60)!.endsWith(' · valve cap 1/9, shed off, refused 0')).toBe(true);
    expect(plain.includes('valve')).toBe(false);
  });
});

describe('load shedding', () => {
  it('trips after ten behind seconds in a row, and not before', () => {
    const gauge = new LoadGauge();
    for (let i = 0; i < 9; i++) { expect(gauge.sample(3, 0)).toBe(false); expect(gauge.shedding).toBe(false); }
    expect(gauge.sample(3, 0)).toBe(true);
    expect(gauge.shedding).toBe(true);
  });
  it('counts a second as behind for written-off steps or a stall over the threshold, and for nothing else', () => {
    const gauge = new LoadGauge(200, 3, 2);
    gauge.sample(0, 200); gauge.sample(0, 199); gauge.sample(0, 0);
    expect(gauge.shedding).toBe(false);
    gauge.sample(0, 201); gauge.sample(1, 0); gauge.sample(0, 5000);
    expect(gauge.shedding).toBe(true);
  });
  it('a calm second in between starts the count again; it lets go after five calm seconds in a row', () => {
    const gauge = new LoadGauge();
    for (let i = 0; i < 9; i++) gauge.sample(1, 0);
    gauge.sample(0, 0);
    for (let i = 0; i < 9; i++) gauge.sample(1, 0);
    expect(gauge.shedding).toBe(false);
    gauge.sample(1, 0);
    expect(gauge.shedding).toBe(true);
    for (let i = 0; i < 4; i++) gauge.sample(0, 0);
    expect(gauge.shedding).toBe(true);
    gauge.sample(1, 0);
    for (let i = 0; i < 4; i++) gauge.sample(0, 0);
    expect(gauge.shedding).toBe(true);
    expect(gauge.sample(0, 0)).toBe(true);
    expect(gauge.shedding).toBe(false);
  });
  it('refuses NEW rooms while shedding, leaves the running ones alone, and says so in the log', () => {
    const log = quiet(), valve = new Capacity({ shed: true }, log);
    const running = [room(), room(), room()];
    running.forEach(r => valve.admit(r));
    let written = 0;
    for (let s = 0; s < 10; s++) valve.tickSecond(written += 5, 0);
    expect(valve.shedding).toBe(true);
    expect(log.mock.calls.some(call => String(call[0]).includes('LOAD SHEDDING ON'))).toBe(true);
    let thrown: unknown;
    try { valve.admit(room()); } catch (error) { thrown = error; }
    expect(thrown).toBeInstanceOf(ArenasFullError);
    expect((thrown as ArenasFullError).why).toBe('load');
    expect((thrown as Error).message).toBe(ARENAS_FULL_MESSAGE);
    expect(valve.rooms).toBe(3);
    running.forEach(r => expect(() => valve.admit(r)).not.toThrow());
    expect(valve.report()).toContain('SHEDDING');
    for (let s = 0; s < 5; s++) valve.tickSecond(written, 0);
    expect(valve.shedding).toBe(false);
    expect(log.mock.calls.some(call => String(call[0]).includes('load shedding off'))).toBe(true);
    expect(() => valve.admit(room())).not.toThrow();
  });
  it('reads the step clock as a running count: only what was written off since the last second counts', () => {
    const valve = new Capacity({ shed: true, behindSeconds: 3, clearSeconds: 1 }, quiet());
    valve.tickSecond(100, 0);
    valve.tickSecond(100, 0);
    valve.tickSecond(100, 0); valve.tickSecond(100, 0); valve.tickSecond(100, 0);
    expect(valve.shedding).toBe(false);
  });
  it('is not armed by LOAD_SHED alone being unset: no shedding however slow the second', () => {
    const valve = new Capacity({}, quiet());
    for (let s = 0; s < 60; s++) valve.tickSecond(s * 100, 900);
    expect(valve.shedding).toBe(false);
    expect(() => valve.admit(room())).not.toThrow();
    expect(valve.report()).toBe('');
  });
  it('both together: the cap answers first', () => {
    const valve = new Capacity({ roomCap: 1, shed: true }, quiet());
    valve.admit(room());
    for (let s = 0; s < 10; s++) valve.tickSecond(s + 1, 0);
    expect(valve.why()).toBe('cap');
  });
});

describe('a real room asks the valve first', () => {
  const client = (sessionId: string) => ({ sessionId, send: vi.fn() } as unknown as Client);
  async function create(Room: typeof PrivateArenaRoom | typeof BotArenaRoom, options: Record<string, unknown>) {
    const made = new Room();
    vi.spyOn(made, 'setPrivate').mockResolvedValue(undefined); vi.spyOn(made, 'setMetadata').mockResolvedValue(undefined);
    vi.spyOn(made, 'broadcast').mockImplementation(() => {}); vi.spyOn(made, 'lock').mockResolvedValue(undefined);
    vi.spyOn(made, 'setFixedTimestep').mockImplementation((_callback: FixedTimestepCallback) => {});
    await made.onCreate({ rosterProtocol: ROSTER_PROTOCOL, mode: 'match', ...options });
    return made;
  }
  const token = (n: number) => `01234567-89ab-cdef-0123-45678900000${n}`;
  const saved = { roomCap: capacity.roomCap };
  beforeEach(() => { capacity.roomCap = 2; });
  afterEach(() => { capacity.roomCap = saved.roomCap; vi.restoreAllMocks(); });

  it('turns the room over the cap away before it builds anything, and takes one again when a room is disposed', async () => {
    const first = await create(BotArenaRoom, { players: 4 });
    const second = await create(PrivateArenaRoom, { creationToken: token(1) });
    const codesBefore = privateCodes.has(second.snapshot().lobby!.code!);
    const refused = new PrivateArenaRoom();
    await expect(refused.onCreate({ rosterProtocol: ROSTER_PROTOCOL, mode: 'match', creationToken: token(2) })).rejects.toThrow(ARENAS_FULL_MESSAGE);
    expect(refused.simulation).toBeUndefined();
    expect(refused['code' as keyof typeof refused]).toBeUndefined();
    expect(codesBefore).toBe(true);
    expect(capacity.rooms).toBeGreaterThanOrEqual(2);
    const guest = client('guest');
    second.clients.push(client('host'), guest);
    expect(() => second.onJoin(guest, { rosterProtocol: ROSTER_PROTOCOL, code: second.snapshot().lobby!.code! })).not.toThrow();
    first.onDispose();
    const third = await create(BotArenaRoom, { players: 4 });
    expect(third.simulation).toBeDefined();
    third.onDispose(); second.onDispose();
  });
  it('a bad create (no token) is refused for its own reason and does not use up a place', async () => {
    const before = capacity.rooms;
    await expect(new PrivateArenaRoom().onCreate({ rosterProtocol: ROSTER_PROTOCOL, mode: 'match' })).rejects.toThrow('Create a private room');
    expect(capacity.rooms).toBe(before);
  });
  it('with the cap off a room is admitted however many are open', async () => {
    capacity.roomCap = 0;
    const made: Awaited<ReturnType<typeof create>>[] = [];
    for (let i = 0; i < 4; i++) made.push(await create(BotArenaRoom, { players: 4 }));
    expect(made.every(each => each.simulation)).toBe(true);
    made.forEach(each => each.onDispose());
    void PrivateCodes;
  });
});

describe('the page', () => {
  it('shows the refusal as it is, whatever wraps it', () => {
    expect(joinFailure(new Error(ARENAS_FULL_MESSAGE))).toBe(ARENAS_FULL_MESSAGE);
    expect(joinFailure({ message: ARENAS_FULL_MESSAGE, code: 4210 })).toBe(ARENAS_FULL_MESSAGE);
    expect(joinFailure({ message: `ServerError: ${ARENAS_FULL_MESSAGE}`, code: 503 })).toBe(ARENAS_FULL_MESSAGE);
    expect(joinFailure(new Error(ARENAS_FULL_MESSAGE), false)).toBe(ARENAS_FULL_MESSAGE);
    expect(ARENAS_FULL_MESSAGE).toBe('The arenas are full right now. Training, Arcade and Bot Duel run on your device, or try again in a minute.');
  });
  it('leaves every other message to the old rules', () => {
    expect(joinFailure(Object.assign(new Error('Bad Gateway'), { code: 502 }), true)).toBe('The servers are restarting. Try again in a minute.');
    expect(joinFailure(new Error('This Duel is full.'))).toBeUndefined();
    expect(isArenasFull(new Error('The arenas are busy'))).toBe(false);
    expect(isArenasFull(undefined)).toBe(false);
  });
});

const sdk = vi.hoisted(() => ({ join: vi.fn(), create: vi.fn(), joinById: vi.fn(), consume: vi.fn() }));
vi.mock('@colyseus/sdk', () => ({ Client: class { joinOrCreate = sdk.join; create = sdk.create; joinById = sdk.joinById; consumeSeatReservation = sdk.consume; } }));
vi.mock('../src/ui/shop/account', () => ({ account: { open: vi.fn().mockResolvedValue(undefined), secret: () => undefined } }));
const accesses: NetworkAccess[] = [
  { kind: 'public' }, { kind: 'bots', players: 12 }, { kind: 'create-private' }, { kind: 'join-private', code: '123456' },
  { kind: 'duel', access: 'online' }, { kind: 'duel', access: 'host' }, { kind: 'duel', access: 'join', code: '123456' },
  { kind: 'coop-create' }, { kind: 'coop-join', code: '', quick: true }, { kind: 'coop-join', code: '123456' },
  ...(['quick', 'host', 'join'] as const).map(access => ({ kind: 'rift-war' as const, access, code: '123456' })),
  ...(['bad-blood', 'last-stand'] as const).flatMap(objective => (['quick', 'host', 'join', 'bots'] as const).map(access => ({ kind: 'objective' as const, objective, access, code: '123456' }))),
];
describe('the page, through every way into a room', () => {
  beforeEach(() => { vi.stubGlobal('location', { protocol: 'http:', hostname: 'localhost' }); vi.stubGlobal('fetch', vi.fn()); for (const fn of Object.values(sdk)) fn.mockReset(); });
  afterEach(() => { vi.unstubAllGlobals(); });
  it.each(accesses)('keeps the refusal through $kind $access $objective error wrapping', async access => {
    for (const fn of Object.values(sdk)) fn.mockRejectedValue(new Error(ARENAS_FULL_MESSAGE));
    vi.mocked(fetch).mockResolvedValue({ ok: false, json: async () => ({ error: ARENAS_FULL_MESSAGE }) } as Response);
    await expect(new Network('http://match.test').connect('goku', 'match', 'Crowd', access)).rejects.toThrow(ARENAS_FULL_MESSAGE);
  });
});

async function driven<T extends ArenaRoom | ObjectiveRoom | SurvivalRoom>(made: T, options: Record<string, unknown>) {
  const handlers = new Map<string, (c: Client, payload?: unknown) => void>(), base = made as unknown as ColyseusRoom;
  let step!: FixedTimestepCallback, frame = 0, now = made.clock.currentTime;
  (made.clock as unknown as { now: () => number }).now = () => now;
  vi.spyOn(base, 'onMessage').mockImplementation(((type: string, fn: (c: Client, payload?: unknown) => void) => { handlers.set(type, fn); return () => {}; }) as never);
  vi.spyOn(base, 'setPrivate').mockResolvedValue(undefined); vi.spyOn(base, 'setMetadata').mockResolvedValue(undefined);
  vi.spyOn(base, 'broadcast').mockImplementation(() => {}); vi.spyOn(base, 'lock').mockResolvedValue(undefined); vi.spyOn(base, 'unlock').mockResolvedValue(undefined);
  vi.spyOn(base, 'setFixedTimestep').mockImplementation((callback: FixedTimestepCallback) => { step = callback; });
  const disconnect = vi.spyOn(base, 'disconnect').mockResolvedValue(undefined as never);
  await (made as unknown as { onCreate(options: unknown): Promise<void> }).onCreate({ rosterProtocol: ROSTER_PROTOCOL, ...options });
  const join = (id: string, extra: Record<string, unknown> = {}) => {
    const c = { sessionId: id, send: vi.fn(), sendBytes: vi.fn(), leave: vi.fn() } as unknown as Client;
    made.clients.push(c); made.onJoin(c, { rosterProtocol: ROSTER_PROTOCOL, fighter: 'goku', name: id, ...extra } as never); return c;
  };
  const leave = (c: Client) => { made.clients.splice(made.clients.indexOf(c), 1); made.onLeave(c); };
  const answers = (c: Client) => vi.mocked(c.send).mock.calls.filter(call => call[0] === 'input-resync').length + vi.mocked(c.sendBytes).mock.calls.filter(call => call[0] === 'resync').length;
  return { room: made, join, leave, answers, disconnect,
    send: (c: Client, type: string, payload?: unknown) => handlers.get(type)!(c, payload),
    wind: (ms: number) => { now += ms; made.clock.tick(); },
    advance: (seconds = 1 / 60) => { for (let i = 0; i < Math.round(seconds * 60); i++) step({ dt: 1 / 60, dtMs: 1000 / 60, tick: ++frame, subSteps: 1, subDt: 1 / 60, subDtMs: 1000 / 60 }); } };
}

describe('resync-input: at most one whole snapshot a client each half second (19 October 2026)', () => {
  afterEach(() => { vi.restoreAllMocks(); });
  const rooms = [
    ['a match room', () => driven(new BotArenaRoom(), { mode: 'match', players: 4 }), {}],
    ['a team room', () => driven(new ObjectiveRoom(), { objective: 'last-stand', access: 'quick' }), { objective: 'last-stand' }],
    ['a co-op room', () => driven(new SurvivalRoom(), { quick: true }), {}],
  ] as const;
  it.each(rooms)('%s answers a burst once, the request inside the window when it ends, and nobody who has left', async (_name, make, joining) => {
    const f = await make();
    try {
      expect(RESYNC_MS).toBe(500);
      const me = f.join('me', joining);
      for (let i = 0; i < 50; i++) f.send(me, 'resync-input');
      expect(f.answers(me)).toBe(1);
      f.wind(499); expect(f.answers(me)).toBe(1);
      f.wind(2); expect(f.answers(me)).toBe(2);
      f.wind(1000); expect(f.answers(me)).toBe(2);
      f.send(me, 'resync-input'); expect(f.answers(me)).toBe(3);
      f.send(me, 'resync-input'); f.leave(me);
      f.wind(1000); expect(f.answers(me)).toBe(3);
    } finally { f.room.onDispose(); }
  });
  it('a page that reconnects is answered at once, whatever it asked before its drop', async () => {
    const f = await driven(new BotArenaRoom(), { mode: 'match', players: 4 });
    try {
      const me = f.join('me');
      f.send(me, 'resync-input'); f.send(me, 'resync-input');
      expect(f.answers(me)).toBe(1);
      f.room.onReconnect(me);
      f.send(me, 'resync-input'); expect(f.answers(me)).toBe(2);
      f.wind(1000); expect(f.answers(me)).toBe(2);
    } finally { f.room.onDispose(); }
  });
});

describe('a match room ends five minutes after its match does (19 October 2026)', () => {
  afterEach(() => { vi.restoreAllMocks(); });
  const ko = (room: ArenaRoom, id: string, by: string) => room.simulation.damage(id, 1e9, by, 'test knockout');

  it('closes a bot royale whose player stays on its results, with the code the page keeps its card for - and not before', async () => {
    const f = await driven(new BotArenaRoom(), { mode: 'match', players: 4 });
    try {
      const me = f.join('me'), sim = f.room.simulation;
      f.advance(6); expect(sim.status).toBe('active');
      sim.serverTime += 400; f.advance();
      for (const p of sim.playerStates()) if (p.isBot) ko(f.room, p.id, 'me');
      f.advance(); expect(sim.status).toBe('finished');
      sim.serverTime += FINISHED_ROOM_SECONDS - 1; f.advance();
      expect(f.disconnect).not.toHaveBeenCalled();
      const sent = vi.mocked(me.send).mock.calls.length;
      f.advance(1); expect(vi.mocked(me.send).mock.calls.length).toBeGreaterThan(sent);
      expect(f.disconnect).toHaveBeenCalledTimes(1); expect(f.disconnect).toHaveBeenCalledWith(FINISHED_ROOM_CLOSE);
      expect(FINISHED_ROOM_CLOSE).toBe(4006); expect(FINISHED_ROOM_SECONDS).toBe(300);
      f.advance(2); expect(f.disconnect).toHaveBeenCalledTimes(1);
    } finally { f.room.onDispose(); }
  });

  async function decided(winner: 'a' | 'b') {
    const f = await driven(new DuelRoom(), { mode: 'match' });
    const a = f.join('a', { fighter: 'jotaro' }), b = f.join('b', { fighter: 'dio' }), sim = f.room.simulation, loser = winner === 'a' ? 'b' : 'a';
    f.advance(8); expect(sim.status).toBe('active');
    ko(f.room, loser, winner); f.advance(); expect(f.room.snapshot().duel!.phase).toBe('interval');
    f.advance(2.9); f.advance(1); expect(sim.status).toBe('active');
    ko(f.room, loser, winner); f.advance(); expect(f.room.snapshot().duel!.phase).toBe('complete');
    return { f, a, b, sim, set: () => f.room.snapshot().duel! };
  }
  it('a Duel: counts from the set\'s end, not a round\'s; one RUN IT BACK asked starts the wait again, asking twice does not', async () => {
    const { f, a, sim, set } = await decided('a');
    try {
      sim.serverTime += 200; f.advance();
      f.send(a, 'duel-runback'); expect(set().runback).toEqual(['a']);
      sim.serverTime += 250; f.advance();
      expect(f.disconnect).not.toHaveBeenCalled();
      f.send(a, 'duel-runback'); sim.serverTime += 49; f.advance();
      expect(f.disconnect).not.toHaveBeenCalled();
      f.advance(1);
      expect(f.disconnect).toHaveBeenCalledWith(FINISHED_ROOM_CLOSE);
    } finally { f.room.onDispose(); }
  });
  it('a Duel: a runback played in the room stops the wait until its own set ends', async () => {
    const { f, a, b, sim, set } = await decided('a');
    try {
      sim.serverTime += 250; f.advance();
      f.send(a, 'duel-runback'); f.send(b, 'duel-runback'); f.advance(); expect(set()).toMatchObject({ set: 2, phase: 'interval' });
      f.advance(3); expect(sim.status).toBe('active');
      sim.serverTime += 120; f.advance();
      expect(f.disconnect).not.toHaveBeenCalled();
      ko(f.room, 'a', 'b'); f.advance(); f.advance(3.5); ko(f.room, 'a', 'b'); f.advance();
      expect(set()).toMatchObject({ set: 2, phase: 'complete' });
      sim.serverTime += FINISHED_ROOM_SECONDS - 1; f.advance();
      expect(f.disconnect).not.toHaveBeenCalled();
      f.advance(1); expect(f.disconnect).toHaveBeenCalledWith(FINISHED_ROOM_CLOSE);
    } finally { f.room.onDispose(); }
  });

  it('never ends a room whose match has not: a private room\'s lobby, or training', async () => {
    const lobby = await driven(new PrivateArenaRoom(), { mode: 'match', creationToken: '01234567-89ab-cdef-0123-456789abcdef' });
    const training = await driven(new ArenaRoom(), { mode: 'training' });
    try {
      lobby.join('host', { creationToken: '01234567-89ab-cdef-0123-456789abcdef' }); training.join('me');
      lobby.advance(1); training.advance(1);
      lobby.room.simulation.serverTime += 600; training.room.simulation.serverTime += 600;
      lobby.advance(1); training.advance(1);
      expect(training.disconnect).not.toHaveBeenCalled();
      expect(lobby.disconnect).not.toHaveBeenCalledWith(FINISHED_ROOM_CLOSE);
    } finally { lobby.room.onDispose(); training.room.onDispose(); }
  });
});

describe('the page, when a finished match\'s room closes on its results', () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  it('is told why with the code (4006), which no other close uses, in words for a page that never showed its results', async () => {
    vi.stubGlobal('location', { protocol: 'http:', hostname: 'localhost' });
    const hooks: Record<string, (...args: unknown[]) => void> = {};
    const fake = { sessionId: 'me', reconnection: { minUptime: 5000, enabled: true }, connection: { isOpen: true }, onMessage: () => {}, send: vi.fn(), leave: vi.fn(),
      onDrop: (h: () => void) => { hooks.drop = h; }, onReconnect: (h: () => void) => { hooks.reconnect = h; }, onLeave: (h: (code: number) => void) => { hooks.leave = h as never; }, onError: (h: () => void) => { hooks.error = h; } };
    sdk.join.mockReset(); sdk.join.mockResolvedValueOnce(fake);
    const network = new Network('http://match.test'), told = vi.fn();
    network.onDisconnect = told;
    await network.connect('goku', 'match', 'Fighter');
    hooks.leave(FINISHED_ROOM_CLOSE);
    expect(told).toHaveBeenCalledWith('Your match ended while you were away. Press PLAY for another.', 4006);
    expect(network.room).toBeNull();
    for (const code of [4001, 4002, 4003, 4004, 4008]) expect(closeMessage(code)).not.toBe(closeMessage(4006));
    clearInterval((network as unknown as { pingTimer: ReturnType<typeof setInterval> }).pingTimer);
  });
});
