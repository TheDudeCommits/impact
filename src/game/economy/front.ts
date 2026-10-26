import { ITEMS, type Item, type ItemKind } from './catalog';

const DAY = 86_400_000, WEEK = 7 * DAY;
const weekIndex = (now: number) => Math.floor((now - 4 * DAY) / WEEK);

export const EFFECT_KINDS: readonly ItemKind[] = ['aura', 'skin', 'kill', 'trail', 'banner', 'emote', 'form'];
const sold = (kinds: readonly ItemKind[]) => ITEMS.filter(item => item.stage === 'live' && kinds.includes(item.kind));

export interface Featured { fighter?: Item; outfit?: Item; effect?: Item }
export function featured(now: number): Featured {
  const w = weekIndex(now), pick = (list: readonly Item[], step: number) => list.length ? list[((w * step) % list.length + list.length) % list.length] : undefined;
  return { fighter: pick(sold(['fighter']), 1), outfit: pick(sold(['outfit']), 1), effect: pick(sold(EFFECT_KINDS), 1) };
}

export function turnover(now: number) {
  const day = Math.floor(now / DAY) * DAY + DAY;
  const monday = day + ((8 - new Date(day).getUTCDay()) % 7) * DAY;
  return { day: day - now, week: monday - now };
}
