import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PlayerTwoVerifier } from '../src/server/economy/playertwo';
import { Economy, mountEconomy } from '../src/server/economy/api';
import { AccountClient, type Poster, type Store } from '../src/ui/shop/account';
import { signInWithPlayerTwo } from '../src/ui/shop/playerTwo';
import type { SurvivalReport } from '../src/game/economy/earn';
import type { Account } from '../src/game/economy/account';

type Answer = { account: Account; signedIn?: boolean; token?: string };
const run = (id: string): SurvivalReport => ({ id, mode: 'survival', fighter: 'zoro', seconds: 800, round: 7, rank: 3, bosses: 7, finishers: 3, score: 2_000_000, kills: 1800, style: 4 });
const clock = (start = Date.UTC(2026, 9, 21, 12)) => { let at = start; const now = () => at; now.pass = (seconds: number) => { at += seconds * 1000; }; return now; };
const memory = (): Store => { const data = new Map<string, string>(); return { get: key => data.get(key), set: (key, value) => { if (value === undefined) data.delete(key); else data.set(key, value); } }; };
const part = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const PLAYER = 'p2player0000000001';

function standIn(now: () => number = Date.now) {
  const make = () => ({ ...crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }), kid: crypto.randomBytes(8).toString('base64url') });
  let current = make();
  const published = [current], asked: string[] = [], state = { down: false };
  const fetcher = (async (url: unknown) => {
    asked.push(String(url));
    if (state.down) throw new Error('offline');
    return { ok: true, json: async () => ({ keys: published.map(k => ({ ...k.publicKey.export({ format: 'jwk' }), kid: k.kid, alg: 'RS256', use: 'sig' })) }) };
  }) as unknown as typeof fetch;
  const identity = (sub = PLAYER, claims: Record<string, unknown> = {}, header: Record<string, unknown> = {}, key = current) => {
    const at = Math.floor(now() / 1000);
    const head = `${part({ alg: 'RS256', typ: 'JWT', kid: key.kid, ...header })}.${part({ iss: 'https://playertwo.lol', aud: 'impact', sub, typ: 'p2-id', h: 'tester', name: 'Tester', pic: null, lvl: 3, kind: 'full', sid: 'a-session', iat: at, exp: at + 600, ...claims })}`;
    return `${head}.${crypto.sign('sha256', Buffer.from(head), key.privateKey).toString('base64url')}`;
  };
  return { fetcher, asked, state, identity, rotate: () => { current = make(); published.push(current); }, unpublished: make, get key() { return current; } };
}

