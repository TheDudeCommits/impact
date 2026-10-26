import { describe, expect, it } from 'vitest';
import { BUNDLES, ITEMS, ITEM, KINDS, STARTERS, isBundle, lookOf, onOffer, priceOf, released, wornOf } from '../src/game/economy/catalog';
import { EFFECT_KINDS, featured, turnover } from '../src/game/economy/front';
import { ROAD, UNLOCKS } from '../src/game/economy/unlocks';
import { RARITY, RARITIES } from '../src/game/economy/rarity';
import { FEAT } from '../src/game/economy/feats';
import { DAILY, WEEKLY, dailyMissions, weeklyMissions } from '../src/game/economy/missions';
import { PAY, dayOf, levelOf, payFor, plausible, underCap, weekOf, xpAt, type SurvivalReport, type MatchReport } from '../src/game/economy/earn';
import { buy, cannotBuy, cannotBuyBundle, credit, merge, newAccount, settle, wear } from '../src/game/economy/account';

const NOW = Date.UTC(2026, 8, 30, 12);
const run = (id: string, over: Partial<SurvivalReport> = {}): SurvivalReport => ({ id, mode: 'survival', fighter: 'zoro', seconds: 800, round: 7, rank: 3, bosses: 7, finishers: 3, score: 2_000_000, kills: 1800, style: 4, ...over });
const bout = (id: string, over: Partial<MatchReport> = {}): MatchReport => ({ id, mode: 'match', fighter: 'goku', seconds: 240, place: 1, players: 12, kos: 3, ...over });
const sum = (lines: { amount: number }[]) => lines.reduce((n, line) => n + line.amount, 0);

describe('the economy: the catalogue', () => {
  it('prices by rarity, Common to Mythic, each dearer, and gates nothing by level (8 October: the shop streamlined)', () => {
    const prices = RARITIES.map(r => RARITY[r].price), levels = RARITIES.map(r => RARITY[r].level);
    expect(prices).toEqual([...prices].sort((a, b) => a - b)); expect(new Set(prices).size).toBe(5);
    expect(levels).toEqual([1, 1, 1, 1, 1]);
    expect(RARITY.mythic.supply).toBe(100);
  });
  it('has items with ids of their own, and offers exactly what the one table says, one stage each', () => {
    expect(ITEM.size).toBe(ITEMS.length);
    for (const item of ITEMS) { expect(KINDS[item.kind], item.id).toBeTruthy(); expect(item.id.startsWith(`${item.kind}-`), item.id).toBe(true); }
    for (const [id, how] of Object.entries(UNLOCKS)) {
      const item = ITEM.get(id);
      expect(item, id).toBeTruthy();
      expect(item!.stage, id).toBe(how.price !== undefined ? 'live' : 'road');
      expect(item!.price, id).toBe(how.price); expect(item!.level, id).toBe(how.level);
      expect(how.price !== undefined || how.level !== undefined, id).toBe(true);
    }
    for (const item of ITEMS.filter(each => !UNLOCKS[each.id])) expect(['retired', 'next', 'ask'], item.id).toContain(item.stage);
    expect(ITEMS.filter(onOffer).length).toBe(Object.keys(UNLOCKS).length);
    expect(ITEMS.filter(item => item.kind === 'fighter' && onOffer(item)).length).toBe(20);
    expect(ITEMS.filter(item => item.kind === 'outfit' && onOffer(item)).length).toBe(20);
    expect(ITEMS.filter(onOffer).length).toBeLessThan(ITEMS.filter(released).length * .6);
  });
  it('asks nothing of anything on offer but its price or its road level: no feat', () => {
    for (const item of ITEMS.filter(onOffer)) expect(item.feat, item.id).toBeUndefined();
  });
  it('starts an account with items that exist and are out (retired from sale, still worn)', () => { for (const id of STARTERS) expect(released(ITEM.get(id)), id).toBe(true); });
  it('keeps every place a party is told of where it was: the first seventy-seven items did not move', () => {
    expect(ITEMS[0].id).toBe('skin-newsprint'); expect(ITEMS[76].id).toBe('place-eclipse-ascendant'); expect(ITEMS[77].id).toBe('kill-soak');
    const worn = { skin: 'skin-living-ink', aura: 'aura-rising', trail: 'trail-chalk', kill: 'kill-seal', form: 'form-oni' };
    expect(lookOf(worn)).toHaveLength(5); expect(wornOf(lookOf(worn))).toEqual(worn);
    expect(wornOf(lookOf(worn).slice(0, 3))).toEqual({ skin: 'skin-living-ink', aura: 'aura-rising', trail: 'trail-chalk' });
  });
  it('sells no sets any more: each piece is got its own way', () => {
    expect(BUNDLES).toEqual([]);
    for (const id of ['bundle-ink', 'bundle-cranes', 'bundle-press', 'bundle-gold', 'bundle-crimson']) {
      expect(isBundle(id)).toBe(false);
      expect(cannotBuyBundle(newAccount('a', NOW), id)).toMatch(/no such set/);
    }
  });
  it('features a fighter, an outfit and an effect a week, the same for everyone, all three on sale', () => {
    const week = featured(NOW), later = featured(NOW + 3 * 86400_000), next = featured(NOW + 7 * 86400_000);
    expect(week.fighter?.kind).toBe('fighter'); expect(week.outfit?.kind).toBe('outfit'); expect(EFFECT_KINDS).toContain(week.effect?.kind);
    for (const item of [week.fighter, week.outfit, week.effect]) { expect(item?.stage).toBe('live'); expect(item?.price).toBeGreaterThan(0); }
    expect([later.fighter?.id, later.outfit?.id, later.effect?.id]).toEqual([week.fighter?.id, week.outfit?.id, week.effect?.id]);
    expect(next.fighter?.id).not.toBe(week.fighter?.id);
    const seen = new Set(Array.from({ length: 20 }, (_, i) => featured(NOW + i * 7 * 86400_000).fighter?.id));
    expect(seen.size).toBe(ITEMS.filter(item => item.kind === 'fighter' && item.stage === 'live').length);
    const { day, week: toWeek } = turnover(NOW);
    expect(day).toBe(12 * 3600_000); expect(toWeek).toBeGreaterThan(day - 1); expect(toWeek).toBeLessThanOrEqual(7 * 86400_000);
  });
  it('lays the road from level 2 to 60, a reward at most three levels from the last', () => {
    expect(ROAD[0].level).toBe(2); expect(ROAD[ROAD.length - 1].level).toBe(60);
    for (let i = 1; i < ROAD.length; i++) { expect(ROAD[i].level - ROAD[i - 1].level, ROAD[i].id).toBeGreaterThan(0); expect(ROAD[i].level - ROAD[i - 1].level, ROAD[i].id).toBeLessThanOrEqual(3); }
    expect(ROAD.filter(step => step.id.startsWith('fighter-')).length).toBeGreaterThanOrEqual(6);
  });
});

