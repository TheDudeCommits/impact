import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buy, buyBundle, credit, merge, roll, settle, wear, type Account } from '../../game/economy/account';
import { ITEM, KINDS, isBundle, type ItemKind } from '../../game/economy/catalog';
import type { Report } from '../../game/economy/earn';
import { refundRelevant, refundWhy, refundsDue, type LedgerLine } from '../../game/economy/refunds';
import { Book } from './book';
import { PrivyVerifier } from './privy';
import { PlayerTwoVerifier, p2Login, p2Of, type PlayerTwoOptions } from './playertwo';
import { PlayerTwoTrophies, type TrophyOptions } from './playertwoTrophies';
import { LinkCodes } from './playertwoLink';
import { ALL_ACCESS_MIN, CODES, codeHash, envCodes, normalCode, type CodeDef } from './codes';
import { blockedName } from './names';
import { displayName, heldKeys } from '../displayName';
import { NAME_FALLBACK } from '../../game/displayName';
import { nameFreeAt, nameKey, nameProblem } from '../../game/economy/names';
import { isDeviceId } from '../../game/economy/device';
import { DeviceReports } from './deviceReports';
import { ForgeRefusal, ForgeStore } from '../forge/ForgeStore';
import { remoteEconomy, type RoomEconomy } from '../cluster/economyLink';

const PAY_OFF = 'off' as const;

export interface EconomyOptions {
  dir?: string | false;
  privyAppId?: string;
  adminToken?: string;
  now?: () => number;
  fetcher?: typeof fetch;
  codes?: readonly CodeDef[];
  playerTwo?: PlayerTwoOptions;
  trophies?: TrophyOptions;
}
class Refusal extends Error { constructor(message: string, readonly status: 400 | 401 | 429 = 400, readonly need?: 'identity') { super(message); } }
const refuse = (message: string, status: 400 | 401 | 429 = 400, need?: 'identity'): never => { throw new Refusal(message, status, need); };

const CODE_MISSES = 10;
const day = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });


const NEW_PER_HOUR = 30;
const DELETES_PER_HOUR = 5;
const SAVE_EVERY = 20;

export class Economy {
  readonly book: Book;
  readonly privy: PrivyVerifier;
  readonly p2: PlayerTwoVerifier;
  readonly trophies: PlayerTwoTrophies;
  private readonly links = new LinkCodes();
  private readonly now: () => number;
  private readonly opened = new Map<string, number[]>();
  private devices?: DeviceReports;
  private readonly codes: readonly CodeDef[];
  private readonly misses = new Map<string, number[]>();
  private readonly deletes = new Map<string, number[]>();
  private readonly timer?: ReturnType<typeof setInterval>;
  readonly forge: ForgeStore;

