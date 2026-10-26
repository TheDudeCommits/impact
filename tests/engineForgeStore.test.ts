import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { appendFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Economy } from '../src/server/economy/api';
import { FORGE_KEEP, ForgeStore } from '../src/server/forge/ForgeStore';
import { encodeForge, ownKit, shortForgeHash, type ForgeKit } from '../src/engine/sim';
import type { FighterId } from '../src/game/types';

const kit = (body: FighterId, special: FighterId, name = 'Flame Hero'): ForgeKit => ({ ...ownKit(body, name), slots: { ...ownKit(body).slots, special: { from: special } } });
type Answer = { account: { pk: string }; token?: string; kept?: unknown; kit?: unknown };

function privy(appId: string) {
  const key = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = { ...key.publicKey.export({ format: 'jwk' }), kid: 'k1' };
  const fetcher = (async () => ({ ok: true, json: async () => ({ keys: [jwk] }) })) as unknown as typeof fetch;
  const token = (did: string) => {
    const part = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const head = `${part({ alg: 'ES256', typ: 'JWT', kid: 'k1' })}.${part({ iss: 'privy.io', aud: appId, sub: did, exp: Math.floor(Date.now() / 1000) + 600 })}`;
    return `${head}.${crypto.sign('sha256', Buffer.from(head), { key: key.privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
  };
  return { fetcher, token };
}
async function signedIn(economy: Economy, p: ReturnType<typeof privy>, did: string) {
  const guest = economy.hello(undefined) as Answer;
  return (await economy.signIn(guest.token, p.token(did)) as Answer).token!;
}

describe('forged fighters kept on the account', () => {
  it('keeps a checked kit for its maker, lists it, shares it by hash and removes it', () => {
    const store = new ForgeStore(), forged = kit('endeavor', 'goku'), code = encodeForge(forged);
    const kept = store.save('pk-a', code);
    expect(kept).toMatchObject({ hash: shortForgeHash(forged), name: 'Flame Hero', body: 'endeavor', owner: 'pk-a' });
    expect(store.save('pk-a', code)).toEqual(kept);
    expect(store.mine('pk-a')).toHaveLength(1); expect(store.mine('pk-b')).toEqual([]);
    expect(store.get(kept.hash)).toEqual({ hash: kept.hash, code, name: 'Flame Hero', body: 'endeavor', at: kept.at });
    expect(store.get('not-a-hash')).toBeUndefined();
    expect(() => store.remove('pk-b', kept.hash)).toThrow(/not yours/);
    store.remove('pk-a', kept.hash);
    expect(store.mine('pk-a')).toEqual([]); expect(store.get(kept.hash)).toBeUndefined();
  });

  it('refuses a damaged or over-budget kit, a blocked name, and more than the keep or the day allows', () => {
    let at = Date.UTC(2026, 9, 10, 12);
    const store = new ForgeStore(undefined, () => at);
    expect(() => store.save('pk', 'JF1.nope.00000000')).toThrow();
    expect(() => store.save('pk', 7)).toThrow(/isn't a Forge code/);
    const greedy: ForgeKit = { ...kit('endeavor', 'goku'), slots: { light: { from: 'naruto', tune: { power: 1.2 } }, heavy: { from: 'saitama', tune: { power: 1.2 } }, special: { from: 'vegeta', tune: { power: 1.2 } }, ultimate: { from: 'ace', tune: { power: 1.2 } } } };
    expect(() => store.save('pk', encodeForge(greedy))).toThrow(/can't be kept/);
    expect(() => store.save('pk', encodeForge(kit('endeavor', 'goku', 'Official Admin')))).toThrow(/not allowed/);
    const bodies = ['endeavor', 'aokiji', 'zoro', 'goku', 'naruto', 'luffy'] as FighterId[];
    for (let i = 0; i < FORGE_KEEP; i++) store.save('pk', encodeForge(kit(bodies[i % bodies.length], 'goku', `Kit ${i}`)));
    expect(() => store.save('pk', encodeForge(kit('endeavor', 'goku', 'One More')))).toThrow(/remove one first/);
    for (const each of store.mine('pk').slice(0, 15)) store.remove('pk', each.hash);
    expect(() => { for (let i = 0; i < 12; i++) store.save('pk', encodeForge(kit('aokiji', 'goku', `Again ${i}`))); }).toThrow(/enough forging for today/);
    at += 86400_000 + 1;
    expect(store.save('pk', encodeForge(kit('aokiji', 'goku', 'Tomorrow'))).name).toBe('Tomorrow');
  });

  it('survives a restart: the file is replayed, removals included, and a torn last line is skipped', () => {
    const dir = mkdtempSync(join(tmpdir(), 'forge-store-'));
    try {
      let store = new ForgeStore(dir);
      const a = store.save('pk', encodeForge(kit('endeavor', 'goku', 'Keeps'))), b = store.save('pk', encodeForge(kit('aokiji', 'zoro', 'Goes')));
      store.remove('pk', b.hash);
      appendFileSync(join(dir, 'forge.jsonl'), '{"t":"save","kit":{"hash');
      store = new ForgeStore(dir);
      expect(store.mine('pk').map(each => each.hash)).toEqual([a.hash]);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it("answers over the economy's API: signed-in only to keep, anyone to load by hash", async () => {
    const p = privy('app-one'), e = new Economy({ dir: false, privyAppId: 'app-one', fetcher: p.fetcher });
    const guest = (e.hello(undefined) as Answer).token, code = encodeForge(kit('endeavor', 'goku'));
    await expect(e.forgeSave(guest, code)).rejects.toThrow(/Sign in/);
    const token = await signedIn(e, p, 'did:privy:maker');
    const { kept } = await e.forgeSave(token, code) as { kept: { hash: string } };
    expect((e.forgeMine(token) as { kept: unknown[] }).kept).toHaveLength(1);
    expect((e.forgeGet(kept.hash) as { kit: { code: string } }).kit.code).toBe(code);
    expect(() => e.forgeGet('0000000000000000')).toThrow(/no forged fighter/i);
    expect((e.forgeRemove(token, kept.hash) as { kept: unknown[] }).kept).toEqual([]);
    e.close();
  });
});
