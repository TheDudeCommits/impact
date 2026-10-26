import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { BODY_MAX, cleanReport, signatureOf, type ErrorReport, type ReportKind } from '../../game/errorReport';
import { allowedOrigin } from '../economy/api';
import { Tally, clientCounts, errorCounts, recordServerError, serverErrors } from './errorCounts';

export { errorCounts, recordServerError, serverErrors };

export const PER_ADDRESS = 20, ADDRESS_WINDOW = 10 * 60_000, PER_HOUR = 600;
export const GROUPS = 500, FILE_MAX = 5 * 1024 * 1024;
export const KEEP_DAYS = 30, PRUNE_EVERY = 6 * 3_600_000;
const NEW_PER_MINUTE = 10;
const SPREAD = 12;
const DAY = 86_400_000;

export interface ErrorReportsOptions {
  dir?: string;
  adminToken?: string;
  origins?: readonly string[];
  fileMax?: number;
  now?: () => number;
  log?: (line: string) => void;
}

export interface Group {
  id: string; kind: ReportKind;
  signature: string; frame: string;
  message: string; stack?: string;
  count: number; first: string; last: string;
  builds: Record<string, number>; browsers: Record<string, number>; screens: Record<string, number>; paths: Record<string, number>;
}
interface Line extends ErrorReport { at: string; id: string }

export type Verdict = 'kept' | 'invalid' | 'address' | 'cap';

const bump = (spread: Record<string, number>, key: string | undefined) => {
  if (!key) return;
  const at = key in spread || Object.keys(spread).length < SPREAD ? key : 'other';
  spread[at] = (spread[at] ?? 0) + 1;
};

export class ClientErrors {
  readonly groups = new Map<string, Group>();
  readonly file?: string;
  private readonly old?: string;
  private size = 0;
  private readonly tally = new Tally();
  private readonly addresses = new Map<string, number[]>();
  private readonly hour: number[] = [];
  private readonly now: () => number;
  private readonly log: (line: string) => void;
  private readonly repeats = new Map<string, number>();
  private unlogged = 0; private dropped = 0;
  private newLogged = 0; private minute = -1;
  private capNoted = -Infinity;
  private writeFailed = false;

  constructor(private readonly options: ErrorReportsOptions = {}) {
    this.now = options.now ?? Date.now;
    this.log = options.log ?? (line => console.log(line));
    if (!options.dir) return;
    const folder = path.join(options.dir, 'ops');
    try {
      fs.mkdirSync(folder, { recursive: true });
      this.file = path.join(folder, 'client-errors.jsonl'); this.old = path.join(folder, 'client-errors.1.jsonl');
      for (const file of [this.old, this.file]) for (const line of this.trimmed(file)) this.fold(line, false);
      this.size = fs.existsSync(this.file) ? fs.statSync(this.file).size : 0;
      const groups = this.groups.size, day = this.tally.since(this.now(), 1440);
      if (groups) this.log(`[client-error] ${groups} group(s) kept from the last ${KEEP_DAYS} days, ${day} report(s) in the last day (${this.file})`);
    } catch (error) {
      console.error(`[client-error] reports cannot be kept in ${folder}: memory only`, error);
      this.file = undefined; this.old = undefined;
    }
  }

  private trimmed(file: string): Line[] {
    if (!fs.existsSync(file)) return [];
    const cutoff = this.now() - KEEP_DAYS * DAY, raw = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
    const kept: Line[] = [];
    for (const text of raw) {
      try { const line = JSON.parse(text) as Line; if (Date.parse(line.at) >= cutoff && typeof line.kind === 'string' && typeof line.message === 'string') kept.push(line); }
      catch { }
    }
    if (kept.length !== raw.length) {
      const spare = `${file}.tmp`;
      fs.writeFileSync(spare, kept.map(line => `${JSON.stringify(line)}\n`).join(''));
      fs.renameSync(spare, file);
    }
    return kept;
  }

