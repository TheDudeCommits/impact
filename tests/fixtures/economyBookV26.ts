import type { Completion } from '../../src/server/economy/completions';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { newAccount, type Account } from '../../src/game/economy/account';
import { nameKey } from '../../src/game/economy/names';

const LEDGER_TURNS_AT = 16 * 1024 * 1024;
const hash = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
export const isGuestToken = (t: unknown): t is string => typeof t === 'string' && /^[a-f0-9]{32}$/.test(t);
export const isSessionToken = (t: unknown): t is string => typeof t === 'string' && /^s_[A-Za-z0-9_-]{32}$/.test(t);

interface Line { seq: number; at: number; t: 'new' | 'earn' | 'buy' | 'wear' | 'grant' | 'link' | 'revoke' | 'merge' | 'order' | 'redeem' | 'name'; pk: string;
  after?: Account;
  order?: unknown; completion?: Completion;
  code?: string;
  item?: string; serial?: number; amount?: number; why?: string; token?: string; did?: string; into?: string }
interface Snapshot { seq: number; accounts: Account[]; tokens: Record<string, string>; dids: Record<string, string>; sold: Record<string, number>; orders?: unknown[]; completions?: Completion[] }

export class Book {
  readonly completions = new Map<string, Completion>();
  readonly accounts = new Map<string, Account>();
  readonly sold = new Map<string, number>();
  readonly legacyOrders = new Map<string, unknown>();
  private readonly tokens = new Map<string, string>();
  private readonly dids = new Map<string, string>();
  private readonly names = new Map<string, string>();
  private seq = 0;
  private dirty = false;
  private fd?: number;
  private writeFault = false;

  constructor(private readonly dir?: string) {
    if (!dir) return;
    fs.mkdirSync(dir, { recursive: true });
    this.load();
    this.fd = fs.openSync(path.join(dir, 'ledger.jsonl'), 'a');
    for (const account of this.accounts.values()) if (account.name) this.names.set(nameKey(account.name), account.pk);
  }

  private load() {
    const file = path.join(this.dir!, 'accounts.json');
    if (fs.existsSync(file)) {
      const snapshot = JSON.parse(fs.readFileSync(file, 'utf8')) as Snapshot;
      this.seq = snapshot.seq;
      for (const account of snapshot.accounts) this.accounts.set(account.pk, account);
      for (const [h, pk] of Object.entries(snapshot.tokens)) this.tokens.set(h, pk);
      for (const [did, pk] of Object.entries(snapshot.dids)) this.dids.set(did, pk);
      for (const [id, n] of Object.entries(snapshot.sold)) this.sold.set(id, n);
      for (const c of snapshot.completions ?? []) this.completions.set(`${c.matchId}:${c.pk}`, c);
      for (const order of snapshot.orders ?? []) this.keepLegacyOrder(order);
    }
    const ledger = path.join(this.dir!, 'ledger.jsonl');
    if (!fs.existsSync(ledger)) return;
    let source = fs.readFileSync(ledger, 'utf8');
    if (source && !source.endsWith('\n')) {
      const end = source.lastIndexOf('\n') + 1, tail = source.slice(end);
      let valid = false; try { JSON.parse(tail); valid = true; } catch { }
      const fd = fs.openSync(ledger, 'r+');
      try {
        if (valid) { fs.writeSync(fd, '\n', Buffer.byteLength(source)); source += '\n'; }
        else { source = source.slice(0,end); fs.ftruncateSync(fd, Buffer.byteLength(source)); }
        fs.fsyncSync(fd);
      } finally { fs.closeSync(fd); }
    }
    let replayed = 0;
    for (const raw of source.split('\n')) {
      if (!raw) continue;
      let line: Line;
      try { line = JSON.parse(raw) as Line; } catch { throw new Error('The economy ledger contains a corrupt complete record. Repair storage before starting.'); }
      if (line.seq <= this.seq) continue;
      this.seq = line.seq; replayed++;
      if (line.t === 'revoke') { if (line.token) this.tokens.delete(line.token); continue; }
      if (line.t === 'order') { this.keepLegacyOrder(line.order); continue; }
      if (line.completion) this.completions.set(`${line.completion.matchId}:${line.completion.pk}`,line.completion);
      if (line.t === 'merge') { if(line.into)this.moveCompletions(line.pk,line.into); if (line.into) for (const [h, pk] of this.tokens) if (pk === line.pk) this.tokens.set(h, line.into); this.accounts.delete(line.pk); continue; }
      this.accounts.set(line.pk, line.after ?? this.accounts.get(line.pk) ?? newAccount(line.pk, line.at));
      if (line.token) this.tokens.set(line.token, line.pk);
      if (line.did) this.dids.set(line.did, line.pk);
      if (line.item && line.serial) this.sold.set(line.item, Math.max(this.sold.get(line.item) ?? 0, line.serial));
    }
    if (replayed) { this.dirty = true; console.log(`[economy] replayed ${replayed} ledger line(s) past the last book`); }
    if (fs.statSync(ledger).size > LEDGER_TURNS_AT) { this.dirty = true; this.save(); fs.renameSync(ledger, path.join(this.dir!, `ledger-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`)); }
  }