  constructor(private readonly options: EconomyOptions = {}) {
    this.now = options.now ?? Date.now;
    let dir = options.dir === false ? undefined : options.dir ?? path.join(os.tmpdir(), 'jump-economy');
    let book: Book;
    try { book = new Book(dir); } catch (error) { console.error(`[economy] THE BOOK CANNOT BE KEPT in ${dir}: accounts will not outlive this process.`, error); dir = undefined; book = new Book(undefined); }
    this.book = book; this.kept = dir;
    this.forge = new ForgeStore(dir, this.now);
    this.privy = new PrivyVerifier(options.privyAppId ?? '', options.fetcher);
    this.p2 = new PlayerTwoVerifier({ game: process.env.P2_GAME, keys: process.env.P2_KEYS, now: this.now, ...options.playerTwo });
    this.trophies = new PlayerTwoTrophies({ key: process.env.P2_GAME_KEY, site: process.env.P2_SITE, dir, now: this.now, ...options.trophies });
    this.codes = options.codes ?? [...envCodes(), ...CODES];
    if (!options.codes && normalCode(process.env.ALL_ACCESS_CODE) && !envCodes().length)
      console.warn(`[economy] ALL_ACCESS_CODE is shorter than ${ALL_ACCESS_MIN} characters: the all-access code is off.`);
    if (dir) this.refundPriceDrops(dir);
    if (dir) { this.timer = setInterval(() => this.save(), SAVE_EVERY * 1000); this.timer.unref?.(); }
    console.log(`[economy] ${this.book.accounts.size} account(s)${dir ? ` in ${dir}` : ' (memory only)'}; sign-in ${this.privy.enabled ? 'on' : 'off'}; all-access code ${this.codes.some(each => each.grants.allAccess) ? 'on' : 'off'}`);
  }
  readonly kept?: string;
  private refundPriceDrops(dir: string) {
    const lines = fs.readdirSync(dir).filter(name => /^ledger.*\.jsonl$/.test(name)).flatMap(name => fs.readFileSync(path.join(dir, name), 'utf8').split('\n')
      .filter(refundRelevant).flatMap(raw => { try { return [JSON.parse(raw) as LedgerLine]; } catch { return []; } }));
    for (const due of refundsDue(lines)) {
      const account = this.book.accounts.get(due.pk);
      if (!account || account.refunded?.[due.item]) continue;
      const next = structuredClone(account); credit(next, due.amount); next.refunded = { ...next.refunded, [due.item]: due.amount };
      try { this.book.record('grant', next, { amount: due.amount, why: refundWhy(due.item) }); this.book.accounts.set(due.pk, next); }
      catch (error) { console.error('[economy] a refund could not be written; it is paid at the next start', error); return; }
    }
  }
  save() { try { this.book.save(); } catch (error) { console.error('[economy] the book could not be written', error); } }
  close() { if (this.timer) clearInterval(this.timer); this.trophies.close(); try { this.book.close(); } catch (error) { console.error('[economy] the book could not be closed', error); } }
  private trophiesFor(account: Account) {
    if (!this.trophies.enabled || !account.feats.length) return;
    for (const login of this.book.loginsOf(account.pk)) { const player = p2Of(login); if (player) this.trophies.offer(player, account.feats); }
  }

  private answer(account: Account, more: Record<string, unknown> = {}) {
    return { account, signedIn: this.book.hasLogin(account.pk), sold: Object.fromEntries(this.book.sold), config: { privy: this.privy.enabled ? this.privy.appId : undefined, pay: PAY_OFF }, ...more };
  }
  private open(token: unknown): Account {
    const account = this.book.find(token) ?? refuse('That account is not known here. Reload the game.', 401);
    roll(account, this.now());
    return account;
  }

  hello(token: unknown, address = '') {
    const known = this.book.find(token);
    if (known) { roll(known, this.now()); return this.answer(known); }
    const hour = this.now() - 3600_000, recent = (this.opened.get(address) ?? []).filter(at => at > hour);
    if (recent.length >= NEW_PER_HOUR) refuse('Too many new accounts from here. Try again in an hour.', 429);
    this.opened.set(address, [...recent, this.now()]);
    const made = this.book.create(this.now());
    roll(made.account, this.now());
    return this.answer(made.account, { token: made.token });
  }

  report(token: unknown, report: Report) {
    const account = this.open(token);
    if (typeof report?.id !== 'string') refuse('A completed server match is required.');
    if (isDeviceId(report.id)) {
      if (!this.kept && this.options.dir !== false) refuse('Results cannot be kept just now.', 429);
      const paid = (this.devices ??= new DeviceReports(this.book)).settle(account, report, this.now());
      if ('refused' in paid) return refuse(paid.refused, paid.status);
      this.trophiesFor(paid.account);
      return this.answer(paid.account, { settlement: paid.completion.settlement });
    }
    const completion = this.book.completions.get(`${report.id}:${account.pk}`);
    if (!completion) refuse('No completed server match was found for this account.');
    return this.answer(account, { settlement: completion!.settlement });
  }

