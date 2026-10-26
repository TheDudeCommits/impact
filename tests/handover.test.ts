import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { CARRIED, MOVED_KEY, SPARE_KEY, TRIES, TRIES_KEY, TRY_AGAIN, WAIT, carried, frameUrl, fromOld, isDone, isReady, isToken, plan, readHash, run, taken, wantsIt, writeHash, type Sites } from '../src/boot/handover';
import { HANDOVER_SITES, handoverScript, handoverSites, oneSite, withHandover } from '../scripts/build/handover';

const SITES: Sites = { from: 'https://jump.dude.work', to: 'https://impact.dude.work' };
const GUEST = 'a'.repeat(32), OTHER = 'b'.repeat(32), SESSION = `s_${'Zx9_-q'.repeat(5)}Zx`;
const FORGE = (n: number) => `JF1.${'k'.repeat(n)}.0a1b2c3d`;
const OLD: [string, string][] = [
  ['jump-account-token', GUEST], ['jump-account-login', 'as a•••@g•••.com'], ['jump-account-pending', JSON.stringify([{ id: 'r1', mode: 'bots', fighter: 'goku', seconds: 90, place: 1, players: 12, kos: 3 }])],
  ['jump-account', JSON.stringify({ account: { pk: '0123456789abcdef', sumi: 420 }, config: {}, signedIn: false })],
  ['rift-player-name', 'Kōhai 🔥'], ['rift-settings', JSON.stringify({ sensitivity: .7, quality: 'high', musicEnabled: false })], ['jump-bindings-v1', JSON.stringify({ keys: { light: 'KeyJ' } })],
  ['rift-mode-prefs', JSON.stringify({ duel: { rival: 'naruto' } })], ['rift-training-dummy', '"combat"'], ['jump-fan-notice', '1'], ['rift-fullscreen', 'off'],
  ['rift-survival-progress', JSON.stringify({ version: 1, shards: 12 })], ['jump.career.v1', JSON.stringify({ totals: { matches: 31 } })],
  ['jump-forge-draft:goku', FORGE(400)], ['jump-forge-online:goku', '1'], ['jump-shop-refund-seen:0123456789abcdef', '40'],
];
const asMap = (entries: Iterable<readonly [string, string]>) => new Map(entries);
const held = (map: Map<string, string>) => (key: string) => map.get(key) ?? null;

describe('what is carried', () => {
  it('knows a token by the two shapes the server mints, and nothing else', () => {
    expect(isToken(GUEST)).toBe(true); expect(isToken(SESSION)).toBe(true);
    for (const bad of ['', 'a'.repeat(31), 'A'.repeat(32), `${'a'.repeat(32)}\n`, `s_${'a'.repeat(31)}`, `s_${'a'.repeat(31)}.`, '<script>', undefined, 7, null]) expect(isToken(bad)).toBe(false);
  });
  it('takes the keys the game writes, each by its shape', () => {
    for (const [key, value] of OLD) expect(carried(key, value), key).toBe(true);
    expect(carried('jump-account-token', 'not-a-token')).toBe(false);
    expect(carried('rift-settings', '[1]')).toBe(false); expect(carried('rift-settings', '{oops')).toBe(false);
    expect(carried('jump-account-pending', '{}')).toBe(false);
    expect(carried('rift-player-name', 'a\u0000b')).toBe(false); expect(carried('rift-player-name', 'x'.repeat(65))).toBe(false); expect(carried('rift-player-name', 7)).toBe(false);
    expect(carried('jump-forge-draft:goku', 'JF1.<img>.0a1b2c3d')).toBe(false);
    expect(carried('jump-forge-draft:', FORGE(8))).toBe(false); expect(carried('jump-forge-draft:../x', FORGE(8))).toBe(false);
    expect(carried(7, '1')).toBe(false); expect(carried(['rift-settings'], '{}')).toBe(false);
  });
  it('carries nothing it was not told to: a tab\'s notes, the last error, Privy\'s session, its own marks', () => {
    for (const key of ['rift-last-error', 'privy:token', 'privy:refresh_token', 'jump-signin', 'jump-stale-reload', MOVED_KEY, TRIES_KEY, SPARE_KEY, '__proto__', 'constructor', 'anything']) expect(carried(key, '1'), key).toBe(false);
  });
  it('names every key once', () => { expect(new Set(CARRIED.map(each => each.key)).size).toBe(CARRIED.length); });
});

