import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { MOVES } from '../src/game/moves';
import type { CombatEvent, FighterId, PlayerInput } from '../src/game/types';
import { FIGHTER_IDS, forgeMoves, ownKit, type ForgeKit } from '../src/engine/sim';
import { AREA_BY_ELEMENT, areaMoveOf } from '../src/engine/sim/areaMoves';
import { moveDamage } from '../src/engine/sim/forge';
import { housePick } from '../src/engine/sim/houseKits';
import { tuneMove } from '../src/engine/sim/tune';
import {
  AREA_BULLSEYE, AREA_DAMAGE_CEILING, AREA_LOOKS, AREA_STRIKES, areaFalloff, areaTotal, isBullseye, lookLead, lookStrikes, pinnedSchedule, strikeOffsets,
} from '../src/engine/sim/areaDamage';


const V43_ELEMENTS = {
  fire: 92, blackflame: 88, explosion: 112, ice: 80, lightning: 102, beam: 106, haki: 104, slash: 112, domain: 86, gravity: 96,
  summon: 108, windwater: 106, earth: 104, strings: 84, mecha: 114, strength: 110,
} as const;
const V43_ENTRIES: Partial<Record<FighterId, number>> = {
  goku: 110, naruto: 112, luffy: 112, zoro: 112, sanji: 100, vegeta: 110, kakashi: 104, sasuke: 98, jotaro: 114, ichigo: 112,
  dio: 112, killua: 110, ace: 104, law: 90, gojo: 100, guts: 104, itachi: 96, endeavor: 84, akainu: 100, byakuya: 116,
};

type Command = Partial<Omit<PlayerInput, 'seq'>>;
function cast(fighter: FighterId, off = 0, seconds = 6) {
  const sim = new ArenaSimulation({ trainingBot: false, seed: 5 });
  sim.addPlayer('a', fighter, 'A', false, { x: 0, y: 0, z: 0 });
  sim.addPlayer('b', 'jiren', 'B', false, { x: 0, y: 0, z: 8 + off });
  const events: CombatEvent[] = [];
  for (let i = 0, seq = 1; i < seconds * 60; i++, seq++) {
    const a: Command = i === 0 ? { attack: 'area', aim: { x: 0, z: 8 } } : {};
    sim.submitInput('a', { seq, moveX: 0, moveZ: 0, yaw: 0, ...a });
    sim.submitInput('b', { seq, moveX: 0, moveZ: 0, yaw: Math.PI });
    sim.step(1 / 60);
    events.push(...sim.snapshot(true).events);
  }
  const hits = events.filter(e => e.kind === 'hit' && e.slot === 'area' && e.targetId === 'b');
  return { sim, events, hits, release: events.find(e => e.kind === 'release' && e.slot === 'area')!, impacts: events.filter(e => e.kind === 'impact') };
}

describe('area damage: twice what it was, under every ultimate', () => {
  it("doubles every element's default, as a total its look's strikes share", () => {
    for (const [element, before] of Object.entries(V43_ELEMENTS)) {
      const own = AREA_BY_ELEMENT[element as keyof typeof V43_ELEMENTS];
      expect(own.damage, element).toBe(before * 2);
      expect(own.finisherDamage, element).toBeUndefined();
      expect(own.area?.hits, element).toBeUndefined();
    }
  });

  it("doubles every fighter's own entry (areaMoves.json), whatever look shares it", () => {
    for (const [id, before] of Object.entries(V43_ENTRIES) as [FighterId, number][]) expect(areaTotal(areaMoveOf(id)), id).toBe(before * 2);
  });

  it(`keeps every area move from 160 to the ceiling (${AREA_DAMAGE_CEILING}), under the least ultimate, and the Forge counts every strike`, () => {
    const least = Math.min(...FIGHTER_IDS.map(id => moveDamage(MOVES[id].ultimate)));
    expect(AREA_DAMAGE_CEILING).toBeLessThan(least);
    for (const id of FIGHTER_IDS) {
      const move = MOVES[id].area;
      expect(areaTotal(move), id).toBeGreaterThanOrEqual(160);
      expect(areaTotal(move), id).toBeLessThanOrEqual(AREA_DAMAGE_CEILING);
      expect(moveDamage(move), id).toBe(areaTotal(move));
    }
  });

  it('holds a Forge-tuned area move to the ceiling, however much power it is given', () => {
    const biggest = [...FIGHTER_IDS].sort((x, y) => areaTotal(MOVES[y].area) - areaTotal(MOVES[x].area))[0];
    const tuned = tuneMove(MOVES[biggest].area, { tune: { power: 1.2 } });
    expect(areaTotal(MOVES[biggest].area) * 1.2).toBeGreaterThan(AREA_DAMAGE_CEILING);
    expect(areaTotal(tuned)).toBeLessThanOrEqual(AREA_DAMAGE_CEILING);
    expect(areaTotal(tuned)).toBeGreaterThan(AREA_DAMAGE_CEILING - 5);
  });
});