  complete(pk: string, report: Report) {
    if (!this.kept && this.options.dir !== false) throw new Error('Verified rewards require a writable economy ledger.');
    const key = `${report.id}:${pk}`, known = this.book.completions.get(key);
    if (known) return known;
    const current = this.book.accounts.get(pk); if (!current) return undefined;
    const next = structuredClone(current), now = this.now();
    const settlement = settle(next, report, now, true);
    if (settlement.refused) throw new Error(settlement.refused);
    const completion = { matchId: report.id, pk, completedAt: now, report: structuredClone(report), settlement };
    this.book.record('earn', next, { amount: settlement.total, why: `verified:${report.mode}:${report.id}`, completion });
    this.book.accounts.set(pk, next); this.book.completions.set(key, completion);
    this.trophiesFor(next);
    return completion;
  }

  buy(token: unknown, id: unknown) {
    const account = this.open(token), item = String(id ?? '');
    if (isBundle(item)) {
      const result = buyBundle(account, item, this.now());
      if ('refused' in result) return refuse(result.refused);
      this.book.record('buy', account, { item, amount: -result.price, why: result.owned.join(',') });
      return this.answer(account, { bought: item, items: result.owned });
    }
    const result = buy(account, item, this.book.sold.get(item) ?? 0, this.now());
    if ('refused' in result) return refuse(result.refused);
    if (result.owned.serial) this.book.sold.set(item, result.owned.serial);
    this.book.record('buy', account, { item, amount: -result.price, serial: result.owned.serial });
    return this.answer(account, { bought: item });
  }

  wear(token: unknown, kind: unknown, id: unknown) {
    const account = this.open(token);
    if (typeof kind !== 'string' || !(kind in KINDS)) refuse('That is not a kind of item.');
    const result = wear(account, kind as ItemKind, typeof id === 'string' && id ? id : undefined);
    if ('refused' in result) return refuse(result.refused);
    this.book.record('wear', account);
    return this.answer(account);
  }

  async signIn(token: unknown, access: unknown) {
    const did = await this.privy.verify(String(access ?? '')).catch((error: Error) => refuse(error.message));
    const guest = this.book.find(token), known = this.book.byLogin(did);
    let account = known ?? guest ?? this.book.create(this.now()).account;
    if (known && guest && guest !== known && !this.book.hasLogin(guest.pk)) { merge(known, guest); this.book.retire(guest, known); account = known; this.trophiesFor(account); }
    roll(account, this.now());
    const session = this.book.link(account, did);
    return this.answer(account, { token: session });
  }
  async signInPlayerTwo(token: unknown, identity: unknown) {
    const player = await this.p2.verify(String(identity ?? '')).catch((error: Error) => refuse(error.message));
    const login = p2Login(player.id), presented = this.book.find(token), known = this.book.byLogin(login);
    if (known && presented === known) { roll(known, this.now()); return this.answer(known); }
    const guest = presented && !this.book.hasLogin(presented.pk) ? presented : undefined;
    let account = known ?? guest ?? this.book.create(this.now()).account;
    if (known && guest) { merge(known, guest); this.book.retire(guest, known); account = known; }
    roll(account, this.now());
    const session = this.book.link(account, login);
    this.trophiesFor(account);
    return this.answer(account, { token: session });
  }
  async linkCode(token: unknown, identity: unknown) {
    const account = this.open(token);
    const player = await this.p2.verify(String(identity ?? '')).catch((error: Error) => refuse(error.message));
    if (this.book.byLogin(p2Login(player.id))?.pk !== account.pk) refuse('Sign in with Player Two first.');
    const issued = this.links.issue(account.pk, player, this.now()) ?? refuse('Too many tries. Try again in an hour.', 429);
    return this.answer(account, issued);
  }
  linkInfo(code: unknown) {
    const link = this.links.read(code, this.now()) ?? refuse('This link has run out. Start again from Impact in Player Two.');
    return { player: { handle: link.handle, name: link.name } };
  }
  link(code: unknown, token: unknown) {
    const link = this.links.read(code, this.now()) ?? refuse('This link has run out. Start again from Impact in Player Two.');
    const kept = this.open(token), login = p2Login(link.player), framed = this.book.byLogin(login);
    if (!framed || framed.pk !== link.pk) refuse('This link has run out. Start again from Impact in Player Two.');
    if (kept.pk !== framed!.pk) {
      if (this.book.loginsOf(kept.pk).some(each => p2Of(each))) refuse('This account is kept with another Player Two player already.');
      const name = kept.name ? undefined : framed!.name, logins = this.book.loginsOf(framed!.pk);
      merge(kept, framed!); this.book.retire(framed!, kept);
      if (name) { kept.name = name; kept.nameAt = framed!.nameAt; this.book.keepName(kept, undefined); }
      for (const did of logins) this.book.addLogin(kept, did);
    }
    this.links.take(code as string);
    roll(kept, this.now());
    this.trophiesFor(kept);
    return this.answer(kept, { linked: true });
  }
  signOut(token: unknown, address = '') {
    if (typeof token === 'string') this.book.revoke(token);
    return this.hello(undefined, address);
  }
  deleteAccount(token: unknown, confirm: unknown, address = '') {
    if (confirm !== 'DELETE') refuse('Confirm the deletion first: it cannot be undone.');
    const hour = this.now() - 3600_000, recent = (this.deletes.get(address) ?? []).filter(at => at > hour);
    if (recent.length >= DELETES_PER_HOUR) refuse('Too many deletions from here. Try again in an hour.', 429);
    this.deletes.set(address, [...recent, this.now()]);
    const account = this.book.find(token);
    if (account) {
      const lines = this.book.forget(account.pk);
      this.misses.delete(`pk:${account.pk}`);
      console.log(`[economy] an account was deleted at its owner's word (${lines} ledger line(s) removed)`);
    }
    try { return { deleted: true, ...this.hello(undefined, address) }; }
    catch (error) { if (error instanceof Refusal) return { deleted: true }; throw error; }
  }

