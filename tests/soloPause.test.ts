import { ROSTER_PROTOCOL } from '../src/game/rosterProtocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Deferred, type Client, type FixedTimestepCallback, type Room } from 'colyseus';
import { Packr, unpack } from 'msgpackr';
import { ArenaRoom, BotArenaRoom, DuelRoom, PrivateArenaRoom } from '../src/server/ArenaRoom';
import { SurvivalRoom } from '../src/server/SurvivalRoom';
import { ObjectiveRoom } from '../src/server/objectives/ObjectiveRoom';
import { OBJECTIVE_PROTOCOL } from '../src/game/objectives/model';
import { PAUSE_FENCE_TICKS, PAUSE_LIMIT_MS, PAUSE_REARM_TICKS, SoloPause, type PauseRoom } from '../src/server/SoloPause';
import { LATE_HOLD_SECONDS, READY_SECONDS, READY_WAIT_SECONDS } from '../src/server/ReadyGate';
import { assetSignature } from '../src/game/social/assets';
import { Prediction } from '../src/game/prediction';
import { createRapierCollision } from '../src/game/rapierCollision';
import { decode, type CoopFrame } from '../src/survival/coopNet';
import type { GameSnapshot, PlayerInput } from '../src/game/types';

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
const TOKEN = '01234567-89ab-cdef-0123-456789abcdef';
const wire = <T>(value: T): T => unpack(new Packr({ useRecords: false }).pack(value)) as T;
type Mock = Client & { snapshots: GameSnapshot[] };
const client = (sessionId: string) => {
  const snapshots: GameSnapshot[] = [];
  return { sessionId, snapshots, leave: vi.fn(), sendBytes: vi.fn((_type: string, bytes: Uint8Array) => snapshots.push(decode(bytes))),
    send: vi.fn((type: string, message: unknown) => { if (type === 'snapshot' || type === 'input-resync') snapshots.push(wire(message as GameSnapshot)); }) } as unknown as Mock;
};

async function fixture<T extends ArenaRoom | SurvivalRoom | ObjectiveRoom>(room: T, options: object) {
  let tick!: FixedTimestepCallback, frame = 0;
  const handlers = new Map<string, (c: Client, payload?: unknown) => void>();
  const base = room as unknown as Room;
  vi.spyOn(base, 'onMessage').mockImplementation(((type: string, fn: (c: Client, payload?: unknown) => void) => { handlers.set(type, fn); return () => {}; }) as never);
  vi.spyOn(base, 'setPrivate').mockResolvedValue(undefined); vi.spyOn(base, 'setMetadata').mockResolvedValue(undefined);
  vi.spyOn(base, 'broadcast').mockImplementation(() => {}); vi.spyOn(base, 'lock').mockResolvedValue(undefined); vi.spyOn(base, 'unlock').mockResolvedValue(undefined);
  vi.spyOn(base, 'setFixedTimestep').mockImplementation((callback: FixedTimestepCallback) => { tick = callback; });
  await (room as unknown as { onCreate(options: unknown): Promise<void> }).onCreate({rosterProtocol:ROSTER_PROTOCOL,...options});
  const advance = (n = 1) => { for (let i = 0; i < n; i++) tick({ dt: 1 / 60, dtMs: 1000 / 60, tick: ++frame, subSteps: 1, subDt: 1 / 60, subDtMs: 1000 / 60 }); };
  const join = (id: string, options: object = {}) => { const c = client(id); room.clients.push(c); room.onJoin(c, {rosterProtocol:ROSTER_PROTOCOL, fighter: 'goku', name: id, ...options } as never); return c; };
  const send = (c: Client, type: string, payload?: unknown) => handlers.get(type)!(c, payload);
  const last = (c: Mock) => c.snapshots[c.snapshots.length - 1];
  return { room, advance, join, send, last };
}
const sim = (room: ArenaRoom) => room.simulation;
const world = (room: ArenaRoom) => JSON.stringify(room.simulation.snapshot(false, true));
const command = (seq: number, extra: Partial<PlayerInput> = {}): PlayerInput => ({ seq, moveX: 0, moveZ: -1, yaw: Math.PI, ...extra });

