import { RELEASED_FIGHTERS } from '../src/game/rosterAvailability';
import { describe, expect, it } from 'vitest';
import type { FighterId } from '../src/game/types';
import { MOVES } from '../src/game/moves';
import { BUDGET_LIMIT, FIGHTER_IDS, budget, decodeForge, encodeForge, forgeMoves, forgeProblems, ownKit, simSpec, type ForgeKit } from '../src/engine/sim';
import {
  STUDIO_HISTORY, STUDIO_TARGETS, assignItem, assignTrial, changed, defaultKitName, dropTrial, edit, fits as libraryFits, inPlay, isOwnKit, loadKit, lookHue,
  lookOf, lookScale, lookSetting, original, startStudio, targetFor, tryItem, undo, withLook, withName, withStatus, withTune, type StudioItem, type StudioState,
  type StudioTarget,
} from '../src/engine/client/forgeStudio';
import { forgeDraftKey, forgeJoinOption, forgeOnline, forgeOnlineKey } from '../src/engine/client/forgeJoin';
import { libraryMoves, moveName } from '../src/ui/forge/studioLibrary';
import { targetLabel } from '../src/ui/forge/studioDom';

const move = (from: FighterId, fromSlot: 'light' | 'heavy' | 'special' | 'ultimate'): StudioItem => ({ kind: 'move', from, fromSlot });
const fx = (effect: string): StudioItem => ({ kind: 'fx', effect });
const fresh = (): StudioState => startStudio('endeavor', defaultKitName('Endeavor'));