describe('what is stored at the new address', () => {
  it('an empty browser takes everything, the token first', () => {
    const made = plan(OLD, () => null);
    expect(asMap(made.write)).toEqual(asMap(OLD)); expect(made.write[0][0]).toBe('jump-account-token'); expect(made.kept).toEqual([]);
  });
  it('writes over nothing that is there', () => {
    const made = plan(OLD, held(new Map([['rift-settings', '{"quality":"low"}'], ['rift-player-name', 'Newer']]))), written = asMap(made.write);
    expect(written.has('rift-settings')).toBe(false); expect(written.has('rift-player-name')).toBe(false); expect(made.kept.sort()).toEqual(['rift-player-name', 'rift-settings']);
    expect(written.get('jump-account-token')).toBe(GUEST); expect(written.get('jump-bindings-v1')).toBe(asMap(OLD).get('jump-bindings-v1'));
  });
  it('an account at the new address is kept whole: the old token goes beside it, the rest of that account is not mixed in', () => {
    const made = plan(OLD, held(new Map([['jump-account-token', OTHER]]))), written = asMap(made.write);
    for (const key of ['jump-account-token', 'jump-account-login', 'jump-account-pending', 'jump-account']) expect(written.has(key), key).toBe(false);
    expect(written.get(SPARE_KEY)).toBe(GUEST); expect(written.get('rift-settings')).toBeDefined(); expect(written.get('jump-forge-draft:goku')).toBeDefined();
    expect(asMap(plan(OLD, held(new Map([['jump-account-token', GUEST]]))).write).has(SPARE_KEY)).toBe(false);
    expect(asMap(plan(OLD, held(new Map([['jump-account-token', OTHER], [SPARE_KEY, SESSION]]))).write).has(SPARE_KEY)).toBe(false);
  });
  it('makes up no account from the rest of one, and takes a key once', () => {
    const made = asMap(plan(OLD.filter(([key]) => key !== 'jump-account-token'), () => null).write);
    expect(made.has('jump-account-login')).toBe(false); expect(made.has('jump-account')).toBe(false);
    expect(made.has('jump-account-pending')).toBe(true); expect(made.has('rift-settings')).toBe(true);
    expect(plan([['rift-player-name', 'First'], ['rift-player-name', 'Second'], ['not-carried', 'x']], () => null).write).toEqual([['rift-player-name', 'First']]);
  });
});