describe('area damage: placement', () => {
  it('deals all of a strike in the bullseye, half at the rim, in a straight line between', () => {
    expect(areaFalloff(0, 4)).toBe(1);
    expect(areaFalloff(4 * AREA_BULLSEYE, 4)).toBe(1);
    expect(areaFalloff(2.5, 4)).toBeCloseTo(.75, 10);
    expect(areaFalloff(4, 4)).toBeCloseTo(.5, 10);
    expect(areaFalloff(4.4, 4)).toBe(.5);
    expect(isBullseye(1, 4)).toBe(true);
    expect(isBullseye(1.01, 4)).toBe(false);
  });

  it('in a match: dead centre lands whole and is marked a bullseye; at the rim, about half, unmarked', () => {
    const move = MOVES.goku.area, total = areaTotal(move);
    expect(strikeOffsets(move)).toHaveLength(1);
    const centre = cast('goku', 0), rim = cast('goku', move.radius - .05);
    expect(centre.hits.map(h => [h.damage, h.bullseye])).toEqual([[total, true]]);
    expect(rim.hits.map(h => [h.damage, h.bullseye])).toEqual([[Math.round(total * areaFalloff(move.radius - .05, move.radius)), undefined]]);
    expect(rim.hits[0].damage! / total).toBeCloseTo(.5, 1);
  });
});

describe("area damage: it lands when the look's strikes do", () => {
  it("times every fighter's area move to its look (its kit's, else its first area look): the look's strikes, else the schedule it pins", () => {
    for (const id of FIGHTER_IDS) {
      const move = MOVES[id].area, fx = move.area!.fx, kit = housePick(id, 'area')?.fx?.effect;
      expect(fx, id).toBe(kit ?? AREA_LOOKS[id]?.[0]);
      if (pinnedSchedule(move)) expect(strikeOffsets(move), id).toHaveLength(move.area!.hits ?? 1);
      else {
        expect(strikeOffsets(move), id).toEqual(lookStrikes(fx));
        expect(strikeOffsets(move), id).toHaveLength(Math.max(1, AREA_STRIKES[fx!]?.length ?? 0));
      }
    }
    for (const [id, at] of Object.entries(AREA_STRIKES)) {
      expect(at.length, id).toBeGreaterThan(0);
      expect(at.length, id).toBeLessThanOrEqual(8);
      expect(at.every((t, k) => t >= 0 && (k === 0 || t > at[k - 1])), id).toBe(true);
      expect(at.at(-1)! - at[0], id).toBeLessThanOrEqual(3);
    }
  });

  it('strikes as often as the look, when the look does, the total split across them - and tells every screen which look', () => {
    const move = MOVES.minato.area, at = strikeOffsets(move);
    expect(move.area!.fx).toBe('saga_blitz');
    expect(at).toHaveLength(AREA_STRIKES.saga_blitz.length);
    const { release, impacts, hits } = cast('minato');
    expect(release).toMatchObject({ look: 'saga_blitz', strikes: at.length });
    expect(impacts.map(e => e.contactIndex)).toEqual([...at.keys()]);
    impacts.forEach((e, k) => {
      expect(e.look).toBe('saga_blitz');
      expect(e.serverTime, `strike ${k}`).toBeGreaterThanOrEqual(release.due! + at[k] - 1e-6);
      expect(e.serverTime, `strike ${k}`).toBeLessThan(release.due! + at[k] + 1 / 60 + 1e-6);
    });
    expect(hits).toHaveLength(at.length);
    expect(hits.every(h => h.bullseye)).toBe(true);
    expect(hits.reduce((sum, h) => sum + h.damage!, 0)).toBe(areaTotal(move));
    expect(lookLead('saga_blitz')).toBe(AREA_STRIKES.saga_blitz[0]);
  });

  it('strikes once, with all of it, for a look that bursts once', () => {
    const { impacts, hits } = cast('goku');
    expect(impacts).toHaveLength(1);
    expect(hits.map(h => h.damage)).toEqual([areaTotal(MOVES.goku.area)]);
  });

  it("retimes a kit's area move to the look its pick gives it, its total kept", () => {
    const own = ownKit('goku');
    const kit: ForgeKit = { ...own, slots: { ...own.slots, area: { from: 'goku', fx: { effect: 'titan_thundercloud' } } } };
    const move = forgeMoves(kit).area;
    expect(move.area).toMatchObject({ fx: 'titan_thundercloud', strikes: lookStrikes('titan_thundercloud') });
    expect(areaTotal(move)).toBe(areaTotal(MOVES.goku.area));
    const pinned = forgeMoves({ ...own, slots: { ...own.slots, area: { from: 'vegeta', fx: { effect: 'titan_thundercloud' } } } }).area;
    expect(pinned.area).toMatchObject({ fx: 'titan_thundercloud', hits: MOVES.vegeta.area.area!.hits });
    expect(pinned.area!.strikes).toBeUndefined();
    expect(areaTotal(pinned)).toBe(areaTotal(MOVES.vegeta.area));
  });
});