describe('the Forge Studio: try, then assign', () => {
  it("starts from the body's draft when it is this body's, else from the body's own kit", () => {
    expect(fresh().assigned).toEqual(ownKit('endeavor', 'Endeavor Forged'));
    expect(isOwnKit(fresh().assigned)).toBe(true);
    const draft: ForgeKit = { ...ownKit('endeavor', 'Flame Hero'), slots: { ...ownKit('endeavor').slots, special: { from: 'goku' } } };
    expect(startStudio('endeavor', 'x', draft).assigned).toBe(draft);
    expect(startStudio('endeavor', 'x', { ...draft, body: 'goku' }).assigned.body).toBe('endeavor');
  });

  it('tries a move in the target at once, without changing what is kept', () => {
    const tried = tryItem(fresh(), 'special', move('goku', 'special'));
    expect(tried.trial).toMatchObject({ target: 'special', item: move('goku', 'special') });
    expect(inPlay(tried).slots.special).toEqual({ from: 'goku' });
    expect(tried.assigned.slots.special).toEqual({ from: 'endeavor' });
    expect(forgeMoves(inPlay(tried)).special).toEqual(simSpec('goku')!.kit.slots.special);
  });

  it("puts an ultimate on Q: any of a fighter's four moves in any slot", () => {
    const tried = tryItem(fresh(), 'special', move('ace', 'ultimate'));
    expect(inPlay(tried).slots.special).toEqual({ from: 'ace', fromSlot: 'ultimate' });
    expect(forgeMoves(inPlay(tried)).special).toEqual(simSpec('ace')!.kit.slots.ultimate);
    expect(forgeProblems(inPlay(tried), { sandbox: true }).errors).toEqual([]);
  });

  it('puts back what was assigned when something else is tried without assigning', () => {
    let state = assignTrial(tryItem(fresh(), 'heavy', move('zoro', 'heavy')));
    state = tryItem(state, 'special', move('goku', 'special'));
    state = tryItem(state, 'light', move('naruto', 'light'));
    expect(inPlay(state).slots.special).toEqual({ from: 'endeavor' });
    expect(inPlay(state).slots.light).toEqual({ from: 'naruto' });
    expect(inPlay(state).slots.heavy).toEqual({ from: 'zoro' });
    state = tryItem(state, 'light', move('luffy', 'light'));
    expect(inPlay(state).slots.light).toEqual({ from: 'luffy' });
    expect(dropTrial(state).trial).toBeUndefined();
    expect(inPlay(dropTrial(state))).toBe(state.assigned);
  });

  it('assigns the trial: kept, one undo step, and the same kit the draft code carries', () => {
    const state = assignTrial(tryItem(fresh(), 'special', move('goku', 'special')));
    expect(state.trial).toBeUndefined();
    expect(state.assigned.slots.special).toEqual({ from: 'goku' });
    expect(state.history).toHaveLength(1);
    expect(decodeForge(encodeForge(state.assigned))).toEqual(state.assigned);
    expect(assignTrial(state)).toBe(state);
    expect(assignItem(fresh(), 'heavy', move('saitama', 'heavy')).assigned.slots.heavy).toEqual({ from: 'saitama' });
  });

  it('never puts a move on the aura: it goes to the slot it comes from', () => {
    expect(targetFor('aura', move('goku', 'ultimate'))).toBe('ultimate');
    expect(targetFor('aura', fx('ext_aura_fire'))).toBe('aura');
    expect(tryItem(fresh(), 'aura', move('goku', 'ultimate')).trial?.target).toBe('ultimate');
  });

  it("tries and assigns Armory effects per slot and as the aura; a slot's look stays when its move changes", () => {
    let state = assignTrial(tryItem(fresh(), 'special', fx('titan_firefist')));
    expect(state.assigned.slots.special).toEqual({ from: 'endeavor', fx: { effect: 'titan_firefist' } });
    state = assignTrial(tryItem(state, 'aura', fx('ext_aura_fire')));
    expect(state.assigned.aura).toEqual({ effect: 'ext_aura_fire' });
    state = assignTrial(tryItem(state, 'special', move('goku', 'special')));
    expect(state.assigned.slots.special).toEqual({ from: 'goku', fx: { effect: 'titan_firefist' } });
    expect(forgeMoves(state.assigned)).toEqual(forgeMoves({ ...state.assigned, aura: undefined, slots: { ...state.assigned.slots, special: { from: 'goku' } } }));
    expect(forgeProblems(state.assigned).errors).toEqual([]);
    expect(decodeForge(encodeForge(state.assigned))).toEqual(state.assigned);
  });

  it('brings a new move with its own tunes and no status, and keeps them for a new look', () => {
    let state = assignTrial(tryItem(fresh(), 'special', move('goku', 'special')));
    state = edit(state, 'special', withTune('special', 'power', .8));
    state = edit(state, 'special', withStatus('special', 'burn'));
    expect(state.assigned.slots.special).toEqual({ from: 'goku', tune: { power: .8 }, status: 'burn' });
    const looked = assignTrial(tryItem(state, 'special', fx('dragonbreath')));
    expect(looked.assigned.slots.special).toEqual({ from: 'goku', tune: { power: .8 }, status: 'burn', fx: { effect: 'dragonbreath' } });
    const moved = assignTrial(tryItem(looked, 'special', move('vegeta', 'special')));
    expect(moved.assigned.slots.special).toEqual({ from: 'vegeta', fx: { effect: 'dragonbreath' } });
  });

  it("ORIGINAL puts a slot's move (with its tunes and status) or a look back to the body's own, as an undoable assignment", () => {
    let state = assignTrial(tryItem(fresh(), 'special', move('goku', 'special')));
    state = edit(state, 'special', withTune('special', 'reach', 1.2));
    state = assignTrial(tryItem(state, 'special', fx('dragonbreath')));
    const before = state.history.length;
    const plain = original(state, 'special', 'move');
    expect(plain.assigned.slots.special).toEqual({ from: 'endeavor', fx: { effect: 'dragonbreath' } });
    expect(plain.history).toHaveLength(before + 1);
    const bare = original(plain, 'special', 'look');
    expect(bare.assigned.slots.special).toEqual({ from: 'endeavor' });
    expect(isOwnKit(bare.assigned)).toBe(true);
    expect(undo(bare).assigned.slots.special).toEqual({ from: 'endeavor', fx: { effect: 'dragonbreath' } });
    expect(original(bare, 'special', 'look')).toMatchObject({ assigned: bare.assigned, history: bare.history });
    const tried = tryItem(state, 'special', move('saitama', 'special'));
    expect(original(tried, 'special', 'move').trial).toBeUndefined();
    const auraed = assignTrial(tryItem(fresh(), 'aura', fx('ext_aura_fire')));
    expect(original(auraed, 'aura', 'look').assigned.aura).toBeUndefined();
  });

  it('undoes the last assignment, and anything being tried with it', () => {
    let state = assignTrial(tryItem(fresh(), 'special', move('goku', 'special')));
    state = assignTrial(tryItem(state, 'heavy', move('zoro', 'heavy')));
    state = tryItem(state, 'light', move('naruto', 'light'));
    state = undo(state);
    expect(state.trial).toBeUndefined();
    expect(state.assigned.slots.heavy).toEqual({ from: 'endeavor' });
    expect(state.assigned.slots.special).toEqual({ from: 'goku' });
    state = undo(undo(state));
    expect(isOwnKit(state.assigned)).toBe(true);
    expect(state.history).toEqual([]);
    expect(undo(tryItem(state, 'light', move('naruto', 'light'))).trial).toBeUndefined();
  });

  it('takes a whole slider drag back in one undo, and an edit to what is tried stays with the trial', () => {
    let state = assignTrial(tryItem(fresh(), 'special', move('goku', 'special')));
    for (const power of [.95, .9, .85, .8]) state = edit(state, 'special', withTune('special', 'power', power), 'tune:special:power');
    expect(state.assigned.slots.special.tune).toEqual({ power: .8 });
    expect(state.history).toHaveLength(2);
    expect(undo(state).assigned.slots.special).toEqual({ from: 'goku' });
    state = edit(state, 'special', withTune('special', 'power', 1), 'tune:special:power');
    expect(state.assigned.slots.special).toEqual({ from: 'goku' });
    let looked = tryItem(state, 'heavy', fx('blade_crescent'));
    looked = edit(looked, 'heavy', withLook('heavy', lookScale(1.5)), 'look:heavy:scale');
    looked = edit(looked, 'heavy', withLook('heavy', lookHue(40)), 'look:heavy:hue');
    looked = edit(looked, 'heavy', withLook('heavy', lookSetting('glow', 1.6)), 'look:heavy:glow');
    expect(looked.assigned.slots.heavy).toEqual({ from: 'endeavor' });
    expect(lookOf(inPlay(looked), 'heavy')).toEqual({ effect: 'blade_crescent', scale: 1.5, hue: 40, settings: { glow: 1.6 } });
    looked = edit(looked, 'name', withName('Flame Saiyan'), 'name');
    expect(looked.assigned.name).toBe('Flame Saiyan');
    expect(inPlay(looked).name).toBe('Flame Saiyan');
    const kept = assignTrial(looked);
    expect(kept.assigned.name).toBe('Flame Saiyan');
    expect(kept.assigned.slots.heavy.fx).toEqual({ effect: 'blade_crescent', scale: 1.5, hue: 40, settings: { glow: 1.6 } });
    expect(lookScale(1)(lookHue(0)({ effect: 'x', scale: 2, hue: 9 }))).toEqual({ effect: 'x' });
    expect(withLook('light', lookScale(2))(ownKit('endeavor'))).toEqual(ownKit('endeavor'));
  });

  it('loads a whole kit (a code, a kept fighter, a share link) as an assignment, for this body only', () => {
    const kit: ForgeKit = { ...ownKit('endeavor', 'Shared'), slots: { ...ownKit('endeavor').slots, ultimate: { from: 'goku' } } };
    const loaded = loadKit(tryItem(fresh(), 'light', move('naruto', 'light')), kit);
    expect(loaded.assigned).toBe(kit);
    expect(loaded.trial).toBeUndefined();
    expect(undo(loaded).assigned).toEqual(fresh().assigned);
    expect(loadKit(fresh(), { ...kit, body: 'goku' })).toEqual(fresh());
  });

  it('remembers a bounded history, and knows what differs from the body', () => {
    let state = fresh();
    const ids = ['goku', 'naruto', 'luffy', 'ichigo'] as const;
    for (let i = 0; i < STUDIO_HISTORY + 20; i++) state = assignItem(state, 'light', move(ids[i % ids.length], 'light'));
    expect(state.history).toHaveLength(STUDIO_HISTORY);
    expect(changed(state.assigned, 'light')).toEqual({ move: true, look: false });
    expect(changed(state.assigned, 'heavy')).toEqual({ move: false, look: false });
    expect(changed({ ...state.assigned, slots: { ...state.assigned.slots, heavy: { from: 'endeavor', fromSlot: 'heavy' } } }, 'heavy').move).toBe(false);
    expect(changed({ ...state.assigned, slots: { ...state.assigned.slots, heavy: { from: 'endeavor', fromSlot: 'special' } } }, 'heavy').move).toBe(true);
    expect(isOwnKit({ ...ownKit('endeavor', 'Renamed') })).toBe(true);
  });
});

