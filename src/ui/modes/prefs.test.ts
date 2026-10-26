import { beforeEach, describe, expect, it } from 'vitest';
import { coachOn, coachShown, explainerSeen, markCoachShown, markExplainerSeen, modePrefs, saveModePrefs, setCoachOn, setTrainingDummy, trainingDummy } from './prefs';
import { MODES } from './catalogue';

const store = new Map<string, string>();
beforeEach(() => { store.clear(); (globalThis as unknown as { localStorage: Storage }).localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => void store.set(k, String(v)), removeItem: k => void store.delete(k), clear: () => store.clear(), key: () => null, length: 0 }; });

describe('what the device remembers about the modes', () => {
  it('shows the explainer until it is seen, and again after the rules change', () => {
    expect(explainerSeen('duel')).toBe(false);
    markExplainerSeen('duel');
    expect(explainerSeen('duel')).toBe(true); expect(explainerSeen('royale')).toBe(false);
    store.set('rift-modes-seen', JSON.stringify({ duel: MODES.duel.rulesVersion - 1 }));
    expect(explainerSeen('duel')).toBe(false);
  });
  it('opens the sheet where the player left it', () => {
    expect(modePrefs('royale')).toEqual({});
    saveModePrefs('royale', { variant: 'online' }); saveModePrefs('royale', { fighters: 10 });
    expect(modePrefs('royale')).toEqual({ variant: 'online', fighters: 10 });
  });
  it('gives each coach tip once, and stays quiet when switched off', () => {
    expect(coachOn()).toBe(true);
    markCoachShown('arcade', 'tree'); markCoachShown('arcade', 'tree');
    expect(coachShown('arcade')).toEqual(['tree']);
    setCoachOn(false); expect(coachOn()).toBe(false); expect(coachShown('arcade')).toEqual(['tree']);
    setCoachOn(true); expect(coachOn()).toBe(true);
  });
  it('keeps the training dummy passive until the player changes it', () => {
    expect(trainingDummy()).toBe('passive');
    setTrainingDummy('combat'); expect(trainingDummy()).toBe('combat');
    store.set('rift-training-dummy', 'nonsense'); expect(trainingDummy()).toBe('passive');
  });
  it('survives storage that refuses (private browsing)', () => {
    (globalThis as unknown as { localStorage: unknown }).localStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
    expect(explainerSeen('training')).toBe(false); expect(() => markExplainerSeen('training')).not.toThrow(); expect(trainingDummy()).toBe('passive');
  });
});
