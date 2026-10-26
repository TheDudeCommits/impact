import { beforeEach, describe, expect, it } from 'vitest';
import { ARENAS, DUEL_ARENAS, customRules, duelStage } from './social/custom';
import { DuelDeck, ONLINE_DUEL_STAGES, SMALL_ROYALE_STAGES, STAGES, type StageId } from './stages';
import { DEFAULT_CHOICE, dealPlace, forgetDeal, namedPlace, placeFits, placeForStart, placesFor, royaleRules } from './stageChoice';

const MODES = ['duel', 'royale', 'training', 'arcade', 'last-stand', 'bad-blood', 'rift-war'];
const PICKABLE: [string, string][] = [['duel', 'offline'], ['duel', 'friends'], ['training', 'offline'], ['royale', 'offline'], ['royale', 'friends'], ['bad-blood', 'offline'], ['bad-blood', 'friends']];
beforeEach(() => forgetDeal());

describe('which ways of playing can choose a place (the owner, 10 October 2026)', () => {
  it('lets the player choose against bots and the host choose for friends - the default is RANDOM', () => {
    expect(DEFAULT_CHOICE).toBe('random');
    for (const [mode, way] of PICKABLE) expect(placesFor(mode, way).length, `${mode} ${way}`).toBeGreaterThan(1);
  });
  it('never offers a choice online: the server deals every public match, whatever this device remembered', () => {
    for (const mode of MODES) {
      expect(placesFor(mode, 'online'), mode).toEqual([]);
      expect(namedPlace('kami-lookout', mode, 'online'), mode).toBeUndefined();
      expect(placeForStart('kami-lookout', mode, 'online', undefined, false), mode).toBeUndefined();
    }
  });
  it("offers nothing for the modes whose place is authored: Last Stand's village, Rift War's lanes, Arcade's worlds", () => {
    for (const mode of ['last-stand', 'rift-war', 'arcade'])
      for (const way of ['offline', 'friends']) expect(placesFor(mode, way), `${mode} ${way}`).toEqual([]);
  });
  it('only lists real stages, each at most once', () => {
    for (const [mode, way] of PICKABLE) {
      const pool = placesFor(mode, way);
      expect(new Set(pool).size, `${mode} ${way}`).toBe(pool.length);
      for (const id of pool) expect(STAGES[id], `${id}`).toBeDefined();
    }
  });
  it("offers a host only what the match server's rooms accept (so a friends' room never refuses or silently changes the place)", () => {
    expect(placesFor('duel', 'friends').every(id => DUEL_ARENAS.includes(id))).toBe(true);
    expect(placesFor('royale', 'friends').every(id => ARENAS.royale.includes(id))).toBe(true);
    expect(placesFor('bad-blood', 'friends').every(id => ARENAS['bad-blood'].includes(id))).toBe(true);
    expect(placesFor('duel', 'offline')).toEqual(placesFor('duel', 'friends'));
    expect(placesFor('royale', 'offline')).toEqual(placesFor('royale', 'friends'));
    expect(placesFor('bad-blood', 'offline')).toEqual(placesFor('bad-blood', 'friends'));
  });
});

describe('the place remembered', () => {
  it('is the place named, while this way still offers it', () => {
    expect(namedPlace('valley-of-the-end', 'duel', 'offline')).toBe('valley-of-the-end');
    expect(namedPlace('valley-of-the-end', 'duel', 'friends')).toBe('valley-of-the-end');
    expect(namedPlace('onigashima', 'bad-blood', 'offline')).toBe('onigashima');
  });
  it('is RANDOM for the default, for RANDOM itself, and for anything stale or foreign - never an error', () => {
    for (const saved of [undefined, null, 'random', '', 'harbor', 'rift-war', 'not-a-stage', 42, {}, ['kami-lookout']])
      expect(namedPlace(saved, 'duel', 'offline'), String(saved)).toBeUndefined();
    expect(namedPlace('blood-citadel', 'duel', 'offline')).toBeUndefined();
    expect(namedPlace('chunin-exam-room', 'royale', 'offline')).toBeUndefined();
  });
  it('is RANDOM when the royale field does not fit the small ring that was named', () => {
    expect(SMALL_ROYALE_STAGES['galactic-arena']).toBe(4);
    expect(placeFits('galactic-arena', 4)).toBe(true);
    expect(placeFits('galactic-arena', 12)).toBe(false);
    expect(placeFits('kami-lookout', 12)).toBe(true);
    expect(placeFits('galactic-arena')).toBe(true);
    expect(namedPlace('galactic-arena', 'royale', 'offline', 4)).toBe('galactic-arena');
    expect(namedPlace('galactic-arena', 'royale', 'offline', 12)).toBeUndefined();
    expect(namedPlace('null-realm', 'royale', 'friends', 8)).toBe('null-realm');
    expect(namedPlace('null-realm', 'royale', 'friends', 12)).toBeUndefined();
  });
});

