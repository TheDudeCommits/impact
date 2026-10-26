import { ROSTER_PROTOCOL } from '../src/game/rosterProtocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Client, FixedTimestepCallback } from 'colyseus';
import { DuelRoom, PrivateArenaRoom, PrivateDuelRoom } from '../src/server/ArenaRoom';
import { ObjectiveRoom } from '../src/server/objectives/ObjectiveRoom';
import { SurvivalRoom } from '../src/server/SurvivalRoom';
import { PARTY_COUNTDOWN, PARTY_GRACE_SECONDS, PartyStart } from '../src/server/social/PartyStart';
import { assetSignature } from '../src/game/social/assets';
import { OBJECTIVE_PROTOCOL } from '../src/game/objectives/model';
import { decode, type CoopFrame } from '../src/survival/coopNet';
import { privatePanel } from '../src/ui/hud/privatePanel';
import { dockText } from '../src/ui/modes/WaitingDock';
import type { GameSnapshot, RoomLobby } from '../src/game/types';

const TOKEN = '01234567-89ab-cdef-0123-456789abcdef';
afterEach(() => vi.restoreAllMocks());
const statuses = (room: { broadcast: unknown }) => vi.mocked(room.broadcast as (type: string, message: { message: string }) => void).mock.calls.filter(c => c[0] === 'notice').map(c => c[1].message);

async function arena(room: PrivateArenaRoom | PrivateDuelRoom | DuelRoom, options: Record<string, unknown>) {
  let step!: FixedTimestepCallback; const handlers = new Map<string, (c: Client, p?: unknown) => void>();
  vi.spyOn(room, 'setPrivate').mockResolvedValue(undefined); vi.spyOn(room, 'setMetadata').mockResolvedValue(undefined); vi.spyOn(room, 'broadcast').mockImplementation(() => {});
  vi.spyOn(room, 'lock').mockResolvedValue(undefined); vi.spyOn(room, 'unlock').mockResolvedValue(undefined); vi.spyOn(room, 'setFixedTimestep').mockImplementation(fn => { step = fn; });
  vi.spyOn(room, 'onMessage').mockImplementation(((type: string, handler: (c: Client, p?: unknown) => void) => { handlers.set(type, handler); return () => {}; }) as never);
  await room.onCreate({rosterProtocol:ROSTER_PROTOCOL, creationToken: TOKEN, ...options } as never);
  const join = (id: string, fighter = 'goku') => { const c = { sessionId: id, send: vi.fn(), leave: vi.fn() } as unknown as Client; room.onJoin(c, {rosterProtocol:ROSTER_PROTOCOL, creationToken: TOKEN, fighter, name: id, assetGate: true, readyGate: true } as never); room.clients.push(c); return c; };
  const send = (c: Client, type: string, p?: unknown) => handlers.get(type)?.(c, p);
  let tick = 0;
  const advance = (seconds: number) => { for (let i = 0; i < Math.round(seconds * 60); i++) step({ dt: 1 / 60, dtMs: 1000 / 60, tick: tick++, subSteps: 1, subDt: 1 / 60, subDtMs: 1000 / 60 }); };
  const loaded = (...clients: Client[]) => { for (const c of clients) { send(c, 'assets-ready', assetSignature(room.snapshot())); send(c, 'ready'); } };
  const leave = (c: Client) => { room.clients.splice(room.clients.indexOf(c), 1); room.onLeave(c); };
  return { room, join, send, advance, loaded, leave, lobby: () => room.snapshot().lobby! };
}