describe('a real pause for a room with one human in it', () => {
  it('freezes a bot royale outright: no tick, no bot, no clock, no event - and drops input sent meanwhile', async () => {
    const f = await fixture(new BotArenaRoom(), { players: 8 });
    try {
      const me = f.join('me');
      for (let i = 0; i < 6 * 60 && sim(f.room).status === 'waiting'; i++) f.advance();
      expect(sim(f.room).status).toBe('active');
      f.advance(90);
      expect(f.last(me).pause).toMatchObject({ paused: false, pausable: true, ack: 0 });
      let wall = Date.now();
      vi.spyOn(Date, 'now').mockImplementation(() => wall);
      f.send(me, 'pause', { n: 1 });
      f.advance();
      expect(f.last(me).pause).toMatchObject({ paused: true, pausable: true, ack: 1 });
      const time = sim(f.room).serverTime, tick = sim(f.room).tick, before = world(f.room), frozenAt = me.snapshots.length;
      for (let seq = 1; seq <= 30; seq++) { f.send(me, 'input', command(seq, { attack: 'light' })); f.advance(20); wall += 333; }
      expect(sim(f.room).serverTime).toBe(time);
      expect(sim(f.room).tick).toBe(tick);
      expect(world(f.room)).toBe(before);
      const beats = me.snapshots.slice(frozenAt);
      expect(beats.length).toBeGreaterThanOrEqual(25);
      for (const beat of beats) { expect(beat.events).toEqual([]); expect(beat.serverTime).toBe(time); expect(beat.pause?.paused).toBe(true); }
      f.send(me, 'resume', { n: 2 });
      f.advance();
      expect(sim(f.room).serverTime).toBeCloseTo(time + 1 / 60, 9);
      expect(f.last(me).pause).toMatchObject({ paused: false, ack: 2 });
      expect(sim(f.room).actors.get('me')!.lastSeq).toBe(-1);
    } finally { f.room.onDispose(); }
  });

  it('plays the commands already on their way before it freezes, then nothing', async () => {
    const f = await fixture(new BotArenaRoom(), { players: 4 });
    try {
      const me = f.join('me');
      for (let i = 0; i < 6 * 60 && sim(f.room).status === 'waiting'; i++) f.advance();
      for (let seq = 1; seq <= 12; seq++) { f.send(me, 'input', command(seq)); f.advance(); }
      for (let seq = 13; seq <= 18; seq++) f.send(me, 'input', command(seq));
      f.send(me, 'pause', { n: 1 });
      f.advance(PAUSE_FENCE_TICKS);
      expect(f.last(me).pause?.paused).toBe(true);
      expect(sim(f.room).actors.get('me')!.lastSeq).toBe(18);
      expect(f.last(me).players.find(p => p.id === 'me')!.ackSeq).toBe(18);
    } finally { f.room.onDispose(); }
  });

  it('carries every clock on from where it stood: the READY hold does not jump across a pause', async () => {
    const f = await fixture(new BotArenaRoom(), { players: 6 });
    try {
      const me = f.join('me', { assetGate: true, readyGate: true });
      f.send(me, 'assets-ready', assetSignature(f.room.snapshot()));
      f.send(me, 'ready');
      f.advance();
      const startsAt = f.room.snapshot().lobby!.startsAt!;
      expect(startsAt - sim(f.room).serverTime).toBeCloseTo(READY_SECONDS, 6);
      f.advance(60);
      f.send(me, 'pause', { n: 1 }); f.advance();
      expect(f.last(me).pause?.paused, 'a solo room pauses its READY hold too').toBe(true);
      const left = startsAt - sim(f.room).serverTime;
      f.advance(20 * 60);
      expect(sim(f.room).status).toBe('waiting');
      expect(startsAt - sim(f.room).serverTime).toBe(left);
      f.send(me, 'resume', { n: 2 });
      let ticks = 0;
      while (sim(f.room).status === 'waiting' && ticks < 10 * 60) { f.advance(); ticks++; }
      expect(ticks / 60).toBeCloseTo(left, 1);
      expect(f.room.snapshot().lobby!.startsAt).toBeNull();
    } finally { f.room.onDispose(); }
  });

  it('never pauses a room with two humans, and lets go of one the moment a second human is in', async () => {
    const f = await fixture(new PrivateArenaRoom(), { creationToken: TOKEN, players: 4 });
    try {
      const host = f.join('host', { creationToken: TOKEN }), guest = f.join('guest', { creationToken: TOKEN });
      f.send(host, 'start-private-match'); f.advance(4 * 60);
      expect(sim(f.room).status).toBe('active');
      expect(f.last(host).pause).toMatchObject({ paused: false, pausable: false });
      const time = sim(f.room).serverTime;
      f.send(host, 'pause', { n: 1 }); f.send(guest, 'pause', { n: 1 });
      f.advance(120);
      expect(f.last(host).pause?.paused).toBe(false);
      expect(sim(f.room).serverTime).toBeCloseTo(time + 2, 6);
    } finally { f.room.onDispose(); }
    const t = await fixture(new ArenaRoom(), { mode: 'training' });
    try {
      const me = t.join('me');
      t.advance(10);
      t.send(me, 'pause', { n: 1 }); t.advance();
      expect(t.last(me).pause?.paused).toBe(true);
      const time = sim(t.room).serverTime;
      t.join('probe');
      t.advance(30);
      expect(t.last(me).pause).toMatchObject({ paused: false, pausable: false });
      expect(sim(t.room).serverTime).toBeCloseTo(time + .5, 6);
    } finally { t.room.onDispose(); }
  });

  it('cannot be stepped a few frames at a time: a pause needs play behind it before it takes', async () => {
    const f = await fixture(new ArenaRoom(), { mode: 'training' });
    try {
      const me = f.join('me');
      f.send(me, 'pause', { n: 1 }); f.advance();
      expect(f.last(me).pause?.paused).toBe(true);
      f.send(me, 'resume', { n: 2 }); f.advance();
      const time = sim(f.room).serverTime;
      f.send(me, 'pause', { n: 3 });
      f.advance(PAUSE_REARM_TICKS - 2);
      expect(f.last(me).pause).toMatchObject({ paused: false, pausing: true, ack: 3 });
      f.advance(5);
      expect(f.last(me).pause?.paused).toBe(true);
      expect(sim(f.room).serverTime - time).toBeGreaterThanOrEqual((PAUSE_REARM_TICKS - 1) / 60 - 1e-9);
      f.send(me, 'resume', { n: 3 }); f.advance();
      expect(f.last(me).pause?.paused).toBe(true);
    } finally { f.room.onDispose(); }
  });

  it('holds for its one human while their link is down, and thaws only when they say so', async () => {
    const f = await fixture(new BotArenaRoom(), { players: 4 });
    try {
      const me = f.join('me');
      for (let i = 0; i < 6 * 60 && sim(f.room).status === 'waiting'; i++) f.advance();
      f.advance(30);
      const pending = new Deferred<Client>();
      vi.spyOn(f.room, 'allowReconnection').mockReturnValue(pending);
      f.room.clients.splice(f.room.clients.indexOf(me), 1);
      const drop = f.room.onDrop(me);
      const time = sim(f.room).serverTime, before = world(f.room);
      f.advance(10 * 60);
      expect(world(f.room)).toBe(before);
      pending.resolve(me); await drop; f.room.clients.push(me); f.room.onReconnect(me);
      f.send(me, 'resync-input');
      expect(f.last(me).pause?.paused).toBe(true);
      f.advance(60);
      expect(sim(f.room).serverTime).toBe(time);
      f.send(me, 'resume', { n: 1 }); f.advance(60);
      expect(sim(f.room).serverTime).toBeCloseTo(time + 1, 6);
    } finally { f.room.onDispose(); }
  });

  it('pauses a co-op run with one fighter in it, and its draft clock skips the pause', async () => {
    const f = await fixture(new SurvivalRoom(), { creationToken: TOKEN });
    try {
      const code = f.room.roomId.replace('coop-', '');
      const me = f.join('me', { code, fighter: 'zoro' });
      f.send(me, 'start-private-match');
      for (let i = 0; i < 20 * 60 && f.room.game.phase !== 'fight'; i++) f.advance();
      expect(f.room.game.phase).toBe('fight');
      f.send(me, 'pause', { n: 1 }); f.advance();
      expect((f.last(me) as CoopFrame).pause?.paused).toBe(true);
      const time = f.room.game.sim.serverTime;
      f.advance(5 * 60);
      expect(f.room.game.sim.serverTime).toBe(time);
      f.send(me, 'resume', { n: 2 }); f.advance();
      expect(f.room.game.sim.serverTime).toBeCloseTo(time + 1 / 60, 9);
      f.join('friend', { code, fighter: 'goku' });
      f.advance(PAUSE_REARM_TICKS + 5);
      f.send(me, 'pause', { n: 3 }); f.advance(10);
      expect((f.last(me) as CoopFrame).pause).toMatchObject({ paused: false, pausable: false });
    } finally { f.room.onDispose(); }
  });
});

