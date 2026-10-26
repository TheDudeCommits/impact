import { describe, expect, it } from 'vitest';
import { AccountClient, Refused, type Poster, type Store } from '../src/ui/shop/account';
import { Economy } from '../src/server/economy/api';
import type { SurvivalReport } from '../src/game/economy/earn';

const run = (id: string, over: Partial<SurvivalReport> = {}): SurvivalReport => ({ id, mode: 'survival', fighter: 'zoro', seconds: 800, round: 7, rank: 3, bosses: 7, finishers: 3, score: 2_000_000, kills: 1800, style: 4, ...over });
const clock = (start = Date.UTC(2026, 8, 30, 12)) => { let at = start; const now = () => at; now.pass = (seconds: number) => { at += seconds * 1000; }; return now; };
const memory = (): Store & { data: Map<string, string> } => { const data = new Map<string, string>(); return { data, get: key => data.get(key), set: (key, value) => { if (value === undefined) data.delete(key); else data.set(key, value); } }; };

function wire(economy: Economy) {
  const state = { down: false, calls: [] as string[] };
  const post: Poster = async (path, body) => {
    state.calls.push(path);
    if (state.down) throw new Error('offline');
    const b = body as Record<string, unknown>;
    try {
      const answer = path === 'hello' ? economy.hello(b.token) : path === 'report' ? economy.report(b.token, b.report as never) : path === 'buy' ? economy.buy(b.token, b.item)
        : path === 'wear' ? economy.wear(b.token, b.kind, b.item) : path === 'signout' ? economy.signOut(b.token) : undefined;
      return { status: 200, body: JSON.parse(JSON.stringify(answer)) };
    } catch (error) { return { status: (error as { status?: number }).status ?? 500, body: { error: (error as Error).message } }; }
  };
  return { post, state };
}

describe('the economy: the browser\'s account', () => {
  it('opens no account by looking, one before a server match, and remembers it', async () => {
    const now = clock(), economy = new Economy({ dir: false, now }), { post, state } = wire(economy), store = memory();
    const client = new AccountClient(post, store, async () => { now.pass(9); });
    await client.start();
    expect(state.calls).toEqual([]); expect(client.known).toBe(false); expect(economy.book.accounts.size).toBe(0);
    await client.open();economy.complete(client.account!.pk,run('client-run-1'));
    const paid = await client.report(run('client-run-1'));
    expect(paid.settlement!.total).toBeGreaterThan(100); expect(client.account!.balance).toBe(paid.settlement!.total); expect(economy.book.accounts.size).toBe(1);
    const again = new AccountClient(post, store, async () => { now.pass(9); });
    expect(again.account!.balance).toBe(paid.settlement!.total); expect(again.wallet.live).toBe(false);
    await again.start();
    expect(again.wallet.live).toBe(true); expect(again.account!.pk).toBe(client.account!.pk); expect(economy.book.accounts.size).toBe(1);
    economy.close();
  });

  it('keeps a result the server could not be reached with, and is paid for it later', async () => {
    const now = clock(), economy = new Economy({ dir: false, now }), { post, state } = wire(economy), store = memory();
    const client = new AccountClient(post, store, async () => { now.pass(9); });
    await client.open();economy.complete(client.account!.pk,run('kept-run-a'));economy.complete(client.account!.pk,run('kept-run-b'));
    state.down = true;
    expect(await client.report(run('kept-run-a'))).toEqual({ kept: true });
    expect(await client.report(run('kept-run-b'))).toEqual({ kept: true });
    expect(client.account!.stats.runs).toBe(0);
    state.down = false;
    const later = new AccountClient(post, store, async () => { now.pass(9); });
    await later.start(); await later.flush();
    expect(later.account!.stats.runs).toBe(2); expect(store.get('jump-account-pending')).toBe('[]');
    now.pass(60);
    economy.complete(later.account!.pk,run('quick-run-a'));economy.complete(later.account!.pk,run('quick-run-b'));
    await later.report(run('quick-run-a'));
    expect((await later.report(run('quick-run-b'))).settlement).toBeDefined();
    await later.flush();
    expect(later.account!.stats.runs).toBe(4);
    now.pass(60);
    expect((await later.report(run('invented-run'))).refused).toMatch(/No completed/);
    expect(store.get('jump-account-pending')).toBe('[]');
    economy.close();
  });

  it('buys and wears, tells its listeners, and says why the server refused', async () => {
    const now = clock(), economy = new Economy({ dir: false, now, adminToken: 'owner' }), { post } = wire(economy);
    const client = new AccountClient(post, memory(), async () => { now.pass(9); });
    const seen: number[] = [];
    client.on(wallet => seen.push(wallet.account?.balance ?? -1));
    await client.open();economy.complete(client.account!.pk,run('buyer-run-1'));
    economy.grant('Bearer owner', client.account!.pk, 1000, undefined);
    await client.report(run('buyer-run-1'));
    await client.buy('skin-negative');
    await client.wear('skin', 'skin-negative');
    expect(client.account!.worn.skin).toBe('skin-negative'); expect(seen.length).toBe(5); expect(seen.slice(0, 2)).toEqual([-1, 0]); expect(seen[3]).toBe(seen[2] - 400);
    await expect(client.buy('fighter-roger')).rejects.toBeInstanceOf(Refused);
    await expect(client.buy('fighter-roger')).rejects.toThrow(/costs 2,400/);
    economy.close();
  });

  it('asks for an account again when the server no longer knows its token', async () => {
    const now = clock(), store = memory();
    let economy = new Economy({ dir: false, now }), wired = wire(economy);
    const client = new AccountClient((path, body) => wired.post(path, body), store, async () => { now.pass(9); });
    await client.open();economy.complete(client.account!.pk,run('lost-run-1'));
    await client.report(run('lost-run-1'));
    const first = client.account!.pk;
    economy.close(); economy = new Economy({ dir: false, now }); wired = wire(economy);
    now.pass(60);
    const paid = await client.report(run('lost-run-2'));
    expect(paid.refused).toMatch(/No completed/); expect(client.account!.pk).not.toBe(first); expect(client.account!.stats.runs).toBe(0);
    economy.close();
  });
});
