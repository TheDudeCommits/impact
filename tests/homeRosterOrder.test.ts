import { describe, expect, it } from 'vitest';
import { RELEASED_FIGHTERS } from '../src/game/rosterAvailability';
import type { FighterId } from '../src/game/types';
import {
  HOME_ORIGINAL_FIGHTERS, HOME_BASELINE_FIGHTERS, HOME_EXPANSION_FIGHTERS, HOME_HERO_ORDER, HOME_RIVAL_ORDER,
  homeAnimeOptions, homeRosterPages, homeRosterWip, homeSeries, homeWing,
} from '../src/ui/HomeRosterOrder';

const sorted = (ids: readonly string[]) => [...ids].sort();
describe('editorial homepage roster', () => {
  it('classifies all94 released fighters once, including the reviewed trio', () => {
    const curated = [...HOME_HERO_ORDER, ...HOME_RIVAL_ORDER];
    expect(new Set(curated).size).toBe(94);
    expect(sorted(curated)).toEqual(sorted(RELEASED_FIGHTERS));
    const shown = homeRosterPages(RELEASED_FIGHTERS).flatMap(page => page.fighters);
    expect(sorted(shown)).toEqual(sorted(curated));
    expect(shown).toEqual(expect.arrayContaining(['garou','kaiju-no-8','rengoku']));
    expect(homeWing('garou')).toBe('rivals');
    expect(homeWing('kaiju-no-8')).toBe('heroes');
    expect(homeWing('rengoku')).toBe('heroes');
    expect(HOME_HERO_ORDER.indexOf('rengoku')).toBe(HOME_HERO_ORDER.indexOf('tanjiro') + 1);
    for (const id of ['vegeta', 'sasuke', 'itachi', 'law', 'pain', 'makima', 'eren'] as const)
      expect(homeWing(id)).toBe('rivals');
  });
  it('pins the original sixteen and balances both wings in two rows', () => {
    const pages = homeRosterPages(RELEASED_FIGHTERS);
    expect(sorted(pages[0].fighters)).toEqual(sorted(HOME_ORIGINAL_FIGHTERS));
    expect(pages[0].fighters.some(homeRosterWip)).toBe(false);
    expect(pages.map(p=>p.fighters.length)).toEqual([16,16,16,16,16,14]);
    for (const page of pages) {
      expect(page.left.length).toBeLessThanOrEqual(8);
      expect(page.right.length).toBeLessThanOrEqual(8);
      expect(page.left.length - page.right.length).toBe(page.fighters.length % 2);
      const heroes = page.right.map((id,i)=>homeWing(id)==='heroes'?i:-1).filter(i=>i>=0);
      const rivals = page.right.map((id,i)=>homeWing(id)==='rivals'?i:-1).filter(i=>i>=0);
      for(const h of heroes)for(const r of rivals)expect(h%4).toBeLessThanOrEqual(r%4);
    }
  });
  it('reflows filtered subsets without changing their editorial order or introducing fighters', () => {
    for (const option of homeAnimeOptions(RELEASED_FIGHTERS)) {
      const subset = RELEASED_FIGHTERS.filter(id => homeSeries(id) === option.id);
      const pages = homeRosterPages([...subset].reverse());
      expect(sorted(pages.flatMap(p => p.fighters))).toEqual(sorted(subset));
      expect(pages).toEqual(homeRosterPages(subset));
      expect(pages.every(p => p.fighters.length <= 16
        && Math.abs(p.left.length - p.right.length) <= 1)).toBe(true);
    }
    const heroOnly = homeRosterPages(['goku', 'luffy']);
    expect(heroOnly[0].left).toEqual(['goku']);
    expect(heroOnly[0].right).toEqual(['luffy']);
    expect(homeRosterPages(['aizen', 'sukuna'])[0].left).toHaveLength(1);
    expect(homeRosterPages(['aizen', 'sukuna'])[0].right).toHaveLength(1);
    expect(homeRosterPages([])).toEqual([]);
    expect(homeRosterPages(['goku', 'goku'])[0].fighters).toEqual(['goku']);
  });
  it('keeps WIP membership exactly58 independent of filtering, pagination and order', () => {
    expect(HOME_BASELINE_FIGHTERS).toHaveLength(36);
    expect(HOME_EXPANSION_FIGHTERS).toHaveLength(58);
    expect(new Set([...HOME_BASELINE_FIGHTERS, ...HOME_EXPANSION_FIGHTERS]).size).toBe(94);
    expect(HOME_BASELINE_FIGHTERS.every(id => !homeRosterWip(id))).toBe(true);
    expect(HOME_EXPANSION_FIGHTERS.every(homeRosterWip)).toBe(true);
    expect(sorted(RELEASED_FIGHTERS.filter(homeRosterWip))).toEqual(sorted(HOME_EXPANSION_FIGHTERS));
  });
  it('counts normalized franchises and sorts counts before editorial familiarity', () => {
    expect(homeSeries('broly')).toBe('Dragon Ball');
    expect(homeSeries('kakashi')).toBe(homeSeries('minato'));
    expect(homeSeries('killua')).toBe(homeSeries('hisoka'));
    const options = homeAnimeOptions(RELEASED_FIGHTERS);
    expect(options.slice(0, 4).map(o => o.label)).toEqual([
      'One Piece (21)', 'Naruto (12)', 'Bleach (8)', 'Dragon Ball (7)',
    ]);
    expect(options.reduce((sum, o) => sum + o.count, 0)).toBe(94);
    expect(options.map(o => o.label)).toEqual(expect.arrayContaining(['Demon Slayer (3)','One Punch Man (3)','Kaiju No. 8 (1)']));
    expect(options.every((o, i) => !i || options[i - 1].count >= o.count)).toBe(true);
    const tie: FighterId[] = ['luffy', 'naruto', 'goku'];
    expect(homeAnimeOptions(tie).map(o => o.id)).toEqual(['Dragon Ball', 'Naruto', 'One Piece']);
    expect(homeAnimeOptions(['goku', 'goku', 'broly'])).toEqual([
      { id: 'Dragon Ball', label: 'Dragon Ball (2)', count: 2 },
    ]);
  });
});
