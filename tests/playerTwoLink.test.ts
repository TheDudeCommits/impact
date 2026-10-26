import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Economy, mountEconomy } from '../src/server/economy/api';
import type { SurvivalReport } from '../src/game/economy/earn';
import type { Account } from '../src/game/economy/account';

type Answer = { account: Account; signedIn?: boolean; token?: string; code?: string; until?: number; linked?: boolean };
const PLAYER = 'p2player0000000001', OTHER = 'p2player0000000002';
const clock = (start = Date.UTC(2026, 9, 21, 12)) => { let at = start; const now = () => at; now.pass = (seconds: number) => { at += seconds * 1000; }; return now; };
const run = (id: string, over: Partial<SurvivalReport> = {}): SurvivalReport => ({ id, mode: 'survival', fighter: 'zoro', seconds: 800, round: 7, rank: 3, bosses: 7, finishers: 3, score: 2_000_000, kills: 1800, style: 4, ...over });
const part = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
function identities(now: () => number) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }), kid = 'k1';
  const fetcher = (async () => ({ ok: true, json: async () => ({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid }] }) })) as unknown as typeof fetch;
  const identity = (sub = PLAYER, handle = 'tester') => {
    const at = Math.floor(now() / 1000), head = `${part({ alg: 'RS256', kid })}.${part({ iss: 'https://playertwo.lol', aud: 'impact', sub, typ: 'p2-id', h: handle, name: handle.toUpperCase(), lvl: 2, kind: 'full', iat: at, exp: at + 600 })}`;
    return `${head}.${crypto.sign('sha256', Buffer.from(head), privateKey).toString('base64url')}`;
  };
  return { fetcher, identity };
}
function trophyServer() {
  const given: string[] = [];
  const fetcher = (async (url: unknown) => { given.push(decodeURIComponent(String(url).split('/trophies/')[1])); return { ok: true, status: 200, json: async () => ({ new: true }) }; }) as unknown as typeof fetch;
  return { fetcher, given };
}