  take(raw: unknown, address: string): Verdict {
    const now = this.now();
    const recent = (this.addresses.get(address) ?? []).filter(at => at > now - ADDRESS_WINDOW);
    if (recent.length >= PER_ADDRESS) { this.addresses.set(address, recent); return 'address'; }
    this.addresses.set(address, [...recent, now]);
    if (this.addresses.size > 5000) for (const [key, times] of this.addresses) if (!times.some(at => at > now - ADDRESS_WINDOW)) this.addresses.delete(key);
    const report = cleanReport(raw);
    if (!report) return 'invalid';
    while (this.hour.length && this.hour[0] <= now - 3_600_000) this.hour.shift();
    if (this.hour.length >= PER_HOUR) {
      this.dropped++;
      if (now - this.capNoted > 3_600_000) { this.capNoted = now; this.log(`[client-error] ${PER_HOUR} reports kept this hour: the rest are dropped until it has passed (a summary a minute counts them)`); }
      return 'cap';
    }
    this.hour.push(now);
    const line: Line = { at: new Date(now).toISOString(), id: signatureOf(report).id, ...report };
    this.write(line);
    this.fold(line, true);
    return 'kept';
  }

  private fold(line: Line, live: boolean) {
    const at = Date.parse(line.at), signature = signatureOf(line), id = line.id || signature.id;
    this.tally.add(at);
    let group = this.groups.get(id);
    if (!group) {
      group = { id, kind: line.kind, signature: signature.message, frame: signature.frame, message: line.message, count: 0, first: line.at, last: line.at, builds: {}, browsers: {}, screens: {}, paths: {} };
      if (live) this.sighted(group, line);
    } else {
      this.groups.delete(id);
      if (live) this.repeats.set(id, (this.repeats.get(id) ?? 0) + 1);
    }
    group.count++; group.last = line.at; group.message = line.message;
    if (line.stack) group.stack = line.stack; else delete group.stack;
    bump(group.builds, line.build); bump(group.browsers, line.browser); bump(group.screens, line.screen); bump(group.paths, line.path);
    this.groups.set(id, group);
    if (this.groups.size > GROUPS) this.groups.delete(this.groups.keys().next().value!);
  }

  private sighted(group: Group, line: Line) {
    const minute = Math.floor(this.now() / 60_000);
    if (minute !== this.minute) { this.minute = minute; this.newLogged = 0; }
    if (this.newLogged++ >= NEW_PER_MINUTE) { this.unlogged++; return; }
    this.log(`[client-error] new ${group.kind} ${group.id}: ${JSON.stringify(line.message)}${group.frame ? ` at ${group.frame}` : ''} (build ${line.build}${line.browser ? `, ${line.browser}` : ''}${line.screen ? `, ${line.screen}` : ''})`);
  }

  summarise() {
    const repeats = [...this.repeats.entries()].sort((a, b) => b[1] - a[1]), total = repeats.reduce((sum, [, n]) => sum + n, 0);
    if (!total && !this.unlogged && !this.dropped) return undefined;
    const top = repeats.slice(0, 3).map(([id, n]) => `${id} x${n}`).join(', ');
    const line = `[client-error] last minute: ${total} repeat(s)${total ? ` (${top}${repeats.length > 3 ? `, ${repeats.length - 3} more group(s)` : ''})` : ''}`
      + `${this.unlogged ? `, ${this.unlogged} new group(s) not logged` : ''}${this.dropped ? `, ${this.dropped} dropped at the hourly cap` : ''}`;
    this.repeats.clear(); this.unlogged = 0; this.dropped = 0;
    this.log(line);
    return line;
  }

  private write(line: Line) {
    if (!this.file || !this.old) return;
    const text = `${JSON.stringify(line)}\n`, bytes = Buffer.byteLength(text);
    try {
      if (this.size + bytes > (this.options.fileMax ?? FILE_MAX) && this.size > 0) {
        fs.renameSync(this.file, this.old);
        this.trimmed(this.old);
        this.size = 0;
      }
      fs.appendFileSync(this.file, text);
      this.size += bytes;
      this.writeFailed = false;
    } catch (error) {
      if (!this.writeFailed) console.error(`[client-error] a report could not be written to ${this.file}; it is counted in memory`, error);
      this.writeFailed = true;
    }
  }

  prune() {
    const cutoff = this.now() - KEEP_DAYS * DAY;
    for (const [id, group] of this.groups) if (Date.parse(group.last) < cutoff) this.groups.delete(id);
    if (!this.file || !this.old) return;
    try { this.trimmed(this.old); this.trimmed(this.file); this.size = fs.existsSync(this.file) ? fs.statSync(this.file).size : 0; }
    catch (error) { console.error('[client-error] old reports could not be pruned; the next start tries again', error); }
  }

  counts(now = this.now()) {
    let groupsLastDay = 0;
    for (const group of this.groups.values()) if (Date.parse(group.last) > now - DAY) groupsLastDay++;
    return { lastHour: this.tally.since(now, 60), lastDay: this.tally.since(now, 1440), groupsLastDay };
  }