  record(t: Exclude<Line['t'], 'order'>, account: Account, detail: Partial<Line> = {}) {
    if (this.writeFault) throw new Error('The economy ledger is unavailable. Restart after repairing storage.');
    this.dirty = true;
    const line: Line = { seq: ++this.seq, at: Date.now(), t, pk: account.pk, ...(t === 'merge' || t === 'revoke' ? {} : { after: account }), ...detail };
    if (this.fd === undefined) return;
    const before = fs.fstatSync(this.fd).size, bytes = Buffer.from(JSON.stringify(line) + '\n');
    try {
      let offset = 0;
      while (offset < bytes.length) { const written = fs.writeSync(this.fd, bytes, offset, bytes.length - offset); if (!written) throw new Error('Short ledger write'); offset += written; }
      fs.fsyncSync(this.fd);
    } catch (error) {
      this.seq--;
      try { fs.ftruncateSync(this.fd, before); fs.fsyncSync(this.fd); } catch { this.writeFault = true; }
      throw error;
    }
  }

  save() {
    if (!this.dir || !this.dirty) return;
    const started = performance.now();
    const snapshot: Snapshot = { seq: this.seq, accounts: [...this.accounts.values()], tokens: Object.fromEntries(this.tokens), dids: Object.fromEntries(this.dids), sold: Object.fromEntries(this.sold), completions: [...this.completions.values()],
      ...(this.legacyOrders.size ? { orders: [...this.legacyOrders.values()] } : {}) };
    const file = path.join(this.dir, 'accounts.json'), tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(snapshot), { flush: true });
    fs.renameSync(tmp, file);
    const directory = fs.openSync(this.dir, 'r');
    try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); }
    this.dirty = false;
    const took = performance.now() - started;
    if (took > 12) console.warn(`[economy] the book took ${took.toFixed(0)} ms to write (${this.accounts.size} accounts)`);
  }

  private keepLegacyOrder(order: unknown) {
    const id = (order as { id?: unknown } | null)?.id;
    if (typeof id === 'string') this.legacyOrders.set(id, order);
  }
  find(token: unknown): Account | undefined {
    if (!isGuestToken(token) && !isSessionToken(token)) return undefined;
    const pk = this.tokens.get(hash(token));
    return pk ? this.accounts.get(pk) : undefined;
  }
  create(now: number): { token: string; account: Account } {
    const token = crypto.randomBytes(16).toString('hex'), account = newAccount(crypto.randomBytes(8).toString('hex'), now);
    this.accounts.set(account.pk, account); this.tokens.set(hash(token), account.pk);
    this.record('new', account, { token: hash(token) });
    return { token, account };
  }
  byLogin(did: string): Account | undefined { const pk = this.dids.get(did); return pk ? this.accounts.get(pk) : undefined; }
  hasLogin(pk: string): boolean { for (const owner of this.dids.values()) if (owner === pk) return true; return false; }
  nameHolder(name: string): string | undefined { return this.names.get(nameKey(name)); }
  keepName(account: Account, before: string | undefined) {
    if (before && this.names.get(nameKey(before)) === account.pk) this.names.delete(nameKey(before));
    if (account.name) this.names.set(nameKey(account.name), account.pk);
  }
  redemptions(code: string): number { let n = 0; for (const account of this.accounts.values()) if (account.redeemed?.[code]) n++; return n; }
  link(account: Account, did: string, label: string | undefined): string {
    const token = `s_${crypto.randomBytes(24).toString('base64url')}`;
    this.dids.set(did, account.pk); this.tokens.set(hash(token), account.pk);
    if (label) account.label = label;
    this.record('link', account, { did, token: hash(token) });
    return token;
  }
  revoke(token: string) {
    const h = hash(token), pk = this.tokens.get(h), account = pk ? this.accounts.get(pk) : undefined;
    if (!this.tokens.delete(h) || !account) return;
    this.record('revoke', account, { token: h });
  }
  private moveCompletions(from:string,into:string) {
    for(const [key,c] of this.completions)if(c.pk===from){this.completions.delete(key);this.completions.set(`${c.matchId}:${into}`,{...c,pk:into});}
  }
  retire(gone: Account, into: Account) {
    if (gone.name && this.names.get(nameKey(gone.name)) === gone.pk) this.names.delete(nameKey(gone.name));
    this.moveCompletions(gone.pk,into.pk);
    for (const [h, pk] of this.tokens) if (pk === gone.pk) this.tokens.set(h, into.pk);
    this.accounts.delete(gone.pk);
    this.record('merge', gone, { into: into.pk });
    this.record('grant', into, { why: `merged ${gone.pk}` });
  }
  close() { this.save(); if (this.fd !== undefined) fs.closeSync(this.fd); this.fd = undefined; }
}
