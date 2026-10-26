import { describe, expect, it } from 'vitest';
import { appendFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Economy } from '../src/server/economy/api';
import type { Account } from '../src/game/economy/account';
import { priceNow, refundRelevant, refundWhy, refundsDue, type LedgerLine } from '../src/game/economy/refunds';
import { ITEM } from '../src/game/economy/catalog';
import { RARITY } from '../src/game/economy/rarity';

let seq = 0;
const buy = (pk: string, item: string, paid: number, why?: string): LedgerLine => ({ seq: ++seq, t: 'buy', pk, item, amount: -paid, ...(why ? { why } : {}) });

describe('the price drop\'s refunds', () => {
  it('knows what each item costs now: its price, nothing on the road alone, no new price retired', () => {
    expect(priceNow('fighter-kaido')).toBe(2000);
    expect(priceNow('fighter-griffith')).toBe(1600);
    expect(priceNow('aura-azure-flame')).toBe(0);
    expect(priceNow('skin-newsprint')).toBeUndefined();
    expect(priceNow('aura-ink-dragon')).toBeUndefined();
    expect(priceNow('no-such-item')).toBeUndefined();
  });

  it('gives back what was paid above today\'s price, item by item', () => {
    const due = refundsDue([
      buy('a', 'fighter-kaido', 15000), buy('a', 'outfit-luffy-gear5', 1800), buy('a', 'aura-azure-flame', 600),
      buy('a', 'skin-newsprint', 60), buy('a', 'skin-authors-hand', 12000),
      buy('b', 'outfit-goku-ssj', 200),
      { seq: ++seq, t: 'grant', pk: 'a', item: 'fighter-shanks', why: 'admin' },
    ]);
    expect(due).toEqual([
      { pk: 'a', item: 'fighter-kaido', amount: 13000 },
      { pk: 'a', item: 'outfit-luffy-gear5', amount: 800 },
      { pk: 'a', item: 'aura-azure-flame', amount: 600 },
    ]);
  });

  it('shares a set\'s price over the pieces it bought, by their own prices then', () => {
    const paid = 900, pieces = ['skin-sumi-e', 'aura-ink-wisps', 'kill-soak', 'banner-brush'];
    const whole = pieces.reduce((sum, id) => sum + RARITY[ITEM.get(id)!.rarity].price, 0);
    const due = refundsDue([buy('c', 'bundle-ink', paid, pieces.join(','))]);
    expect(due).toEqual([{ pk: 'c', item: 'skin-sumi-e', amount: Math.round(paid * 200 / whole) }]);
  });

  it('pays once: a refund already in the ledger is not paid again, and a folded account takes both with it', () => {
    const lines = [buy('guest', 'fighter-madara', 18000), { seq: ++seq, t: 'grant', pk: 'guest', amount: 16000, why: refundWhy('fighter-madara') }];
    expect(refundsDue(lines)).toEqual([]);
    const folded = [...lines, buy('login', 'fighter-sukuna', 18000), { seq: ++seq, t: 'merge', pk: 'guest', into: 'login' }];
    expect(refundsDue(folded)).toEqual([{ pk: 'login', item: 'fighter-sukuna', amount: 16000 }]);
    expect(refundsDue([buy('g2', 'fighter-roger', 18000), { seq: ++seq, t: 'merge', pk: 'g2', into: 'l2' }])).toEqual([{ pk: 'l2', item: 'fighter-roger', amount: 15600 }]);
  });

  it('reads the ledger in its own order, whatever order the files are read in', () => {
    const lines = [buy('d', 'fighter-jiren', 14000), { seq: ++seq, t: 'grant', pk: 'd', amount: 12400, why: refundWhy('fighter-jiren') }];
    expect(refundsDue([...lines].reverse())).toEqual([]);
  });

  it('skips the lines a refund has nothing to do with, unread', () => {
    expect(refundRelevant(JSON.stringify(buy('e', 'skin-negative', 600)))).toBe(true);
    expect(refundRelevant(JSON.stringify({ seq: 1, t: 'grant', pk: 'e', why: refundWhy('skin-negative') }))).toBe(true);
    expect(refundRelevant(JSON.stringify({ seq: 1, t: 'merge', pk: 'e', into: 'f' }))).toBe(true);
    expect(refundRelevant(JSON.stringify({ seq: 1, t: 'wear', pk: 'e', after: { pk: 'e' } }))).toBe(false);
    expect(refundRelevant(JSON.stringify({ seq: 1, t: 'earn', pk: 'e', why: 'verified:match:x' }))).toBe(false);
  });

  it('is paid by the server from its own ledger, once - and again never, across restarts', () => {
    const dir = mkdtempSync(join(tmpdir(), 'economy-refunds-'));
    try {
      let e = new Economy({ dir });
      const hello = e.hello(undefined) as unknown as { token: string; account: Account };
      e.close();
      const book = JSON.parse(readFileSync(join(dir, 'accounts.json'), 'utf8')) as { seq: number; accounts: Account[] };
      const before = book.accounts.find(each => each.pk === hello.account.pk)!;
      const kaido = { ...before, balance: 900, spent: 15000, items: { ...before.items, 'fighter-kaido': { at: 1 } } };
      const flame = { ...kaido, balance: 300, spent: 15600, items: { ...kaido.items, 'aura-azure-flame': { at: 2 } } };
      appendFileSync(join(dir, 'ledger.jsonl'), [{ seq: book.seq + 1, at: 1, t: 'buy', pk: before.pk, after: kaido, item: 'fighter-kaido', amount: -15000 },
        { seq: book.seq + 2, at: 2, t: 'buy', pk: before.pk, after: flame, item: 'aura-azure-flame', amount: -600 }].map(line => JSON.stringify(line)).join('\n') + '\n');
      e = new Economy({ dir });
      const paid = (e.hello(hello.token) as unknown as { account: Account }).account;
      expect(paid.balance).toBe(300 + 13000 + 600);
      expect(paid.refunded).toEqual({ 'fighter-kaido': 13000, 'aura-azure-flame': 600 });
      expect(paid.items['fighter-kaido']).toBeTruthy();
      const ledger = readFileSync(join(dir, 'ledger.jsonl'), 'utf8').split('\n').filter(Boolean).map(raw => JSON.parse(raw) as { why?: string });
      expect(ledger.filter(line => line.why?.startsWith('refund:')).map(line => line.why)).toEqual([refundWhy('fighter-kaido'), refundWhy('aura-azure-flame')]);
      e.close();
      e = new Economy({ dir });
      expect((e.hello(hello.token) as unknown as { account: Account }).account.balance).toBe(13900);
      e.close();
      e = new Economy({ dir });
      expect((e.hello(hello.token) as unknown as { account: Account }).account.balance).toBe(13900);
      e.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
