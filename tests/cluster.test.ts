import { afterAll, describe, expect, it, vi } from 'vitest';
import http from 'node:http';
import net, { type AddressInfo } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requestFromIPC, subscribeIPC, initializeRoomCache } from 'colyseus';
import { Link, type Down, type Up } from '../src/server/cluster/link';
import { LinkDriver, LinkPresence } from '../src/server/cluster/shared';
import { Primary, REQUEST_TIMEOUT_MS, UPSTREAM_TIMEOUT_MS, routeOf } from '../src/server/cluster/primary';
import { choose } from '../src/server/cluster/placement';
import { clusterCodes } from '../src/server/privateCodes';
import { RemoteEconomy, answerRoomEconomy } from '../src/server/cluster/economyLink';
import { Economy } from '../src/server/economy/api';
import { RoomRewards } from '../src/server/economy/RoomRewards';
import { ArenaSimulation } from '../src/game/simulation';

function cluster(...roles: Array<['control' | 'rooms', number]>) {
  const primary = new Primary({ port: 0, roomWorkers: roles.filter(([role]) => role === 'rooms').length, basePort: 0, log: () => {} });
  const internals = primary as unknown as { fromChild(child: unknown, message: Up): void; children: Map<string, unknown> };
  const links = roles.map(([role, index]) => {
    let deliver: (message: Down) => void = () => {};
    const child = { role, index, port: 0, topics: new Map(), started: Date.now(), proc: { connected: true, send: (message: Down) => queueMicrotask(() => deliver(structuredClone(message))) } };
    internals.children.set(`${role}:${index}`, child);
    return new Link(message => queueMicrotask(() => internals.fromChild(child, structuredClone(message))), listener => { deliver = listener; });
  });
  return { primary, links };
}

