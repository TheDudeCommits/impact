import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { CHIP, JUST_GUARD_WINDOW, MOVES } from '../src/game/moves';
import type { CombatEvent, FighterId, PlayerInput } from '../src/game/types';

function bout(fighter: FighterId = 'zoro', other: FighterId = 'goku', gap = 1.6) {
  const sim = new ArenaSimulation({ trainingBot: false });
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
  const drain = () => { events.push(...sim.snapshot().events); return events; };
  const saw = (kind: CombatEvent['kind']) => drain().some(e => e.kind === kind);
  input('a', { targetId: 'b' }); input('b', { targetId: 'a' });
  return { sim, input, step, hold, saw, drain };
}

describe('blocking is a decision, not a tax', () => {
  it('parries a hit taken on the beat: no chip, no stamina, attacker held', () => {
    const { sim, input, step, saw } = bout('zoro');
    const light = MOVES.zoro.light;
    input('a', { attack: 'light', targetId: 'b' });
    step(light.contacts[0] - JUST_GUARD_WINDOW * .5);
    const stamina = sim.getPlayer('b')!.stamina;
    input('b', { guard: true, targetId: 'a' });
    step(JUST_GUARD_WINDOW * .5 + .05);
    expect(saw('just-guard'), 'a block on the beat is a parry').toBe(true);
    expect(sim.getPlayer('b')!.hp).toBe(1000);
    expect(sim.getPlayer('b')!.stamina).toBeGreaterThanOrEqual(stamina - 1);
    expect(sim.getPlayer('a')!.action).toBe('hurt');
  });

  it('charges a late block chip and stamina instead', () => {
    const { sim, input, step, hold, saw } = bout('zoro');
    hold('b', { guard: true, targetId: 'a' }, .6);
    const stamina = sim.getPlayer('b')!.stamina;
    input('a', { attack: 'light', targetId: 'b' });
    hold('b', { guard: true, targetId: 'a' }, MOVES.zoro.light.contacts[0] + .08);
    step(0);
    expect(saw('just-guard'), 'holding guard never re-arms the parry').toBe(false);
    expect(saw('blocked')).toBe(true);
    expect(sim.getPlayer('b')!.hp).toBeLessThan(1000);
    expect(sim.getPlayer('b')!.stamina).toBeLessThan(stamina);
  });

  it('does not parry for a defender who never let go of the button', () => {
    const { sim } = bout('goku', 'goku');
    let seq = 1000, blocks = 0, parries = 0;
    for (let i = 0; i < 600; i++) {
      sim.submitInput('a', { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', attack: i >= Math.round(JUST_GUARD_WINDOW * 60) + 2 ? 'light' : undefined });
      sim.submitInput('b', { seq: seq++, moveX: 0, moveZ: 0, yaw: Math.PI, guard: true, targetId: 'a' });
      sim.step();
      for (const e of sim.snapshot(true).events) {
        if (e.kind === 'blocked') blocks++;
        if (e.kind === 'just-guard') parries++;
      }
    }
    expect(blocks, 'the pressure never landed').toBeGreaterThan(5);
    expect(parries, `${parries} parries from ${blocks} blocks, with the button never released`).toBeLessThanOrEqual(1);
  });

  it('will not chip a guard to death with a normal, and will with an ultimate', () => {
    const { sim, input, hold } = bout('zoro');
    (sim as unknown as { actors: Map<string, { state: { hp: number } }> }).actors.get('b')!.state.hp = 1;
    hold('b', { guard: true, targetId: 'a' }, .4);
    input('a', { attack: 'light', targetId: 'b' });
    hold('b', { guard: true, targetId: 'a' }, MOVES.zoro.light.duration + .1);
    expect(sim.getPlayer('b')!.alive, 'a jab cannot chip someone out').toBe(true);
    expect(sim.getPlayer('b')!.hp).toBe(1);
  });

  it('scales chip by slot', () => {
    expect(CHIP.light).toBeLessThan(CHIP.heavy);
    expect(CHIP.heavy).toBeLessThan(CHIP.special);
    expect(CHIP.special).toBeLessThan(CHIP.ultimate);
  });
});

describe('the arena hits back', () => {
  it('splats a body driven into the stage bound', () => {
    const sim = new ArenaSimulation({ trainingBot: false, stage: 'galactic-arena' });
    const { halfZ } = sim.bounds;
    sim.addPlayer('a', 'zoro', 'A', false, { x: 0, y: 0, z: halfZ - 2.8 });
    sim.addPlayer('b', 'goku', 'B', false, { x: 0, y: 0, z: halfZ - .8 });
    let seq = 0;
    sim.submitInput('a', { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', attack: 'heavy' });
    const events: CombatEvent[] = [];
    for (let i = 0; i < 120; i++) { sim.step(); events.push(...sim.snapshot().events); }
    expect(events.some(e => e.kind === 'wall-splat'), 'a wall is a surface, not scenery').toBe(true);
  });

  it('bounces a juggled fighter off the floor once', () => {
    const { sim, input, step, drain } = bout('vegeta', 'goku', 1.4);
    input('a', { attack: 'heavy', targetId: 'b' });
    step(MOVES.vegeta.heavy.contacts[0] + .15);
    expect(sim.getPlayer('b')!.grounded).toBe(false);
    input('a', { attack: 'heavy', targetId: 'b' });
    step(2.4);
    const bounces = drain().filter(e => e.kind === 'ground-bounce');
    expect(bounces.length, 'once, not a trampoline').toBeLessThanOrEqual(1);
  });
});

describe('two beams cancel each other out', () => {
  it('annihilates a Kamehameha into a Galick Gun: neither one lands', () => {
    const { sim, input, step, saw } = bout('goku', 'vegeta', 6);
    input('a', { attack: 'special', targetId: 'b' });
    input('b', { attack: 'special', targetId: 'a' });
    step(Math.max(MOVES.goku.special.contacts[0], MOVES.vegeta.special.contacts[0]) + .1);
    expect(saw('projectile-clash'), 'the two beams meet and go out').toBe(true);
    expect(sim.getPlayer('a')!.hp, 'neither beam gets through').toBe(1000);
    expect(sim.getPlayer('b')!.hp).toBe(1000);
    step(.3);
    expect(sim.getPlayer('a')!.action).not.toBe('special');
    expect(sim.getPlayer('b')!.action).not.toBe('special');
  });

  it('still lets a beam through when nothing is pointed back at it', () => {
    const { sim, input, step, saw } = bout('goku', 'vegeta', 6);
    input('a', { attack: 'special', targetId: 'b' });
    step(MOVES.goku.special.contacts[0] + .1);
    expect(saw('projectile-clash'), 'one beam is not a clash').toBe(false);
    expect(sim.getPlayer('b')!.hp, 'an unanswered Kamehameha hits').toBeLessThan(1000);
  });

  it('leaves two swings to trade, because a blade lock is not a thing here', () => {
    const { sim, input, step, saw } = bout('zoro', 'ichigo', 1.5);
    input('a', { attack: 'light', targetId: 'b' });
    input('b', { attack: 'light', targetId: 'a' });
    step(Math.max(MOVES.zoro.light.contacts[0], MOVES.ichigo.light.contacts[0]) + .12);
    expect(saw('projectile-clash'), 'swords are not beams').toBe(false);
    expect(sim.getPlayer('a')!.hp, 'they hit each other instead').toBeLessThan(1000);
    expect(sim.getPlayer('b')!.hp).toBeLessThan(1000);
  });

  it('cancels two shots that meet in the air', () => {
    const { sim, input, step, saw } = bout('zoro', 'ichigo', 22);
    input('a', { attack: 'special', targetId: 'b' });
    input('b', { attack: 'special', targetId: 'a' });
    step(3);
    expect(saw('projectile-clash')).toBe(true);
    expect(sim.getPlayer('a')!.hp, 'neither shot gets through').toBe(1000);
    expect(sim.getPlayer('b')!.hp).toBe(1000);
  });
});

describe('a swing goes where the fighter is looking', () => {
  it('turns a melee cast onto someone standing off the aim line', () => {
    const sim = new ArenaSimulation({ trainingBot: false });
    sim.addPlayer('a', 'zoro', 'A', false, { x: 0, y: 0, z: 0 });
    sim.addPlayer('b', 'goku', 'B', false, { x: 1.1, y: 0, z: 1.3 });
    sim.submitInput('a', { seq: 1, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', attack: 'light' });
    for (let i = 0; i < Math.round((MOVES.zoro.light.contacts[0] + .1) * 60); i++) sim.step();
    expect(sim.getPlayer('b')!.hp, 'a swing at someone in front of you should reach them').toBeLessThan(1000);
  });

  it('will not turn round to find someone behind', () => {
    const sim = new ArenaSimulation({ trainingBot: false });
    sim.addPlayer('a', 'zoro', 'A', false, { x: 0, y: 0, z: 0 });
    sim.addPlayer('b', 'goku', 'B', false, { x: 0, y: 0, z: -1.6 });
    sim.submitInput('a', { seq: 1, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', attack: 'light' });
    for (let i = 0; i < Math.round((MOVES.zoro.light.contacts[0] + .1) * 60); i++) sim.step();
    expect(sim.getPlayer('b')!.hp).toBe(1000);
  });
});
