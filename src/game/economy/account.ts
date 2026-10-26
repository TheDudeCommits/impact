import { BUNDLE, EMOTE_SLOTS, ITEM, STARTERS, bundlePrice, priceOf, type Item, type ItemKind, type Worn } from './catalog';
import { RARITY } from './rarity';
import { FEATS, FEAT } from './feats';
import { ALL_DAILY_BONUS, dailyMissions, weeklyMissions, type Mission } from './missions';
import { PAY, dayOf, levelOf, payFor, plausible, roundsCleared, underCap, weekOf, type PayLine, type Report } from './earn';
import { onRoadAt } from './unlocks';

export interface AccountStats {
  runs: number; matches: number; wins: number;
  rounds: number; bosses: number; finishers: number; kills: number;
  seals: number; sealedWith: string[]; sBosses: number;
  bestRank: number; bestStyle: number; fastBoss: number;
  bestStreak: number;
}
export interface Owned { at: number; serial?: number }
export interface Account {
  pk: string;
  created: number;
  label?: string;
  balance: number;
  earned: number; spent: number;
  bought: number;
  xp: number;
  items: Record<string, Owned>;
  refunded?: Record<string, number>;
  allAccess?: boolean;
  redeemed?: Record<string, number>;
  name?: string;
  nameAt?: number;
  worn: Worn;
  feats: string[];
  stats: AccountStats;
  day: { date: string; pay: number; played: number; progress: Record<string, number>; done: string[]; all: boolean; fighters: string[] };
  week: { id: string; progress: Record<string, number>; done: string[] };
  streak: { last: string; days: number };
  reported: string[];
}

export function newAccount(pk: string, now: number): Account {
  return { pk, created: now, balance: 0, earned: 0, spent: 0, bought: 0, xp: 0,
    items: Object.fromEntries(STARTERS.map(id => [id, { at: now }])),
    worn: { entrance: 'entrance-paper', title: 'title-rookie', emotes: ['emote-interrobang'] }, feats: [],
    stats: { runs: 0, matches: 0, wins: 0, rounds: 0, bosses: 0, finishers: 0, kills: 0, seals: 0, sealedWith: [], sBosses: 0, bestRank: 0, bestStyle: 0, fastBoss: 0, bestStreak: 0 },
    day: { date: '', pay: 0, played: 0, progress: {}, done: [], all: false, fighters: [] }, week: { id: '', progress: {}, done: [] },
    streak: { last: '', days: 0 }, reported: [] };
}

export function roll(account: Account, now: number) {
  const day = dayOf(now), week = weekOf(now);
  if (account.day.date !== day) account.day = { date: day, pay: 0, played: 0, progress: {}, done: [], all: false, fighters: [] };
  if (account.week.id !== week) account.week = { id: week, progress: {}, done: [] };
}

export interface Settlement {
  refused?: string;
  lines: PayLine[];
  total: number; xp: number;
  level: { from: number; to: number };
  missions: string[]; feats: string[];
  capped: boolean;
}