describe('the cluster (ROOM_WORKERS)', () => {
  it('routes a room socket to its process, Rift War\'s queue to room process 1, everything else to control', () => {
    expect(routeOf('/AbC123/room-1?sessionId=x', true)).toEqual({ kind: 'process', processId: 'AbC123' });
    expect(routeOf('/rift-war/reserve', false)).toEqual({ kind: 'target', target: { role: 'rooms', index: 1 } });
    for (const url of ['/health', '/matchmake/joinOrCreate/arena', '/api/economy/hello', '/rift-war/queue', '/rift-war/reserve/x'])
      expect(routeOf(url, false)).toEqual({ kind: 'target', target: { role: 'control', index: 0 } });
  });

  it('places a room on a room process only: the least busy, not shedding, then the fewest rooms; Rift War on process 1', () => {
    const now = 1_000_000, load = (role: string, index: number, busy: number, rooms: number, shedding = false, at = now) => JSON.stringify({ role, index, busy, rooms, shedding, at });
    const loads = { c: load('control', 0, 0, 0), r1: load('rooms', 1, .3, 2), r2: load('rooms', 2, .1, 5), r3: load('rooms', 3, .1, 1), old: load('rooms', 4, 0, 0, false, now - 20_000) };
    expect(choose('arena', loads, now)).toBe('r3');
    expect(choose('arena', { ...loads, r3: load('rooms', 3, .1, 1, true) }, now)).toBe('r2');
    expect(choose('rift_war', loads, now)).toBe('r1');
    expect(choose('arena', { c: loads.c, old: loads.old }, now)).toBeUndefined();
  });

  it('gives each room process its own share of the six-digit codes', () => {
    expect(clusterCodes(1, 1)).toBeUndefined();
    expect(clusterCodes(0, 3)).toBeUndefined();
    for (const [index, size] of [[1, 3], [2, 3], [3, 3], [4, 4]] as const) {
      const next = clusterCodes(index, size)!;
      for (let i = 0; i < 400; i++) { const code = next(); expect(code).toMatch(/^\d{6}$/); expect(Number(code) % size).toBe(index - 1); }
    }
  });

  it('shares presence between processes: pub/sub, keys, and Colyseus\'s own IPC requests', async () => {
    const { links: [control, rooms] } = cluster(['control', 0], ['rooms', 1]);
    const a = new LinkPresence(control), b = new LinkPresence(rooms);
    const got: unknown[] = [];
    await b.subscribe('topic', (data: unknown) => got.push(data));
    a.publish('topic', { n: 1 }); a.publish('topic', { n: 2 });
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(got).toEqual([{ n: 1 }, { n: 2 }]);
    await a.hset('h', 'f', 'v'); expect(await b.hget('h', 'f')).toBe('v'); expect(await b.hgetall('h')).toEqual({ f: 'v' });
    expect(await b.hincrbyex('k', 'x', 2, 60)).toBe(2); expect(await a.hincrbyex('k', 'x', -1, 60)).toBe(1);
    expect(await a.channels('top*')).toEqual(['topic']);
    await subscribeIPC(b, 'p:rooms-1', (method: string, args: unknown[]) => method === 'add' ? (args as number[])[0] + (args as number[])[1] : Promise.reject(new Error('nope')));
    expect(await requestFromIPC(a, 'p:rooms-1', 'add', [2, 3])).toBe(5);
    await expect(requestFromIPC(a, 'p:rooms-1', 'other', [])).rejects.toThrow('nope');
    b.unsubscribe('topic'); expect(await a.channels('top*')).toEqual([]);
  });

  it('keeps one room listing for every process, as copies (RedisDriver\'s semantics)', async () => {
    const { links: [control, rooms] } = cluster(['control', 0], ['rooms', 1]);
    const here = new LinkDriver(rooms), there = new LinkDriver(control);
    const room = initializeRoomCache({ name: 'arena', roomId: 'r1', processId: 'p1', clients: 0, maxClients: 12, metadata: { mode: 'match' } });
    await here.persist(room, true);
    await here.update(room, { $inc: { clients: 2 }, $set: { locked: false } });
    expect(room.clients).toBe(2);
    expect(await there.has('r1')).toBe(true);
    expect((await there.findOne({ roomId: 'r1' })).clients).toBe(2);
    expect((await there.query({ name: 'arena', mode: 'match' } as never)).map(r => r.roomId)).toEqual(['r1']);
    expect((await there.findOne({ name: 'arena', locked: false })).roomId).toBe('r1');
    expect([...(await there.findByIds(['r1', 'nope'])).keys()]).toEqual(['r1']);
    await there.cleanup('p1'); expect(await here.has('r1')).toBe(false);
  });

  it('relays a room process\'s economy calls to control, errors included', async () => {
    const { links: [control, rooms] } = cluster(['control', 0], ['rooms', 1]);
    control.handle('twice', n => (n as number) * 2);
    control.handle('fail', () => { throw Object.assign(new Error('refused'), { code: 4212 }); });
    expect(await rooms.call('rpc', 'twice', [21])).toBe(42);
    await expect(rooms.call('rpc', 'fail', [])).rejects.toMatchObject({ message: 'refused', code: 4212 });
    await expect(rooms.call('rpc', 'missing', [])).rejects.toThrow('no handler');
  });

  it('a room process reads accounts and names from control, and a match it settles is paid once by control', async () => {
    const { links: [control, rooms] } = cluster(['control', 0], ['rooms', 1]);
    const e = new Economy({ dir: false }), sim = new ArenaSimulation({ roomMode: 'match' });
    try {
      answerRoomEconomy(control, () => e, (token, typed, max) => `${String(typed)}/${max}/${e.book.find(token) ? 'known' : 'guest'}`);
      const remote = new RemoteEconomy(rooms);
      const a = e.hello(undefined) as unknown as { token: string; account: { pk: string } };
      expect(remote.book.find(a.token)).toBeUndefined();
      await remote.learn(a.token, 'Typed');
      expect(remote.book.find(a.token)?.pk).toBe(a.account.pk);
      expect(remote.name(a.token, 'Typed', 18)).toBe('Typed/18/known');
      expect(remote.name(a.token, 'Typed', 20)).toBe('Typed/20/known');

      const r = new RoomRewards(() => remote);
      sim.addPlayer('a', 'naruto', 'A'); sim.addPlayer('b', 'goku', 'B'); r.bind('a', a.token);
      sim.startMatch(); r.observe(sim.snapshot());
      r.input('a', { seq: 1, moveX: 1, moveZ: 0, yaw: 0 });
      sim.serverTime = 35; sim.damage('b', 1e6, 'a', 'KO'); sim.step();
      r.observe(sim.snapshot());
      expect(r.forOwner(sim.snapshot(), 'a').reward).toBeUndefined();
      await new Promise(resolve => setTimeout(resolve, 20));
      r.observe(sim.snapshot());
      const own = r.forOwner(sim.snapshot(), 'a');
      expect(own.reward?.settlement.total).toBeGreaterThan(0);
      const balance = e.book.find(a.token)!.balance;
      expect(balance).toBe(own.reward!.settlement.total);
      for (let i = 0; i < 5; i++) r.observe(sim.snapshot());
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(e.book.find(a.token)!.balance).toBe(balance);
      expect(e.book.completions.size).toBe(1);
    } finally { sim.dispose(); e.close(); }
  });

  it('does not ask control again while a settlement is out, and waits before asking again after a failure', async () => {
    const { links: [control, rooms] } = cluster(['control', 0], ['rooms', 1]);
    let asked = 0, answer: unknown;
    control.handle('economy.complete', () => { asked++; if (!answer) throw new Error('disk unavailable'); return answer; });
    control.handle('economy.seat', () => ({ names: {} }));
    let now = 0;
    const remote = new RemoteEconomy(rooms, () => now), report = { id: 'm1', mode: 'duel', fighter: 'naruto', seconds: 35, place: 1, players: 2, kos: 1 } as never;
    expect(remote.complete('pk', report)).toBeUndefined();
    expect(remote.complete('pk', report)).toBeUndefined();
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(asked).toBe(1);
    expect(remote.complete('pk', report)).toBeUndefined(); expect(asked).toBe(1);
    now = 2500; answer = { matchId: 'm1', pk: 'pk', completedAt: 1, report, settlement: { total: 5 } };
    expect(remote.complete('pk', report)).toBeUndefined();
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(asked).toBe(2);
    expect(remote.complete('pk', report)).toMatchObject({ settlement: { total: 5 } });
  });
});