describe('a party\'s match room starts by itself', () => {
  it('a party DUEL: both in and loaded, then the room\'s own 3-second count, and the fight - nobody presses START', async () => {
    const f = await arena(new PrivateDuelRoom(), { stage: 'galactic-arena', party: 2 });
    try {
      const a = f.join('a'), b = f.join('b');
      expect(f.lobby()).toMatchObject({ duel: true, party: true, autoStart: true, startsAt: null });
      f.advance(2);
      expect(f.lobby().startsAt).toBeNull();
      f.loaded(a); f.advance(1);
      expect(f.lobby().startsAt).toBeNull();
      f.loaded(b); f.advance(.1);
      expect(f.lobby().startsAt).toBeCloseTo(f.room.simulation.serverTime + PARTY_COUNTDOWN - .1, 0);
      expect(statuses(f.room).at(-1)).toBe('Everyone is here — the duel starts in 3 seconds.');
      f.advance(PARTY_COUNTDOWN + .2);
      expect(f.room.simulation.status).toBe('active');
      expect(f.room.simulation.stage).toBe('galactic-arena');
      expect(f.lobby()).toMatchObject({ party: true, autoStart: false });
    } finally { f.room.onDispose(); }
  });

  it('a party royale: the count, the bots at kickoff (loaded too), then the fight', async () => {
    const f = await arena(new PrivateArenaRoom(), { players: 4, party: 3, rules: { arena: 'valley-of-the-end' } });
    try {
      const people = ['a', 'b', 'c'].map(id => f.join(id));
      f.loaded(...people); f.advance(.1);
      expect(f.lobby().startsAt).not.toBeNull();
      f.advance(PARTY_COUNTDOWN + .1);
      expect(f.room.snapshot().players.filter(p => p.isBot)).toHaveLength(1);
      expect(f.room.simulation.status).toBe('waiting');
      f.loaded(...people); f.advance(.2);
      expect(f.room.simulation.status).toBe('active');
      expect(f.room.simulation.stage).toBe('valley-of-the-end');
    } finally { f.room.onDispose(); }
  });

  it('every other private room still waits for its host\'s START', async () => {
    for (const make of [() => arena(new PrivateArenaRoom(), { players: 4 }), () => arena(new PrivateDuelRoom(), {})]) {
      const f = await make();
      try {
        const host = f.join('host'), guest = f.join('guest');
        f.loaded(host, guest); f.advance(10);
        expect(f.room.simulation.status).toBe('waiting');
        expect(f.lobby().startsAt).toBeNull();
        expect(f.lobby()).not.toHaveProperty('party');
        expect(f.lobby()).not.toHaveProperty('autoStart');
        f.send(host, 'start-private-match');
        expect(f.lobby().startsAt).not.toBeNull();
        f.advance(3.1); f.loaded(host, guest); f.advance(.2);
        expect(f.room.simulation.status).toBe('active');
      } finally { f.room.onDispose(); }
    }
  });

  it('a member who never arrives hands the start back to the host, and so does one who leaves', async () => {
    const f = await arena(new PrivateArenaRoom(), { players: 4, party: 3 });
    try {
      const host = f.join('host'), guest = f.join('guest');
      f.loaded(host, guest); f.advance(10);
      expect(f.room.simulation.status).toBe('waiting');
      expect(f.lobby()).toMatchObject({ party: true, autoStart: true, startsAt: null });
      f.advance(PARTY_GRACE_SECONDS - 10 + .1);
      expect(f.lobby()).toMatchObject({ party: true, autoStart: false, canStart: true });
      f.send(host, 'start-private-match');
      f.advance(3.1); f.loaded(host, guest); f.advance(.2);
      expect(f.room.simulation.status).toBe('active');
    } finally { f.room.onDispose(); }
    const d = await arena(new PrivateDuelRoom(), { party: 2 });
    try {
      const a = d.join('a'), b = d.join('b');
      d.leave(b);
      expect(d.lobby()).toMatchObject({ party: true, autoStart: false });
      const c = d.join('c'); d.loaded(a, c); d.advance(5);
      expect(d.lobby().startsAt).toBeNull();
      expect(d.room.simulation.status).toBe('waiting');
    } finally { d.room.onDispose(); }
  });

  it('only a private room takes the option, and only a whole number of seats it has', async () => {
    for (const party of ['2', 2.5, 99, -1, 1, 0, null, { n: 2 }, [2]]) {
      const f = await arena(new PrivateDuelRoom(), { party });
      try { f.join('a'); expect(f.lobby(), JSON.stringify(party)).not.toHaveProperty('party'); } finally { f.room.onDispose(); }
    }
    const queue = await arena(new DuelRoom(), { party: 2 });
    try { queue.join('a'); expect(queue.lobby()).not.toHaveProperty('party'); } finally { queue.room.onDispose(); }
    expect(new PartyStart(4, 4).seats).toBe(4);
    expect(new PartyStart(5, 4).seats).toBe(0);
  });
});