describe('the economy: what a match pays', () => {
  it('pays a good survival run about forty, and a match won about forty', () => {
    expect(sum(payFor(run('r')))).toBe(5 + 6 * 1.5 + 7 * 2 + 3 * 2 + 6);
    expect(sum(payFor(bout('m')))).toBe(8 + 20 + 6);
    expect(sum(payFor(bout('m', { mode: 'bots' })))).toBe((8 + 20 + 6) / 2);
  });
  it('pays sealing the rift, and nothing for a run of a minute', () => {
    expect(sum(payFor(run('r', { round: 14, rank: 6, sealed: true, bosses: 14, finishers: 6, seconds: 1500 })))).toBe(5 + 14 * 1.5 + 28 + 12 + 30 + 60);
    expect(plausible(run('short-run', { seconds: 60 }))).toHaveProperty('refused');
    expect(plausible(bout('short-match', { seconds: 30 }))).toHaveProperty('refused');
  });
  it('holds a report to what its length allows', () => {
    const checked = plausible(run('forged', { seconds: 120, round: 40, rank: 6, bosses: 90, finishers: 90, sealed: true, kills: 999999 }));
    if ('refused' in checked) throw new Error(checked.refused);
    const r = checked.report as SurvivalReport;
    expect(r.round).toBe(4); expect(r.rank).toBe(1); expect(r.bosses).toBeLessThanOrEqual(9); expect(r.finishers).toBeLessThanOrEqual(r.bosses); expect(r.sealed).toBe(false); expect(r.kills).toBeLessThanOrEqual(1440);
  });
  it('pays match pay whole to the cap, then a fifth', () => {
    expect(underCap(50, 0)).toBe(50); expect(underCap(50, 180)).toBe(20 + 30 * PAY.past); expect(underCap(50, 400)).toBe(50 * PAY.past);
  });
  it('reaches level 3 in a day, 8 in three, and knows its days and weeks', () => {
    expect(xpAt(1)).toBe(0); expect(levelOf(0).level).toBe(1); expect(levelOf(xpAt(8)).level).toBe(8); expect(levelOf(xpAt(8) - 1).level).toBe(7);
    expect(dayOf(NOW)).toBe('2026-09-30'); expect(weekOf(NOW)).toBe('2026-W40'); expect(weekOf(Date.UTC(2026, 0, 1))).toBe('2026-W01');
  });
});

