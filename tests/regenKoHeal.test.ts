import fs from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { COMBO_HP, COMBO_STAMINA, KO_HEAL, STAMINA_REGEN } from '../src/game/moves';
import { ArenaSimulation } from '../src/game/simulation';
import { BASE_STATS } from '../src/survival/upgrades';
import type { PlayerState } from '../src/game/types';

const sims: ArenaSimulation[] = [];
afterEach(() => { for (const s of sims.splice(0)) s.dispose(); });
type Live = { actors: Map<string, { state: PlayerState }>; eliminate(a: unknown, actorId: string): void };
const live = (sim: ArenaSimulation) => sim as unknown as Live;
const state = (sim: ArenaSimulation, id: string) => live(sim).actors.get(id)!.state;

describe('stamina back twice as fast', () => {
  it('refills an idle fighter at 32 a second, twice the 16 it was', () => {
    expect(STAMINA_REGEN).toBe(32);
    const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, maxStamina: COMBO_STAMINA }); sims.push(sim);
    sim.addPlayer('t', 'naruto', 'T');
    const t = state(sim, 't');
    t.stamina = 40;
    for (let i = 0; i < 60; i++) sim.step();
    expect(t.stamina).toBeCloseTo(40 + STAMINA_REGEN, 0);
  });

  it("doubles a survival run's own refill too; its upgrades still add theirs", () => expect(BASE_STATS.staminaRegen).toBe(18));
});

describe("the royale's knockout heal", () => {
  function knockout(hp: number, options: { koHeal?: number } = { koHeal: KO_HEAL }) {
    const sim = new ArenaSimulation({ roomMode: 'match', maxStamina: COMBO_STAMINA, maxHp: COMBO_HP, ...options }); sims.push(sim);
    sim.addPlayer('a', 'naruto', 'A'); sim.addPlayer('b', 'goku', 'B', true);
    sim.startMatch(); sim.drainEvents();
    state(sim, 'a').hp = hp;
    live(sim).eliminate(live(sim).actors.get('b'), 'a');
    return { sim, a: state(sim, 'a'), ko: sim.drainEvents().find(e => e.kind === 'eliminated')! };
  }

  it('gives whoever scored it 20% of their health bar back', () => {
    expect(KO_HEAL).toBe(.2);
    const { a, ko } = knockout(500);
    expect(a.hp).toBeCloseTo(500 + COMBO_HP * .2);
    expect(ko.heal).toBeCloseTo(COMBO_HP * .2);
    expect(a.kills).toBe(1);
  });

  it('never past full, and says what it gave', () => {
    const { a, ko } = knockout(COMBO_HP - 100);
    expect(a.hp).toBe(COMBO_HP);
    expect(ko.heal).toBeCloseTo(100);
    const full = knockout(COMBO_HP);
    expect(full.a.hp).toBe(COMBO_HP);
    expect(full.ko.heal).toBeUndefined();
  });

  it('heals nobody for a fall into the water, or in a room without it', () => {
    const sim = new ArenaSimulation({ roomMode: 'match', maxHp: COMBO_HP, koHeal: KO_HEAL }); sims.push(sim);
    sim.addPlayer('a', 'naruto', 'A'); sim.addPlayer('b', 'goku', 'B', true);
    sim.startMatch(); state(sim, 'a').hp = 500;
    live(sim).eliminate(live(sim).actors.get('b'), 'water');
    expect(state(sim, 'a').hp).toBe(500);
    const duel = knockout(500, {});
    expect(duel.a.hp).toBe(500);
    expect(duel.ko.heal).toBeUndefined();
  });

  it('is the royale\'s only: the server\'s royales and the solo one, not a Duel', () => {
    expect(fs.readFileSync('src/server/ArenaRoom.ts', 'utf8')).toMatch(/koHeal: this\.duelRoom \? 0 : KO_HEAL/);
    expect(fs.readFileSync('src/game/LocalRoyale.ts', 'utf8')).toMatch(/koHeal: ?KO_HEAL/);
    for (const file of ['src/game/duel/LocalDuel.ts', 'src/network.ts', 'src/game/objectives/ObjectiveMatch.ts', 'src/survival/SurvivalGame.ts'])
      expect(fs.readFileSync(file, 'utf8'), file).not.toMatch(/koHeal/);
  });
});