describe('the other rooms a lone human can be in', () => {
  it('pauses a team match whose only human is its host, countdown and fight alike', async () => {
    const f = await fixture(new ObjectiveRoom(), { objective: 'bad-blood', access: 'host', creationToken: TOKEN, assetGate: true, objectiveProtocol: OBJECTIVE_PROTOCOL });
    try {
      const me = f.join('me', { objective: 'bad-blood', fighter: 'goku', creationToken: TOKEN, assetGate: true, objectiveProtocol: OBJECTIVE_PROTOCOL });
      f.send(me, 'objective-start'); f.advance();
      const game = (f.room as ObjectiveRoom).game;
      expect(game.view.phase).toBe('countdown');
      f.send(me, 'assets-ready', assetSignature(game.snapshot()));
      f.advance(30);
      f.send(me, 'pause', { n: 1 }); f.advance();
      expect(f.last(me).pause).toMatchObject({ paused: true, pausable: true });
      const time = game.sim.serverTime, startsAt = game.view.startsAt;
      f.advance(10 * 60);
      expect(game.sim.serverTime).toBe(time);
      expect(game.view.phase).toBe('countdown');
      expect(game.view.startsAt).toBe(startsAt);
      f.send(me, 'resume', { n: 2 });
      for (let i = 0; i < 10 * 60 && game.view.phase === 'countdown'; i++) f.advance();
      expect(game.view.phase).toBe('active');
      f.advance(PAUSE_REARM_TICKS + 1);
      f.send(me, 'pause', { n: 3 }); f.advance();
      const fight = game.sim.serverTime;
      f.advance(5 * 60);
      expect(game.sim.serverTime).toBe(fight);
    } finally { f.room.onDispose(); }
  });

  it('does not count a frozen room\'s minutes as loading time: a page hidden mid-load is not sent home', async () => {
    const f = await fixture(new BotArenaRoom(), { players: 4 });
    try {
      let wall = Date.now();
      vi.spyOn(Date, 'now').mockImplementation(() => wall);
      const me = f.join('me', { assetGate: true, readyGate: true });
      f.advance(60); wall += 1000;
      f.send(me, 'pause', { n: 1 }); f.advance();
      expect(f.last(me).pause?.paused).toBe(true);
      for (let i = 0; i < 120; i++) { wall += 1000; f.advance(); }
      f.send(me, 'resume', { n: 2 });
      f.advance(); wall += 1000; f.advance(60);
      expect(me.leave, 'still in the room').not.toHaveBeenCalled();
      f.send(me, 'assets-ready', assetSignature(f.room.snapshot())); f.send(me, 'ready'); f.advance();
      expect(f.room.snapshot().lobby!.startsAt).not.toBeNull();
    } finally { f.room.onDispose(); }
  });
});

