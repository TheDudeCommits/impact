export interface Sites { from: string; to: string }
export const MOVED_KEY = 'jump-moved-in', SPARE_KEY = 'jump-account-token-old', TRIES_KEY = 'jump-move-tries';
const TOKEN_KEY = 'jump-account-token';
export const WAIT = 8000, TRIES = 3, TRY_AGAIN = 24 * 3600_000;

type Shape = 'token' | 'object' | 'array' | 'json' | 'text' | 'forge';
interface Rule { key: string; shape: Shape; max: number; many?: true; account?: true }
const rule = (key: string, shape: Shape, max: number, more: Partial<Rule> = {}): Rule => ({ key, shape, max, ...more });
export const CARRIED: readonly Rule[] = [
  rule(TOKEN_KEY, 'token', 34, { account: true }), rule('jump-account-login', 'text', 80, { account: true }),
  rule('jump-account-pending', 'array', 64_000, { account: true }), rule('jump-account', 'object', 256_000, { account: true }),
  rule('rift-player-name', 'text', 64), rule('rift-settings', 'object', 16_000), rule('jump-bindings-v1', 'object', 16_000),
  rule('rift-mode-prefs', 'object', 16_000), rule('rift-modes-seen', 'object', 8000), rule('rift-coach', 'object', 16_000),
  rule('rift-training-dummy', 'json', 32), rule('rift-training-inputs', 'text', 8), rule('rift-fullscreen', 'text', 8),
  rule('rift-quality-auto', 'object', 1000), rule('rift-intro-seen', 'text', 8), rule('rift-pointer-captured', 'text', 8),
  rule('rift-strip-matches', 'text', 12), rule('jump-fan-notice', 'text', 16), rule('jump-shop-goal', 'text', 80),
  rule('jump-signed-out', 'text', 20), rule('jump-shop-refund-seen:', 'text', 16, { many: true }),
  rule('rift-survival-progress', 'object', 256_000), rule('rift-survival-records', 'object', 64_000), rule('jump.career.v1', 'object', 256_000),
  rule('jump-forge-online:', 'text', 4, { many: true }), rule('jump-forge-draft:', 'forge', 256_000, { many: true }),
];
const ruleAt = (key: unknown) => typeof key !== 'string' ? -1 : CARRIED.findIndex(each => each.many ? key.startsWith(each.key) && /^[a-z0-9][a-z0-9_-]{0,47}$/i.test(key.slice(each.key.length)) : key === each.key);

export const isToken = (value: unknown): value is string => typeof value === 'string' && /^(?:[a-f0-9]{32}|s_[A-Za-z0-9_-]{32})$/.test(value);
function fits(shape: Shape, max: number, value: unknown): value is string {
  if (typeof value !== 'string' || !value.length || value.length > max) return false;
  if (shape === 'token') return isToken(value);
  if (shape === 'forge') return /^JF1\.[A-Za-z0-9_-]+\.[a-f0-9]{8}$/.test(value);
  if (shape === 'text') return !/[\u0000-\u001f\u007f]/.test(value);
  try { const read: unknown = JSON.parse(value); return shape === 'json' || (shape === 'array' ? Array.isArray(read) : !!read && typeof read === 'object' && !Array.isArray(read)); } catch { return false; }
}
export function carried(key: unknown, value: unknown): boolean { const at = ruleAt(key); return at >= 0 && fits(CARRIED[at].shape, CARRIED[at].max, value); }

export interface Plan { write: [string, string][]; kept: string[] }
export function plan(data: readonly (readonly [string, string])[], held: (key: string) => string | null): Plan {
  const write: [string, string][] = [], kept: string[] = [], has = (key: string) => held(key) !== null;
  const token = data.find(([key]) => key === TOKEN_KEY)?.[1], mine = held(TOKEN_KEY);
  for (const [key, value] of data) {
    const at = ruleAt(key);
    if (at < 0 || write.some(([written]) => written === key)) continue;
    if (CARRIED[at].account && mine !== null) { kept.push(key); continue; }
    if (CARRIED[at].account && !token && key !== 'jump-account-pending') continue;
    if (has(key)) kept.push(key); else write.push([key, value]);
  }
  if (mine !== null && token && token !== mine && !has(SPARE_KEY)) write.push([SPARE_KEY, token]);
  write.sort((a, b) => Number(b[0] === TOKEN_KEY) - Number(a[0] === TOKEN_KEY));
  return { write, kept };
}

