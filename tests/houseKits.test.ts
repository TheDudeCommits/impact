import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/engine/sim/houseKits.json', () => ({ default: {
  goku: { slots: { special: { from: 'vegeta', fromSlot: 'special' }, area: { from: 'sukuna', fromSlot: 'area', fx: { effect: 'test-burst' } } }, aura: { effect: 'test-aura', scale: 1.2 } },
  vegeta: { slots: { special: { from: 'goku', fromSlot: 'special', tune: { power: 1.1 } } } },
} }));

import { ArenaSimulation } from '../src/game/simulation';
import { HOUSE_APPLIED, MOVES } from '../src/game/moves';
import { moveFor } from '../src/game/awakening';
import type { CombatEvent } from '../src/game/types';
import { budget, deriveSimSpec, forgeMoves, forgeProblems, houseForgeKit, ownKit, simSpec, type ForgeKit } from '../src/engine/sim';
import { areaMoveOf } from '../src/engine/sim/areaMoves';
import { tuneMove } from '../src/engine/sim/tune';
import { areaTotal } from '../src/engine/sim/areaDamage';
import { ForgeSession, moveSource, presentationKit, setActiveKit, slotFx } from '../src/engine/client';


afterEach(() => { setActiveKit(undefined, 'goku'); });

describe('house kits in the simulation', () => {
  it('puts each pick into MOVES from the authored tables, so a swap both ways neither chains nor loops', () => {
    expect([...HOUSE_APPLIED].sort()).toEqual(['goku.area', 'goku.special', 'vegeta.special']);
    expect(MOVES.goku.special).toMatchObject({ name: 'Galick Gun', damage: 128 });
    expect(MOVES.vegeta.special).toMatchObject({ name: 'Kamehameha', damage: Math.round(122 * 1.1) });
    expect(MOVES.goku.area).toEqual(tuneMove(areaMoveOf('sukuna'), { fx: { effect: 'test-burst' } }));
    expect(MOVES.goku.area).toMatchObject({ name: areaMoveOf('sukuna').name, area: { fx: 'test-burst' } });
    expect(MOVES.goku.area.area?.strikes).toBeUndefined();
    expect(areaTotal(MOVES.goku.area)).toBe(areaTotal(areaMoveOf('sukuna')));
    expect(moveFor('goku', 'special', false)).toBe(MOVES.goku.special);
    expect(simSpec('goku')!.kit.slots.special).toEqual(MOVES.goku.special);
    expect(deriveSimSpec('vegeta').kit.slots.special).toEqual(tuneMove(MOVES.vegeta.special, {}));
  });

  it('throws the house move in a match', () => {
    const sim = new ArenaSimulation({ seed: 3, trainingBot: false });
    sim.addPlayer('g', 'goku', 'Goku', false, { x: 0, y: 0, z: 0 });
    sim.addPlayer('d', 'jiren', 'Dummy', false, { x: 0, y: 0, z: 8 });
    sim.startMatch();
    const events: CombatEvent[] = [];
    let seq = 1;
    for (let i = 0; i < 90; i++) {
      sim.submitInput('g', { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, targetId: 'd', ...(i === 70 ? { attack: 'special' } : {}) });
      sim.step(1 / 60);
      events.push(...sim.snapshot(true).events);
    }
    const cast = events.find(e => e.kind === 'cast' && e.actorId === 'g' && e.slot === 'special');
    expect(cast?.move).toBe(MOVES.goku.special.name);
  });

  it("makes ORIGINAL the house version, and a player's kit overrides it slot by slot", () => {
    const own = ownKit('goku');
    expect(forgeMoves(own).special).toEqual(MOVES.goku.special);
    expect(budget(own)).toBeCloseTo(1, 10);
    const session = new ForgeSession();
    const before = MOVES.goku.special;
    const kit: ForgeKit = { ...own, slots: { ...own.slots, special: { from: 'jiren', fromSlot: 'special' } } };
    expect(session.apply(kit)).toEqual({ ok: true });
    expect(MOVES.goku.special.name).toBe(simSpec('jiren')!.kit.slots.special.name);
    expect(MOVES.goku.area).toEqual(tuneMove(areaMoveOf('sukuna'), { fx: { effect: 'test-burst' } }));
    session.restore();
    expect(MOVES.goku.special).toBe(before);
  });

  it('validates with forgeProblems like any kit', () => {
    expect(forgeProblems(houseForgeKit('goku')!, { sandbox: true }).errors).toEqual([]);
    expect(forgeProblems(houseForgeKit('vegeta')!, { sandbox: true }).errors).toEqual([]);
    expect(houseForgeKit('luffy')).toBeUndefined();
  });
});

describe('house kits on the page', () => {
  it('draws a house pick as the borrowed move it is: its source, its effect and the aura', () => {
    expect(moveSource({ fighter: 'goku' }, 'special')).toEqual({ fighter: 'vegeta', slot: 'special' });
    expect(moveSource({ fighter: 'goku' }, 'area')).toEqual({ fighter: 'sukuna', slot: 'area' });
    expect(moveSource({ fighter: 'goku' }, 'light')).toBeUndefined();
    expect(slotFx({ fighter: 'goku' }, 'area')).toEqual({ effect: 'test-burst' });
    expect(slotFx({ fighter: 'goku' }, 'body')).toEqual({ effect: 'test-aura', scale: 1.2 });
    expect(presentationKit({ fighter: 'luffy' })).toBeUndefined();
  });

  it("lays a player's kit over it slot by slot, its ORIGINAL picks staying the house's", () => {
    const own = ownKit('goku');
    setActiveKit({ ...own, slots: { ...own.slots, light: { from: 'luffy', fromSlot: 'light' }, heavy: { from: 'vegeta', fromSlot: 'special' },
      special: { from: 'goku', fx: { effect: 'mine' } } }, aura: { effect: 'my-aura' } });
    expect(moveSource({ fighter: 'goku' }, 'light')).toEqual({ fighter: 'luffy', slot: 'light' });
    expect(moveSource({ fighter: 'goku' }, 'heavy')).toEqual({ fighter: 'goku', slot: 'special' });
    expect(moveSource({ fighter: 'goku' }, 'special')).toEqual({ fighter: 'vegeta', slot: 'special' });
    expect(slotFx({ fighter: 'goku' }, 'special')).toEqual({ effect: 'mine' });
    expect(slotFx({ fighter: 'goku' }, 'area')).toEqual({ effect: 'test-burst' });
    expect(slotFx({ fighter: 'goku' }, 'body')).toEqual({ effect: 'my-aura' });
  });
});
