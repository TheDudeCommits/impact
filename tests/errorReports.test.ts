import { EventEmitter } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BODY_MAX, MESSAGE_MAX, STACK_FRAMES, STACK_MAX, browserOf, cleanReport, firstFrame, scrub, signatureOf } from '../src/game/errorReport';
import { ADDRESS_WINDOW, ClientErrors, GROUPS, KEEP_DAYS, PER_ADDRESS, PER_HOUR, mountErrorReports } from '../src/server/ops/errorReports';
import { ServerErrors, Tally, errorCounts, recordServerError, serverErrors } from '../src/server/ops/errorCounts';
import { healthReport } from '../src/server/health';
import { RoomFaults } from '../src/server/RoomFaults';

const clock = (start = Date.UTC(2026, 9, 18, 12)) => { let at = start; const now = () => at; now.pass = (ms: number) => { at += ms; }; return now; };
const report = (over: Record<string, unknown> = {}) => ({ kind: 'error', message: 'TypeError: Cannot read properties of undefined (reading \'x\')', build: '0123456789ab', path: '/', screen: 'home', browser: 'Chrome 141 / Android', tab: 'abc123def0',
  stack: 'TypeError: Cannot read properties of undefined (reading \'x\')\n    at loadStage (https://impact.dude.work/assets/index-D3fK2aB1.js:1:23456)\n    at https://impact.dude.work/assets/index-D3fK2aB1.js:1:999', ...over });
const temp = () => mkdtempSync(join(tmpdir(), 'error-reports-'));
const hex32 = 'f0e1d2c3b4a5'.repeat(3).slice(0, 32), jwt = ['eyJ' + 'hbGciOiJFUzI1NiJ9', 'eyJ' + 'zdWIiOiJkaWQ6cHJpdnk6YWJjIn0', 'c2lnbmF0dXJlLWhlcmU'].join('.');
const home = ['', 'Users', 'someone', 'game', 'main.ts'].join('/');