describe('the Forge Studio: the area slot (G, docs/engine/AREA.md)', () => {
  const area = (from: FighterId): StudioItem => ({ kind: 'move', from, fromSlot: 'area' });
  const rows = libraryMoves('endeavor').flatMap(group => group.moves);
  const listed = (target: StudioTarget) => rows.filter(row => libraryFits(target, row.item));

  it('is a row of the inspector like the others, G · AREA between R and the aura, holding the body\'s own area move', () => {
    expect(STUDIO_TARGETS).toEqual(['light', 'heavy', 'special', 'ultimate', 'area', 'aura']);
    expect(STUDIO_TARGETS.map(targetLabel)).toEqual(['J · LIGHT', 'K · HEAVY', 'Q · SPECIAL', 'R · ULTIMATE', 'G · AREA', 'AURA']);
    expect(fresh().assigned.slots.area).toEqual({ from: 'endeavor' });
    expect(changed(fresh().assigned, 'area')).toEqual({ move: false, look: false });
    expect(moveName('endeavor', 'area')).toBe(MOVES.endeavor.area.name);
  });

  it("lists every fighter's area move for the area slot alone, and no area move for any other target", () => {
    expect(libraryMoves('endeavor')[0].id).toBe('endeavor');
    const areas = listed('area');
    expect(areas.map(row => row.item.from).sort()).toEqual([...RELEASED_FIGHTERS].sort());
    for (const { item, name } of areas) {
      expect(item.fromSlot).toBe('area');
      expect(simSpec(item.from)!.kit.slots.area.area, item.from).toBeTruthy();
      expect(name).toBe(MOVES[item.from].area.name);
    }
    for (const target of STUDIO_TARGETS.filter(each => each !== 'area')) {
      expect(listed(target), target).toHaveLength(rows.length - RELEASED_FIGHTERS.length);
      expect(listed(target).some(({ item }) => item.fromSlot === 'area' || !!simSpec(item.from)!.kit.slots[item.fromSlot].area), target).toBe(false);
    }
    for (const target of STUDIO_TARGETS) expect(libraryFits(target, fx('cosmos_meteorstorm')), target).toBe(true);
  });

  it('tries, assigns and puts back an area move; the area slot takes only area moves, and they fit nowhere else', () => {
    let state = tryItem(fresh(), 'area', area('goku'));
    expect(state.trial).toMatchObject({ target: 'area', item: area('goku') });
    expect(inPlay(state).slots.area).toEqual({ from: 'goku' });
    expect(forgeMoves(inPlay(state)).area).toEqual(simSpec('goku')!.kit.slots.area);
    expect(forgeProblems(inPlay(state), { sandbox: true }).errors).toEqual([]);
    state = assignTrial(state);
    expect(state.assigned.slots.area).toEqual({ from: 'goku' });
    expect(changed(state.assigned, 'area').move).toBe(true);
    expect(targetFor('special', area('ace'))).toBe('area');
    expect(targetFor('aura', area('ace'))).toBe('area');
    expect(targetFor('area', move('ace', 'special'))).toBe('special');
    expect(inPlay(tryItem(state, 'area', move('ace', 'special'))).slots).toMatchObject({ special: { from: 'ace' }, area: { from: 'goku' } });
    const back = original(state, 'area', 'move');
    expect(back.assigned.slots.area).toEqual({ from: 'endeavor' });
    expect(isOwnKit(back.assigned)).toBe(true);
    expect(undo(back).assigned.slots.area).toEqual({ from: 'goku' });
    expect(assignItem(state, 'area', area('endeavor')).assigned).toEqual(back.assigned);
  });

  it('tries and assigns any Armory effect on the area slot, in kit.slots.area.fx, kept when its move changes', () => {
    let state = tryItem(fresh(), 'area', fx('cosmos_meteorstorm'));
    expect(state.trial?.target).toBe('area');
    expect(inPlay(state).slots.area).toEqual({ from: 'endeavor', fx: { effect: 'cosmos_meteorstorm' } });
    expect(state.assigned.slots.area).toEqual({ from: 'endeavor' });
    state = assignTrial(state);
    expect(state.assigned.slots.area?.fx).toEqual({ effect: 'cosmos_meteorstorm' });
    expect(lookOf(state.assigned, 'area')).toEqual({ effect: 'cosmos_meteorstorm' });
    state = edit(state, 'area', withLook('area', lookScale(1.5)), 'look:area:scale');
    state = assignItem(state, 'area', area('sukuna'));
    expect(state.assigned.slots.area).toEqual({ from: 'sukuna', fx: { effect: 'cosmos_meteorstorm', scale: 1.5 } });
    expect(forgeProblems(state.assigned, { sandbox: true }).errors).toEqual([]);
    expect(decodeForge(encodeForge(state.assigned))).toEqual(state.assigned);
    expect(original(state, 'area', 'look').assigned.slots.area).toEqual({ from: 'sukuna' });
  });

  it("keeps a kit made before the area slot: its area slot is the body's own, and ORIGINAL there changes nothing", () => {
    const { area: _area, ...core } = ownKit('endeavor').slots;
    const old: ForgeKit = { ...ownKit('endeavor', 'Old Kit'), slots: core as ForgeKit['slots'] };
    const state = startStudio('endeavor', 'x', old);
    expect(isOwnKit(state.assigned)).toBe(true);
    expect(forgeProblems(old, { sandbox: true }).errors).toEqual([]);
    const same = original(state, 'area', 'move');
    expect(same.assigned).toBe(old);
    expect(same.history).toHaveLength(0);
    expect(assignItem(state, 'area', fx('cosmos_meteorstorm')).assigned.slots.area).toEqual({ from: 'endeavor', fx: { effect: 'cosmos_meteorstorm' } });
  });
});