async function proxied(answer: http.RequestListener, limits = { requestTimeoutMs: 300, upstreamTimeoutMs: 300 }) {
  const upstream = http.createServer(answer), rooms = new Set<net.Socket>();
  upstream.on('upgrade', (_req, socket: net.Socket) => {
    rooms.add(socket); socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n');
    socket.on('data', data => socket.write(data)); socket.on('end', () => socket.end()); socket.on('error', () => {});
  });
  await new Promise<void>(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const primary = new Primary({ port: 0, roomWorkers: 0, basePort: 0, log: () => {}, ...limits });
  const internals = primary as unknown as { children: Map<string, unknown>; byProcessId: Map<string, unknown>; ready: boolean };
  const control = { role: 'control', index: 0, port: (upstream.address() as AddressInfo).port, processId: 'control-process', topics: new Map(), started: Date.now(), proc: { connected: true, send: () => {} } };
  internals.children.set('control:0', control); internals.byProcessId.set('control-process', control); internals.ready = true;
  await primary.listen();
  const port = (primary.server!.address() as AddressInfo).port;
  const close = async () => { for (const socket of rooms) socket.destroy(); primary.server!.closeAllConnections(); upstream.closeAllConnections(); await Promise.all([new Promise(resolve => primary.server!.close(resolve)), new Promise(resolve => upstream.close(resolve))]); };
  return { primary, port, close };
}
function raw(port: number) {
  const socket = net.connect(port, '127.0.0.1'), seen = { text: '', closed: false };
  socket.on('data', data => { seen.text += data; }); socket.on('close', () => { seen.closed = true; }); socket.on('error', () => {});
  return { socket, seen };
}
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('the primary: its limits (19 October 2026)', () => {
  it('has the production limits: thirty seconds for a whole request, thirty for the process behind to answer', () => {
    expect(REQUEST_TIMEOUT_MS).toBe(30_000); expect(UPSTREAM_TIMEOUT_MS).toBe(30_000);
  });

  it('answers 504 itself when the process behind does not answer in time, frees that socket, and serves the next', async () => {
    let hung: http.IncomingMessage | undefined, freed = false;
    const p = await proxied((req, res) => { if (req.url === '/slow') { hung = req; req.on('close', () => { freed = true; }); return; } res.end('{"ok":true}'); });
    try {
      const began = Date.now(), answer = await fetch(`http://127.0.0.1:${p.port}/slow`);
      expect(answer.status).toBe(504);
      expect(await answer.json()).toEqual({ error: 'The server took too long to answer. Try again.' });
      expect(Date.now() - began).toBeLessThan(3000);
      expect(hung).toBeDefined(); await wait(50); expect(freed).toBe(true);
      expect((await fetch(`http://127.0.0.1:${p.port}/health`)).status).toBe(200);
    } finally { await p.close(); }
  });

  it('cuts off a request whose body never comes (408), and lets go of its socket to the process behind', async () => {
    let arrived = false, freed = false;
    const p = await proxied((req, res) => { arrived = true; req.on('close', () => { freed = true; }); req.resume(); req.on('end', () => res.end('{}')); }, { requestTimeoutMs: 300, upstreamTimeoutMs: 5000 });
    try {
      const slow = raw(p.port);
      slow.socket.write('POST /api/economy/hello HTTP/1.1\r\nHost: impact\r\nContent-Type: application/json\r\nContent-Length: 1000\r\n\r\n{"token":');
      await wait(150); expect(arrived).toBe(true); expect(slow.seen.closed).toBe(false);
      await wait(1000);
      expect(slow.seen.closed).toBe(true); expect(slow.seen.text).toMatch(/^HTTP\/1\.1 408/);
      expect(freed).toBe(true);
      expect((await fetch(`http://127.0.0.1:${p.port}/health`)).status).toBe(200);
    } finally { await p.close(); }
  });

  it('never times out a room\'s socket: upgraded, it is not a request any more', async () => {
    const p = await proxied((_req, res) => res.end('{}'));
    try {
      const room = raw(p.port);
      room.socket.write('GET /control-process/room-1?sessionId=a HTTP/1.1\r\nHost: impact\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n');
      await wait(100); expect(room.seen.text).toMatch(/^HTTP\/1\.1 101/);
      await wait(1500);
      room.seen.text = ''; room.socket.write('still here');
      await wait(100);
      expect(room.seen.closed).toBe(false); expect(room.seen.text).toBe('still here');
      room.socket.destroy();
    } finally { await p.close(); }
  });

  it('logs a stray error and keeps serving, counted by control; while starting, one still ends the process', () => {
    const { primary, links: [control] } = cluster(['control', 0]);
    const internals = primary as unknown as { stray(kind: string): (error: unknown) => void; serving: boolean };
    const exit = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => { throw new Error(`exit ${code}`); }) as never), error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const counted: unknown[] = [];
      control.handle('ops.serverError', event => { counted.push(event); });
      expect(() => internals.stray('uncaught exception')(new Error('while starting'))).toThrow('exit 1');
      exit.mockClear(); internals.serving = true;
      internals.stray('uncaught exception')(new Error('planted stray'));
      internals.stray('unhandled rejection')('a reason that is not an Error');
      expect(exit).not.toHaveBeenCalled();
      expect(error.mock.calls.some(call => String(call[0]).includes('still serving'))).toBe(true);
      expect(counted).toEqual([]);
      control.hello('control', 0, 'control-process', 0);
      return wait(20).then(() => {
        expect(counted).toMatchObject([{ kind: 'primary uncaught exception', message: 'Error: planted stray' }, { kind: 'primary unhandled rejection', message: 'a reason that is not an Error' }]);
        internals.stray('uncaught exception')(new Error('once control is up'));
        return wait(20);
      }).then(() => { expect(counted).toHaveLength(3); expect(exit).not.toHaveBeenCalled(); });
    } finally { exit.mockRestore(); error.mockRestore(); }
  });
});

