import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { BURN_TICK, FREEZE_IMMUNITY, MOVES, type MoveDefinition } from '../src/game/moves';
import type { AttackSlot, CombatEvent, FighterId } from '../src/game/types';
import { BUDGET_LIMIT, FORGE_STATUSES, budget, forgeMoves, forgeProblems, moveProblems, ownKit, statusValue, type ForgeKit } from '../src/engine/sim';

const withStatus = (status: MoveDefinition['status']): Record<AttackSlot, MoveDefinition> =>
  ({ ...MOVES.endeavor, light: { ...MOVES.endeavor.light, status } });
function duel(status: MoveDefinition['status'], rival: FighterId = 'aokiji') {
  const sim = new ArenaSimulation({ trainingBot: false, seed: 9 });
  sim.addPlayer('a', 'endeavor', 'A', false, { x: 0, y: 0, z: 0 });
  sim.addPlayer('b', rival, 'B', false, { x: 0, y: 0, z: 1.6 });
  sim.forge('a', withStatus(status), 'test');
  const events: CombatEvent[] = [];
  let seq = 0;
  const step = (ticks: number, a: Partial<Parameters<ArenaSimulation['submitInput']>[1]> = {}, b: Partial<Parameters<ArenaSimulation['submitInput']>[1]> = {}) => {
    for (let i = 0; i < ticks; i++) {
      sim.submitInput('a', { seq: seq, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', ...(i === 0 ? a : {}) });
      sim.submitInput('b', { seq: seq++, moveX: 0, moveZ: 0, yaw: Math.PI, ...b });
      sim.step();
      events.push(...(sim.snapshot(true).events ?? []));
    }
  };
  return { sim, step, events };
}

describe('statuses', () => {
  it('burns over time, a tick every half second, never the last point, counted to whoever lit it', () => {
    const { sim, step, events } = duel(FORGE_STATUSES.burn);
    step(1, { attack: 'light' }); step(40);
    expect(events.some(event => event.kind === 'status' && event.status === 'burn' && event.targetId === 'b')).toBe(true);
    const lit = sim.getPlayer('b')!.hp;
    expect(sim.getPlayer('b')!.status).toEqual(['burn']);
    step(Math.round(60 * 4));
    const burned = lit - sim.getPlayer('b')!.hp;
    expect(burned).toBeGreaterThan(0); expect(burned).toBeLessThanOrEqual(statusValue(FORGE_STATUSES.burn));
    expect(sim.getPlayer('b')!.status).toBeUndefined();
    expect(sim.getPlayer('a')!.damageDealt).toBeGreaterThanOrEqual(1000 - sim.getPlayer('b')!.hp - 0);
    const low = duel(FORGE_STATUSES.burn);
    low.sim.actors.get('b')!.state.hp = 12;
    low.step(1, { attack: 'light' }); low.step(60 * 5);
    expect(low.sim.getPlayer('b')!.hp).toBeGreaterThanOrEqual(1); expect(low.sim.getPlayer('b')!.alive).toBe(true);
    expect(BURN_TICK).toBe(.5);
  });

  it('runs a burn lit again from its own next tick, so one lit faster than it ticks still burns', () => {
    const { sim, step } = duel(undefined);
    const b = sim.actors.get('b')!, hp = b.state.hp;
    const afflict = (sim as unknown as { afflict(target: unknown, fromId: string, status: unknown): void }).afflict.bind(sim);
    for (let i = 0; i < 8; i++) { afflict(b, 'a', FORGE_STATUSES.burn); step(18); }
    expect(hp - b.state.hp).toBeGreaterThanOrEqual(4 * Math.round(FORGE_STATUSES.burn.dps * BURN_TICK));
  });

  it('slows the victim: it covers less floor running for as long as the slow lasts', () => {
    const run = (status: MoveDefinition['status']) => {
      const { sim, step } = duel(status);
      step(1, { attack: 'light' }); step(50);
      const from = sim.getPlayer('b')!.x;
      step(60, {}, { moveX: 1 });
      return Math.abs(sim.getPlayer('b')!.x - from);
    };
    const plain = run(undefined), slowed = run(FORGE_STATUSES.slow);
    expect(slowed).toBeLessThan(plain * .8);
  });

  it("freezes the victim where it stands - no attack while frozen - then can't freeze it again for a while", () => {
    const { sim, step, events } = duel(FORGE_STATUSES.freeze, 'zoro');
    step(1, { attack: 'light' }); step(16);
    expect(sim.getPlayer('b')!.status).toContain('freeze');
    const before = events.filter(event => event.kind === 'cast' && event.actorId === 'b').length;
    step(1, {}, { attack: 'light' }); step(5);
    expect(events.filter(event => event.kind === 'cast' && event.actorId === 'b').length).toBe(before);
    step(60);
    const freezes = events.filter(event => event.kind === 'status' && event.status === 'freeze').length;
    step(1, { attack: 'light' }); step(30);
    expect(events.filter(event => event.kind === 'status' && event.status === 'freeze').length).toBe(freezes);
    expect(FREEZE_IMMUNITY).toBe(2);
  });

  it('clears on a respawn, and no roster move outside the area slot carries one', () => {
    const { sim, step } = duel(FORGE_STATUSES.burn);
    step(1, { attack: 'light' }); step(30);
    sim.trainingCommand('a', 'reset');
    expect(sim.getPlayer('b')!.status).toBeUndefined();
    for (const [id, slots] of Object.entries(MOVES)) for (const [slot, move] of Object.entries(slots)) if (slot !== 'area') expect(move.status, `${id} ${move.name}`).toBeUndefined();
  });
});

describe('statuses in the Forge', () => {
  const kit = (status: 'burn' | 'slow' | 'freeze'): ForgeKit => ({ ...ownKit('endeavor', 'Burning Fist'), slots: { ...ownKit('endeavor').slots, special: { from: 'endeavor', status } } });
  it('prices each status into the budget: any one fits on a special, and refuses one the Forge does not offer', () => {
    for (const status of ['burn', 'slow', 'freeze'] as const) {
      expect(forgeMoves(kit(status)).special.status).toEqual(FORGE_STATUSES[status]);
      expect(budget(kit(status))).toBeGreaterThan(1); expect(budget(kit(status))).toBeLessThan(BUDGET_LIMIT);
      expect(forgeProblems(kit(status)).errors).toEqual([]);
    }
    expect(forgeProblems({ ...kit('burn'), slots: { ...kit('burn').slots, special: { from: 'endeavor', status: 'poison' as never } } }).errors[0]).toMatch(/not burn, slow or freeze/);
  });
  it('counts a status no more often than it can take hold: a slow or a freeze on a quick button is paid for elsewhere', () => {
    const own = ownKit('endeavor', 'Cold Fist');
    const quick: ForgeKit = { ...own, slots: { ...own.slots, light: { from: 'endeavor', status: 'freeze' } } };
    expect(budget(quick)).toBeGreaterThan(BUDGET_LIMIT);
    expect(budget(quick)).toBeLessThan(1.2);
    const paid: ForgeKit = { ...quick, slots: { ...quick.slots, heavy: { from: 'endeavor', tune: { power: .8 } } } };
    expect(budget(paid)).toBeLessThan(BUDGET_LIMIT); expect(forgeProblems(paid).errors).toEqual([]);
  });
  it('holds a status to its limits in the validator', () => {
    const light = MOVES.endeavor.light;
    expect(moveProblems({ ...light, status: { kind: 'burn', seconds: 9, dps: 10 } }, 'x').errors[0]).toMatch(/burn lasts 9 s/);
    expect(moveProblems({ ...light, status: { kind: 'slow', seconds: 2, factor: .1 } }, 'x').errors[0]).toMatch(/slow runs at 0.1/);
    expect(moveProblems({ ...light, status: { kind: 'freeze', seconds: 3 } }, 'x').errors[0]).toMatch(/freeze lasts 3 s/);
    for (const status of Object.values(FORGE_STATUSES)) expect(moveProblems({ ...light, status }, 'x').errors).toEqual([]);
  });
});