describe('the pause and the player\'s own prediction agree', () => {
  it('freezes the world the page had predicted, holds it, and resumes without a correction', async () => {
    const f = await fixture(new ArenaRoom(), { mode: 'training' });
    const prediction = new Prediction();
    try {
      const me = f.join('me');
      sim(f.room).removePlayer('sparring-bot');
      f.advance(3);
      prediction.start('me', f.last(me), await createRapierCollision(f.room.simulation.stage));
      const local = () => (prediction as unknown as { sim: { actors: Map<string, { state: { x: number; z: number; yaw: number; action: string } }> } }).sim.actors.get('me')!.state;
      const server = () => sim(f.room).actors.get('me')!.state;
      let seq = 0, delivered = 0, phase: 'before' | 'frozen' | 'after' = 'before';
      const worst = { before: 0, frozen: 0, after: 0 };
      const banked = () => { const o = prediction.diagnostics.offset; return Math.hypot(o.x, o.y, o.z); };
      const deliver = () => { for (; delivered < me.snapshots.length; delivered++) { const was = banked(); prediction.reconcile(me.snapshots[delivered]); worst[phase] = Math.max(worst[phase], Math.abs(banked() - was)); } };
      const play = (ticks: number) => {
        for (let i = 0; i < ticks; i++) {
          const input = command(++seq, { moveX: Math.sin(seq / 9), moveZ: -1, attack: seq % 40 === 5 ? 'light' : undefined });
          prediction.submit(input); f.send(me, 'input', input);
          f.advance(); deliver();
        }
      };
      play(90);
      const predicted = { ...local() };
      phase = 'frozen';
      f.send(me, 'pause', { n: 1 });
      f.advance(PAUSE_FENCE_TICKS); deliver();
      expect(f.last(me).pause?.paused).toBe(true);
      expect(server().x).toBeCloseTo(predicted.x, 6);
      expect(server().z).toBeCloseTo(predicted.z, 6);
      expect(server().action).toBe(predicted.action);
      f.advance(20 * 60); deliver();
      expect(local().x).toBeCloseTo(predicted.x, 6);
      expect(local().z).toBeCloseTo(predicted.z, 6);
      phase = 'after';
      f.send(me, 'resume', { n: 2 });
      play(120);
      for (let i = 0; i < 6; i++) { f.advance(); deliver(); }
      expect(worst.before, 'the page predicts its own run exactly').toBeLessThan(1e-3);
      expect(worst.frozen, 'the freeze and twenty seconds of frozen snapshots corrected nothing').toBeLessThan(1e-3);
      expect(worst.after, 'nor did the resume').toBeLessThan(1e-3);
      expect(banked(), 'nothing banked over the whole run').toBeLessThan(.01);
      const authority = f.last(me).players.find(p => p.id === 'me')!;
      expect(local().x).toBeCloseTo(authority.x, 6);
      expect(local().z).toBeCloseTo(authority.z, 6);
    } finally { prediction.stop(); f.room.onDispose(); }
  });
});