describe('error reports: what one may hold', () => {
  it('takes out query strings, tokens, addresses, ids and long runs of hex or base64, and keeps the words and the frames', () => {
    expect(scrub('GET https://impact.dude.work/?invite=123456&name=Bob failed')).toBe('GET https://impact.dude.work/ failed');
    expect(scrub('fetch for "/assets/fighters/goku.glb?v=4f2a&t=9" responded with 404')).toBe('fetch for "/assets/fighters/goku.glb" responded with 404');
    expect(scrub('at x (https://impact.dude.work/assets/a.js?v=1:10:5)')).toBe('at x (https://impact.dude.work/assets/a.js:10:5)');
    expect(scrub(`the account ${hex32} is not known`)).toBe('the account <hex> is not known');
    expect(scrub(`session s_${'Ab9_-'.repeat(7)} expired`)).toBe('session <token> expired');
    expect(scrub(`Authorization: Bearer ${hex32}`)).toBe('Authorization: Bearer <token>');
    expect(scrub(`identity ${jwt} refused`)).toBe('identity <token> refused');
    expect(scrub('mail player.one+x@example.co.uk now')).toBe('mail <email> now');
    expect(scrub('login did:privy:cm1abcdefghijklmnopqrstu gone')).toBe('login <id> gone');
    expect(scrub('room 3f2a9c1e-1b2c-4d5e-8f90-a1b2c3d4e5f6')).toBe('room <id>');
    expect(scrub(`key ${'QmFzZTY0IGlzIG5vdCBhIHNlY3JldA'}==`)).toBe('key <data>');
    expect(scrub('from 203.0.113.42 at 2001:0db8:0000:0000:0000:ff00:0042:8329')).toBe('from <ip> at <ip>');
    expect(scrub(`at file://${home}:3:4`)).toBe('at file:///Users/<user>/game/main.ts:3:4');
    expect(scrub('could not join rift-482913 or duel-123456')).toBe('could not join rift-<code> or duel-<code>');
    expect(scrub('image data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB is bad')).toBe('image data:<data> is bad');
    const frame = 'at loadStage (https://impact.dude.work/assets/index-D3fK2aB1.js:1:23456)';
    expect(scrub(frame)).toBe(frame);
    expect(scrub('fetch for "/assets/fighters/kaiju-no-8-monster-form-v2.glb" responded with 404')).toContain('kaiju-no-8-monster-form-v2.glb');
    expect(scrub('What? #app is gone')).toBe('What? #app is gone');
    expect(scrub('Nobody named NarutoFan99 here', ['narutofan99'])).toBe('Nobody named <name> here');
    expect(scrub('a Fighter', ['Fighter', 'ab'])).toBe('a Fighter');
    expect(scrub(`Hex said ${hex32}`, ['hex'])).toBe('<name> said <hex>');
  });

  it('keeps only the fields a report has, each to what it may hold', () => {
    expect(cleanReport(undefined)).toBeUndefined(); expect(cleanReport([])).toBeUndefined(); expect(cleanReport('x')).toBeUndefined();
    expect(cleanReport(report({ kind: 'telemetry' }))).toBeUndefined();
    expect(cleanReport(report({ message: '   ' }))).toBeUndefined();
    const clean = cleanReport({ ...report(), ip: '203.0.113.42', name: 'Bob', token: hex32, userAgent: 'Mozilla/5.0 (X11; Linux x86_64)', account: 'pk' })!;
    expect(Object.keys(clean).sort()).toEqual(['browser', 'build', 'kind', 'message', 'path', 'screen', 'stack', 'tab']);
    const long = cleanReport(report({ message: 'x'.repeat(5000), stack: Array.from({ length: 40 }, (_, i) => `    at f${i} (https://impact.dude.work/assets/index-D3fK2aB1.js:1:${i})`).join('\n') }))!;
    expect(long.message.length).toBe(MESSAGE_MAX); expect(long.message.endsWith('…')).toBe(true);
    expect(long.stack!.split('\n')).toHaveLength(STACK_FRAMES); expect(long.stack!.length).toBeLessThanOrEqual(STACK_MAX);
    const odd = cleanReport(report({ build: 'not-a-build', path: '/index.html?invite=482913#x', screen: 'a screen; drop table', browser: 'Mozilla/5.0 (Windows NT 10.0)', tab: 'ABC' }))!;
    expect(odd).toMatchObject({ build: 'unknown', path: '/index.html' }); expect(odd.screen).toBeUndefined(); expect(odd.browser).toBeUndefined(); expect(odd.tab).toBeUndefined();
    expect(cleanReport(report({ build: 'development', path: 'https://evil.example/' }))).toMatchObject({ build: 'development', path: '/' });
    expect(BODY_MAX).toBe(8192);
  });

  it('names the browser by family, major version and system, never by its user agent', () => {
    expect(browserOf('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7390.54 Mobile Safari/537.36')).toBe('Chrome 141 / Android');
    expect(browserOf('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1')).toBe('Safari 18 / iOS');
    expect(browserOf('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.0.0 Mobile/15E148 Safari/604.1')).toBe('Chrome 141 / iOS');
    expect(browserOf('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0')).toBe('Edge 141 / Windows');
    expect(browserOf('Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:144.0) Gecko/20100101 Firefox/144.0')).toBe('Firefox 144 / macOS');
    expect(browserOf('Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36')).toBe('Samsung Internet 28 / Android');
    expect(browserOf('curl/8.7.1')).toBe('other');
    for (const agent of ['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7390.54 Mobile Safari/537.36', 'Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/144.0'])
      expect(cleanReport(report({ browser: browserOf(agent) }))!.browser).toBe(browserOf(agent));
  });

  it('groups one bug as one, across numbers and builds, and two bugs as two', () => {
    const a = signatureOf(cleanReport(report({ message: 'RangeError: index 12 out of 40' }))!);
    const b = signatureOf(cleanReport(report({ message: 'RangeError: index 7 out of 41', stack: report().stack.replace(/D3fK2aB1/g, 'Zz9_Yy8x').replace(':23456', ':777') }))!);
    expect(a.id).toBe(b.id); expect(a.id).toMatch(/^[0-9a-f]{8}$/);
    expect(a.frame).toBe('loadStage (/assets/index.js)');
    expect(signatureOf(cleanReport(report({ kind: 'rejection' }))!).id).not.toBe(signatureOf(cleanReport(report())!).id);
    expect(signatureOf(cleanReport(report({ stack: report().stack.replace('loadStage', 'showStage') }))!).id).not.toBe(signatureOf(cleanReport(report())!).id);
    expect(firstFrame('loadStage@https://impact.dude.work/assets/index-D3fK2aB1.js:1:23456')).toBe('loadStage@/assets/index.js');
    expect(firstFrame('TypeError: x\nno frames here')).toBe('');
  });
});

