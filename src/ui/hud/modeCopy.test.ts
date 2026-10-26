import { describe, expect, it } from 'vitest';
import { KoChain, allyState, badgeCopy, badgeKind, faceMark, faceState, levelNote, nextBossWave, pointsCopy, returnAsk, struckStructure, targetTag, underAttack, waveLine, wavePlaque } from './modeCopy';
import type { VillageStructure } from '../../game/objectives/villageStructures';

describe('Last Stand copy (§7.5)', () => {
  it('heads the plaque with the wave and what is left, or the clock to the next', () => {
    expect(wavePlaque({ phase: 'assault', wave: 3, remaining: 24, nextWaveAt: 0 }, 10)).toEqual({ lead: 'WAVE 3', accent: ' · 24 LEFT' });
    expect(wavePlaque({ phase: 'preparation', wave: 3, remaining: 0, nextWaveAt: 15.2 }, 10)).toEqual({ lead: 'NEXT WAVE', accent: ' · 6s' });
    expect(wavePlaque({ phase: 'preparation', wave: 0, remaining: 0, nextWaveAt: 9 }, 10).accent).toBe(' · 0s');
  });
  it('finds the next boss wave from the siege tiers', () => {
    expect(nextBossWave(1)).toBe(3); expect(nextBossWave(3)).toBe(3); expect(nextBossWave(4)).toBe(5); expect(nextBossWave(7)).toBe(9);
  });
  it("says what the plaque's second line should, in order of urgency", () => {
    const base = { phase: 'assault' as const, wave: 4, plan: undefined, bossPhase: 0, director: undefined };
    expect(waveLine(base, 50, -1, false)).toBe('NEXT BOSS · WAVE 5');
    expect(waveLine({ ...base, director: { state: 'rally', lane: 0, until: 60 } }, 50, -1, false)).toBe('RALLY · RESCUE & REGROUP');
    expect(waveLine(base, 50, -1, true)).toBe('BOSS AT THE GATES');
    expect(waveLine({ ...base, bossPhase: 2 }, 50, -1, true)).toBe('DESPERATION · STAY TOGETHER');
    const prep = { ...base, phase: 'preparation' as const, plan: { title: 'X', hint: '', lanes: [1, 2, 3], total: 54 } };
    expect(waveLine(prep, 50, 48, false)).toBe('WAVE 4 CLEARED · REGROUP & REPAIR');
    expect(waveLine(prep, 50, 40, false)).toBe('WAVE 5 · BOSS WAVE');
    expect(waveLine({ ...prep, wave: 5 }, 50, 40, false)).toBe('WAVE 6 · BOSS WAVE');
    expect(waveLine({ ...prep, wave: 6 }, 50, 40, false)).toBe('WAVE 7 · 54 RAIDERS');
  });
  it("tags an ally's plate only while they are not fighting", () => {
    expect(allyState({ rescue: 0 }, false, 10)).toBe('');
    expect(allyState({ rescue: 0 }, true, 10)).toBe('✚ DOWN');
    expect(allyState({ rescue: .4 }, true, 10)).toBe('✚ REVIVING 40%');
    expect(allyState({ rescue: 0, reviveAt: 11.2 }, true, 10)).toBe('RETURNING · 2s');
    expect(allyState({ rescue: 0, disconnected: true }, true, 10)).toBe('RECONNECTING');
  });
  it('alerts the most recently struck standing structure, then the next', () => {
    const s = (id: string, hitAt: number, hp = 100): VillageStructure => ({ id, name: id, x: 0, z: 0, hp, maxHp: 100, hitAt });
    const all = [s('village-west', 9), s('village-east', 9.5), s('village-keep', 6), s('village-gone', 9.9, 0)];
    const first = struckStructure(all, 10);
    expect(first?.id).toBe('village-east');
    expect(struckStructure(all, 10, first)?.id).toBe('village-west');
    expect(struckStructure(all, 13)).toBeUndefined();
    expect(underAttack(6)).toBe('UNDER ATTACK · 6 RAIDERS'); expect(underAttack(1)).toBe('UNDER ATTACK · 1 RAIDER'); expect(underAttack(0)).toBe('UNDER ATTACK');
  });
  it('carries the level news for a moment, then the next full heal', () => {
    expect(levelNote({ level: 3, leveledAt: -1, healedAt: -1 }, 10)).toBe('FULL HEAL AT LV 5');
    expect(levelNote({ level: 5, leveledAt: 9, healedAt: 9 }, 10)).toBe('HEALTH RESTORED');
    expect(levelNote({ level: 6, leveledAt: 9, healedAt: -1 }, 10)).toBe('LEVEL UP · POWER UP');
    expect(levelNote({ level: 6, leveledAt: 5, healedAt: -1 }, 10)).toBe('FULL HEAL AT LV 10');
  });
});