describe('READY then FIGHT', () => {
  it('starts a bot royale\'s hold only once its player\'s screen is up, and nobody acts or is hit before FIGHT', async () => {
    const f = await fixture(new BotArenaRoom(), { players: 8 });
    try {
      const me = f.join('me', { assetGate: true, readyGate: true });
      f.advance(13 * 60);
      expect(sim(f.room).status).toBe('waiting');
      expect(f.room.snapshot().lobby!.startsAt).toBeNull();
      f.send(me, 'assets-ready', assetSignature(f.room.snapshot()));
      f.advance(2 * 60);
      expect(f.room.snapshot().lobby!.startsAt, 'models in, but the page has not drawn the fight yet').toBeNull();
      f.send(me, 'ready'); f.advance();
      const go = f.room.snapshot().lobby!.startsAt!;
      expect(go - sim(f.room).serverTime).toBeCloseTo(READY_SECONDS, 6);
      let seq = 0;
      while (sim(f.room).status === 'waiting') {
        f.send(me, 'input', command(++seq, { attack: seq % 10 === 0 ? 'special' : undefined, dash: seq % 7 === 0 }));
        f.advance();
        for (const p of sim(f.room).snapshot().players) expect(p.hp, `${p.id} untouched before FIGHT`).toBe(p.maxHp);
      }
      expect(sim(f.room).serverTime).toBeGreaterThanOrEqual(go - 1e-9);
    } finally { f.room.onDispose(); }
  });

  it('counts a page that never says it is up as up after a while, so nothing stalls', async () => {
    const f = await fixture(new BotArenaRoom(), { players: 4 });
    try {
      const me = f.join('me', { assetGate: true, readyGate: true });
      f.send(me, 'assets-ready', assetSignature(f.room.snapshot()));
      f.advance(Math.round(READY_WAIT_SECONDS * 60) + 2);
      expect(f.room.snapshot().lobby!.startsAt).not.toBeNull();
      f.advance(Math.round(READY_SECONDS * 60) + 2);
      expect(sim(f.room).status).toBe('active');
    } finally { f.room.onDispose(); }
  });

  it('holds a room of several humans for one whose screen came up late, and only so long', async () => {
    const f = await fixture(new PrivateArenaRoom(), { creationToken: TOKEN, players: 4 });
    try {
      const gated = { creationToken: TOKEN, assetGate: true, readyGate: true };
      const host = f.join('host', gated), guest = f.join('guest', gated);
      f.send(host, 'ready');
      f.send(host, 'start-private-match');
      f.advance(4 * 60);
      for (const c of [host, guest]) f.send(c, 'assets-ready', assetSignature(f.room.snapshot()));
      f.advance(60);
      expect(sim(f.room).status, 'the guest has not drawn the fight yet').toBe('waiting');
      f.send(guest, 'ready');
      f.advance();
      const go = f.room.snapshot().lobby!.startsAt!;
      expect(go - sim(f.room).serverTime).toBeCloseTo(LATE_HOLD_SECONDS - 1 / 60, 6);
      f.advance(Math.round(LATE_HOLD_SECONDS * 60) + 1);
      expect(sim(f.room).status).toBe('active');
    } finally { f.room.onDispose(); }
  });
});