describe('a party\'s team room deploys by itself', () => {
  async function objective(kind: 'bad-blood' | 'last-stand', options: Record<string, unknown>) {
    const room = new ObjectiveRoom(); let step!: FixedTimestepCallback; const handlers = new Map<string, (c: Client, p?: unknown) => void>();
    vi.spyOn(room, 'setPrivate').mockResolvedValue(undefined); vi.spyOn(room, 'setMetadata').mockResolvedValue(undefined); vi.spyOn(room, 'broadcast').mockImplementation(() => {});
    vi.spyOn(room, 'lock').mockResolvedValue(undefined); vi.spyOn(room, 'unlock').mockResolvedValue(undefined); vi.spyOn(room, 'setFixedTimestep').mockImplementation(fn => { step = fn; });
    vi.spyOn(room, 'onMessage').mockImplementation(((type: string, handler: (c: Client, p?: unknown) => void) => { handlers.set(type, handler); return () => {}; }) as never);
    await room.onCreate({rosterProtocol:ROSTER_PROTOCOL, objective: kind, access: 'host', creationToken: TOKEN, ...options } as never);
    const join = (id: string) => { const c = { sessionId: id, send: vi.fn(), leave: vi.fn() } as unknown as Client; room.onJoin(c, {rosterProtocol:ROSTER_PROTOCOL, creationToken: TOKEN, objective: kind, fighter: 'goku', name: id, assetGate: true, objectiveProtocol: OBJECTIVE_PROTOCOL } as never); room.clients.push(c); return c; };
    const send = (c: Client, type: string, p?: unknown) => handlers.get(type)?.(c, p);
    let tick = 0;
    const advance = (seconds: number) => { for (let i = 0; i < Math.round(seconds * 60); i++) step({ dt: 1 / 60, dtMs: 1000 / 60, tick: tick++, subSteps: 1, subDt: 1 / 60, subDtMs: 1000 / 60 }); };
    const loaded = (...clients: Client[]) => { for (const c of clients) send(c, 'assets-ready', assetSignature(room.game.snapshot())); };
    const view = () => (room as unknown as { forOwner(s: unknown, id: string): { objective: { phase: string; startsAt: number | null; party?: boolean; autoStart?: boolean } } }).forOwner(room.game.snapshot(), 'h').objective;
    return { room, join, send, advance, loaded, view };
  }
  it('a party Bad Blood: everyone in and loaded, the lobby\'s count, then the deployment - no DEPLOY pressed', async () => {
    const f = await objective('bad-blood', { party: 2, rules: { arena: 'onigashima' } });
    try {
      const h = f.join('h'), g = f.join('g');
      expect(f.view()).toMatchObject({ phase: 'lobby', party: true, autoStart: true, startsAt: null });
      f.advance(1);
      expect(f.view().startsAt).toBeNull();
      f.loaded(h, g); f.advance(.1);
      expect(f.view().startsAt).not.toBeNull();
      f.advance(PARTY_COUNTDOWN + .1);
      expect(f.room.game.view.phase).toBe('countdown');
      expect(f.room.game.sim.stage).toBe('onigashima');
      expect(f.view()).toMatchObject({ party: true, autoStart: false });
    } finally { f.room.onDispose(); }
  });
  it('a hosted room no party launched still waits for DEPLOY; a member who leaves hands it back to the host', async () => {
    const plain = await objective('bad-blood', {});
    try {
      const h = plain.join('h'), g = plain.join('g'); plain.loaded(h, g); plain.advance(10);
      expect(plain.room.game.view.phase).toBe('lobby');
      expect(plain.view()).not.toHaveProperty('party');
      plain.send(h, 'objective-start');
      expect(plain.room.game.view.phase).toBe('countdown');
    } finally { plain.room.onDispose(); }
    const party = await objective('last-stand', { party: 3, fill: true });
    try {
      const h = party.join('h'), g = party.join('g'), x = party.join('x');
      expect(party.room.game.view.fillBots).toBe(true);
      party.room.clients.splice(party.room.clients.indexOf(x), 1); party.room.onLeave(x);
      party.loaded(h, g); party.advance(6);
      expect(party.room.game.view.phase).toBe('lobby');
      expect(party.view()).toMatchObject({ party: true, autoStart: false });
    } finally { party.room.onDispose(); }
    const own = await objective('last-stand', { fill: true });
    try { expect(own.room.game.view.fillBots).toBe(false); } finally { own.room.onDispose(); }
  });
});