describe('the address', () => {
  it('splits a fragment into the page\'s part and the mark', () => {
    expect(readHash('')).toEqual({ rest: '', marked: false, framed: false }); expect(readHash('#room=123456&kind=duel')).toEqual({ rest: 'room=123456&kind=duel', marked: false, framed: false });
    expect(readHash('#hand=frame')).toEqual({ rest: '', marked: true, framed: true }); expect(readHash('#party=AB12&hand=frame')).toEqual({ rest: 'party=AB12', marked: true, framed: true });
    expect(readHash('#hand=take.abc&room=1')).toEqual({ rest: 'room=1', marked: true, framed: false }); expect(readHash('#hand=frame&hand=frame')).toEqual({ rest: '', marked: true, framed: false });
    expect(writeHash('')).toBe(''); expect(writeHash('room=1&kind=duel')).toBe('#room=1&kind=duel'); expect(frameUrl(SITES)).toBe('https://impact.dude.work/#hand=frame');
  });
  it('the old address goes to the new one at the same path, query and hash, and nothing it holds is in the address', () => {
    expect(fromOld(SITES, { pathname: '/', search: '', hash: '' }, [])).toEqual({ url: 'https://impact.dude.work/', carry: [], left: [] });
    expect(fromOld(SITES, { pathname: '/', search: '?forge&kit=abc', hash: '#room=123456&kind=duel' }, [])!.url).toBe('https://impact.dude.work/?forge&kit=abc#room=123456&kind=duel');
    const leaving = fromOld(SITES, { pathname: '/', search: '?forge', hash: '#room=123456&kind=coop' }, OLD)!;
    expect(leaving.url).toBe('https://impact.dude.work/?forge#room=123456&kind=coop'); expect(asMap(leaving.carry)).toEqual(asMap(OLD)); expect(leaving.left).toEqual([]);
    expect(fromOld(SITES, { pathname: '/', search: '', hash: '#room=123456&kind=duel&hand=frame' }, OLD)!.url).toBe('https://impact.dude.work/#room=123456&kind=duel');
    expect(fromOld(SITES, { pathname: '/', search: '', hash: `#hand=take.${GUEST}` }, [])!.url).toBe('https://impact.dude.work/');
  });
  it('hands over only what is carried, and names what does not read as it should', () => {
    const leaving = fromOld(SITES, { pathname: '/', search: '', hash: '' }, [...OLD.filter(([key]) => key !== 'jump-bindings-v1'), ['privy:token', 'secret-of-privy'], ['rift-last-error', '{}'], ['rift-settings-x', '{}'], ['jump-bindings-v1', 'broken{'], [TRIES_KEY, '{"n":1,"at":1}']])!;
    expect(leaving.carry.map(([key]) => key)).not.toEqual(expect.arrayContaining(['privy:token', 'rift-last-error', 'rift-settings-x', 'jump-bindings-v1', TRIES_KEY]));
    expect(JSON.stringify(leaving.carry)).not.toContain('secret-of-privy'); expect(leaving.left).toEqual(['jump-bindings-v1']); expect(leaving.carry.length).toBe(OLD.length - 1);
  });
  it('only an automated browser that asks is left at the old address', () => {
    const at = { pathname: '/', search: '?nomove', hash: '' };
    expect(fromOld(SITES, at, OLD, true)).toBeNull(); expect(fromOld(SITES, { ...at, search: '?forge&nomove=1' }, OLD, true)).toBeNull();
    expect(fromOld(SITES, at, OLD, false)!.url).toBe('https://impact.dude.work/?nomove');
    expect(fromOld(SITES, { ...at, search: '?nomoves' }, [], true)!.url).toBe('https://impact.dude.work/?nomoves'); expect(fromOld(SITES, { ...at, search: '' }, [], true)!.url).toBe('https://impact.dude.work/');
  });
  it('stops asking for a day after three frames that never answered', () => {
    const at = { pathname: '/', search: '', hash: '' }, now = 1_800_000_000_000;
    expect(fromOld(SITES, at, OLD, false, { n: TRIES - 1, at: now - 1000 }, now)!.carry.length).toBe(OLD.length);
    expect(fromOld(SITES, at, OLD, false, { n: TRIES, at: now - 1000 }, now)).toEqual({ url: 'https://impact.dude.work/', carry: [], left: [] });
    expect(fromOld(SITES, at, OLD, false, { n: TRIES, at: now - TRY_AGAIN - 1 }, now)!.carry.length).toBe(OLD.length);
    expect(fromOld(SITES, at, OLD, false, { n: TRIES, at: now + 5000 }, now)!.carry.length).toBe(OLD.length);
  });
});

describe('what the two pages say to each other', () => {
  it('the old page hands over only to a new address that can store and has not moved in', () => {
    expect(wantsIt({ hand: 'ready', moved: false, usable: true })).toBe(true);
    for (const no of [{ hand: 'ready', moved: true, usable: true }, { hand: 'ready', moved: false, usable: false }, { hand: 'ready' }, { hand: 'ready', moved: 0, usable: 1 }, { hand: 'done', ok: true }, null, 'ready', 7]) expect(wantsIt(no)).toBe(false);
    expect(isReady({ hand: 'ready', moved: true, usable: true })).toBe(true); expect(isDone({ hand: 'done', ok: false })).toBe(true); expect(isDone({ hand: 'ready' })).toBe(false); expect(isReady(null)).toBe(false);
  });
  it('the framed page stores only pairs that are carried kinds in their shape', () => {
    const read = taken({ hand: 'take', left: ['jump-bindings-v1', 'evil', 4], data: [...OLD, ['jump-account-token', '<script>alert(1)</script>'], ['privy:token', 'x'], ['rift-player-name', 7], ['__proto__', '1'], ['rift-settings'], 'rift-settings', null, { 0: 'rift-settings', 1: '{}' }] }, () => null)!;
    expect(asMap(read.write)).toEqual(asMap(OLD)); expect(read.dropped).toBe(8); expect(read.left).toEqual(['jump-bindings-v1']);
  });
  it('refuses what is not a hand-over', () => {
    for (const bad of [null, undefined, 'take', 7, [], {}, { hand: 'ready' }, { hand: 'take' }, { hand: 'take', data: 'x' }, { hand: 'take', data: { length: 1, 0: ['rift-player-name', 'x'] } }]) expect(taken(bad, () => null), JSON.stringify(bad)).toBeNull();
    expect(taken({ hand: 'take', data: [] }, () => null)).toEqual({ write: [], kept: [], left: [], dropped: 0 });
  });
});