describe('an online duel, as the page plays it', () => {
  it('waits for both screens, holds the late one, never pauses, and starts at the server\'s word', async () => {
    const f = await fixture(new DuelRoom(), { mode: 'match' });
    try {
      const gated = { assetGate: true, readyGate: true };
      const a = f.join('a', { ...gated, fighter: 'jotaro' }), b = f.join('b', { ...gated, fighter: 'dio' });
      f.advance(60);
      const sig = assetSignature(f.room.snapshot());
      f.send(a, 'assets-ready', sig); f.send(b, 'assets-ready', sig); f.send(a, 'ready');
      f.advance(4 * 60);
      expect(sim(f.room).status, 'b has its models but has not drawn the fight').toBe('waiting');
      f.send(b, 'ready'); f.advance();
      const left = f.room.snapshot().lobby!.startsAt! - sim(f.room).serverTime;
      expect(left).toBeGreaterThanOrEqual(LATE_HOLD_SECONDS - 1 / 60 - 1e-6);
      f.send(a, 'pause', { n: 1 }); f.advance();
      expect(f.last(a).pause).toMatchObject({ paused: false, pausable: false });
      for (let i = 0; i < 5 * 60 && sim(f.room).status === 'waiting'; i++) f.advance();
      expect(sim(f.room).status).toBe('active');
      expect(sim(f.room).snapshot().players.every(p => p.hp === p.maxHp)).toBe(true);
    } finally { f.room.onDispose(); }
  });
});

describe('SoloPause on its own', () => {
  const room = (over: Partial<PauseRoom> = {}) => {
    const calls: string[] = [];
    const host: PauseRoom = { solo: () => 'me', open: () => true, queued: () => 0, frozen: () => calls.push('frozen'), thawed: ms => calls.push(`thawed ${ms}`), beat: () => calls.push('beat'), ...over };
    return { pause: new SoloPause(host), calls };
  };
  it('lets a forgotten pause go after its limit, and hears only the room\'s one human', () => {
    const { pause, calls } = room();
    pause.request({ sessionId: 'someone-else' }, { n: 1 }, true, 0);
    expect(pause.hold(0)).toBe(false);
    pause.request({ sessionId: 'me' }, { n: 1 }, true, 0);
    expect(pause.hold(0)).toBe(true);
    expect(pause.hold(PAUSE_LIMIT_MS - 1)).toBe(true);
    expect(pause.hold(PAUSE_LIMIT_MS)).toBe(false);
    expect(calls[0]).toBe('frozen');
    expect(calls.at(-1)).toBe(`thawed ${PAUSE_LIMIT_MS}`);
    expect(pause.frozenMs).toBe(PAUSE_LIMIT_MS);
  });
  it('refuses a malformed serial and a room whose phase does not allow it', () => {
    const closed = room({ open: () => false });
    closed.pause.request({ sessionId: 'me' }, { n: 1 }, true, 0);
    expect(closed.pause.hold(0)).toBe(false);
    expect(closed.pause.view()).toEqual({ paused: false, pausable: false, ack: 1 });
    const { pause } = room();
    for (const bad of [undefined, null, 'x', { n: -1 }, { n: 1.5 }, { n: Number.MAX_VALUE }]) pause.request({ sessionId: 'me' }, bad, true, 0);
    expect(pause.hold(0)).toBe(false);
    expect(pause.view().ack).toBe(0);
  });
});