  async redeem(token: unknown, code: unknown, identity: unknown, address = '') {
    const account = this.open(token), typed = normalCode(code);
    if (!typed) refuse('Type a code first.');
    if (!this.book.hasLogin(account.pk)) refuse('Sign in first: a code is kept with your login, not with this browser.');
    const hour = this.now() - 3600_000, keys = [`pk:${account.pk}`, `at:${address}`];
    const recent = (key: string) => (this.misses.get(key) ?? []).filter(at => at > hour);
    if (keys.some(key => recent(key).length >= CODE_MISSES)) refuse('Too many codes tried. Try again in an hour.', 429);
    const def = typed.length <= 64 ? this.codes.find(each => each.hash === codeHash(typed)) : undefined;
    if (!def) { for (const key of keys) this.misses.set(key, [...recent(key), this.now()]); return refuse('That code is not known. Check its spelling.'); }
    if (account.redeemed?.[def.id]) refuse('You have already redeemed that code.');
    if (def.limit !== undefined && this.book.redemptions(def.id) >= def.limit) refuse('That code has been used up.');
    if (def.email) {
      if (typeof identity !== 'string' || !identity) refuse('This code checks who you are signed in as. Confirm your sign-in.', 400, 'identity');
      const login = await this.privy.identity(identity as string).catch((error: Error) => refuse(error.message));
      if (this.book.byLogin(login.did)?.pk !== account.pk) refuse('That sign-in is not this account\'s. Sign out, sign in again and try once more.');
      if (!login.emails.includes(def.email.toLowerCase())) refuse('That code belongs to another account.');
    }
    const current = this.book.accounts.get(account.pk) ?? refuse('That account is not known here. Reload the game.', 401);
    if (current.redeemed?.[def.id]) refuse('You have already redeemed that code.');
    const next = structuredClone(current), now = this.now(), grants = def.grants, items: string[] = [];
    if (grants.allAccess) next.allAccess = true;
    for (const id of grants.items ?? []) if (ITEM.has(id) && !next.items[id]) { next.items[id] = { at: now }; items.push(id); }
    if (grants.sumi) credit(next, grants.sumi);
    next.redeemed = { ...next.redeemed, [def.id]: now };
    this.book.record('redeem', next, { code: def.id, amount: grants.sumi || undefined, why: items.join(',') || undefined });
    this.book.accounts.set(next.pk, next);
    return this.answer(next, { redeemed: { says: def.says, allAccess: !!grants.allAccess, items, sumi: grants.sumi ?? 0 } });
  }