type Mode = 'ok' | 'blocked' | 'full';
class FakeStorage {
  private map = new Map<string, string>();
  constructor(private mode: Mode = 'ok', seed: [string, string][] = []) { for (const [key, value] of seed) this.map.set(key, value); }
  private guard() { if (this.mode === 'blocked') throw new DOMException('denied', 'SecurityError'); }
  get length() { this.guard(); return this.map.size; }
  key(i: number) { this.guard(); return [...this.map.keys()][i] ?? null; }
  getItem(key: string) { this.guard(); return this.map.get(key) ?? null; }
  setItem(key: string, value: string) { this.guard(); if (this.mode === 'full') throw new DOMException('full', 'QuotaExceededError'); this.map.set(key, value); }
  removeItem(key: string) { this.guard(); this.map.delete(key); }
  all() { return Object.fromEntries(this.map); }
}
interface Handle { postMessage(data: unknown, target: string): void }
interface FakeWindow { origin: string; listeners: Set<(event: unknown) => void>; seenBy(viewer: FakeWindow): Handle }
function browse(script: string, url: string, storage: Record<string, FakeStorage>, options: { webdriver?: boolean; deaf?: boolean; framedBy?: string; send?: (frame: Handle) => void } = {}) {
  const visits: string[] = [], framed: string[] = [], overheard: unknown[] = [], halted: string[] = [];
  let shown = url, blocked = false, waited = 0;
  for (let next: string | undefined = url; next; ) {
    if (visits.push(next) > 6) throw new Error(`a loop: ${visits.join(' > ')}`);
    let go: string | undefined, clock = 0, ids = 0;
    shown = next; blocked = false;
    const tasks: (() => void)[] = [], timers: { at: number; run: () => void; id: number }[] = [];
    const windowOf = (origin: string): FakeWindow => {
      const handles = new Map<FakeWindow, Handle>();
      const self: FakeWindow = { origin, listeners: new Set(), seenBy(viewer) {
        if (!handles.has(viewer)) handles.set(viewer, { postMessage(data, target) { if (target !== origin && target !== '*') return; const copy = structuredClone(data); tasks.push(() => { for (const listener of [...self.listeners]) listener({ origin: viewer.origin, source: viewer.seenBy(self), data: copy }); }); } });
        return handles.get(viewer)!;
      } };
      return self;
    };
    const open = (address: string, parent?: FakeWindow): FakeWindow => {
      const at = new URL(address), self = windowOf(at.origin), local = storage[at.origin], top = !parent;
      const location = { get origin() { return at.origin; }, get pathname() { return at.pathname; }, get search() { return at.search; }, get hash() { return at.hash; }, replace(to: string) { if (top) go = to; } };
      const history = { state: null, replaceState(_: unknown, __: string, to: string) { const moved = new URL(to, at.href); at.pathname = moved.pathname; at.search = moved.search; at.hash = moved.hash; if (top) shown = at.href; } };
      const append = (node: { tag?: string; content?: string; src?: string; contentWindow?: unknown }) => {
        if (node.content === "script-src 'none'" && top) blocked = true;
        if (node.tag === 'iframe' && node.src) { framed.push(node.src); node.contentWindow = (options.deaf ? windowOf(new URL(node.src).origin) : open(node.src, self)).seenBy(self); }
      };
      const window = { location, history, navigator: { webdriver: options.webdriver === true }, parent: undefined as unknown, stop() { halted.push(at.href); },
        document: { createElement: (tag: string) => ({ tag, setAttribute() { } }), head: { append }, documentElement: { append }, body: null },
        get localStorage() { if (!local) throw new Error('no storage'); return local; },
        addEventListener: (_: string, listener: (event: unknown) => void) => self.listeners.add(listener), removeEventListener: (_: string, listener: (event: unknown) => void) => self.listeners.delete(listener),
        setTimeout: (run: () => void, ms: number) => { timers.push({ at: clock + ms, run, id: ++ids }); return ids; }, clearTimeout: (id: number) => { const at = timers.findIndex(timer => timer.id === id); if (at >= 0) timers.splice(at, 1); } };
      window.parent = parent ? parent.seenBy(self) : window;
      vm.runInNewContext(script, { window, JSON, Date });
      return self;
    };
    if (options.framedBy) {
      const spy = windowOf(options.framedBy);
      spy.listeners.add(event => overheard.push((event as { data: unknown }).data));
      options.send?.(open(next, spy).seenBy(spy));
    } else open(next);
    while (!go) { const task = tasks.shift(); if (task) { task(); continue; } timers.sort((a, b) => a.at - b.at); const timer = timers.shift(); if (!timer) break; waited += timer.at - clock; clock = timer.at; timer.run(); }
    next = go;
  }
  return { visits, shown, blocked, framed, waited, overheard, halted };
}
const two = (old: [string, string][] = OLD, fresh: [string, string][] = [], mode: { old?: Mode; fresh?: Mode } = {}) => ({ [SITES.from]: new FakeStorage(mode.old, old), [SITES.to]: new FakeStorage(mode.fresh, fresh) });
const without = (stored: Record<string, string>, ...keys: string[]) => Object.fromEntries(Object.entries(stored).filter(([key]) => !keys.includes(key)));