describe('a party\'s co-op room starts its run by itself', () => {
  async function coop(options: Record<string, unknown>) {
    const room = new SurvivalRoom(); let step!: FixedTimestepCallback, n = 0;
    vi.spyOn(room, 'setPrivate').mockResolvedValue(undefined); vi.spyOn(room, 'setMetadata').mockResolvedValue(undefined);
    vi.spyOn(room, 'broadcast').mockImplementation(() => {}); vi.spyOn(room, 'lock').mockResolvedValue(undefined); vi.spyOn(room, 'unlock').mockResolvedValue(undefined);
    vi.spyOn(room, 'setFixedTimestep').mockImplementation(fn => { step = fn; });
    await room.onCreate({rosterProtocol:ROSTER_PROTOCOL, creationToken: TOKEN, ...options } as never);
    const frames = new Map<string, CoopFrame[]>();
    const join = (id: string) => { const list: CoopFrame[] = []; frames.set(id, list); const c = { sessionId: id, send: vi.fn(), sendBytes: vi.fn((_t: string, bytes: Uint8Array) => list.push(decode(bytes))) } as unknown as Client; room.clients.push(c); room.onJoin(c, {rosterProtocol:ROSTER_PROTOCOL, creationToken: TOKEN, fighter: 'zoro', name: id }); return c; };
    const advance = (seconds: number) => { for (let i = 0; i < Math.round(seconds * 60); i++) step({ dt: 1 / 60, dtMs: 1000 / 60, tick: ++n, subSteps: 1, subDt: 1 / 60, subDtMs: 1000 / 60 }); };
    const last = (id: string) => frames.get(id)!.at(-1)!;
    const loaded = (c: Client) => room.loadedBy(c, last(c.sessionId).survival.run);
    return { room, join, advance, last, loaded };
  }
  it('every member in with the first world loaded, the lobby\'s count, then the run', async () => {
    const f = await coop({ party: 2 });
    try {
      const a = f.join('a'), b = f.join('b'); f.advance(1);
      expect(f.last('a').lobby).toMatchObject({ party: true, autoStart: true, startsAt: null });
      f.loaded(a); f.advance(1);
      expect(f.room.game.phase).toBe('lobby');
      f.loaded(b); f.advance(.2);
      expect(f.last('a').lobby?.startsAt).not.toBeNull();
      f.advance(PARTY_COUNTDOWN);
      expect(f.room.game.phase).not.toBe('lobby');
    } finally { f.room.onDispose(); }
  });
  it('a co-op room no party launched still waits for START RUN, and a party one falls back to it', async () => {
    const plain = await coop({});
    try {
      const a = plain.join('a'), b = plain.join('b'); plain.advance(1); plain.loaded(a); plain.loaded(b); plain.advance(10);
      expect(plain.room.game.phase).toBe('lobby');
      expect(plain.last('a').lobby).not.toHaveProperty('party');
      plain.room.start(a);
      expect(plain.room.game.phase).not.toBe('lobby');
    } finally { plain.room.onDispose(); }
    const party = await coop({ party: 3 });
    try {
      const a = party.join('a'), b = party.join('b'); party.advance(1); party.loaded(a); party.loaded(b);
      party.advance(PARTY_GRACE_SECONDS);
      expect(party.room.game.phase).toBe('lobby');
      expect(party.last('a').lobby).toMatchObject({ party: true, autoStart: false });
      party.room.start(a);
      expect(party.room.game.phase).not.toBe('lobby');
    } finally { party.room.onDispose(); }
  });
});