  async forgeSave(token: unknown, code: unknown) {
    const account = this.open(token);
    if (!this.book.hasLogin(account.pk)) refuse('Sign in to keep a forged fighter: it is kept with your login.');
    return { kept: this.forged(() => this.forge.save(account.pk, code)) };
  }
  forgeMine(token: unknown) { const account = this.open(token); return { kept: this.forge.mine(account.pk).map(({ owner: _owner, ...kit }) => kit) }; }
  forgeGet(hash: unknown) { return { kit: this.forge.get(hash) ?? refuse('There is no forged fighter at that link (it may have been removed).') }; }
  forgeRemove(token: unknown, hash: unknown) {
    const account = this.open(token);
    this.forged(() => this.forge.remove(account.pk, hash));
    return this.forgeMine(token);
  }
  private forged<T>(work: () => T): T { try { return work(); } catch (error) { if (error instanceof ForgeRefusal) refuse(error.message); throw error; } }

  claimName(token: unknown, raw: unknown) {
    const account = this.open(token), name = typeof raw === 'string' ? raw.trim() : '';
    if (!this.book.hasLogin(account.pk)) refuse('Sign in to claim a username.');
    const problem = nameProblem(name);
    if (problem) refuse(problem);
    if (blockedName(name)) refuse('That username is not allowed.');
    if (account.name === name) refuse('That is already your username.');
    const holder = this.book.nameHolder(name);
    if (holder && holder !== account.pk) refuse('That username is taken.');
    const caseOnly = !!account.name && nameKey(account.name) === nameKey(name), freeAt = nameFreeAt(account);
    if (!caseOnly && freeAt > this.now()) refuse(`You can change your username again on ${day(freeAt)}.`);
    const next = structuredClone(account), before = account.name;
    next.name = name;
    if (!caseOnly) next.nameAt = this.now();
    this.book.record('name', next, { why: before ? `was ${before}` : undefined });
    this.book.accounts.set(next.pk, next); this.book.keepName(next, before);
    return this.answer(next);
  }

  grant(bearer: unknown, pk: unknown, amount: unknown, item: unknown) {
    if (!this.options.adminToken || bearer !== `Bearer ${this.options.adminToken}`) refuse('Not allowed.');
    const account = this.book.accounts.get(String(pk ?? '')) ?? refuse('No such account.');
    const n = Math.floor(Number(amount) || 0), id = typeof item === 'string' ? item : undefined;
    if (n) credit(account, n);
    if (id) { if (!ITEM.has(id)) refuse('There is no such item.'); account.items[id] ??= { at: this.now() }; }
    this.book.record('grant', account, { amount: n || undefined, item: id, why: 'admin' });
    return this.answer(account);
  }
}

interface Req { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown; socket?: { remoteAddress?: string }; on(event: string, listener: (chunk?: Buffer) => void): unknown }
interface Res { statusCode: number; setHeader(name: string, value: string): unknown; removeHeader?(name: string): unknown; end(body?: string): unknown }
interface App { use(path: string, handler: (req: Req, res: Res, next: () => void) => void): unknown; post(path: string, handler: (req: Req, res: Res) => void): unknown }

const ORIGINS = [/^https:\/\/([a-z0-9-]+\.)*dude\.work$/, /^https:\/\/rift-arena-preview[a-z0-9-]*\.vercel\.app$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/, /^https:\/\/impact\.playertwo\.cc$/];
const allowed = (origin: string, extra: readonly string[]) => ORIGINS.some(each => each.test(origin)) || extra.includes(origin);
export { allowed as allowedOrigin };

