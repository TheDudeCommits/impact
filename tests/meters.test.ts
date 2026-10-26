import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { AWAKENING_PER_BLOCKED, AWAKENING_PER_DAMAGE, CHIP, JUST_GUARD_METER, JUST_GUARD_WINDOW, MOVES,
  ULTIMATE_COST, ULTIMATE_PER_DAMAGE } from '../src/game/moves';
import { AWAKENING_COST } from '../src/game/awakening';
import type { CombatEvent, FighterId, PlayerInput } from '../src/game/types';

function bout(fighter: FighterId = 'zoro', other: FighterId = 'goku', gap = 1.6) {
  const sim = new ArenaSimulation({ trainingBot: false, seed: 5 });
  sim.addPlayer('a', fighter, 'A', false, { x: 0, y: 0, z: 0 });
  sim.addPlayer('b', other, 'B', false, { x: 0, y: 0, z: gap });
  let seq = 0;
  const input = (id: string, more: Partial<PlayerInput>) =>
    sim.submitInput(id, { seq: seq++, moveX: 0, moveZ: 0, yaw: id === 'a' ? 0 : Math.PI, ...more });
  const step = (seconds: number) => { for (let i = 0; i < Math.round(seconds * 60); i++) sim.step(); };
  const hold = (id: string, more: Partial<PlayerInput>, seconds: number) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) { input(id, more); sim.step(); }
  };
  const events: CombatEvent[] = [];
  const drain = () => { events.push(...sim.snapshot(true).events); return events; };
  input('a', { targetId: 'b' }); input('b', { targetId: 'a' });
  return { sim, input, step, hold, drain };
}

describe('the ultimate bar fills from damage dealt, the awakening bar from damage taken', () => {
  it('pays the attacker in ultimate and the victim in awakening, and nothing the other way round', () => {
    const { sim, input, step, drain } = bout();
    input('a', { attack: 'light', targetId: 'b' });
    step(MOVES.zoro.light.duration + .1);
    const hit = drain().find(e => e.kind === 'hit' && e.targetId === 'b')!;
    expect(hit, 'the jab landed').toBeDefined();
    const a = sim.getPlayer('a')!, b = sim.getPlayer('b')!;
    expect(a.ultimate).toBeCloseTo(hit.damage! * ULTIMATE_PER_DAMAGE, 6);
    expect(a.awakening, 'hitting somebody is not being hit').toBe(0);
    expect(b.awakening).toBeCloseTo(hit.damage! * AWAKENING_PER_DAMAGE, 6);
    expect(b.ultimate, 'the victim no longer gets a sliver of ultimate for being hit').toBe(0);
  });

  it('credits a blocked hit to the defender\'s awakening at the unblocked figure, not the chip', () => {
    const { sim, input, hold, drain } = bout();
    hold('b', { guard: true, targetId: 'a' }, .6);
    input('a', { attack: 'light', targetId: 'b' });
    hold('b', { guard: true, targetId: 'a' }, MOVES.zoro.light.contacts[0] + .08);
    const blocked = drain().find(e => e.kind === 'blocked')!;
    expect(blocked).toBeDefined();
    const chip = blocked.damage!;
    expect(chip).toBe(Math.max(1, Math.round(MOVES.zoro.light.damage * CHIP.light)));
    const b = sim.getPlayer('b')!;
    expect(b.awakening).toBeCloseTo(MOVES.zoro.light.damage * AWAKENING_PER_BLOCKED, 6);
    expect(b.awakening, 'more than the chip alone would be worth').toBeGreaterThan(chip * AWAKENING_PER_DAMAGE);
    expect(sim.getPlayer('a')!.ultimate, 'a blocked swing builds nothing for its thrower').toBe(0);
  });

  it('keeps the just-guard bonus on the ultimate bar', () => {
    const { sim, input, step, drain } = bout();
    input('a', { attack: 'light', targetId: 'b' });
    step(MOVES.zoro.light.contacts[0] - JUST_GUARD_WINDOW * .5);
    input('b', { guard: true, targetId: 'a' });
    step(JUST_GUARD_WINDOW * .5 + .05);
    expect(drain().some(e => e.kind === 'just-guard')).toBe(true);
    expect(sim.getPlayer('b')!.ultimate).toBe(JUST_GUARD_METER);
    expect(sim.getPlayer('b')!.awakening).toBe(0);
  });
});