  view(limit = 100, kind?: string) {
    const groups = [...this.groups.values()].reverse().filter(group => !kind || group.kind === kind).slice(0, Math.max(1, Math.min(GROUPS, limit)));
    const now = this.now();
    return { now: new Date(now).toISOString(), kept: this.file ? 'volume' : 'memory', counts: { client: this.counts(now), server: serverErrors.counts(now) }, groups, server: { recent: [...serverErrors.recent].reverse().map(event => ({ ...event, at: new Date(event.at).toISOString() })) } };
  }
}

interface Req { method?: string; url?: string; headers: Record<string, string | string[] | undefined>; body?: unknown; socket?: { remoteAddress?: string }; on(event: string, listener: (chunk?: Buffer) => void): unknown }
interface Res { statusCode: number; setHeader(name: string, value: string): unknown; removeHeader?(name: string): unknown; end(body?: string): unknown }
interface App { post(path: string, handler: (req: Req, res: Res) => void): unknown; get(path: string, handler: (req: Req, res: Res) => void): unknown }

function bodyOf(req: Req): Promise<unknown | 'big' | 'bad'> {
  if (req.body !== undefined && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise(resolve => {
    const chunks: Buffer[] = []; let size = 0, done = false;
    const finish = (value: unknown) => { if (!done) { done = true; resolve(value); } };
    req.on('data', chunk => { if (!chunk || done) return; size += chunk.length; if (size > BODY_MAX) finish('big'); else chunks.push(chunk); });
    req.on('end', () => { try { finish(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : 'bad'); } catch { finish('bad'); } });
    req.on('error', () => finish('bad'));
  });
}

const tokenMatches = (header: unknown, token: string | undefined) => {
  if (!token || typeof header !== 'string') return false;
  const digest = (text: string) => crypto.createHash('sha256').update(text).digest();
  return crypto.timingSafeEqual(digest(header), digest(`Bearer ${token}`));
};

let shared: ClientErrors | undefined;
export const sharedErrorReports = () => shared;

export function mountErrorReports(app: App, options: ErrorReportsOptions = {}): ClientErrors {
  const store = shared = new ClientErrors(options);
  clientCounts.read = now => store.counts(now);
  const extra = options.origins ?? (process.env.ECONOMY_ORIGINS ?? '').split(',').map(each => each.trim()).filter(Boolean);
  const headers = (req: Req, res: Res) => {
    for (const header of ['Access-Control-Allow-Origin', 'Access-Control-Allow-Credentials']) res.removeHeader?.(header);
    res.setHeader('Vary', 'Origin'); res.setHeader('Cache-Control', 'no-store');
    const origin = String(req.headers.origin ?? '');
    if (origin && allowedOrigin(origin, extra)) res.setHeader('Access-Control-Allow-Origin', origin);
    return origin;
  };
  app.post('/errors', (req, res) => {
    const origin = headers(req, res);
    const address = String(req.headers['x-forwarded-for'] ?? req.socket?.remoteAddress ?? '').split(',')[0].trim();
    void bodyOf(req).then(body => {
      if (body === 'big') { res.statusCode = 413; res.end(); return; }
      if (body === 'bad') { res.statusCode = 400; res.end(); return; }
      const verdict = origin && !allowedOrigin(origin, extra) ? 'kept' : store.take(body, address);
      res.statusCode = verdict === 'invalid' ? 400 : 204; res.end();
    }).catch(() => { res.statusCode = 400; res.end(); });
  });
  app.get('/errors', (req, res) => {
    headers(req, res);
    res.setHeader('Content-Type', 'application/json');
    if (!tokenMatches(req.headers.authorization, options.adminToken)) { res.statusCode = 401; res.end(JSON.stringify({ error: 'Not allowed.' })); return; }
    const query = new URLSearchParams((req.url ?? '').split('?')[1] ?? '');
    res.statusCode = 200; res.end(JSON.stringify(store.view(Number(query.get('limit')) || 100, query.get('kind') ?? undefined)));
  });
  const timer = setInterval(() => store.summarise(), 60_000); timer.unref?.();
  const pruning = setInterval(() => store.prune(), PRUNE_EVERY); pruning.unref?.();
  console.log(`[client-error] reports on${store.file ? ` in ${store.file}` : ' (memory only)'}; GET /errors ${options.adminToken ? 'behind the admin token' : 'closed (no ECONOMY_ADMIN_TOKEN)'}`);
  return store;
}