describe('the primary\'s own stray errors, in a real cluster (19 October 2026)', () => {
  const ROOT = fileURLToPath(new URL('..', import.meta.url));
  const free = (port: number) => new Promise<boolean>(resolve => { const probe = net.createServer().once('error', () => resolve(false)).listen(port, '0.0.0.0', () => probe.close(() => resolve(true))); });
  async function spare() {
    for (let port = 2641; port <= 2649; port++) if (await free(port) && await free(port + 20) && await free(port + 21)) return port;
    throw new Error('No spare ports in 2641-2649');
  }
  async function until(check: () => boolean | Promise<boolean>, label: string, ms = 90_000) {
    const end = Date.now() + ms;
    while (!(await check())) { if (Date.now() > end) throw new Error(`Timed out: ${label}`); await wait(200); }
  }
  function start(port: number, data: string) {
    const child = spawn(process.execPath, ['--import', 'tsx', 'tests/fixtures/strayPrimary.ts'], { cwd: ROOT, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: String(port), ROOM_WORKERS: '1', CLUSTER_BASE_PORT: String(port + 20), DATA_DIR: data, NET_LOG_SECONDS: '0' } });
    const log = { out: '', exit: undefined as number | null | undefined };
    child.stdout!.on('data', chunk => { log.out += chunk; }); child.stderr!.on('data', chunk => { log.out += chunk; });
    child.on('exit', code => { log.exit = code; });
    return { child, log, end: () => { try { process.kill(-child.pid!, 'SIGKILL'); } catch { } } };
  }
  const health = (port: number) => fetch(`http://127.0.0.1:${port}/health`).then(res => res.ok ? res.json() as Promise<{ cluster?: { up: number }; errors: { server: { lastHour: number } } }> : undefined, () => undefined);
  const data = mkdtempSync(path.join(tmpdir(), 'impact-stray-primary-'));
  afterAll(() => rmSync(data, { recursive: true, force: true }));

  it('logs it, keeps serving, and control counts it; SIGTERM still stops every process', async () => {
    const port = await spare(), server = start(port, data);
    try {
      await until(async () => server.log.exit !== undefined || (await health(port))?.cluster?.up === 1, 'the cluster up');
      expect(server.log.exit, server.log.out).toBeUndefined();
      const before = (await health(port))!.errors.server.lastHour;
      process.kill(server.child.pid!, 'SIGUSR2');
      await until(() => /unhandled rejection in the primary; still serving/.test(server.log.out) && /uncaught exception in the primary; still serving/.test(server.log.out), 'both logged', 10_000);
      await wait(500);
      expect(server.log.exit, server.log.out).toBeUndefined();
      const after = await health(port);
      expect(after?.cluster?.up).toBe(1);
      expect(after!.errors.server.lastHour).toBe(before + 2);
      process.kill(server.child.pid!, 'SIGTERM');
      await until(() => server.log.exit !== undefined, 'stopped', 30_000);
      expect(server.log.exit, server.log.out).toBe(0);
    } finally { server.end(); }
  }, 150_000);

  it('still ends the process (code 1) when it cannot open its port while starting', async () => {
    const port = await spare(), holder = net.createServer();
    await new Promise<void>(resolve => holder.listen(port, '0.0.0.0', resolve));
    const server = start(port, data);
    try {
      await until(() => server.log.exit !== undefined, 'the primary ends', 60_000);
      expect(server.log.exit, server.log.out).toBe(1);
      expect(server.log.out).toMatch(/uncaught exception while starting: Error: listen EADDRINUSE/);
    } finally { server.end(); holder.close(); }
  }, 90_000);
});