describe('the waiting panel of a party\'s room', () => {
  const lobby = (extra: Partial<RoomLobby> = {}): RoomLobby => ({ visibility: 'private', code: '123456', hostId: 'host', canStart: true, startsAt: null, expiresAt: 900, ...extra });
  const panel = (l: RoomLobby | undefined, status: GameSnapshot['status'], self = 'host', duel?: { phase: 'playing' | 'interval' | 'complete' }, coop = false) => privatePanel(l, status, 10, self, { coop, players: 2, duel });
  it('reads as it always did in a room no party launched', () => {
    expect(panel(lobby(), 'waiting')).toEqual({ hidden: false, party: false, label: 'PRIVATE ROOM', startHidden: false, startLabel: 'START FIGHT', hint: 'YOUR ROOM · READY TO START' });
    expect(panel(lobby({ duel: true }), 'waiting', 'guest')).toMatchObject({ hidden: false, label: 'DUEL ROOM', startHidden: true, hint: 'WAITING FOR HOST' });
    expect(panel(lobby({ duel: true, startsAt: 13 }), 'waiting', 'host', { phase: 'interval' })).toMatchObject({ hidden: false, hint: 'STARTING IN 3s' });
    expect(panel(lobby(), 'waiting', 'host', undefined, true)).toMatchObject({ label: 'CO-OP ROOM', startLabel: 'START RUN', hint: 'PARTY OF 2 · READY' });
    expect(panel(lobby(), 'active').hidden).toBe(true);
  });
  it('has no invite and no START while it starts by itself, and no panel between a party Duel\'s rounds', () => {
    expect(panel(lobby({ duel: true, party: true, autoStart: true }), 'waiting')).toMatchObject({ hidden: false, party: true, label: 'PARTY DUEL', startHidden: true, hint: 'STARTS BY ITSELF ONCE EVERYONE IS IN' });
    expect(panel(lobby({ party: true, autoStart: true, startsAt: 12 }), 'waiting')).toMatchObject({ label: 'PARTY MATCH', startHidden: true, hint: 'STARTING IN 2s' });
    expect(panel(lobby({ party: true, autoStart: false }), 'waiting')).toMatchObject({ startHidden: false, hint: 'START WHEN YOU ARE READY' });
    expect(panel(lobby({ party: true, autoStart: false }), 'waiting', 'guest')).toMatchObject({ startHidden: true, hint: 'WAITING FOR THE HOST' });
    expect(panel(lobby({ duel: true, party: true, autoStart: false, startsAt: 13 }), 'waiting', 'host', { phase: 'interval' }).hidden).toBe(true);
    expect(panel(lobby({ party: true, autoStart: true }), 'waiting', 'host', undefined, true)).toMatchObject({ label: 'PARTY RUN', startHidden: true });
    const dock = (extra: Partial<RoomLobby>) => dockText({ phase: 'waiting', self: { id: 'host' }, snapshot: { roomMode: 'match', serverTime: 10, lobby: lobby(extra), players: [{ id: 'host' }, { id: 'b' }] } } as never, 0)!;
    expect(dock({ party: true, duel: true, autoStart: true }).title).toBe('PARTY DUEL');
    expect(dock({ party: true, size: 4 })).toMatchObject({ title: 'PARTY MATCH', detail: '2 / 4 JOINED · 2 BOTS AT START' });
    expect(dock({ size: 4 }).title).toBe('YOUR ROOM · 123456');
  });
});