describe('Player Two: its identities checked (src/server/economy/playertwo.ts)', () => {
  it('takes one Player Two signed for this game, and refuses every other kind of token', async () => {
    const p2 = standIn(), check = new PlayerTwoVerifier({ fetcher: p2.fetcher });
    expect(await check.verify(p2.identity())).toEqual({ id: PLAYER, handle: 'tester', name: 'Tester', level: 3, kind: 'full' });
    expect(p2.asked).toEqual(['https://playertwo.lol/.well-known/p2-keys.json']);
    const now = Math.floor(Date.now() / 1000);
    await expect(check.verify(p2.identity(PLAYER, { aud: 'another-game' }))).rejects.toThrow(/another game/);
    await expect(check.verify(p2.identity(PLAYER, { iss: 'https://evil.example' }))).rejects.toThrow(/not a Player Two identity/);
    await expect(check.verify(p2.identity(PLAYER, { typ: undefined, iss: 'playertwo.lol', g: 'impact', d: 'a-device', k: 'full' }))).rejects.toThrow(/not a Player Two identity/);
    await expect(check.verify(p2.identity(PLAYER, { exp: now - 60 }))).rejects.toThrow(/ran out/);
    await expect(check.verify(p2.identity(PLAYER, { iat: now + 3600, exp: now + 4200 }))).rejects.toThrow(/future/);
    await expect(check.verify(p2.identity('short'))).rejects.toThrow(/no player/);
    await expect(check.verify(p2.identity(PLAYER, { kind: 'owner' }))).rejects.toThrow(/no player/);
    const [head, , sig] = p2.identity().split('.');
    await expect(check.verify(`${head}.${part({ iss: 'https://playertwo.lol', aud: 'impact', sub: 'p2player0000000002', typ: 'p2-id', kind: 'full', exp: now + 600 })}.${sig}`)).rejects.toThrow(/did not check out/);
    await expect(check.verify(p2.identity(PLAYER, {}, {}, p2.unpublished()))).rejects.toThrow(/did not check out/);
    await expect(check.verify(`${head}.${part({ sub: PLAYER })}.`)).rejects.toThrow(/malformed/);
    await expect(check.verify(p2.identity(PLAYER, {}, { alg: 'none' }))).rejects.toThrow(/unexpected type/);
    const pem = p2.key.publicKey.export({ type: 'spki', format: 'pem' }) as string;
    const hsHead = `${part({ alg: 'HS256', typ: 'JWT', kid: p2.key.kid })}.${part({ iss: 'https://playertwo.lol', aud: 'impact', sub: PLAYER, typ: 'p2-id', kind: 'full', exp: now + 600 })}`;
    await expect(check.verify(`${hsHead}.${crypto.createHmac('sha256', pem).update(hsHead).digest('base64url')}`)).rejects.toThrow(/unexpected type/);
    await expect(check.verify('x'.repeat(9000))).rejects.toThrow(/malformed/);
    await expect(new PlayerTwoVerifier({ fetcher: p2.fetcher, game: 'another-game' }).verify(p2.identity())).rejects.toThrow(/another game/);
  });

  it('keeps Player Two\'s keys an hour, asks again early for a new key at most once a minute, and keeps them while Player Two is away', async () => {
    const now = clock(), p2 = standIn(now), check = new PlayerTwoVerifier({ fetcher: p2.fetcher, now, keys: 'http://127.0.0.1:5492/.well-known/p2-keys.json' });
    await check.verify(p2.identity()); await check.verify(p2.identity());
    expect(p2.asked).toEqual(['http://127.0.0.1:5492/.well-known/p2-keys.json']);
    p2.rotate();
    now.pass(30);
    await expect(check.verify(p2.identity())).rejects.toThrow(/did not check out/);
    now.pass(31);
    expect((await check.verify(p2.identity())).id).toBe(PLAYER);
    expect(p2.asked).toHaveLength(2);
    now.pass(3601); p2.state.down = true;
    expect((await check.verify(p2.identity())).id).toBe(PLAYER);
    expect(p2.asked).toHaveLength(3);
    const away = standIn(); away.state.down = true;
    await expect(new PlayerTwoVerifier({ fetcher: away.fetcher }).verify(away.identity())).rejects.toThrow(/Could not reach Player Two/);
  });
});

