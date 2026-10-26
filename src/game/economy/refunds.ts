import { ITEM } from './catalog';
import { RARITY } from './rarity';

export interface LedgerLine { seq?: number; t: string; pk: string; item?: string; amount?: number; why?: string; into?: string }
export interface RefundDue { pk: string; item: string; amount: number }

export function priceNow(id: string): number | undefined {
  const item = ITEM.get(id);
  if (!item) return undefined;
  if (item.stage === 'live') return item.price;
  if (item.stage === 'road') return 0;
  return undefined;
}
export const refundWhy = (item: string) => `refund:${item}`;
const refunded = (why: string | undefined) => why?.startsWith('refund:') ? why.slice(7) : undefined;

export const refundRelevant = (raw: string) => raw.includes('"t":"buy"') || raw.includes('"t":"merge"') || raw.includes('refund:');

export function refundsDue(lines: Iterable<LedgerLine>): RefundDue[] {
  const ordered = [...lines].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
  const paid = new Map<string, Map<string, number>>(), done = new Map<string, Set<string>>();
  const book = <T>(map: Map<string, T>, pk: string, make: () => T) => { let got = map.get(pk); if (!got) { got = make(); map.set(pk, got); } return got; };
  for (const line of ordered) {
    if (line.t === 'buy' && line.item && (line.amount ?? 0) < 0) {
      const spent = -(line.amount ?? 0), mine = book(paid, line.pk, () => new Map<string, number>());
      const pieces = line.item.startsWith('bundle-') ? (line.why ?? '').split(',').filter(id => ITEM.has(id)) : [line.item];
      const list = pieces.map(id => line.item!.startsWith('bundle-') ? RARITY[ITEM.get(id)!.rarity].price : 1), whole = list.reduce((sum, n) => sum + n, 0);
      pieces.forEach((id, i) => mine.set(id, (mine.get(id) ?? 0) + spent * list[i] / whole));
    } else if (line.t === 'grant' && refunded(line.why)) book(done, line.pk, () => new Set<string>()).add(refunded(line.why)!);
    else if (line.t === 'merge' && line.into) {
      const from = paid.get(line.pk), into = book(paid, line.into, () => new Map<string, number>());
      for (const [id, amount] of from ?? []) into.set(id, (into.get(id) ?? 0) + amount);
      const was = done.get(line.pk), now = book(done, line.into, () => new Set<string>());
      for (const id of was ?? []) now.add(id);
      paid.delete(line.pk); done.delete(line.pk);
    }
  }
  const due: RefundDue[] = [];
  for (const [pk, items] of paid) for (const [item, spent] of items) {
    const now = priceNow(item), amount = now === undefined ? 0 : Math.round(spent - now);
    if (amount > 0 && !done.get(pk)?.has(item)) due.push({ pk, item, amount });
  }
  return due;
}
