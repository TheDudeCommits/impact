import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetDeal, placesFor } from '../../game/stageChoice';
import { PREFS_KEY, modePrefs, namedPlaceFor, saveModePrefs, trainingPlace } from './prefs';
import { placePicture, placeRow, placeShown } from './place';

const store = new Map<string, string>();
beforeEach(() => { store.clear(); forgetDeal(); (globalThis as unknown as { localStorage: Storage }).localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => void store.set(k, String(v)), removeItem: k => void store.delete(k), clear: () => store.clear(), key: () => null, length: 0 } as Storage; });
afterEach(() => vi.unstubAllGlobals());

describe("the mode sheet's LOCATION, as the device remembers it", () => {
  it('is RANDOM until a place is named', () => {
    expect(modePrefs('duel').stage).toBeUndefined();
    for (const [mode, way] of [['duel', 'offline'], ['duel', 'friends'], ['royale', 'offline'], ['royale', 'friends'], ['training', 'offline'], ['bad-blood', 'offline'], ['bad-blood', 'friends']] as const)
      expect(namedPlaceFor(mode, way), `${mode} ${way}`).toBeUndefined();
  });
  it('remembers the place named, one per mode, for the bots and the friends way alike', () => {
    saveModePrefs('duel', { stage: 'kami-lookout' }); saveModePrefs('bad-blood', { stage: 'onigashima' });
    expect(namedPlaceFor('duel', 'offline')).toBe('kami-lookout');
    expect(namedPlaceFor('duel', 'friends')).toBe('kami-lookout');
    expect(namedPlaceFor('bad-blood', 'offline')).toBe('onigashima');
    expect(namedPlaceFor('training', 'offline')).toBeUndefined();
    saveModePrefs('duel', { stage: 'random' });
    expect(namedPlaceFor('duel', 'offline')).toBeUndefined();
  });
  it('is never remembered for the online way: public matches stay random', () => {
    saveModePrefs('royale', { stage: 'kami-lookout' }); saveModePrefs('duel', { stage: 'kami-lookout' });
    expect(namedPlaceFor('royale', 'online')).toBeUndefined();
    expect(namedPlaceFor('duel', 'online')).toBeUndefined();
    expect(placeRow('royale', 'online', 'kami-lookout')).toBe('');
  });
  it('sits beside the other options without disturbing them', () => {
    saveModePrefs('royale', { variant: 'offline', fighters: 10 }); saveModePrefs('royale', { stage: 'shiganshina' }); saveModePrefs('royale', { roomSize: 4 });
    expect(modePrefs('royale')).toEqual({ variant: 'offline', fighters: 10, stage: 'shiganshina', roomSize: 4 });
  });
  it('falls back to RANDOM for a value this build does not offer, or a ring the field does not fit', () => {
    store.set(PREFS_KEY, JSON.stringify({ duel: { stage: 'nonsense' }, royale: { stage: 'galactic-arena' } }));
    expect(namedPlaceFor('duel', 'offline')).toBeUndefined();
    expect(namedPlaceFor('royale', 'offline', 4)).toBe('galactic-arena');
    expect(namedPlaceFor('royale', 'offline', 12)).toBeUndefined();
  });
  it('survives storage that refuses (private browsing)', () => {
    (globalThis as unknown as { localStorage: unknown }).localStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
    expect(namedPlaceFor('duel', 'offline')).toBeUndefined();
    expect(() => saveModePrefs('duel', { stage: 'kami-lookout' })).not.toThrow();
  });
});

describe("Training's place", () => {
  it('is dealt from the Duel\'s places when nothing is named (RANDOM, the default)', () => {
    vi.stubGlobal('navigator', { webdriver: false });
    const place = trainingPlace();
    expect(place && placesFor('training', 'offline')).toContain(place);
  });
  it('is the place named', () => {
    vi.stubGlobal('navigator', { webdriver: false });
    saveModePrefs('training', { stage: 'galactic-arena' });
    expect(trainingPlace()).toBe('galactic-arena');
  });
  it("stays the exam hall for a browser driven by a tool, unless a place is named (evidence scripts frame Training by it)", () => {
    vi.stubGlobal('navigator', { webdriver: true });
    expect(trainingPlace()).toBeUndefined();
    saveModePrefs('training', { stage: 'shiganshina' });
    expect(trainingPlace()).toBe('shiganshina');
  });
});