export interface Hash { rest: string; marked: boolean; framed: boolean }
export function readHash(hash: string): Hash {
  const pieces = hash.replace(/^#/, '').split('&'), marks = pieces.filter(piece => piece.startsWith('hand='));
  return { rest: pieces.filter(piece => !piece.startsWith('hand=')).join('&'), marked: marks.length > 0, framed: marks.length === 1 && marks[0] === 'hand=frame' };
}
export const writeHash = (rest: string) => rest ? `#${rest}` : '';
export const frameUrl = (sites: Sites) => `${sites.to}/#hand=frame`;

export interface Place { pathname: string; search: string; hash: string }
export interface Tries { n: number; at: number }
export interface Leaving {
  url: string;
  carry: [string, string][];
  left: string[];
}
const asksToStay = (search: string) => /[?&]nomove(?:[=&]|$)/.test(search);
export function fromOld(sites: Sites, at: Place, entries: Iterable<readonly [string, string]>, automated = false, tries?: Tries, now = Date.now()): Leaving | null {
  if (automated && asksToStay(at.search)) return null;
  const url = `${sites.to}${at.pathname}${at.search}${writeHash(readHash(at.hash).rest)}`;
  if (tries && tries.n >= TRIES && now - tries.at < TRY_AGAIN && now >= tries.at) return { url, carry: [], left: [] };
  const carry: [string, string][] = [], left: string[] = [];
  for (const [key, value] of entries) { if (carried(key, value)) carry.push([key, value]); else if (ruleAt(key) >= 0) left.push(key); }
  return { url, carry, left };
}

export interface Ready { hand: 'ready'; moved: boolean; usable: boolean }
export const isReady = (message: unknown): message is Ready => !!message && typeof message === 'object' && (message as Ready).hand === 'ready';
export const wantsIt = (message: unknown) => isReady(message) && message.usable === true && message.moved === false;
export interface Take { hand: 'take'; data: [string, string][]; left: string[] }
export interface Done { hand: 'done'; ok: boolean }
export const isTake = (message: unknown): message is { hand: 'take'; data?: unknown; left?: unknown } => !!message && typeof message === 'object' && (message as Take).hand === 'take';
export const isDone = (message: unknown): message is Done => !!message && typeof message === 'object' && (message as Done).hand === 'done';
export function taken(message: unknown, held: (key: string) => string | null): (Plan & { left: string[]; dropped: number }) | null {
  if (!isTake(message) || !Array.isArray(message.data)) return null;
  const data: [string, string][] = [];
  let dropped = 0;
  for (const pair of message.data as unknown[]) { if (Array.isArray(pair) && pair.length === 2 && carried(pair[0], pair[1])) data.push([pair[0] as string, pair[1] as string]); else dropped++; }
  const left = (Array.isArray(message.left) ? message.left as unknown[] : []).filter((key): key is string => ruleAt(key) >= 0).slice(0, 40);
  return { ...plan(data, held), left, dropped };
}

type Page = Pick<Window, 'location' | 'history' | 'navigator' | 'document' | 'addEventListener' | 'removeEventListener' | 'setTimeout' | 'clearTimeout' | 'stop'> & { localStorage?: Storage; parent?: Pick<Window, 'postMessage'> | null };

function block(page: Page, halt: boolean) {
  try { const stop = page.document.createElement('meta'); stop.httpEquiv = 'Content-Security-Policy'; stop.content = "script-src 'none'"; page.document.head.append(stop); } catch { }
  if (halt) try { page.stop(); } catch { }
}
const store = (page: Page) => { try { return page.localStorage ?? undefined; } catch { return undefined; } };
const get = (storage: Storage | undefined, key: string) => { try { return storage?.getItem(key) ?? null; } catch { return null; } };
const set = (storage: Storage | undefined, key: string, value: string) => { try { if (!storage) return false; storage.setItem(key, value); return storage.getItem(key) === value; } catch { return false; } };
const drop = (storage: Storage | undefined, key: string) => { try { storage?.removeItem(key); } catch { } };
function everything(storage: Storage | undefined): [string, string][] {
  const all: [string, string][] = [];
  try { for (let i = 0; storage && i < storage.length; i++) { const key = storage.key(i), value = key === null ? null : storage.getItem(key); if (key !== null && value !== null) all.push([key, value]); } } catch { }
  return all;
}

function leaveOld(page: Page, sites: Sites) {
  const at = page.location, local = store(page);
  let tries: Tries | undefined;
  try { const read = JSON.parse(get(local, TRIES_KEY) ?? 'null') as Tries | null; if (read && typeof read.n === 'number' && typeof read.at === 'number') tries = read; } catch { }
  const leaving = fromOld(sites, at, everything(local), page.navigator.webdriver === true, tries);
  if (!leaving) return;
  if (!leaving.carry.length) { at.replace(leaving.url); block(page, false); return; }
  block(page, true);
  const frame = page.document.createElement('iframe');
  let over = false, timer = 0;
  const finish = (late: boolean) => {
    if (over) return;
    over = true; page.clearTimeout(timer); page.removeEventListener('message', hear);
    if (late) set(local, TRIES_KEY, JSON.stringify({ n: (tries?.n ?? 0) + 1, at: Date.now() })); else drop(local, TRIES_KEY);
    at.replace(leaving.url);
  };
  const hear = (event: MessageEvent) => {
    try {
      if (event.origin !== sites.to || !frame.contentWindow || event.source !== frame.contentWindow) return;
      if (wantsIt(event.data)) frame.contentWindow.postMessage({ hand: 'take', data: leaving.carry, left: leaving.left } satisfies Take, sites.to);
      else if (isReady(event.data) || isDone(event.data)) finish(false);
    } catch { finish(false); }
  };
  try {
    page.addEventListener('message', hear);
    timer = page.setTimeout(() => finish(true), WAIT);
    page.setTimeout(() => { try { if (over) return; const note = page.document.createElement('p'); note.textContent = `Taking you to ${sites.to.replace(/^https?:\/\//, '')}...`; note.setAttribute('style', 'font:16px system-ui,sans-serif;margin:24px;color:#666'); (page.document.body ?? page.document.documentElement.appendChild(page.document.createElement('body'))).append(note); } catch { } }, 1500);
    frame.setAttribute('aria-hidden', 'true'); frame.setAttribute('style', 'display:none'); frame.src = frameUrl(sites);
    page.document.head.append(frame);
  } catch { finish(false); }
}

function standInFrame(page: Page, sites: Sites, parent: Pick<Window, 'postMessage'>) {
  block(page, true);
  const local = store(page), usable = set(local, 'jump-move-probe', '1'), moved = get(local, MOVED_KEY) !== null;
  drop(local, 'jump-move-probe');
  let heard = false;
  page.addEventListener('message', (event: MessageEvent) => {
    try {
      if (heard || event.origin !== sites.from || event.source !== parent || !isTake(event.data)) return;
      heard = true;
      const read = usable && get(local, MOVED_KEY) === null ? taken(event.data, key => get(local, key)) : null;
      let ok = false;
      if (read) {
        const failed = read.write.filter(([key, value]) => !set(local, key, value)).map(([key]) => key);
        ok = !failed.includes(TOKEN_KEY);
        if (ok) set(local, MOVED_KEY, JSON.stringify({ at: new Date().toISOString(), from: sites.from, took: read.write.length - failed.length, kept: read.kept, left: read.left, dropped: read.dropped, failed }));
      }
      parent.postMessage({ hand: 'done', ok } satisfies Done, sites.from);
    } catch { }
  });
  parent.postMessage({ hand: 'ready', moved, usable } satisfies Ready, sites.from);
}

export function run(page: Page, sites: Sites): void {
  try {
    const at = page.location;
    if (!sites.from || !sites.to || sites.from === sites.to) return;
    if (at.origin === sites.from) { leaveOld(page, sites); return; }
    if (at.origin !== sites.to) return;
    const mark = readHash(at.hash);
    if (!mark.marked) return;
    const parent = page.parent;
    if (mark.framed && parent && parent !== (page as unknown)) { standInFrame(page, sites, parent); return; }
    page.history.replaceState(page.history.state, '', `${at.pathname}${at.search}${writeHash(mark.rest)}`);
  } catch { }
}