async function bodyOf(req: Req): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === 'object') return req.body as Record<string, unknown>;
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []; let size = 0;
    req.on('data', chunk => { if (!chunk) return; size += chunk.length; if (size > 16384) reject(new Refusal('That is too much to send.')); else chunks.push(chunk); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown> : {}); } catch { reject(new Refusal('That was not JSON.')); } });
    req.on('error', () => reject(new Refusal('The request broke off.')));
  });
}

let shared: Economy | undefined;
export const sharedEconomy = (): RoomEconomy | undefined => shared ?? remoteEconomy();

export function roomName(token: unknown, typed: unknown, max = 20): string {
  const remote = shared ? undefined : remoteEconomy();
  if (remote) {
    const known = remote.book.find(token)?.name;
    if (known) return known;
    const name = displayName(typed, max);
    return name === NAME_FALLBACK ? name : remote.name(token, typed, max) ?? NAME_FALLBACK;
  }
  const book = shared?.book, account = book?.find(token);
  if (account?.name) return account.name;
  const name = displayName(typed, max);
  if (name === NAME_FALLBACK || !book) return name;
  return heldKeys(name).some(key => { const holder = book.nameHolder(key); return holder && holder !== account?.pk; }) ? NAME_FALLBACK : name;
}

export function mountEconomy(app: App, options: EconomyOptions = {}): Economy {
  const economy = shared = new Economy(options);
  const extra = (process.env.ECONOMY_ORIGINS ?? '').split(',').map(each => each.trim()).filter(Boolean);
  app.use('/api/economy', (req, res, next) => {
    const origin = String(req.headers.origin ?? '');
    for (const header of ['Access-Control-Allow-Origin', 'Access-Control-Allow-Credentials']) res.removeHeader?.(header);
    res.setHeader('Vary', 'Origin');
    if (origin && allowed(origin, extra)) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization'); res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS'); res.setHeader('Access-Control-Max-Age', '86400'); }
    if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
    next();
  });
  const route = (name: string, run: (body: Record<string, unknown>, req: Req, address: string) => unknown) => app.post(`/api/economy/${name}`, (req, res) => {
    const address = String(req.headers['x-forwarded-for'] ?? req.socket?.remoteAddress ?? '').split(',')[0].trim();
    res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
    void bodyOf(req).then(body => run(body, req, address)).then(answer => { res.statusCode = 200; res.end(JSON.stringify(answer)); })
      .catch((error: unknown) => {
        if (!(error instanceof Refusal)) console.error(`[economy] ${name} failed`, error);
        res.statusCode = error instanceof Refusal ? error.status : 500;
        res.end(JSON.stringify(error instanceof Refusal ? { error: error.message, ...(error.need ? { need: error.need } : {}) } : { error: 'Something went wrong on the server.' }));
      });
  });
  route('hello', (body, _req, address) => economy.hello(body.token, address));
  route('report', body => economy.report(body.token, body.report as Report));
  route('buy', body => economy.buy(body.token, body.item));
  route('wear', body => economy.wear(body.token, body.kind, body.item));
  route('signin', body => economy.signIn(body.token, body.access));
  route('p2-signin', body => economy.signInPlayerTwo(body.token, body.identity));
  route('p2-link-code', body => economy.linkCode(body.token, body.identity));
  route('p2-link-info', body => economy.linkInfo(body.code));
  route('p2-link', body => economy.link(body.code, body.token));
  route('signout', (body, _req, address) => economy.signOut(body.token, address));
  route('delete', (body, _req, address) => economy.deleteAccount(body.token, body.confirm, address));
  route('grant', (body, req) => economy.grant(req.headers.authorization, body.pk, body.amount, body.item));
  route('redeem', (body, _req, address) => economy.redeem(body.token, body.code, body.identity, address));
  route('name', body => economy.claimName(body.token, body.name));
  route('forge-save', body => economy.forgeSave(body.token, body.code));
  route('forge-mine', body => economy.forgeMine(body.token));
  route('forge-get', body => economy.forgeGet(body.hash));
  route('forge-remove', body => economy.forgeRemove(body.token, body.hash));
  for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => { economy.save(); });
  process.once('exit', () => { economy.close(); });
  return economy;
}