describe('Player Two: signing in with it (Economy.signInPlayerTwo)', () => {
  it('keeps the guest under the login, folds a second device in, and is signed in once', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'economy-p2-'));
    try {
      const now = clock(), p2 = standIn(now), e = new Economy({ dir, now, playerTwo: { fetcher: p2.fetcher } });
      const guest = e.hello(undefined) as Answer;
      e.complete(guest.account.pk, run('p2-run-1'));
      const signed = await e.signInPlayerTwo(guest.token, p2.identity()) as Answer;
      expect(signed.token).toMatch(/^s_/); expect(signed.account.pk).toBe(guest.account.pk); expect(signed.signedIn).toBe(true);
      expect(e.book.byLogin(`p2:${PLAYER}`)?.pk).toBe(guest.account.pk);
      const links = () => readFileSync(join(dir, 'ledger.jsonl'), 'utf8').split('\n').filter(line => line.includes('"t":"link"')).length;
      expect(links()).toBe(1);
      const again = await e.signInPlayerTwo(signed.token, p2.identity()) as Answer;
      expect(again.token).toBeUndefined(); expect(again.account.pk).toBe(guest.account.pk); expect(links()).toBe(1);
      const other = e.hello(undefined) as Answer;
      e.complete(other.account.pk, run('p2-run-2'));
      const both = e.book.accounts.get(guest.account.pk)!.balance + e.book.accounts.get(other.account.pk)!.balance;
      const second = await e.signInPlayerTwo(other.token, p2.identity()) as Answer;
      expect(second.account.pk).toBe(guest.account.pk); expect(second.account.balance).toBe(both); expect(second.account.stats.runs).toBe(2);
      expect(e.book.accounts.has(other.account.pk)).toBe(false); expect(e.book.find(other.token)?.pk).toBe(guest.account.pk);
      e.close();
      const back = new Economy({ dir, now, playerTwo: { fetcher: p2.fetcher } });
      expect(back.book.byLogin(`p2:${PLAYER}`)?.pk).toBe(guest.account.pk); expect(back.book.find(signed.token)?.pk).toBe(guest.account.pk); expect(back.book.find(second.token)?.pk).toBe(guest.account.pk);
      back.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('never takes over an account that has a login of its own, and refuses what is not an identity for this game', async () => {
    const p2 = standIn(), e = new Economy({ dir: false, playerTwo: { fetcher: p2.fetcher } });
    const first = await e.signInPlayerTwo(undefined, p2.identity()) as Answer;
    expect(first.token).toMatch(/^s_/); expect(first.signedIn).toBe(true);
    const second = await e.signInPlayerTwo(first.token, p2.identity('p2player0000000002')) as Answer;
    expect(second.account.pk).not.toBe(first.account.pk); expect(e.book.byLogin(`p2:${PLAYER}`)?.pk).toBe(first.account.pk);
    await expect(e.signInPlayerTwo(undefined, p2.identity(PLAYER, { aud: 'another-game' }))).rejects.toThrow(/another game/);
    await expect(e.signInPlayerTwo(undefined, 'not a token')).rejects.toThrow(/malformed/);
    e.close();
  });

  it('answers over HTTP from the hosted copy', async () => {
    const p2 = standIn(), posts = new Map<string, (req: unknown, res: unknown) => void>(); let gate: ((req: unknown, res: unknown, next: () => void) => void) | undefined;
    const economy = mountEconomy({ use: (_path, handler) => { gate = handler as never; }, post: (path, handler) => { posts.set(path, handler as never); } }, { dir: false, playerTwo: { fetcher: p2.fetcher } });
    const answer = await new Promise<{ status: number; allow?: string; body: Answer }>(resolve => {
      const req = Object.assign(new EventEmitter(), { method: 'POST', headers: { origin: 'https://impact.playertwo.cc' } as Record<string, string> });
      const headers: Record<string, string> = {};
      const res = { statusCode: 0, setHeader: (k: string, v: string) => { headers[k.toLowerCase()] = v; }, removeHeader: (k: string) => { delete headers[k.toLowerCase()]; }, end: (text?: string) => resolve({ status: res.statusCode, allow: headers['access-control-allow-origin'], body: JSON.parse(text ?? '{}') }) };
      gate!(req, res, () => { posts.get('/api/economy/p2-signin')!(req, res); queueMicrotask(() => { req.emit('data', Buffer.from(JSON.stringify({ identity: p2.identity() }))); req.emit('end'); }); });
    });
    expect(answer.status).toBe(200); expect(answer.allow).toBe('https://impact.playertwo.cc'); expect(answer.body.token).toMatch(/^s_/); expect(answer.body.signedIn).toBe(true);
    economy.close();
  });
});

describe('Player Two: the browser signs in with it (src/ui/shop/playerTwo.ts)', () => {
  const wire = (economy: Economy) => {
    const calls: string[] = [];
    const post: Poster = async (path, body) => {
      calls.push(path);
      const b = body as Record<string, unknown>;
      try {
        const answer = path === 'hello' ? economy.hello(b.token) : path === 'p2-signin' ? await economy.signInPlayerTwo(b.token, b.identity) : undefined;
        return { status: 200, body: JSON.parse(JSON.stringify(answer)) };
      } catch (error) { return { status: (error as { status?: number }).status ?? 500, body: { error: (error as Error).message } }; }
    };
    return { post, calls };
  };

  it('signs in once as the Player Two player, again only as another, and not at all outside Player Two', async () => {
    const p2 = standIn(), economy = new Economy({ dir: false, playerTwo: { fetcher: p2.fetcher } }), { post, calls } = wire(economy), local = memory();
    const client = new AccountClient(post, local);
    let who = PLAYER;
    const find = async () => ({ identity: async () => p2.identity(who), player: { handle: 'tester' } });
    await client.open();
    const guest = client.account!.pk;
    expect(await signInWithPlayerTwo({ account: client, find, local })).toBe(true);
    expect(client.wallet.signedIn).toBe(true); expect(client.account!.pk).toBe(guest); expect(client.login).toBe('with Player Two as @tester');
    expect(client.secret()).toMatch(/^s_/);
    const reloaded = new AccountClient(post, local);
    await reloaded.start();
    const asked = calls.length;
    expect(await signInWithPlayerTwo({ account: reloaded, find, local })).toBe(false);
    expect(calls.length).toBe(asked);
    who = 'p2player0000000002';
    expect(await signInWithPlayerTwo({ account: reloaded, find, local })).toBe(true);
    expect(reloaded.account!.pk).not.toBe(guest);
    expect(await signInWithPlayerTwo({ account: reloaded, find: async () => undefined, local })).toBe(false);
    economy.close();
  });
});
