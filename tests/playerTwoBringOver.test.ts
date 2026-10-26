import { describe, expect, it } from 'vitest';
import { HOME, bringOver } from '../src/ui/shop/bringOver';
import { HOSTED, awaitCode, codeFrom, isLinkWindow, keptOf, linkHtml } from '../src/boot/playerTwoLink';

const CODE = 'AbCdEfGhIjKlMnOpQrStUvWxYz012345';
type Event = { origin: string; source: unknown; data: unknown };
function ears() {
  const listeners = new Set<(event: Event) => void>();
  return {
    listeners,
    tell: (event: Event) => { for (const each of [...listeners]) each(event); },
    addEventListener: (_: string, fn: (event: Event) => void) => { listeners.add(fn); },
    removeEventListener: (_: string, fn: (event: Event) => void) => { listeners.delete(fn); },
  };
}
function frame({ blocked = false, signedIn = true, slow = false } = {}) {
  const sent: [unknown, string][] = [];
  const popup = { closed: false, close() { this.closed = true; }, postMessage: (message: unknown, origin: string) => { sent.push([message, origin]); } };
  const page = ears(), seen = { opened: [] as string[], identities: [] as string[], starts: 0 };
  let release = () => {};
  const coded = new Promise<void>(done => { release = done; });
  return {
    popup, page, seen, sent, release,
    deps: {
      account: { linkCode: async (identity: string) => { seen.identities.push(identity); if (slow) await coded; return CODE; }, start: async () => { seen.starts++; } },
      find: async () => signedIn ? { identity: async () => 'an.identity.token' } : undefined,
      open: (url: string) => { seen.opened.push(url); return blocked ? null : popup as unknown as Window; },
      page: page as unknown as Pick<Window, 'addEventListener' | 'removeEventListener'>,
    },
  };
}
const until = async (done: () => boolean) => { for (let i = 0; i < 200 && !done(); i++) await new Promise(r => setTimeout(r, 5)); };
const codes = (sent: [unknown, string][]) => sent.filter(([message]) => (message as { p2link?: string }).p2link === 'code');

describe('Player Two: BRING IT OVER in its player (src/ui/shop/bringOver.ts)', () => {
  it('opens impact.dude.work with no code in its address, and hands the code only to that window, at that origin, once it is ready', async () => {
    const f = frame(), result = bringOver(f.deps);
    expect(f.seen.opened).toEqual([`${HOME}/#p2link`]); expect(HOME).toBe('https://impact.dude.work');
    await until(() => f.seen.identities.length > 0);
    await new Promise(r => setTimeout(r, 10));
    expect(codes(f.sent)).toEqual([]);
    f.page.tell({ origin: 'https://evil.example', source: f.popup, data: { p2link: 'ready' } });
    f.page.tell({ origin: HOME, source: {}, data: { p2link: 'ready' } });
    expect(codes(f.sent)).toEqual([]);
    f.page.tell({ origin: HOME, source: f.popup, data: { p2link: 'ready' } });
    expect(codes(f.sent)).toEqual([[{ p2link: 'code', code: CODE }, HOME]]);
    expect(f.seen.identities).toEqual(['an.identity.token']);
    f.page.tell({ origin: 'https://evil.example', source: f.popup, data: { p2link: 'done' } });
    f.page.tell({ origin: HOME, source: f.popup, data: { p2link: 'done' } });
    expect(await result).toBe('moved'); expect(f.seen.starts).toBe(1); expect(f.page.listeners.size).toBe(0);
  });

  it('hands the code over once it has it, when the window was ready first', async () => {
    const f = frame({ slow: true }), result = bringOver(f.deps);
    await until(() => f.seen.identities.length > 0);
    f.page.tell({ origin: HOME, source: f.popup, data: { p2link: 'ready' } });
    expect(codes(f.sent)).toEqual([]);
    f.release();
    await until(() => codes(f.sent).length > 0);
    expect(codes(f.sent)).toEqual([[{ p2link: 'code', code: CODE }, HOME]]);
    f.popup.closed = true;
    expect(await result).toBe('left');
  });

  it('says why when the window can\'t open or Player Two has no player, and how it ended when it is closed', async () => {
    await expect(bringOver(frame({ blocked: true }).deps)).rejects.toThrow(/blocked the window/);
    const out = frame({ signedIn: false });
    await expect(bringOver(out.deps)).rejects.toThrow(/Sign in to Player Two/);
    expect(out.popup.closed).toBe(true); expect(out.page.listeners.size).toBe(0); expect(codes(out.sent)).toEqual([]);
    const f = frame(), result = bringOver(f.deps);
    await until(() => f.seen.identities.length > 0);
    f.popup.closed = true;
    expect(await result).toBe('left'); expect(f.seen.starts).toBe(1); expect(codes(f.sent)).toEqual([]);
  });
});

