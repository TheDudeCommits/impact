import { afterEach, describe, expect, it, vi } from 'vitest';

type Calls = { presence: (string | null)[]; init: number; invites?: Record<string, string>[] };
function sdk(calls: Calls, { refuse = false, env = 'p2', params = null as Record<string, string> | null, inviteFails = false } = {}) {
  const api = {
    identity: async () => 'a.b.c', player: { handle: 'tester' }, params,
    presence: { set: async (text: string | null) => { calls.presence.push(text); return { ok: true }; } },
    invite: async (p: Record<string, string>) => { if (inviteFails) throw new Error('offline'); (calls.invites ??= []).push(p); return `https://playertwo.lol/game/impact?join=${Buffer.from(JSON.stringify(p)).toString('base64url')}`; },
  };
  const p2 = { env: 'disabled', init: async () => { calls.init++; p2.env = env; if (refuse) throw Object.assign(new Error('signed out'), { code: 'signed-out' }); return api; } };
  return p2;
}
const fresh = async () => { vi.resetModules(); return import('../src/boot/playerTwo'); };
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
afterEach(() => { delete (globalThis as { PlayerTwo?: unknown }).PlayerTwo; vi.unstubAllGlobals(); });

describe('Player Two in the page (src/boot/playerTwo.ts)', () => {
  it('finds Player Two once, and tells its friends the mode only when it changes', async () => {
    const calls: Calls = { presence: [], init: 0 };
    (globalThis as { PlayerTwo?: unknown }).PlayerTwo = sdk(calls);
    const p2 = await fresh();
    expect(p2.inPlayerTwo()).toBe(false);
    expect(await p2.playerTwo()).toBeTruthy(); expect(await p2.playerTwo()).toBeTruthy();
    expect(calls.init).toBe(1); expect(p2.inPlayerTwo()).toBe(true);
    p2.presence('Duel'); p2.presence('Duel'); await settle();
    p2.presence(null); p2.presence('BR vs Players'); await settle();
    expect(calls.presence).toEqual(['Duel', null, 'BR vs Players']);
  });

  it('does nothing without the SDK, outside Player Two, or when its page has no session to give', async () => {
    let p2 = await fresh();
    expect(await p2.playerTwo()).toBeUndefined(); expect(p2.inPlayerTwo()).toBe(false);
    p2.presence('Duel'); await settle();
    const outside: Calls = { presence: [], init: 0 };
    (globalThis as { PlayerTwo?: unknown }).PlayerTwo = sdk(outside, { env: 'disabled', refuse: true });
    p2 = await fresh();
    expect(await p2.playerTwo()).toBeUndefined(); expect(p2.inPlayerTwo()).toBe(false);
    const signedOut: Calls = { presence: [], init: 0 };
    (globalThis as { PlayerTwo?: unknown }).PlayerTwo = sdk(signedOut, { refuse: true });
    p2 = await fresh();
    expect(await p2.playerTwo()).toBeUndefined(); expect(p2.inPlayerTwo()).toBe(true);
    p2.presence('Duel'); await settle();
    expect(signedOut.presence).toEqual([]);
  });

  it('reads who an identity names without checking it (the server checks)', async () => {
    const p2 = await fresh(), part = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
    expect(p2.identityPlayer(`${part({ alg: 'RS256' })}.${part({ sub: 'p2player0000000001' })}.sig`)).toBe('p2player0000000001');
    expect(p2.identityPlayer('nonsense')).toBeUndefined();
  });

  it('makes invite links Player Two\'s inside its player, and the game\'s own everywhere else', async () => {
    const own = 'https://impact.dude.work/#room=123456&kind=private';
    let p2 = await fresh();
    expect(await p2.inviteLink({ room: '123456', kind: 'private' }, own)).toBe(own);
    const calls: Calls = { presence: [], init: 0 };
    (globalThis as { PlayerTwo?: unknown }).PlayerTwo = sdk(calls);
    p2 = await fresh();
    await p2.playerTwo();
    expect(await p2.inviteLink({ party: '654321' }, own)).toMatch(/^https:\/\/playertwo\.lol\/game\/impact\?join=/);
    expect(calls.invites).toEqual([{ party: '654321' }]);
    (globalThis as { PlayerTwo?: unknown }).PlayerTwo = sdk({ presence: [], init: 0 }, { inviteFails: true });
    p2 = await fresh(); await p2.playerTwo();
    expect(await p2.inviteLink({ party: '654321' }, own)).toBe(own);
  });

  it('reads a join link\'s params as the game\'s own invite links carry them, and nothing else', async () => {
    const { joinHash } = await fresh();
    expect(joinHash({ room: '123456', kind: 'coop' })).toBe('#room=123456&kind=coop');
    expect(joinHash({ room: '123456', kind: 'duel' })).toBe('#room=123456&kind=duel');
    expect(joinHash({ party: '654321' })).toBe('#party=654321');
    expect(joinHash({ mode: 'last-stand', room: '111222' })).toBe('#mode=last-stand&room=111222');
    expect(joinHash({ mode: 'rift-war', room: '111222' })).toBe('#mode=rift-war&room=111222');
    for (const bad of [null, 'room=1', {}, { room: '12345' }, { room: '123456', kind: 'admin' }, { room: '123456' }, { party: '12a456' }, { mode: 'boss', room: '123456' }, { room: '123456&kind=duel#x', kind: 'duel' }])
      expect([bad, joinHash(bad)]).toEqual([bad, '']);
  });

  it('puts a join link\'s room into the address before the game reads it, inside Player Two only', async () => {
    const page = (hash = '') => {
      const at = { pathname: '/', search: '', hash, written: [] as string[] };
      vi.stubGlobal('window', globalThis);
      vi.stubGlobal('location', at);
      vi.stubGlobal('history', { state: null, replaceState: (_s: unknown, _t: string, url: string) => { at.written.push(url); at.hash = url.slice(url.indexOf('#')); } });
      vi.stubGlobal('document', { querySelector: () => null });
      return at;
    };
    let at = page();
    (globalThis as { PlayerTwo?: unknown }).PlayerTwo = sdk({ presence: [], init: 0 }, { params: { room: '123456', kind: 'private' } });
    vi.resetModules(); await import('../src/boot/playerTwoJoin');
    expect(at.written).toEqual(['/#room=123456&kind=private']);
    at = page('#party=999999');
    (globalThis as { PlayerTwo?: unknown }).PlayerTwo = sdk({ presence: [], init: 0 }, { params: { room: '123456', kind: 'private' } });
    vi.resetModules(); await import('../src/boot/playerTwoJoin');
    expect(at.written).toEqual([]);
    at = page();
    (globalThis as { PlayerTwo?: unknown }).PlayerTwo = sdk({ presence: [], init: 0 });
    vi.resetModules(); await import('../src/boot/playerTwoJoin');
    delete (globalThis as { PlayerTwo?: unknown }).PlayerTwo;
    vi.resetModules(); await import('../src/boot/playerTwoJoin');
    expect(at.written).toEqual([]);
  });
});