export function settle(account: Account, raw: Report, now: number, verified = false, past: number = PAY.past): Settlement {
  const none: Settlement = { lines: [], total: 0, xp: 0, level: { from: levelOf(account.xp).level, to: levelOf(account.xp).level }, missions: [], feats: [], capped: false };
  const checked = plausible(raw, verified);
  if ('refused' in checked) return { ...none, refused: checked.refused };
  const report = checked.report;
  if (account.reported.includes(report.id)) return { ...none, refused: 'That result was already counted.' };
  roll(account, now);
  account.reported = [...account.reported.slice(-39), report.id];
  const lines: PayLine[] = [];
  const base = payFor(report), asked = base.reduce((sum, line) => sum + line.amount, 0), paid = underCap(asked, account.day.pay, past);
  const share = asked > 0 ? paid / asked : 0;
  for (const line of base) lines.push({ label: line.label, amount: line.amount * share });
  const capped = paid < asked - 1e-6;
  account.day.pay += asked;
  if (account.day.played === 0) {
    lines.push({ label: 'First of the day', amount: PAY.firstOfDay });
    const yesterday = dayOf(now - 86400000);
    account.streak.days = account.streak.last === yesterday ? account.streak.days + 1 : 1;
    account.streak.last = account.day.date;
    account.stats.bestStreak = Math.max(account.stats.bestStreak, account.streak.days);
    lines.push({ label: `Day ${account.streak.days} running`, amount: PAY.streak[(account.streak.days - 1) % PAY.streak.length] });
  }
  account.day.played++;
  const stats = account.stats, fresh = { fighter: !account.day.fighters.includes(report.fighter) };
  if (fresh.fighter) account.day.fighters.push(report.fighter);
  if (report.mode === 'survival') {
    stats.runs++; stats.rounds += roundsCleared(report); stats.bosses += report.bosses; stats.finishers += report.finishers; stats.kills += report.kills;
    stats.bestRank = Math.max(stats.bestRank, report.rank); stats.bestStyle = Math.max(stats.bestStyle, report.style); stats.sBosses += report.sBosses ?? 0;
    if (report.fastBoss) stats.fastBoss = stats.fastBoss ? Math.min(stats.fastBoss, report.fastBoss) : report.fastBoss;
    if (report.sealed) { stats.seals++; if (!stats.sealedWith.includes(report.fighter)) stats.sealedWith.push(report.fighter); }
  } else { stats.matches++; if (report.place === 1) stats.wins++; }
  const missions: string[] = [];
  const advance = (list: Mission[], book: { progress: Record<string, number>; done: string[] }) => {
    for (const mission of list) {
      if (book.done.includes(mission.id)) continue;
      const at = (book.progress[mission.id] ?? 0) + mission.count(report, fresh);
      book.progress[mission.id] = Math.min(mission.goal, at);
      if (at >= mission.goal) { book.done.push(mission.id); missions.push(mission.id); lines.push({ label: mission.text, amount: mission.pay }); }
    }
  };
  const today = dailyMissions(account.day.date);
  advance(today, account.day);
  if (!account.day.all && today.every(mission => account.day.done.includes(mission.id))) { account.day.all = true; lines.push({ label: "All of the day's missions", amount: ALL_DAILY_BONUS }); }
  advance(weeklyMissions(account.week.id), account.week);
  const from = levelOf(account.xp).level, xp = Math.round((PAY.xp + asked) * (past > 0 || asked <= 0 ? 1 : share) + missions.length * 10);
  account.xp += xp;
  const to = levelOf(account.xp).level;
  for (let level = from + 1; level <= to; level++) lines.push({ label: `Account level ${level}`, amount: PAY.level(level) });
  const feats: string[] = [];
  for (const feat of FEATS) if (!account.feats.includes(feat.id) && feat.done(stats, account.xp)) { account.feats.push(feat.id); feats.push(feat.id); lines.push({ label: `Feat: ${feat.name}`, amount: feat.pay }); }
  const whole = lines.map(line => ({ label: line.label, amount: Math.round(line.amount) })).filter(line => line.amount > 0);
  const total = whole.reduce((sum, line) => sum + line.amount, 0);
  account.balance += total; account.earned += total;
  return { lines: whole, total, xp, level: { from, to }, missions, feats, capped };
}

export type Owner = Pick<Account, 'items'> & Partial<Pick<Account, 'allAccess' | 'xp' | 'feats'>>;

const isOut = (id: string) => { const stage = ITEM.get(id)?.stage; return !!stage && stage !== 'next' && stage !== 'ask'; };

export function owns(owner: Owner | undefined, id: string): boolean {
  if (!owner) return false;
  if (owner.items[id]) return true;
  if (onRoadAt(levelOf(owner.xp ?? 0).level, id)) return true;
  return !!owner.allAccess && isOut(id);
}

export function gate(owner: Owner | undefined, item: Item, subject = 'It'): string | undefined {
  if (owner?.allAccess) return undefined;
  const rule = RARITY[item.rarity];
  if (levelOf(owner?.xp ?? 0).level < rule.level) return `${subject} opens at account level ${rule.level}.`;
  if (item.feat && !owner?.feats?.includes(item.feat)) return `${subject} asks for a feat first: ${FEAT.get(item.feat)?.text ?? item.feat}`;
  return undefined;
}
export function unlocked(owner: Owner | undefined, id: string): boolean {
  const item = ITEM.get(id);
  return !!item && !gate(owner, item);
}