describe('the Forge Studio: "Use in private rooms"', () => {
  const store = (entries: Record<string, string>) => (key: string) => entries[key] ?? null;
  const fits: ForgeKit = { ...ownKit('endeavor', 'Flame Hero'), slots: { ...ownKit('endeavor').slots, special: { from: 'ace', tune: { power: .8 } } } };
  const strongest = (slot: 'light' | 'heavy' | 'special' | 'ultimate') => FIGHTER_IDS
    .map(id => ({ id, power: budget({ ...ownKit('endeavor'), slots: { ...ownKit('endeavor').slots, [slot]: { from: id } } }) })).sort((a, b) => b.power - a.power)[0].id;
  const greedy: ForgeKit = { ...ownKit('endeavor', 'Too Much'), slots: { light: { from: strongest('light') }, heavy: { from: strongest('heavy') }, special: { from: strongest('special') }, ultimate: { from: strongest('ultimate') } } };

  it('is off until the player turns it on for that body', () => {
    expect(forgeOnline('endeavor', store({}))).toBe(false);
    expect(forgeOnline('endeavor', store({ [forgeOnlineKey('endeavor')]: '1' }))).toBe(true);
    expect(forgeOnline('goku', store({ [forgeOnlineKey('endeavor')]: '1' }))).toBe(false);
  });

  it('sends the draft only when it is on, the kit is whole and within the online budget', () => {
    expect(budget(fits)).toBeLessThanOrEqual(BUDGET_LIMIT);
    expect(budget(greedy)).toBeGreaterThan(BUDGET_LIMIT);
    expect(forgeProblems(greedy, { sandbox: true }).errors).toEqual([]);
    const on = { [forgeOnlineKey('endeavor')]: '1' };
    expect(forgeJoinOption('endeavor', store({ [forgeDraftKey('endeavor')]: encodeForge(fits) }))).toEqual({});
    expect(forgeJoinOption('endeavor', store({ ...on, [forgeDraftKey('endeavor')]: encodeForge(fits) }))).toEqual({ forge: encodeForge(fits) });
    expect(forgeJoinOption('endeavor', store({ ...on, [forgeDraftKey('endeavor')]: encodeForge(greedy) }))).toEqual({});
    expect(forgeJoinOption('endeavor', store(on))).toEqual({});
    expect(forgeJoinOption('endeavor', store({ ...on, [forgeDraftKey('endeavor')]: 'JF1.garbage.00000000' }))).toEqual({});
    const goku = { ...fits, body: 'goku' as FighterId, slots: ownKit('goku').slots };
    expect(forgeJoinOption('endeavor', store({ ...on, [forgeDraftKey('endeavor')]: encodeForge(goku) }))).toEqual({});
    expect(forgeJoinOption('goku', store({ ...on, [forgeDraftKey('goku')]: encodeForge(goku) }))).toEqual({});
    const looks: ForgeKit = { ...fits, aura: { effect: 'ext_aura_fire' }, slots: { ...fits.slots, heavy: { from: 'endeavor', fx: { effect: 'dragonbreath', scale: 1.4 } } } };
    expect(forgeJoinOption('endeavor', store({ ...on, [forgeDraftKey('endeavor')]: encodeForge(looks) }))).toEqual({ forge: encodeForge(looks) });
  });
});