describe('error reports: the server', () => {
  const quiet = () => { const lines: string[] = []; return { lines, log: (line: string) => { lines.push(line); } }; };
  afterEach(() => { vi.restoreAllMocks(); });

  it('limits one address and everyone, in memory, and answers either way', () => {
    const now = clock(), { log } = quiet(), store = new ClientErrors({ now, log });
    for (let i = 0; i < PER_ADDRESS; i++) expect(store.take(report({ message: `Error: number ${i} ${'x'.repeat(i)}` }), '198.51.100.7')).toBe('kept');
    expect(store.take(report(), '198.51.100.7')).toBe('address');
    expect(store.take(report(), '198.51.100.8')).toBe('kept');
    now.pass(ADDRESS_WINDOW + 1);
    expect(store.take(report(), '198.51.100.7')).toBe('kept');
    expect(store.take({ kind: 'nope' }, '198.51.100.9')).toBe('invalid');
    const capped = new ClientErrors({ now, log });
    let kept = 0;
    for (let i = 0; i < PER_HOUR + 50; i++) if (capped.take(report(), `10.0.${i >> 8}.${i & 255}`) === 'kept') kept++;
    expect(kept).toBe(PER_HOUR);
    expect(capped.take(report(), '10.9.9.9')).toBe('cap');
    now.pass(3_600_001);
    expect(capped.take(report(), '10.9.9.9')).toBe('kept');
  });

  it('groups reports by signature, logs a group once and the repeats once a minute', () => {
    const now = clock(), { lines, log } = quiet(), store = new ClientErrors({ now, log });
    store.take(report(), 'a'); store.take(report({ build: 'fedcba987654', browser: 'Safari 18 / iOS', message: 'TypeError: Cannot read properties of undefined (reading \'x\')' }), 'b');
    store.take(report({ kind: 'webgl', message: 'the graphics context was lost while the game was on screen', stack: undefined, screen: 'match' }), 'c');
    expect(store.groups.size).toBe(2);
    const [first] = store.groups.values();
    expect(first).toMatchObject({ kind: 'error', count: 2, builds: { '0123456789ab': 1, fedcba987654: 1 }, browsers: { 'Chrome 141 / Android': 1, 'Safari 18 / iOS': 1 }, screens: { home: 2 }, paths: { '/': 2 } });
    expect(lines.filter(line => line.includes('new error'))).toHaveLength(1);
    expect(lines.filter(line => line.includes('new webgl'))).toHaveLength(1);
    expect(lines.every(line => line.startsWith('[client-error] '))).toBe(true);
    const summary = store.summarise()!;
    expect(summary).toMatch(/last minute: 1 repeat\(s\) \([0-9a-f]{8} x1\)/);
    expect(store.summarise()).toBeUndefined();
    now.pass(60_000);
    for (let i = 0; i < 15; i++) store.take(report({ kind: 'caught', message: `caught ${'y'.repeat(i)} once`, stack: `    at f${'q'.repeat(i)} (https://impact.dude.work/a.js:1:1)` }), `addr${i}`);
    expect(lines.filter(line => line.includes('new caught'))).toHaveLength(10);
    expect(store.summarise()).toMatch(/5 new group\(s\) not logged/);
    const many = new ClientErrors({ now, log: () => {} });
    for (let i = 0; i <= GROUPS; i++) { many.take(report({ message: `Error: kind ${'z'.repeat(i % 50)} ${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26) % 26)}` }), `x${i}`); if (i % 19 === 0) now.pass(ADDRESS_WINDOW); }
    expect(many.groups.size).toBe(GROUPS);
  });

  it('keeps each report as a line beside the book, never with its address; rotates the file and forgets what is 30 days old', () => {
    const dir = temp();
    try {
      const now = clock(), t0 = now(), store = new ClientErrors({ dir, now, log: () => {}, fileMax: 4000 });
      const file = join(dir, 'ops', 'client-errors.jsonl'), old = join(dir, 'ops', 'client-errors.1.jsonl');
      store.take(report(), '203.0.113.42');
      const line = JSON.parse(readFileSync(file, 'utf8').trim());
      expect(line).toMatchObject({ kind: 'error', build: '0123456789ab', path: '/', id: expect.stringMatching(/^[0-9a-f]{8}$/), at: new Date(now()).toISOString() });
      expect(readFileSync(file, 'utf8')).not.toContain('203.0.113.42');
      for (let i = 0; i < 12; i++) { store.take(report({ message: `Error: line ${i}` }), `198.51.100.${i}`); now.pass(1000); }
      expect(existsSync(old)).toBe(true);
      expect(readFileSync(file, 'utf8').length).toBeLessThanOrEqual(4000);
      const total = (store: ClientErrors) => [...store.groups.values()].reduce((n, group) => n + group.count, 0);
      const lines = () => [old, file].flatMap(each => readFileSync(each, 'utf8').split('\n').filter(Boolean)).length;
      const restarted = new ClientErrors({ dir, now: clock(t0 + 60_000), log: () => {}, fileMax: 4000 });
      expect(total(restarted)).toBe(lines()); expect(restarted.counts(t0 + 60_000).lastHour).toBe(lines());
      const later = t0 + KEEP_DAYS * 86_400_000 - 60_000;
      writeFileSync(old, `${JSON.stringify({ ...line, at: new Date(t0 - 120_000).toISOString(), message: 'Error: ancient' })}\n${readFileSync(old, 'utf8')}{"torn`);
      const back = new ClientErrors({ dir, now: clock(later), log: () => {}, fileMax: 4000 });
      expect(readFileSync(old, 'utf8')).not.toContain('ancient'); expect(readFileSync(old, 'utf8')).not.toContain('{"torn');
      expect([...back.groups.values()].some(group => group.message === 'Error: ancient')).toBe(false);
      expect(total(back)).toBe(lines()); expect(back.counts(later).lastDay).toBe(0);
      const running = clock(later), kept = new ClientErrors({ dir, now: running, log: () => {}, fileMax: 4000 });
      running.pass(2 * 60_000); kept.prune();
      expect(lines()).toBe(0); expect(kept.groups.size).toBe(0);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('keeps reports in memory where the volume cannot be written', () => {
    const dir = temp();
    try {
      mkdirSync(join(dir, 'ops')); writeFileSync(join(dir, 'ops', 'client-errors.jsonl'), '');
      const blocked = join(dir, 'ops', 'client-errors.jsonl', 'nested');
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const store = new ClientErrors({ dir: blocked, log: () => {} });
      expect(store.file).toBeUndefined(); expect(store.take(report(), 'a')).toBe('kept'); expect(store.groups.size).toBe(1);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('answers POST /errors at once, lets only the game in, and opens GET /errors only to the admin token', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const handlers = new Map<string, (req: unknown, res: unknown) => void>();
    const store = mountErrorReports({ post: (path, handler) => handlers.set(`POST ${path}`, handler as never), get: (path, handler) => handlers.set(`GET ${path}`, handler as never) }, { adminToken: 'owner', origins: [], now: clock(), log: () => {} });
    const call = (method: 'GET' | 'POST', body: string | undefined, headers: Record<string, string> = {}, url = '/errors') => new Promise<{ status: number; headers: Record<string, string>; body?: string }>(resolve => {
      const req = Object.assign(new EventEmitter(), { method, url, headers });
      const out: Record<string, string> = { 'access-control-allow-origin': headers.origin ?? '*', 'access-control-allow-credentials': 'true' };
      const res = { statusCode: 0, setHeader: (k: string, v: string) => { out[k.toLowerCase()] = v; }, removeHeader: (k: string) => { delete out[k.toLowerCase()]; }, end: (text?: string) => resolve({ status: res.statusCode, headers: out, body: text }) };
      handlers.get(`${method} /errors`)!(req, res);
      if (body !== undefined) queueMicrotask(() => { req.emit('data', Buffer.from(body)); req.emit('end'); });
    });
    const sent = await call('POST', JSON.stringify(report()), { origin: 'https://impact.dude.work', 'x-forwarded-for': '203.0.113.42, 10.0.0.1' });
    expect(sent.status).toBe(204); expect(sent.headers['access-control-allow-origin']).toBe('https://impact.dude.work'); expect(sent.headers['access-control-allow-credentials']).toBeUndefined();
    expect(store.groups.size).toBe(1);
    const foreign = await call('POST', JSON.stringify(report({ message: 'Error: from elsewhere' })), { origin: 'https://evil.example' });
    expect(foreign.status).toBe(204); expect(foreign.headers['access-control-allow-origin']).toBeUndefined(); expect(store.groups.size).toBe(1);
    expect((await call('POST', '{"kind":', {})).status).toBe(400);
    expect((await call('POST', JSON.stringify({ kind: 'error' }), {})).status).toBe(400);
    expect((await call('POST', JSON.stringify(report({ message: 'x'.repeat(BODY_MAX) })), {})).status).toBe(413);
    for (let i = 0; i < PER_ADDRESS + 3; i++) expect((await call('POST', JSON.stringify(report()), { 'x-forwarded-for': '198.51.100.1' })).status).toBe(204);
    expect((await call('GET', undefined)).status).toBe(401);
    expect((await call('GET', undefined, { authorization: 'Bearer nope' })).status).toBe(401);
    expect((await call('GET', undefined, { authorization: 'owner' })).status).toBe(401);
    const view = await call('GET', undefined, { authorization: 'Bearer owner', origin: 'https://evil.example' }, '/errors?limit=5&kind=error');
    expect(view.status).toBe(200); expect(view.headers['access-control-allow-origin']).toBeUndefined();
    const body = JSON.parse(view.body!);
    expect(body.groups).toHaveLength(1); expect(body.groups[0]).toMatchObject({ kind: 'error', count: 1 + PER_ADDRESS });
    expect(body.counts.client.lastHour).toBe(1 + PER_ADDRESS); expect(JSON.stringify(body)).not.toContain('203.0.113.42'); expect(JSON.stringify(body)).not.toContain('198.51.100.1');
    const closed = new Map<string, (req: unknown, res: unknown) => void>();
    mountErrorReports({ post: () => {}, get: (path, handler) => closed.set(path, handler as never) }, { log: () => {} });
    const res = { statusCode: 0, setHeader: () => {}, end: () => {} };
    closed.get('/errors')!({ headers: { authorization: 'Bearer undefined' }, on: () => {} }, res);
    expect(res.statusCode).toBe(401);
  });
});

describe('error reports: the counts on /health', () => {
  it('counts the server\'s own errors by the minute, a flood in fixed memory, and sends them where the sink says', () => {
    const tally = new Tally(), t0 = Date.UTC(2026, 9, 18, 12);
    tally.add(t0 - 2 * 3_600_000); tally.add(t0 - 30 * 60_000, 3); tally.add(t0, 2); tally.add(t0 - 2 * 86_400_000, 50);
    expect(tally.since(t0, 60)).toBe(5); expect(tally.since(t0, 1440)).toBe(6);
    const now = clock(t0), errors = new ServerErrors(now);
    errors.record('uncaught exception', new TypeError(`no such room ${hex32}`));
    errors.record('room step', 'a string');
    expect(errors.counts()).toEqual({ lastHour: 2, lastDay: 2 });
    expect(errors.recent[0]).toEqual({ at: t0, kind: 'uncaught exception', message: 'TypeError: no such room <hex>' });
    now.pass(61 * 60_000);
    expect(errors.counts()).toEqual({ lastHour: 0, lastDay: 2 });
    for (let i = 0; i < 30; i++) errors.record('room step', new Error(`tick ${i}`));
    expect(errors.recent).toHaveLength(ServerErrors.RECENT);
    const parent = new ServerErrors(now), worker = new ServerErrors(now);
    worker.sink = event => parent.take(JSON.parse(JSON.stringify(event)));
    worker.record('room handler', new Error('boom'));
    expect(worker.counts().lastHour).toBe(0); expect(parent.counts().lastHour).toBe(1);
    worker.sink = () => { throw new Error('the pipe is gone'); };
    expect(() => worker.record('room handler', new Error('boom'))).not.toThrow();
  });

  it('puts counts, never messages, on /health, and counts a room\'s contained fault once', () => {
    const before = errorCounts().server.lastHour;
    recordServerError('unhandled rejection', new Error(`secret ${hex32}`));
    const room = { roomName: 'arena', roomId: 'r1', clients: [], disconnect: async () => {} };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const faults = new RoomFaults(room as never);
    for (let i = 0; i < 5; i++) faults.fault(new Error('step'), 1000 + i * 33);
    faults.report(Object.assign(new Error('handler'), { cause: new Error('handler') }) as never, 'onMessage' as never);
    expect(errorCounts().server.lastHour).toBe(before + 3);
    const health = JSON.parse(JSON.stringify(healthReport('test')));
    expect(Object.keys(health.errors)).toEqual(['client', 'server']);
    expect(health.errors.client).toEqual({ lastHour: expect.any(Number), lastDay: expect.any(Number), groupsLastDay: expect.any(Number) });
    expect(health.errors.server).toEqual({ lastHour: before + 3, lastDay: expect.any(Number) });
    expect(JSON.stringify(health.errors)).not.toMatch(/secret|step|handler/);
    expect(serverErrors.recent.at(-1)!.kind).toBe('room handler');
    vi.restoreAllMocks();
  });

  it('is wired where the server meets its errors: the stray handler, the rooms, the HTTP app', () => {
    const index = readFileSync('src/server/index.ts', 'utf8');
    expect(index).toContain('recordServerError(kind, error)');
    expect(index).toMatch(/mountErrorReports\(app as never, \{ dir: .*DATA_DIR.*\/economy.*adminToken: process\.env\.ECONOMY_ADMIN_TOKEN \}\)/);
    expect(readFileSync('src/server/RoomFaults.ts', 'utf8').match(/recordServerError\(/g)).toHaveLength(3);
  });
});