describe('the LOCATION row', () => {
  it('is there for BOTS and FRIENDS in the modes that can choose, and not for ONLINE or the authored modes', () => {
    for (const [mode, way] of [['duel', 'offline'], ['duel', 'friends'], ['training', 'offline'], ['royale', 'offline'], ['royale', 'friends'], ['bad-blood', 'offline'], ['bad-blood', 'friends']] as const)
      expect(placeRow(mode, way, undefined), `${mode} ${way}`).toContain('data-ms-place');
    for (const [mode, way] of [['duel', 'online'], ['royale', 'online'], ['bad-blood', 'online'], ['last-stand', 'offline'], ['last-stand', 'friends'], ['rift-war', 'offline'], ['arcade', 'offline'], ['arcade', 'friends']] as const)
      expect(placeRow(mode, way, 'kami-lookout'), `${mode} ${way}`).toBe('');
  });
  const tiles = (html: string) => [...html.matchAll(/<button [^>]*data-ms-place="([^"]*)"[^>]*>/g)];
  const tile = (html: string, id: string) => tiles(html).find(m => m[1] === id)?.[0] ?? '';
  it('lists RANDOM first and selected by default, then each place by its picture, its name and its scene line', () => {
    const html = placeRow('duel', 'offline', undefined);
    expect(tiles(html)).toHaveLength(1 + placesFor('duel', 'offline').length);
    expect(tiles(html)[0][1]).toBe('');
    expect(tile(html, '')).toContain('aria-selected="true"');
    expect(html).toContain('>Valley of the End</span>');
    expect(tile(html, 'valley-of-the-end')).toContain('aria-label="Valley of the End: Between the First Hokage and Madara"');
    expect(tile(html, 'valley-of-the-end')).toContain(`url('${placePicture('valley-of-the-end', true)}')`);
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
  });
  it('shows the place remembered as the one selected', () => {
    const html = placeRow('duel', 'offline', 'valley-of-the-end');
    expect(tile(html, 'valley-of-the-end')).toContain('aria-selected="true"');
    expect(tile(html, '')).toContain('aria-selected="false"');
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(placeShown('duel', 'offline', 'valley-of-the-end')).toMatchObject({ id: 'valley-of-the-end', name: 'Valley of the End', at: placesFor('duel', 'offline').indexOf('valley-of-the-end') + 2 });
    expect(placeShown('duel', 'offline', undefined)).toMatchObject({ id: undefined, name: 'Random', at: 1 });
    expect(placeShown('royale', 'online', 'kami-lookout')).toBeUndefined();
  });
  it('says when RANDOM is dealt: against bots each time, for friends when the room opens', () => {
    expect(placeRow('royale', 'offline', undefined, 8)).toContain('A different place each time');
    expect(placeRow('royale', 'friends', undefined, 8)).toContain('Dealt when your room opens');
  });
  it('lists the small rings a big royale cannot use as unavailable, with how many each holds', () => {
    const big = placeRow('royale', 'offline', 'galactic-arena', 12);
    expect(tile(big, 'galactic-arena')).toMatch(/ disabled data-tag="UP TO 4"/);
    expect(tile(big, 'null-realm')).toMatch(/ disabled data-tag="UP TO 8"/);
    expect(tile(big, '')).toContain('aria-selected="true"');
    const small = placeRow('royale', 'offline', 'galactic-arena', 4);
    expect(small).not.toContain('disabled');
    expect(tile(small, 'galactic-arena')).toContain('aria-selected="true"');
  });
  it('escapes the names it draws', () => {
    expect(placeRow('royale', 'friends', undefined, 8)).toContain('>Kami&#39;s Lookout</span>');
  });
});