describe('Bad Blood copy (§7.6)', () => {
  it("states each side's rule on your badge", () => {
    expect(badgeCopy(badgeKind({ team: 'villains', revivesLeft: 0 }, true), {}, 0)).toBe('1.3× POWER · ONE LIFE');
    expect(badgeCopy(badgeKind({ team: 'heroes', revivesLeft: 1 }, true), {}, 0)).toBe('↻ 1 RETURN READY');
    const returning = { team: 'heroes' as const, revivesLeft: 0, reviveAt: 12.4 };
    expect(badgeKind(returning, false)).toBe('returning');
    expect(badgeCopy('returning', returning, 10)).toBe('↻ RETURNING · 3s');
    expect(badgeCopy(badgeKind({ team: 'heroes', revivesLeft: 0 }, true), {}, 0)).toBe('RETURN USED · LAST LIFE');
  });
  it('tags the target with what a knockout will mean', () => {
    expect(targetTag({ team: 'villains', revivesLeft: 0 })).toBe('VILLAIN · 1.3× · ONE LIFE');
    expect(targetTag({ team: 'heroes', revivesLeft: 1 })).toBe('HERO · ↻ RETURN READY');
    expect(targetTag({ team: 'heroes', revivesLeft: 0 })).toBe('HERO · LAST LIFE');
  });
  it('marks each face on the team bar', () => {
    expect(faceState({ team: 'heroes', revivesLeft: 1 }, true)).toBe('ready');
    expect(faceState({ team: 'villains', revivesLeft: 0 }, true)).toBe('up');
    expect(faceState({ team: 'heroes', revivesLeft: 0, reviveAt: 5 }, false)).toBe('returning');
    expect(faceState({ team: 'villains', revivesLeft: 0 }, false)).toBe('out');
    expect(faceMark('returning', { reviveAt: 11.5 }, 10)).toBe('2s'); expect(faceMark('ready', {}, 0)).toBe('↻'); expect(faceMark('out', {}, 0)).toBe('×'); expect(faceMark('up', {}, 0)).toBe('');
  });
  it('asks each side for what a return needs', () => {
    expect(returnAsk('heroes', 2)).toBe('KEEP ONE HERO STANDING');
    expect(returnAsk('villains', 1)).toBe('KO THE LAST HERO TO STOP IT');
    expect(returnAsk('villains', 2)).toBe('');
  });
});

describe('Arcade copy (§7.4)', () => {
  it('counts the KO chain the way the survival HUD does, and shows it only from ten', () => {
    const chain = new KoChain();
    chain.update(0, 0);
    chain.update(5, 100); expect(chain.n).toBe(5); expect(chain.live).toBe(false);
    chain.update(12, 1000); expect(chain.n).toBe(12); expect(chain.live).toBe(true); expect(chain.fading).toBe(false);
    chain.update(12, 3500); expect(chain.live).toBe(true); expect(chain.fading).toBe(true);
    chain.update(12, 4100); expect(chain.live).toBe(false);
    chain.update(13, 4200); expect(chain.n).toBe(1);
    chain.update(0, 5000); chain.update(3, 5100); expect(chain.n).toBe(3);
  });
  it('names the waiting points', () => { expect(pointsCopy(1)).toBe('1 POINT'); expect(pointsCopy(2)).toBe('2 POINTS'); });
});