describe('the page\'s script, as built', async () => {
  const script = await handoverScript(SITES);
  it('is one plain inline script, set straight after the charset', () => {
    expect(script).not.toMatch(/[^\x20-\x7e]/); expect(script.toLowerCase()).not.toContain('</script'); expect(script.length).toBeLessThan(12000);
    expect(script).not.toMatch(/index-[A-Za-z0-9_-]+\.js/);
    const page = withHandover(readFileSync(new URL('../index.html', import.meta.url), 'utf8'), script);
    expect(page.indexOf('<script>')).toBeLessThan(page.indexOf('<script type="module"')); expect(page).toMatch(/<meta\s+charset=[^>]*><script>\(function\(\)\{/i);
    expect(page.split('<script>').length).toBe(2);
    expect(withHandover('<html><head><title>x</title></head></html>', 'S')).toBe('<html><head><script>S</script><title>x</title></head></html>');
    expect(() => withHandover('<p>no head</p>', 'S')).toThrow();
  });
  it('moves between the game\'s two addresses unless a build names others, and only between two of one site', () => {
    expect(HANDOVER_SITES).toEqual(SITES); expect(handoverSites({})).toEqual(SITES);
    expect(handoverSites({ VITE_HANDOVER_FROM: 'http://jump.dude.localhost:5480/', VITE_HANDOVER_TO: 'http://impact.dude.localhost:5480' })).toEqual({ from: 'http://jump.dude.localhost:5480', to: 'http://impact.dude.localhost:5480' });
    expect(oneSite(SITES)).toBe(true);
    for (const [from, to] of [['http://127.0.0.1:5480', 'http://localhost:5480'], ['https://jump.dude.work', 'https://impact.example.work'], ['http://jump.dude.work', 'https://impact.dude.work'], ['https://dude.work', 'https://impact.dude.work'], ['http://127.0.0.1:5480', 'http://127.0.0.2:5480']]) {
      expect(oneSite({ from, to }), `${from} ${to}`).toBe(false); expect(() => handoverSites({ VITE_HANDOVER_FROM: from, VITE_HANDOVER_TO: to })).toThrow(/one site/);
    }
  });
  it('a guest with an account, settings and a name arrives with all of it; no address ever holds any of it', () => {
    const storage = two(), before = storage[SITES.from].all();
    const first = browse(script, 'https://jump.dude.work/?forge#room=123456&kind=duel', storage);
    expect(first.visits).toEqual(['https://jump.dude.work/?forge#room=123456&kind=duel', 'https://impact.dude.work/?forge#room=123456&kind=duel']);
    expect(first.framed).toEqual(['https://impact.dude.work/#hand=frame']); expect(first.waited).toBe(0);
    expect(first.halted).toEqual(['https://jump.dude.work/?forge#room=123456&kind=duel', 'https://impact.dude.work/#hand=frame']);
    const after = storage[SITES.to].all();
    expect(without(after, MOVED_KEY)).toEqual(before);
    expect(JSON.parse(after[MOVED_KEY])).toMatchObject({ from: SITES.from, took: OLD.length, kept: [], left: [], dropped: 0, failed: [] });
    expect(storage[SITES.from].all()).toEqual(before);
    for (const address of [...first.visits, ...first.framed]) for (const [, value] of OLD) if (value.length > 8) expect(address).not.toContain(value);
  });
  it('the next visit goes across with nothing handed over, and a browser that never stored anything goes at once', () => {
    const storage = two();
    browse(script, 'https://jump.dude.work/', storage);
    const after = storage[SITES.to].all(), second = browse(script, 'https://jump.dude.work/#room=654321&kind=coop', storage);
    expect(second.visits).toEqual(['https://jump.dude.work/#room=654321&kind=coop', 'https://impact.dude.work/#room=654321&kind=coop']); expect(storage[SITES.to].all()).toEqual(after);
    const empty = two([]), went = browse(script, 'https://jump.dude.work/#room=123456&kind=private', empty);
    expect(went.visits).toEqual(['https://jump.dude.work/#room=123456&kind=private', 'https://impact.dude.work/#room=123456&kind=private']);
    expect(went.framed).toEqual([]); expect(went.halted).toEqual([]); expect(empty[SITES.to].all()).toEqual({}); expect(empty[SITES.from].all()).toEqual({});
  });
  it('a new address that has moved in takes nothing more, whatever the old one holds now', () => {
    const storage = two(OLD, [[MOVED_KEY, '{}'], ['rift-player-name', 'Settled']]);
    browse(script, 'https://jump.dude.work/', storage);
    expect(storage[SITES.to].all()).toEqual({ [MOVED_KEY]: '{}', 'rift-player-name': 'Settled' });
  });
  it('a player who already played at the new address keeps that account; the old token is kept beside it', () => {
    const storage = two(OLD, [['jump-account-token', OTHER], ['rift-settings', '{"quality":"low"}']]);
    browse(script, 'https://jump.dude.work/', storage);
    const after = storage[SITES.to].all();
    expect(after['jump-account-token']).toBe(OTHER); expect(after[SPARE_KEY]).toBe(GUEST); expect(after['rift-settings']).toBe('{"quality":"low"}');
    expect(after['jump-account-login']).toBeUndefined(); expect(after['jump-account-pending']).toBeUndefined(); expect(after['rift-player-name']).toBe('Kōhai 🔥');
    expect(JSON.parse(after[MOVED_KEY]).kept).toEqual(expect.arrayContaining(['jump-account-token', 'rift-settings']));
  });
  it('no link hands anybody an account: a mark in an address is taken out, and stores nothing', () => {
    for (const link of ['https://impact.dude.work/#hand=frame', `https://impact.dude.work/#room=123456&kind=duel&hand=take.${OTHER}`, `https://jump.dude.work/#hand=take.${OTHER}`, 'https://jump.dude.work/#hand=frame']) {
      const storage = two([]), went = browse(script, link, storage);
      expect(storage[SITES.to].all(), link).toEqual({}); expect(went.shown).not.toContain('hand='); expect(new URL(went.shown).origin).toBe(SITES.to); expect(went.blocked).toBe(false);
    }
  });
  it('another site that frames either address is handed nothing, and can hand nothing in', () => {
    const storage = two([]), spied = browse(script, 'https://impact.dude.work/#hand=frame', storage, { framedBy: 'https://evil.example', send: frame => { frame.postMessage({ hand: 'take', data: [['jump-account-token', OTHER], ['rift-player-name', 'Mallory']], left: [] }, SITES.to); frame.postMessage({ hand: 'take', data: [['jump-account-token', OTHER]] }, '*'); } });
    expect(storage[SITES.to].all()).toEqual({}); expect(spied.overheard).toEqual([]);
    const held = two(), framedOld = browse(script, 'https://jump.dude.work/', held, { framedBy: 'https://evil.example' });
    expect(framedOld.overheard).toEqual([]);
  });
  it('blocked or full storage still ends on the game, with no loop and no wait', () => {
    const blockedOld = two(OLD, [], { old: 'blocked' }), went = browse(script, 'https://jump.dude.work/#room=123456&kind=duel', blockedOld);
    expect(went.visits).toEqual(['https://jump.dude.work/#room=123456&kind=duel', 'https://impact.dude.work/#room=123456&kind=duel']); expect(went.framed).toEqual([]);
    for (const fresh of ['blocked', 'full'] as const) {
      const storage = two(OLD, [], { fresh }), there = browse(script, 'https://jump.dude.work/#room=123456&kind=duel', storage);
      expect(there.visits.length, fresh).toBe(2); expect(there.shown).toBe('https://impact.dude.work/#room=123456&kind=duel'); expect(there.waited).toBe(0);
      expect(storage[SITES.from].all()).toEqual(Object.fromEntries(OLD));
    }
  });
  it('a frame that never answers costs the wait, then the game; after three the old address stops asking', () => {
    const storage = two();
    for (let n = 1; n <= TRIES; n++) {
      const went = browse(script, 'https://jump.dude.work/#room=123456&kind=duel', storage, { deaf: true });
      expect(went.shown).toBe('https://impact.dude.work/#room=123456&kind=duel'); expect(went.waited).toBe(WAIT); expect(JSON.parse(storage[SITES.from].all()[TRIES_KEY]).n).toBe(n);
    }
    const fourth = browse(script, 'https://jump.dude.work/', storage, { deaf: true });
    expect(fourth.framed).toEqual([]); expect(fourth.waited).toBe(0); expect(fourth.visits.length).toBe(2);
    const again = two([...OLD, [TRIES_KEY, JSON.stringify({ n: 2, at: Date.now() })]]);
    browse(script, 'https://jump.dude.work/', again);
    expect(again[SITES.from].all()[TRIES_KEY]).toBeUndefined(); expect(again[SITES.to].all()['jump-account-token']).toBe(GUEST);
  });
  it('lets nothing else start on a page it is leaving, and stays out of the way everywhere else', () => {
    expect(browse(script, 'https://jump.dude.work/', two()).visits.length).toBe(2);
    const stayed = browse(script, 'https://jump.dude.work/?nomove', two(), { webdriver: true });
    expect(stayed.visits.length).toBe(1); expect(stayed.blocked).toBe(false); expect(stayed.framed).toEqual([]);
    expect(browse(script, 'https://jump.dude.work/?nomove', two()).shown).toBe('https://impact.dude.work/?nomove');
    for (const elsewhere of ['http://localhost:5173/#hand=frame', 'https://preview.example/#room=123456&kind=duel&hand=frame']) {
      const went = browse(script, elsewhere, two()); expect(went.shown).toBe(elsewhere); expect(went.blocked).toBe(false);
    }
    const home = browse(script, 'https://impact.dude.work/?forge#room=123456&kind=duel', two());
    expect(home.visits.length).toBe(1); expect(home.blocked).toBe(false); expect(home.framed).toEqual([]);
  });
});

describe('run, in the page', () => {
  it('never throws, whatever the page is', () => {
    expect(() => run({} as never, SITES)).not.toThrow();
    expect(() => run({ location: { origin: SITES.to, pathname: '/', search: '', hash: '#hand=frame' }, parent: {}, get localStorage(): Storage { throw new Error('denied'); } } as never, SITES)).not.toThrow();
    expect(() => run({ location: { origin: SITES.from, pathname: '/', search: '', hash: '', replace() { throw new Error('no'); } }, navigator: {} } as never, SITES)).not.toThrow();
    expect(() => run({ location: { origin: SITES.from } } as never, { from: SITES.from, to: SITES.from })).not.toThrow();
  });
});
