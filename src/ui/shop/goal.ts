import { ITEM, type Item } from '../../game/economy/catalog';
import { levelOf, xpAt } from '../../game/economy/earn';
import { owns, type Account } from '../../game/economy/account';
import { PER_MATCH, ROAD } from '../../game/economy/unlocks';

const KEY = 'jump-shop-goal';
export function goalOf(account: Account | undefined): Item | undefined {
  let id: string | null = null;
  try { id = localStorage.getItem(KEY); } catch { }
  const item = id ? ITEM.get(id) : undefined;
  return item && item.stage === 'live' && item.price !== undefined && !owns(account, item.id) ? item : undefined;
}
export function setGoal(id: string | undefined) {
  try { if (id) localStorage.setItem(KEY, id); else localStorage.removeItem(KEY); } catch { }
}

export function roadNext(account: Account | undefined) {
  const xp = account?.xp ?? 0, level = levelOf(xp).level, step = ROAD.find(each => each.level > level && !owns(account, each.id));
  if (!step) return undefined;
  const item = ITEM.get(step.id)!, to = xpAt(step.level), from = xpAt(level);
  return { item, level: step.level, xpLeft: Math.max(0, to - xp), share: Math.max(0, Math.min(1, (xp - from) / Math.max(1, to - from))), matches: Math.max(1, Math.ceil((to - xp) / PER_MATCH.xp)) };
}

export function savingFor(account: Account | undefined, item: Item) {
  const price = item.price ?? 0, have = Math.floor(account?.balance ?? 0);
  return { price, have, left: Math.max(0, price - have), share: price ? Math.min(1, have / price) : 1, matches: Math.max(1, Math.ceil(Math.max(0, price - have) / PER_MATCH.sumi)) };
}
