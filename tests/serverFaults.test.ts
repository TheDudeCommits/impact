import { ROSTER_PROTOCOL } from '../src/game/rosterProtocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, type Room } from '@colyseus/sdk';
import { FAULT_CLOSE_CODE, FAULT_MESSAGE } from '../src/server/RoomFaults';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until(check: () => boolean | Promise<boolean>, label: string, ms = 60_000) {
  const end = Date.now() + ms;
  while (!(await check())) { if (Date.now() > end) throw new Error(`Timed out: ${label}`); await sleep(100); }
}
async function sparePort() {
  for (let port = 2611; port <= 2619; port++) {
    const free = await new Promise<boolean>(resolve => { const probe = createServer().once('error', () => resolve(false)).listen(port, '0.0.0.0', () => probe.close(() => resolve(true))); });
    if (free) return port;
  }
  throw new Error('No spare port in 2611-2619');
}
function start(port: number, data: string) {
  const child = spawn(process.execPath, ['--import', 'tsx', 'tests/fixtures/faultServer.ts'], { cwd: ROOT, env: { ...process.env, PORT: String(port), DATA_DIR: data }, stdio: ['ignore', 'pipe', 'pipe'] });
  const log = { out: '', exit: undefined as number | null | undefined };
  child.stdout!.on('data', chunk => { log.out += chunk; }); child.stderr!.on('data', chunk => { log.out += chunk; });
  child.on('exit', code => { log.exit = code; });
  return { child, log };
}
const healthy = (port: number) => fetch(`http://127.0.0.1:${port}/health`).then(res => res.ok, () => false);

describe('the match server, when a room throws', () => {
  let port = 0, data = '', server: ReturnType<typeof start> | undefined;
  const rooms: Room[] = [];
  beforeAll(async () => {
    port = await sparePort(); data = mkdtempSync(join(tmpdir(), 'jump-faults-'));
    server = start(port, data);
    await until(() => server!.log.exit !== undefined || healthy(port), 'the server up');
    expect(server.log.exit, server.log.out).toBeUndefined();
  }, 120_000);
  afterAll(async () => {
    if (server && server.log.exit === undefined) { server.child.kill('SIGKILL'); await until(() => server!.log.exit !== undefined, 'the server gone', 10_000).catch(() => {}); }
    for (const room of rooms) room.removeAllListeners();
    rmSync(data, { recursive: true, force: true });
  }, 30_000);

  it('closes only that room, logs every fault, and keeps serving everyone else', async () => {
    const client = new Client(`http://127.0.0.1:${port}`);
    const join = async (name: string) => { const room = await client.joinOrCreate('arena', { rosterProtocol: ROSTER_PROTOCOL, mode: 'training', fighter: 'goku', name }); rooms.push(room); room.reconnection.enabled = false; room.onMessage('*', () => {}); return room; };
    const ok = await join('Healthy');
    let snapshots = 0; ok.onMessage('snapshot', () => { snapshots++; });
    const faulty = await join('Tick Fault');
    let error = '', left: number | undefined; faulty.onError((_code, message) => { error = message ?? ''; }); faulty.onLeave(code => { left = code; });
    await until(() => left !== undefined, 'the faulty room closed', 30_000);
    expect(left).toBe(FAULT_CLOSE_CODE); expect(error).toBe(FAULT_MESSAGE);
    for (const command of ['handler-fault', 'stray-exception', 'stray-rejection']) ok.send('training', command);
    await until(() => ['planted handler fault', 'planted stray exception', 'planted stray rejection'].every(text => server!.log.out.includes(text)), 'the faults logged', 20_000);
    const before = snapshots; await sleep(1500);
    expect(snapshots - before, server!.log.out).toBeGreaterThan(15);
    expect(server!.log.exit).toBeUndefined(); expect(await healthy(port)).toBe(true);
    expect(server!.log.out).toMatch(/step failed; the room keeps running[\s\S]*planted tick fault/);
    expect(server!.log.out).toMatch(/closed: its step kept failing/);
    expect(server!.log.out).toMatch(/onMessage 'training' threw; contained[\s\S]*planted handler fault/);
    expect(server!.log.out).toMatch(/uncaught exception; still serving[\s\S]*planted stray exception/);
    expect(server!.log.out).toMatch(/unhandled rejection; still serving[\s\S]*planted stray rejection/);
    const fresh = await join('Newcomer');
    let seen = 0; fresh.onMessage('snapshot', () => { seen++; });
    await until(() => seen > 5, 'snapshots in a new room', 20_000);
  }, 120_000);

  it('still exits when it cannot start: a second server on the same port', async () => {
    const scratch = mkdtempSync(join(tmpdir(), 'jump-faults-')), second = start(port, scratch);
    try {
      await until(() => second.log.exit !== undefined, 'the second server to exit', 90_000);
      expect(second.log.exit, second.log.out).toBe(1);
      expect(second.log.out).toMatch(/could not listen[\s\S]*EADDRINUSE/);
      expect(server!.log.exit).toBeUndefined(); expect(await healthy(port)).toBe(true);
    } finally { if (second.log.exit === undefined) second.child.kill('SIGKILL'); rmSync(scratch, { recursive: true, force: true }); }
  }, 120_000);

  it('still shuts down gracefully on SIGTERM, writing the economy\'s book on the way out', async () => {
    const hello = await fetch(`http://127.0.0.1:${port}/api/economy/hello`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).then(res => res.json()) as { account: { pk: string } };
    server!.child.kill('SIGTERM');
    await until(() => server!.log.exit !== undefined, 'the server to shut down', 30_000);
    expect(server!.log.exit, server!.log.out).toBe(0);
    const book = join(data, 'economy', 'accounts.json');
    expect(existsSync(book)).toBe(true);
    expect(readFileSync(book, 'utf8')).toContain(hello.account.pk);
  }, 60_000);
});