describe('the economy: an account', () => {
  it('settles a run once: its pay, the first of the day, the streak, a feat, experience', () => {
    const a = newAccount('a', NOW);
    const s = settle(a, run('run-0001'), NOW);
    expect(s.refused).toBeUndefined();
    expect(s.lines.find(line => line.label === 'First of the day')?.amount).toBe(25);
    expect(s.lines.find(line => line.label === 'Day 1 running')?.amount).toBe(10);
    expect(s.feats).toContain('first-run'); expect(s.feats).toContain('rank-c');
    expect(a.balance).toBe(s.total); expect(s.total).toBeGreaterThan(40 + 25 + 10 + 50);
    expect(a.xp).toBe(s.xp); expect(s.level.to).toBeGreaterThanOrEqual(s.level.from);
    expect(settle(a, run('run-0001'), NOW + 1000).refused).toMatch(/already/);
    expect(a.balance).toBe(s.total);
  });
  it('keeps a streak a day at a time and starts it again after a day missed', () => {
    const a = newAccount('a', NOW);
    settle(a, run('day-one'), NOW);
    expect(settle(a, run('day-two'), NOW + 86400000).lines.find(line => /running/.test(line.label))?.label).toBe('Day 2 running');
    expect(settle(a, run('day-five'), NOW + 4 * 86400000).lines.find(line => /running/.test(line.label))?.label).toBe('Day 1 running');
    expect(a.stats.bestStreak).toBe(2);
  });
  it('caps a day of farming: the tenth run pays a fifth of the first', () => {
    const a = newAccount('a', NOW);
    const own = (i: number) => settle(a, run(`farm-${String(i).padStart(3, '0')}`), NOW + i * 1000).lines.filter(line => /Run fought|cleared|beaten|finisher|Rank/.test(line.label));
    const first = sum(own(0));
    for (let i = 1; i < 9; i++) own(i);
    const tenth = sum(own(9));
    expect(first).toBeGreaterThanOrEqual(38); expect(tenth).toBeLessThanOrEqual(Math.ceil(first * PAY.past) + 2);
  });
  it('picks three missions a day and a week, the same for everyone, and pays each once', () => {
    expect(dailyMissions('2026-09-30').map(m => m.id)).toEqual(dailyMissions('2026-09-30').map(m => m.id));
    expect(new Set(dailyMissions('2026-09-30').map(m => m.id)).size).toBe(3); expect(new Set(weeklyMissions('2026-W40').map(m => m.id)).size).toBe(3);
    const days = new Set(Array.from({ length: 30 }, (_, i) => dailyMissions(`2026-10-${String(i + 1).padStart(2, '0')}`).map(m => m.id).join()));
    expect(days.size).toBeGreaterThan(10);
    expect(DAILY.length).toBeGreaterThanOrEqual(7); expect(WEEKLY.length).toBeGreaterThanOrEqual(5);
    const a = newAccount('a', NOW);
    let paid = 0;
    for (let i = 0; i < 12; i++) paid += settle(a, i % 2 ? bout(`mission-m${i}`, { fighter: 'goku' }) : run(`mission-r${i}`, { fighter: i % 4 ? 'zoro' : 'ichigo' }), NOW + i * 60000).missions.length;
    expect(a.day.done.length).toBe(3); expect(a.day.all).toBe(true); expect(paid).toBe(a.day.done.length + a.week.done.length);
  });
  it('sells for the price alone, nothing twice, and nothing retired or the road\'s alone', () => {
    const a = newAccount('a', NOW);
    expect(cannotBuy(a, 'skin-negative', 0)).toMatch(/costs 400/);
    credit(a, 100000);
    expect(buy(a, 'skin-negative', 0, NOW)).toMatchObject({ price: 400 });
    expect(cannotBuy(a, 'skin-negative', 0)).toMatch(/already/);
    expect(buy(a, 'fighter-roger', 0, NOW)).toMatchObject({ price: 2400 });
    expect(cannotBuy(a, 'skin-newsprint', 0)).toMatch(/not in Account/);
    expect(cannotBuy(a, 'skin-gold-leaf', 0)).toMatch(/not in Account/);
    expect(cannotBuy(a, 'aura-ink-dragon', 0)).toMatch(/not in Account/);
    expect(a.balance).toBe(100000 - 400 - 2400); expect(a.spent).toBe(400 + 2400);
    expect(priceOf(ITEM.get('fighter-roger')!)).toBe(2400);
  });
  it('gives the road\'s items at their level without granting anything, and keeps a retired one worn', () => {
    const a = newAccount('a', NOW);
    expect(wear(a, 'aura', 'aura-azure-flame')).toHaveProperty('refused');
    a.xp = xpAt(2);
    expect(wear(a, 'aura', 'aura-azure-flame')).toMatchObject({ worn: { aura: 'aura-azure-flame' } });
    expect(a.items['aura-azure-flame']).toBeUndefined();
    a.items['aura-sakura'] = { at: NOW };
    expect(wear(a, 'aura', 'aura-sakura')).toMatchObject({ worn: { aura: 'aura-sakura' } });
  });
  it('wears an outfit a fighter at a time, and tells a party the one for the fighter played', () => {
    const a = newAccount('a', NOW);
    a.xp = 1e9; credit(a, 1e6);
    for (const id of ['outfit-goku-blue', 'outfit-goku-ui', 'outfit-vegeta-ego']) buy(a, id, 0, NOW);
    wear(a, 'outfit', 'outfit-goku-blue'); wear(a, 'outfit', 'outfit-vegeta-ego');
    expect(a.worn.outfits).toEqual({ goku: 'outfit-goku-blue', vegeta: 'outfit-vegeta-ego' });
    wear(a, 'outfit', 'outfit-goku-ui');
    expect(a.worn.outfits?.goku).toBe('outfit-goku-ui');
    wear(a, 'outfit', 'outfit-goku-ui');
    expect(a.worn.outfits).toEqual({ vegeta: 'outfit-vegeta-ego' });
    expect(wornOf(lookOf(a.worn, 'vegeta')).outfits).toEqual({ vegeta: 'outfit-vegeta-ego' });
    expect(wornOf(lookOf(a.worn, 'goku')).outfits).toBeUndefined();
  });
  it('wears what it owns: one of a kind, four emotes on the wheel', () => {
    const a = newAccount('a', NOW);
    expect(wear(a, 'skin', 'skin-newsprint')).toHaveProperty('refused');
    a.items['skin-newsprint'] = { at: NOW };
    expect(wear(a, 'skin', 'skin-newsprint')).toMatchObject({ worn: { skin: 'skin-newsprint' } });
    expect(wear(a, 'aura', 'skin-newsprint')).toHaveProperty('refused');
    wear(a, 'skin', undefined); expect(a.worn.skin).toBeUndefined();
    for (const id of ['emote-dots', 'emote-sweat', 'emote-anger', 'emote-sparkle', 'emote-don']) { a.items[id] = { at: NOW }; wear(a, 'emote', id); }
    expect(a.worn.emotes).toEqual(['emote-sweat', 'emote-anger', 'emote-sparkle', 'emote-don']);
    wear(a, 'emote', 'emote-anger'); expect(a.worn.emotes).toEqual(['emote-sweat', 'emote-sparkle', 'emote-don']);
  });
  it('takes a guest into a signed-in account: wallets added, items joined, the better numbers kept', () => {
    const a = newAccount('a', NOW), g = newAccount('g', NOW);
    settle(a, run('acct-run', { round: 9, rank: 4 }), NOW); settle(g, bout('guest-match'), NOW);
    g.items['skin-newsprint'] = { at: NOW };
    const both = a.balance + g.balance;
    merge(a, g);
    expect(a.balance).toBe(both); expect(g.balance).toBe(0); expect(a.items['skin-newsprint']).toBeTruthy(); expect(a.stats.wins).toBe(1); expect(a.stats.bestRank).toBe(4); expect(a.feats).toContain('wins-1');
  });
});