export function cannotBuy(account: Account, id: string, sold: number): string | undefined {
  const item = ITEM.get(id);
  if (!item) return 'There is no such item.';
  if (item.stage !== 'live') return 'That one is not in Account yet.';
  if (owns(account, id)) return 'You already own it.';
  const rule = RARITY[item.rarity], gated = gate(account, item);
  if (gated) return gated;
  if (rule.supply !== undefined && sold >= rule.supply) return `All ${rule.supply} copies are gone.`;
  if (account.balance < priceOf(item)) return `It costs ${priceOf(item).toLocaleString('en-US')}; you have ${Math.floor(account.balance).toLocaleString('en-US')}.`;
  return undefined;
}
export function buy(account: Account, id: string, sold: number, now: number): { refused: string } | { owned: Owned; price: number } {
  const refused = cannotBuy(account, id, sold);
  if (refused) return { refused };
  const item = ITEM.get(id)!, price = priceOf(item);
  account.balance -= price; account.spent += price;
  const owned: Owned = { at: now, ...(RARITY[item.rarity].supply !== undefined ? { serial: sold + 1 } : {}) };
  account.items[id] = owned;
  return { owned, price };
}

export function cannotBuyBundle(account: Account, id: string): string | undefined {
  const bundle = BUNDLE.get(id);
  if (!bundle) return 'There is no such set.';
  const left = bundle.items.filter(each => !owns(account, each));
  if (!left.length) return 'You own all of it already.';
  for (const each of left) {
    const item = ITEM.get(each)!, rule = RARITY[item.rarity];
    if (item.stage !== 'live') return `${item.name} is not in Account yet.`;
    if (rule.supply !== undefined) return `${item.name} is numbered, and is unlocked alone.`;
    const gated = gate(account, item, item.name);
    if (gated) return gated;
  }
  const { price } = bundlePrice(bundle, each => owns(account, each));
  if (account.balance < price) return `It costs ${price.toLocaleString('en-US')}; you have ${Math.floor(account.balance).toLocaleString('en-US')}.`;
  return undefined;
}
export function buyBundle(account: Account, id: string, now: number): { refused: string } | { owned: string[]; price: number } {
  const refused = cannotBuyBundle(account, id);
  if (refused) return { refused };
  const bundle = BUNDLE.get(id)!, { price } = bundlePrice(bundle, each => owns(account, each));
  const owned = bundle.items.filter(each => !owns(account, each));
  account.balance -= price; account.spent += price;
  for (const each of owned) account.items[each] = { at: now };
  return { owned, price };
}

export function wear(account: Account, kind: ItemKind, id: string | undefined): { refused: string } | { worn: Worn } {
  if (kind === 'fighter') return { refused: 'A fighter is played, not worn.' };
  if (id !== undefined) {
    const item = ITEM.get(id);
    if (!item || item.kind !== kind) return { refused: 'That does not go there.' };
    if (!owns(account, id)) return { refused: 'You do not own it.' };
  }
  if (kind === 'emote') {
    const wheel = account.worn.emotes ?? [];
    if (id === undefined) account.worn.emotes = [];
    else if (wheel.includes(id)) account.worn.emotes = wheel.filter(each => each !== id);
    else account.worn.emotes = [...wheel, id].slice(-EMOTE_SLOTS);
  } else if (kind === 'outfit') {
    if (id === undefined) { delete account.worn.outfits; return { worn: account.worn }; }
    const fighter = ITEM.get(id)!.fighter!, outfits = { ...account.worn.outfits };
    if (outfits[fighter] === id) delete outfits[fighter]; else outfits[fighter] = id;
    account.worn.outfits = outfits;
  } else if (id === undefined) delete account.worn[kind];
  else account.worn[kind] = id;
  return { worn: account.worn };
}

export function credit(account: Account, amount: number) {
  account.balance += amount;
  account.earned += amount;
}

export function merge(into: Account, from: Account) {
  into.balance += from.balance; into.earned += from.earned; into.spent += from.spent; into.bought = (into.bought ?? 0) + (from.bought ?? 0);
  into.xp = Math.max(into.xp, from.xp);
  if (from.allAccess) into.allAccess = true;
  if (from.redeemed) into.redeemed = { ...from.redeemed, ...into.redeemed };
  for (const [id, owned] of Object.entries(from.items)) into.items[id] ??= owned;
  for (const feat of from.feats) if (!into.feats.includes(feat)) into.feats.push(feat);
  const a = into.stats, b = from.stats;
  for (const key of ['runs', 'matches', 'wins', 'rounds', 'bosses', 'finishers', 'kills', 'seals', 'sBosses'] as const) a[key] += b[key];
  for (const key of ['bestRank', 'bestStyle', 'bestStreak'] as const) a[key] = Math.max(a[key], b[key]);
  a.fastBoss = a.fastBoss && b.fastBoss ? Math.min(a.fastBoss, b.fastBoss) : a.fastBoss || b.fastBoss;
  for (const fighter of b.sealedWith) if (!a.sealedWith.includes(fighter)) a.sealedWith.push(fighter);
  from.balance = 0;
}
