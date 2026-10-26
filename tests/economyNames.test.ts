import { ROSTER_PROTOCOL } from '../src/game/rosterProtocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Client } from 'colyseus';
import { Economy, mountEconomy } from '../src/server/economy/api';
import { blockedName } from '../src/server/economy/names';
import { NAME_EVERY_DAYS, OWN_NAMES, nameFreeAt, nameProblem } from '../src/game/economy/names';
import { ArenaRoom } from '../src/server/ArenaRoom';
import type { Account } from '../src/game/economy/account';

type Answer = { account: Account; token?: string };
const DAY = 86_400_000;
afterEach(() => vi.restoreAllMocks());

function privy(appId: string) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1' };
  const fetcher = (async () => ({ ok: true, json: async () => ({ keys: [jwk] }) })) as unknown as typeof fetch;
  const token = (did: string) => {
    const part = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const head = `${part({ alg: 'ES256', typ: 'JWT', kid: 'k1' })}.${part({ iss: 'privy.io', aud: appId, sub: did, exp: Math.floor(Date.now() / 1000) + 600 })}`;
    return `${head}.${crypto.sign('sha256', Buffer.from(head), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
  };
  return { fetcher, token };
}
const refused = (work: () => unknown) => { try { work(); } catch (error) { return (error as Error).message; } throw new Error('It was not refused.'); };

describe('usernames', () => {
  it('takes 3-16 letters, digits and _, and refuses reserved names and slurs', () => {
    for (const bad of ['', 'ab', 'a'.repeat(17), 'two words', 'émile', 'dash-name', 'dot.name']) expect(nameProblem(bad), bad).toBeTruthy();
    for (const reserved of ['admin', 'Admin', 'ADMIN_01', '_admin_', 'SuperAdmin', 'moderator', 'Mod', 'JumpImpact', 'Jump', 'official_jump', 'System', 'support', 'Privy',
      ...OWN_NAMES.flatMap(own => [own, own[0].toUpperCase() + own.slice(1), `${own}_99`]), 'TheDude', 'the_dude', 'RealTheDude', 'Dude'])
      expect(nameProblem(reserved), reserved).toBe('That username is reserved.');
    for (const fine of ['Kaito', 'Kai_99', 'x_y', 'Hancock', 'Zoro2026', '123']) expect(nameProblem(fine), fine).toBeUndefined();
    for (const slur of ['fuckface', 'Sh1tHead', 'big_ass', 'A55', 'n1gga', 'the_rapist', 'nazi_88']) expect(blockedName(slur), slur).toBe(true);
    for (const fine of ['Hancock', 'peacock', 'torpedo', 'class', 'password', 'Assassin', 'Dickens', 'Sussex', 'therapist', 'Ashkenazi', 'Analysis']) expect(blockedName(fine), fine).toBe(false);
  });

  it('is claimed by a signed-in account, unique whatever its case, and changed once in 30 days', async () => {
    let at = Date.UTC(2026, 9, 8, 12);
    const p = privy('app-one'), e = new Economy({ dir: false, privyAppId: 'app-one', fetcher: p.fetcher, now: () => at });
    const guest = e.hello(undefined) as Answer;
    expect(refused(() => e.claimName(guest.token, 'Kaito'))).toBe('Sign in to claim a username.');
    const a = (await e.signIn(guest.token, p.token('did:privy:a')) as Answer).token!;
    const b = (await e.signIn((e.hello(undefined) as Answer).token, p.token('did:privy:b')) as Answer).token!;
    expect((e.claimName(a, '  Kaito ') as Answer).account).toMatchObject({ name: 'Kaito', nameAt: at });
    expect(refused(() => e.claimName(b, 'kaito'))).toBe('That username is taken.');
    expect(refused(() => e.claimName(b, 'KAITO'))).toBe('That username is taken.');
    expect(refused(() => e.claimName(b, 'admin_1'))).toBe('That username is reserved.');
    expect(refused(() => e.claimName(b, 'Sh1t_Lord'))).toBe('That username is not allowed.');
    expect(refused(() => e.claimName(b, 'no'))).toMatch(/at least 3/);
    expect(refused(() => e.claimName(a, 'Kaito'))).toBe('That is already your username.');
    expect(refused(() => e.claimName(a, 'Kaito2'))).toBe('You can change your username again on 7 November 2026.');
    expect((e.claimName(a, 'KAITO') as Answer).account).toMatchObject({ name: 'KAITO', nameAt: Date.UTC(2026, 9, 8, 12) });
    at += NAME_EVERY_DAYS * DAY;
    expect(nameFreeAt(e.book.find(a))).toBe(at);
    expect((e.claimName(a, 'Kaito2') as Answer).account).toMatchObject({ name: 'Kaito2', nameAt: at });
    expect((e.claimName(b, 'kaito') as Answer).account.name).toBe('kaito');
    expect(refused(() => e.claimName(b, 'KAITO2'))).toMatch(/You can change|taken/);
    e.close();
  });

  it('never folds an account kept under a login into another one, label or not: its name and codes stay its own', async () => {
    const p = privy('app-one'), e = new Economy({ dir: false, privyAppId: 'app-one', fetcher: p.fetcher });
    const first = (await e.signIn((e.hello(undefined) as Answer).token, p.token('did:privy:first')) as Answer);
    expect(first.account.label).toBeUndefined();
    e.claimName(first.token, 'Wanderer');
    await e.signIn((e.hello(undefined) as Answer).token, p.token('did:privy:second'));
    const switched = await e.signIn(first.token, p.token('did:privy:second')) as Answer;
    expect(switched.account.name).toBeUndefined();
    expect(e.book.byLogin('did:privy:first')).toMatchObject({ pk: first.account.pk, name: 'Wanderer' });
    expect(e.book.nameHolder('wanderer')).toBe(first.account.pk);
    e.close();
  });

  it('keeps usernames in the book: a restart still knows who holds which', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'economy-names-'));
    try {
      const p = privy('app-one');
      let e = new Economy({ dir, privyAppId: 'app-one', fetcher: p.fetcher });
      const a = (await e.signIn((e.hello(undefined) as Answer).token, p.token('did:privy:a')) as Answer).token!;
      const b = (await e.signIn((e.hello(undefined) as Answer).token, p.token('did:privy:b')) as Answer).token!;
      e.claimName(a, 'Kirin');
      e = new Economy({ dir, privyAppId: 'app-one', fetcher: p.fetcher });
      expect(e.book.find(a)!.name).toBe('Kirin'); expect(refused(() => e.claimName(b, 'KIRIN'))).toBe('That username is taken.');
      e.close();
      e = new Economy({ dir, privyAppId: 'app-one', fetcher: p.fetcher });
      expect(e.book.nameHolder('kirin')).toBe(e.book.find(a)!.pk); expect(refused(() => e.claimName(b, 'kirin'))).toBe('That username is taken.');
      expect(readFileSync(join(dir, 'ledger.jsonl'), 'utf8').split('\n').filter(Boolean).map(raw => JSON.parse(raw).t)).toContain('name');
      e.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('is the name a match room gives a signed-in player, read from the account, and nobody else may type it', async () => {
    const p = privy('app-one'), economy = mountEconomy({ use: () => undefined, post: () => undefined }, { dir: false, privyAppId: 'app-one', fetcher: p.fetcher });
    const room = new ArenaRoom();
    vi.spyOn(room, 'setPrivate').mockResolvedValue(undefined); vi.spyOn(room, 'setMetadata').mockResolvedValue(undefined);
    vi.spyOn(room, 'broadcast').mockImplementation(() => {}); vi.spyOn(room, 'lock').mockResolvedValue(undefined);
    vi.spyOn(room, 'setFixedTimestep').mockImplementation(() => {});
    await room.onCreate({rosterProtocol:ROSTER_PROTOCOL, mode: 'match' });
    try {
      const owner = (await economy.signIn((economy.hello(undefined) as Answer).token, p.token('did:privy:owner')) as Answer).token!;
      economy.claimName(owner, 'InkMaster');
      const guest = (economy.hello(undefined) as Answer).token!;
      const join = (id: string, account: string | undefined, name: string) => { const c = { sessionId: id, send: vi.fn() } as unknown as Client; room.clients.push(c); room.onJoin(c, {rosterProtocol:ROSTER_PROTOCOL, fighter: 'goku', account, name, mode: 'match' }); };
      join('o', owner, 'Whatever I typed');
      join('g1', guest, 'inkmaster');
      join('g2', guest, 'Paper Tiger');
      join('g3', guest, '\u0406nkMaster'); join('g4', guest, 'Ink Master'); join('g5', guest, '\uFF29\uFF4E\uFF4B\uFF2D\uFF41\uFF53\uFF54\uFF45\uFF52');
      join('g6', guest, '4dm1n'); join('g7', guest, 'Z\u0335\u0322a\u0334l\u0337g\u0338o  Kid'); join('g8', guest, 'Ink Mister');
      const names = Object.fromEntries(room.simulation.snapshot().players.filter(each => !each.isBot).map(each => [each.id, each.name]));
      expect(names).toEqual({ o: 'InkMaster', g1: 'Fighter', g2: 'Paper Tiger', g3: 'Fighter', g4: 'Fighter', g5: 'Fighter', g6: 'Fighter', g7: 'Zalgo Kid', g8: 'Ink Mister' });
    } finally { room.onDispose(); economy.close(); }
  });
});