describe('RANDOM', () => {
  const pool = placesFor('duel', 'offline');
  it('deals from the way\'s places and never the one dealt last while there is another', () => {
    let previous: StageId | undefined;
    for (let i = 0; i < 400; i++) {
      const stage = dealPlace(pool, previous, Math.random);
      expect(pool).toContain(stage);
      expect(stage).not.toBe(previous);
      previous = stage;
    }
  });
  it('reaches every place', () => {
    const seen = new Set<StageId>();
    for (let i = 0; i < pool.length * 40; i++) seen.add(dealPlace(pool, undefined, () => (i % pool.length) / pool.length));
    expect([...seen].sort()).toEqual([...pool].sort());
  });
  it('answers a lone place with it, even when it was the last', () => {
    expect(dealPlace(['hidden-leaf'], 'hidden-leaf', () => 0.99)).toBe('hidden-leaf');
    expect(dealPlace(pool, undefined, () => 1)).toBe(pool.at(-1));
  });
  it('is dealt at the start for Training, the bot Duel and Bad Blood; and by their own deck for the royale', () => {
    for (const [mode, way] of [['training', 'offline'], ['duel', 'offline'], ['duel', 'friends'], ['bad-blood', 'offline'], ['bad-blood', 'friends']] as const)
      expect(placesFor(mode, way)).toContain(placeForStart(undefined, mode, way, undefined, false)!);
    expect(placeForStart(undefined, 'royale', 'offline', 8, false)).toBeUndefined();
    expect(placeForStart(undefined, 'royale', 'friends', 8, false)).toBeUndefined();
  });
  it('does not repeat itself on consecutive starts', () => {
    let last = placeForStart(undefined, 'duel', 'offline', undefined, false);
    for (let i = 0; i < 100; i++) { const next = placeForStart(undefined, 'duel', 'offline', undefined, false); expect(next).not.toBe(last); last = next; }
  });
  it('leaves a browser driven by a tool on every mode\'s own place (a name still wins)', () => {
    for (const [mode, way] of PICKABLE) expect(placeForStart(undefined, mode, way, undefined, true), `${mode} ${way}`).toBeUndefined();
    expect(placeForStart('kami-lookout', 'duel', 'offline', undefined, true)).toBe('kami-lookout');
  });
  it('is a named place when one is named, and RANDOM when the name is not one the way offers', () => {
    expect(placeForStart('shiganshina', 'training', 'offline', undefined, false)).toBe('shiganshina');
    expect(placesFor('training', 'offline')).toContain(placeForStart('blood-citadel', 'training', 'offline', undefined, false)!);
    expect(placeForStart('galactic-arena', 'royale', 'offline', 12, false)).toBeUndefined();
    expect(placeForStart('galactic-arena', 'royale', 'offline', 4, false)).toBe('galactic-arena');
  });
});

describe("the room options a host's choice becomes (no match-server change: the options a party's launch already sends)", () => {
  it("is a private Duel's `stage`, which the room reads through duelStage - and an unknown one still opens the tournament ring", () => {
    for (const stage of placesFor('duel', 'friends')) expect(duelStage(placeForStart(stage, 'duel', 'friends', undefined, false)), stage).toBe(stage);
    expect(duelStage(undefined)).toBe('martial-arts-tournament');
    expect(duelStage('nonsense')).toBe('martial-arts-tournament');
    expect(duelStage('harbor')).toBe('martial-arts-tournament');
  });
  it("is a private royale's `rules`, which the room's custom lobby reads through customRules", () => {
    for (const stage of placesFor('royale', 'friends').filter(id => placeFits(id, 4))) {
      const rules = royaleRules(stage, 4);
      expect(rules, stage).toEqual({ arena: stage, players: 4 });
      expect(customRules('royale', rules).arena, stage).toBe(stage);
      expect(customRules('royale', rules).players).toBe(4);
    }
  });
  it("sends no `rules` for the royale's RANDOM: its room deals from a deck that never repeats a place twice running", () => {
    expect(royaleRules(undefined, 8)).toBeUndefined();
    expect(royaleRules('galactic-arena', 12)).toBeUndefined();
    expect(royaleRules('chunin-exam-room', 8)).toBeUndefined();
  });
  it("is a Bad Blood room's `rules.arena`, which the room places before anyone joins", () => {
    for (const stage of placesFor('bad-blood', 'friends')) expect(customRules('bad-blood', { arena: placeForStart(stage, 'bad-blood', 'friends', undefined, false) }).arena, stage).toBe(stage);
    expect(customRules('last-stand', { arena: 'kami-lookout' }).arena).toBe('auto');
  });
});

describe('the online Duel rotation (the owner, 24 October 2026: "Go ahead with the online Duel rotation")', () => {
  it('deals every duelling ring in turn, never the same one twice running, and only rings a Duel may be fought in', () => {
    expect(ONLINE_DUEL_STAGES.length).toBeGreaterThan(1);
    for (const stage of ONLINE_DUEL_STAGES) { expect(STAGES[stage]).toBeTruthy(); expect(DUEL_ARENAS).toContain(stage); }
    let state = 7;
    const pick = (pool: readonly StageId[]) => { state = (state * 1103515245 + 12345) % 2147483648; return pool[state % pool.length]; };
    const deck = new DuelDeck(), dealt: StageId[] = [];
    for (let k = 0; k < ONLINE_DUEL_STAGES.length * 6; k++) dealt.push(deck.deal(pick));
    for (let k = 1; k < dealt.length; k++) expect(dealt[k]).not.toBe(dealt[k - 1]);
    for (let round = 0; round < 6; round++) expect(new Set(dealt.slice(round * ONLINE_DUEL_STAGES.length, (round + 1) * ONLINE_DUEL_STAGES.length)).size).toBe(ONLINE_DUEL_STAGES.length);
  });
});