describe('Player Two: an account brought over from impact.dude.work', () => {
  it('folds the account played in the frame into the one impact.dude.work kept, which keeps the Player Two login', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'economy-link-'));
    try {
      const now = clock(), ids = identities(now), p2 = trophyServer();
      const make = () => new Economy({ dir, now, playerTwo: { fetcher: ids.fetcher }, trophies: { key: ['p2g', 'test', 'game', 'key', '0123456789'].join('_'), fetcher: p2.fetcher, log: () => {} } });
      const e = make();
      const home = e.hello(undefined) as Answer;
      e.complete(home.account.pk, run('home-run-1', { rank: 4 }));
      const held = [...e.book.accounts.get(home.account.pk)!.feats];
      const framed = await e.signInPlayerTwo(undefined, ids.identity()) as Answer;
      now.pass(60);
      e.complete(framed.account.pk, run('frame-run-1'));
      const sum = e.book.accounts.get(home.account.pk)!.balance + e.book.accounts.get(framed.account.pk)!.balance;
      const issued = await e.linkCode(framed.token, ids.identity()) as Answer;
      expect(issued.code).toMatch(/^[A-Za-z0-9_-]{32}$/); expect(issued.until).toBe(now() + 600_000);
      expect(e.linkInfo(issued.code)).toEqual({ player: { handle: 'tester', name: 'TESTER' } });
      const moved = e.link(issued.code, home.token) as Answer;
      expect(moved.linked).toBe(true); expect(moved.account.pk).toBe(home.account.pk); expect(moved.signedIn).toBe(true);
      expect(moved.account.balance).toBe(sum); expect(moved.account.stats.runs).toBe(2);
      expect(e.book.byLogin(`p2:${PLAYER}`)?.pk).toBe(home.account.pk);
      expect(e.book.find(framed.token)?.pk).toBe(home.account.pk); expect(e.book.accounts.has(framed.account.pk)).toBe(false);
      await e.trophies.flush();
      expect(p2.given.sort()).toEqual([...new Set([...held, 'first-run'])].sort());
      expect(() => e.link(issued.code, home.token)).toThrow(/run out/);
      e.close();
      const back = make();
      expect(back.book.byLogin(`p2:${PLAYER}`)?.pk).toBe(home.account.pk); expect(back.book.find(framed.token)?.pk).toBe(home.account.pk);
      expect(back.book.accounts.get(home.account.pk)!.balance).toBe(sum);
      back.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('asks a fresh identity of the same player, runs out, and refuses what is not its to move', async () => {
    const now = clock(), ids = identities(now), e = new Economy({ dir: false, now, playerTwo: { fetcher: ids.fetcher } });
    const framed = await e.signInPlayerTwo(undefined, ids.identity()) as Answer;
    const guest = e.hello(undefined) as Answer;
    await expect(e.linkCode(guest.token, ids.identity())).rejects.toThrow(/Sign in with Player Two first/);
    await expect(e.linkCode(framed.token, ids.identity(OTHER))).rejects.toThrow(/Sign in with Player Two first/);
    await expect(e.linkCode(framed.token, 'not a token')).rejects.toThrow(/malformed/);
    const late = await e.linkCode(framed.token, ids.identity()) as Answer;
    now.pass(601);
    expect(() => e.linkInfo(late.code)).toThrow(/run out/); expect(() => e.link(late.code, guest.token)).toThrow(/run out/);
    const first = await e.linkCode(framed.token, ids.identity()) as Answer, second = await e.linkCode(framed.token, ids.identity()) as Answer;
    expect(() => e.linkInfo(first.code)).toThrow(/run out/); expect(e.linkInfo(second.code).player.handle).toBe('tester');
    expect(() => e.link(second.code, 'f'.repeat(32))).toThrow(/not known/);
    const other = await e.signInPlayerTwo(undefined, ids.identity(OTHER, 'someone')) as Answer;
    expect(() => e.link(second.code, other.token)).toThrow(/another Player Two player/);
    expect((e.link(second.code, framed.token) as Answer).account.pk).toBe(framed.account.pk);
    for (let i = 0; i < 7; i++) await e.linkCode(framed.token, ids.identity());
    await expect(e.linkCode(framed.token, ids.identity())).rejects.toThrow(/Too many/);
    e.close();
  });

  it('keeps the username the player chose in Player Two when the account brought over had none', async () => {
    const now = clock(), ids = identities(now), e = new Economy({ dir: false, now, playerTwo: { fetcher: ids.fetcher } });
    const home = e.hello(undefined) as Answer;
    const framed = await e.signInPlayerTwo(undefined, ids.identity()) as Answer;
    e.claimName(framed.token, 'FramedName');
    const issued = await e.linkCode(framed.token, ids.identity()) as Answer;
    const moved = e.link(issued.code, home.token) as Answer;
    expect(moved.account.name).toBe('FramedName'); expect(e.book.nameHolder('framedname')).toBe(home.account.pk);
    e.close();
  });

  it('answers impact.dude.work over HTTP', async () => {
    const now = clock(), ids = identities(now), posts = new Map<string, (req: unknown, res: unknown) => void>(); let gate: ((req: unknown, res: unknown, next: () => void) => void) | undefined;
    const economy = mountEconomy({ use: (_path, handler) => { gate = handler as never; }, post: (path, handler) => { posts.set(path, handler as never); } }, { dir: false, now, playerTwo: { fetcher: ids.fetcher } });
    const call = (path: string, body: unknown, origin: string) => new Promise<{ status: number; allow?: string; body: Answer & { player?: { handle: string }; error?: string } }>(resolve => {
      const req = Object.assign(new EventEmitter(), { method: 'POST', headers: { origin } as Record<string, string> });
      const headers: Record<string, string> = {};
      const res = { statusCode: 0, setHeader: (k: string, v: string) => { headers[k.toLowerCase()] = v; }, removeHeader: (k: string) => { delete headers[k.toLowerCase()]; }, end: (text?: string) => resolve({ status: res.statusCode, allow: headers['access-control-allow-origin'], body: JSON.parse(text ?? '{}') }) };
      gate!(req, res, () => { posts.get(`/api/economy/${path}`)!(req, res); queueMicrotask(() => { req.emit('data', Buffer.from(JSON.stringify(body))); req.emit('end'); }); });
    });
    const home = economy.hello(undefined) as Answer;
    const framed = await call('p2-signin', { identity: ids.identity() }, 'https://impact.playertwo.cc');
    const issued = await call('p2-link-code', { token: framed.body.token, identity: ids.identity() }, 'https://impact.playertwo.cc');
    expect(issued.status).toBe(200); expect(issued.body.code).toMatch(/^[A-Za-z0-9_-]{32}$/);
    const info = await call('p2-link-info', { code: issued.body.code }, 'https://impact.dude.work');
    expect(info.allow).toBe('https://impact.dude.work'); expect(info.body.player?.handle).toBe('tester');
    const moved = await call('p2-link', { code: issued.body.code, token: home.token }, 'https://impact.dude.work');
    expect(moved.status).toBe(200); expect(moved.body.account.pk).toBe(home.account.pk);
    expect((await call('p2-link', { code: issued.body.code, token: home.token }, 'https://impact.dude.work')).status).toBe(400);
    economy.close();
  });
});