describe('each bar buys its own thing', () => {
  it('spends the awakening bar on the transformation and leaves the ultimate bar alone', () => {
    const { sim, input, step } = bout();
    Object.assign(sim.actors.get('a')!.state, { ultimate: 100, awakening: 100 });
    input('a', { awaken: true });
    step(.05);
    const a = sim.getPlayer('a')!;
    expect(a.awakened).toBe(true);
    expect(a.awakening).toBe(0);
    expect(a.ultimate, 'untouched').toBe(100);
  });

  it('spends the ultimate bar on the ultimate, awakened or not', () => {
    for (const awakened of [false, true]) {
      const { sim, input, step } = bout();
      Object.assign(sim.actors.get('a')!.state, { ultimate: 100, awakening: awakened ? 100 : 0 });
      if (awakened) { input('a', { awaken: true }); step(1.1); expect(sim.getPlayer('a')!.awakened).toBe(true); }
      input('a', { attack: 'ultimate', targetId: 'b' });
      step(.05);
      expect(sim.getPlayer('a')!.action, awakened ? 'awakened' : 'plain').toBe('ultimate');
      expect(sim.getPlayer('a')!.ultimate).toBe(0);
      expect(sim.getPlayer('a')!.awakening, 'the ultimate does not touch the other bar').toBe(0);
    }
  });

  it('refuses the transformation on a full ultimate bar, and the ultimate on a full awakening bar', () => {
    const wrongBar = bout();
    Object.assign(wrongBar.sim.actors.get('a')!.state, { ultimate: 100, awakening: AWAKENING_COST - 1 });
    wrongBar.input('a', { awaken: true });
    wrongBar.step(.3);
    expect(wrongBar.sim.getPlayer('a')!.awakened, 'the ultimate bar does not buy a transformation').toBeFalsy();
    expect(wrongBar.sim.getPlayer('a')!.ultimate).toBe(100);

    const otherBar = bout();
    Object.assign(otherBar.sim.actors.get('a')!.state, { ultimate: ULTIMATE_COST - 1, awakening: 100 });
    otherBar.input('a', { attack: 'ultimate', targetId: 'b' });
    otherBar.step(.3);
    expect(otherBar.sim.getPlayer('a')!.action).not.toBe('ultimate');
    expect(otherBar.drain().some(e => e.kind === 'rejected' && e.reason === 'ultimate-meter'),
      'the awakening bar does not buy an ultimate').toBe(true);
  });

  it('is on the wire, and the practice tool fills both', () => {
    const sim = new ArenaSimulation({ seed: 5 });
    sim.addPlayer('me', 'goku', 'Me');
    const before = sim.snapshot().players.find(p => p.id === 'me')!;
    expect(before.ultimate).toBe(0);
    expect(before.awakening).toBe(0);
    expect(sim.trainingCommand('me', 'awakening')).toBe(true);
    const after = sim.snapshot().players.find(p => p.id === 'me')!;
    expect(after.ultimate).toBe(100);
    expect(after.awakening).toBe(100);
    sim.dispose();
  });
});

describe('bots read both bars', () => {
  it('transforms on a full awakening bar', () => {
    const sim = new ArenaSimulation({ roomMode: 'training', seed: 21 });
    sim.addPlayer('me', 'goku', 'Me', false, { x: 0, y: 0, z: 0 });
    const bot = sim.actors.get('sparring-bot')!;
    Object.assign(bot.state, { x: 0, y: 0, z: 12, awakening: 100 });
    for (let i = 0; i < 60 * 20 && !bot.state.awakened; i++) sim.step();
    expect(bot.state.awakened, 'a bot with a full awakening bar transforms').toBe(true);
    expect(bot.state.awakening).toBe(0);
    sim.dispose();
  });

  it('throws its ultimate on a full ultimate bar without needing to be awakened', () => {
    const sim = new ArenaSimulation({ roomMode: 'training', seed: 21 });
    sim.addPlayer('me', 'goku', 'Me', false, { x: 0, y: 0, z: 0 });
    const bot = sim.actors.get('sparring-bot')!;
    Object.assign(bot.state, { x: 0, y: 0, z: 3, ultimate: 100 });
    let thrown = false;
    for (let i = 0; i < 60 * 20 && !thrown; i++) {
      Object.assign(sim.actors.get('me')!.state, { x: 0, z: 0 });
      sim.step();
      thrown = sim.snapshot(true).events.some(e => e.kind === 'cast' && e.actorId === 'sparring-bot' && e.slot === 'ultimate');
    }
    expect(thrown, 'a bot with a full ultimate bar spends it').toBe(true);
    expect(bot.state.awakened, 'and did not have to transform first').toBeFalsy();
    sim.dispose();
  });
});