describe('Player Two: the window on impact.dude.work (src/boot/playerTwoLink.ts)', () => {
  it('is only #p2link: an address with a code in it is no such window, and its code is never read', () => {
    expect(isLinkWindow('#p2link')).toBe(true);
    for (const hash of ['', '#', `#p2link=${CODE}`, '#p2link=', '#p2link&x', '#room=123456&kind=duel']) expect([hash, isLinkWindow(hash)]).toEqual([hash, false]);
  });

  it('takes a code only from the window that opened it, at the hosted copy\'s origin, shaped as a code', () => {
    const opener = { postMessage: () => {} }, data = { p2link: 'code', code: CODE };
    expect(HOSTED).toBe('https://impact.playertwo.cc');
    expect(codeFrom({ source: opener, origin: HOSTED, data }, opener)).toBe(CODE);
    expect(codeFrom({ source: opener, origin: 'https://evil.example', data }, opener)).toBeUndefined();
    expect(codeFrom({ source: { postMessage: () => {} }, origin: HOSTED, data }, opener)).toBeUndefined();
    expect(codeFrom({ source: opener, origin: HOSTED, data }, null)).toBeUndefined();
    expect(codeFrom({ source: null, origin: HOSTED, data }, null)).toBeUndefined();
    for (const bad of [{ p2link: 'code', code: 'short' }, { p2link: 'code', code: `${CODE}<x>` }, { p2link: 'code' }, { p2link: 'ready', code: CODE }, null, 'code'])
      expect(codeFrom({ source: opener, origin: HOSTED, data: bad }, opener)).toBeUndefined();
  });

  it('tells its opener it is ready at the hosted copy\'s origin only, until the code comes; with no opener, or no code in time, nothing', async () => {
    const said: [unknown, string][] = [], opener = { postMessage: (message: unknown, origin: string) => { said.push([message, origin]); } };
    const win = Object.assign(ears(), { opener });
    const waiting = awaitCode(win as never, 2000, HOSTED, 10);
    await until(() => said.length >= 3);
    expect(said.every(([message, origin]) => origin === HOSTED && (message as { p2link: string }).p2link === 'ready')).toBe(true);
    win.tell({ origin: 'https://evil.example', source: opener, data: { p2link: 'code', code: CODE } });
    win.tell({ origin: HOSTED, source: { postMessage: () => {} }, data: { p2link: 'code', code: CODE } });
    win.tell({ origin: HOSTED, source: opener, data: { p2link: 'code', code: CODE } });
    expect(await waiting).toBe(CODE); expect(win.listeners.size).toBe(0);
    expect(await awaitCode(Object.assign(ears(), { opener: null }) as never)).toBeUndefined();
    const late = Object.assign(ears(), { opener: { postMessage: () => {} } });
    const nothing = awaitCode(late as never, 60, HOSTED, 10);
    late.tell({ origin: 'https://evil.example', source: late.opener, data: { p2link: 'code', code: CODE } });
    expect(await nothing).toBeUndefined(); expect(late.listeners.size).toBe(0);
  });

  it('names the account that would move and where it goes, asks first, and escapes what it shows', () => {
    const kept = keptOf(JSON.stringify({ account: { name: '<b>Kiri</b>', xp: 0, balance: 1234.6 } }));
    expect(kept).toEqual({ name: '<b>Kiri</b>', level: 1, sumi: 1234 });
    expect(keptOf('not json')).toBeNull(); expect(keptOf(null)).toBeNull();
    const ask = linkHtml({ at: 'ask', to: { handle: 'tester', name: 'Tester "T"' }, kept });
    expect(ask).toContain('@tester'); expect(ask).toContain('&lt;b&gt;Kiri&lt;/b&gt;'); expect(ask).not.toContain('<b><b>Kiri');
    expect(ask).toContain('Tester &quot;T&quot;'); expect(ask).toContain('1,234 Sumi'); expect(ask).toContain("can't be undone");
    expect(ask).toContain('data-link="go"'); expect(ask).toContain('data-link="cancel"');
    expect(linkHtml({ at: 'ask', to: { handle: 'tester', name: '' }, kept: null })).toContain('The Impact account this browser kept');
    expect(linkHtml({ at: 'unopened' })).toMatch(/only when Impact opens it from Player Two.*Nothing was moved/);
    expect(linkHtml({ at: 'none' })).toMatch(/no Impact account to bring over/);
    expect(linkHtml({ at: 'refused', why: 'This link has run out. <x>' })).toContain('This link has run out. &lt;x&gt;');
    expect(linkHtml({ at: 'done' })).toMatch(/closes by itself/);
  });
});
