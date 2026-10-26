import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { GETUP_SECONDS, KNOCKDOWN_SECONDS, LAUNCHING, MOVES, OUTCOME_DOWN, OUTCOME_LIFT, RUSH_STAGES, SPIN_SECONDS, STAGGER_GUARD,
  STAGGER_SPENT, WALL_BOUNCE_LIFT, type MoveDefinition, type Outcome } from '../src/game/moves';
import type { CombatEvent, FighterId, PlayerInput } from '../src/game/types';

const ROSTER = Object.keys(MOVES) as FighterId[];

function bout(fighter: FighterId, gap = 1.6, options: ConstructorParameters<typeof ArenaSimulation>[0] = {}, at = 0) {
  const sim = new ArenaSimulation({ trainingBot: false, seed: 9, ...options });
  sim.addPlayer('a', fighter, 'A', false, { x: 0, y: 0, z: at });
  sim.addPlayer('b', 'goku', 'B', false, { x: 0, y: 0, z: at + gap });
  let seq = 0;
  const input = (more: Partial<PlayerInput> = {}) => sim.submitInput('a', { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', ...more });
  const events: CombatEvent[] = [];
  const trace: { t: number; y: number; z: number; yaw: number; action: string; grounded: boolean }[] = [];
  const step = (seconds: number, each?: (i: number) => void) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      each?.(i); sim.step(); events.push(...sim.snapshot(true).events);
      const b = sim.getPlayer('b')!;
      trace.push({ t: sim.serverTime, y: b.y, z: b.z, yaw: b.yaw, action: b.action, grounded: b.grounded });
    }
  };
  const mine = (kind: CombatEvent['kind']) => events.filter(e => e.kind === kind && e.actorId === 'a');
  input(); sim.submitInput('b', { seq: 0, moveX: 0, moveZ: 0, yaw: Math.PI, targetId: 'a' });
  return { sim, input, step, events, trace, mine, attacker: sim.actors.get('a')!, victim: sim.actors.get('b')! };
}
function throwHeavy(fighter: FighterId, patch: Partial<MoveDefinition>, seconds = 3, gap = 1.6) {
  const was = MOVES[fighter].heavy;
  MOVES[fighter].heavy = { ...was, ...patch };
  try {
    const fight = bout(fighter, gap);
    fight.input({ attack: 'heavy' });
    fight.step(seconds);
    return fight;
  } finally { MOVES[fighter].heavy = was; }
}
const freeAfter = (fight: ReturnType<typeof bout>) => {
  const hit = fight.mine('hit')[0];
  const free = fight.trace.find(f => f.t > hit.serverTime + .05 && f.grounded && ['idle', 'run', 'guard'].includes(f.action));
  return free ? free.t - hit.serverTime : Infinity;
};

describe('every move says what it does', () => {
  it('gives every heavy, special and rush finisher of the roster an outcome of its own (bar Blue and the Rasenshuriken)', () => {
    for (const f of ROSTER) {
      const { heavy, special } = MOVES[f];
      if (f !== 'gojo') expect(heavy.outcome, `${f} heavy`).toBeDefined();
      if (f !== 'naruto') expect(special.outcome, `${f} special`).toBeDefined();
    }
    expect(MOVES.naruto.special.outcome).toBeUndefined();
    expect(MOVES.gojo.heavy.outcome).toBeUndefined();
    expect(MOVES.gojo.heavy.knockback).toBeLessThan(0);
  });
  it('launches with four heavies and six specials, where it was fifteen and fourteen', () => {
    expect(ROSTER.filter(f => MOVES[f].heavy.outcome === 'launch')).toEqual(['zoro', 'vegeta', 'goku', 'naruto']);
    expect(ROSTER.filter(f => MOVES[f].special.outcome === 'launch').length).toBe(5);
    expect(MOVES.naruto.special.knockback).toBeGreaterThanOrEqual(6);
  });
  it('leaves the ultimates alone - they are ULTFIX\'s', () => {
    for (const f of ROSTER) expect(MOVES[f].ultimate.outcome, f).toBeUndefined();
  });
});

describe('the outcomes', () => {
  it('launch: up to about 1.4 m, down for OUTCOME_DOWN.launch, lower and sooner than the old 7.5', () => {
    const fight = throwHeavy('goku', { outcome: 'launch' });
    expect(fight.mine('hit')[0].outcome).toBe('launch');
    const top = Math.max(...fight.trace.map(f => f.y));
    expect(top).toBeGreaterThan(1.1); expect(top).toBeLessThan(1.6);
    expect(OUTCOME_LIFT.launch).toBeLessThan(7.5);
    expect(freeAfter(fight)).toBeLessThan(2);
  });
  it('hop: a short pop off the feet that the light out of it juggles', () => {
    const alone = throwHeavy('ichigo', {}, 2);
    expect(alone.mine('hit')[0].outcome).toBe('hop');
    const top = Math.max(...alone.trace.map(f => f.y));
    expect(top, 'a hop, not a launch').toBeLessThan(1.1);
    expect(top).toBeGreaterThan(.5);
    const fight = throwHeavy('ichigo', {}, .1);
    let first = -1;
    fight.step(3, i => { if (first < 0 && fight.mine('hit').length) first = i; if (first >= 0 && (i - first) % 15 === 0) fight.input({ attack: 'light' }); });
    const [, ...after] = fight.mine('hit');
    expect(fight.mine('chase').length, 'the light is the chase').toBe(1);
    expect(after.some(e => e.reaction === 'launched'), 'and juggles them').toBe(true);
  });
  it('crumple: folds to the floor where it stood and is up again quickly', () => {
    const fight = throwHeavy('kakashi', {});
    const blow = fight.mine('hit')[0];
    expect(blow.outcome).toBe('crumple');
    expect(Math.max(...fight.trace.map(f => f.y)), 'barely off the floor').toBeLessThan(.3);
    expect(fight.trace.some(f => f.action === 'knockdown'), 'down').toBe(true);
    const moved = Math.abs(fight.trace.find(f => f.action === 'knockdown')!.z - 1.6);
    expect(moved, 'where it stood').toBeLessThan(1.2);
    expect(freeAfter(fight)).toBeLessThan(1.35);
  });
  it('stagger: reels in place, off nobody\'s feet, long enough for the follow-up', () => {
    const fight = throwHeavy('jotaro', {}, .1);
    fight.step(2.5, i => { if (i === 18) fight.input({ attack: 'light' }); });
    const [blow] = fight.mine('hit');
    expect(blow.outcome).toBe('stagger');
    expect(blow.reaction).toBe('hurt');
    expect(Math.max(...fight.trace.map(f => f.y))).toBeLessThan(.02);
    expect(fight.victim.staggeredAt).toBeCloseTo(blow.serverTime, 5);
    expect(fight.mine('hit').some(e => e.slot === 'light'), 'the follow-up lands').toBe(true);
  });
  it('spin: one whole turn over SPIN_SECONDS, sent off to one side of the blow', () => {
    const fight = throwHeavy('law', {}, 1.5);
    const blow = fight.mine('hit')[0];
    expect(blow.outcome).toBe('spin');
    const during = fight.trace.filter(f => f.t > blow.serverTime && f.t < blow.serverTime + SPIN_SECONDS + .3);
    let turned = 0;
    for (let k = 1; k < during.length; k++) turned += Math.abs(Math.atan2(Math.sin(during[k].yaw - during[k - 1].yaw), Math.cos(during[k].yaw - during[k - 1].yaw)));
    expect(turned, 'a whole turn').toBeGreaterThan(Math.PI * 2 - .1);
    expect(turned).toBeLessThan(Math.PI * 2 + .1);
    const b = fight.sim.getPlayer('b')!;
    expect(Math.abs(b.x), 'off to the side').toBeGreaterThan(.3);
  });
  it('groundBounce: driven into the floor and straight back up into a juggle', () => {
    const fight = throwHeavy('guts', {}, 1.2, 2.2);
    const blow = fight.mine('hit')[0];
    expect(blow.outcome).toBe('groundBounce');
    expect(fight.events.filter(e => e.kind === 'ground-bounce' && e.actorId === 'b'), 'once').toHaveLength(1);
    const top = Math.max(...fight.trace.map(f => f.y));
    expect(top).toBeGreaterThan(.6); expect(top).toBeLessThan(1.3);
  });
  it('wallBounce: blown back along the floor in the open, and back off a wall into reach', () => {
    const open = throwHeavy('luffy', {});
    expect(open.mine('hit')[0].outcome).toBe('wallBounce');
    expect(Math.max(...open.trace.map(f => f.y)), 'low').toBeLessThan(.6);
    expect(open.events.filter(e => e.kind === 'wall-splat'), 'no wall').toEqual([]);
    const fight = bout('luffy', 1.6, { stage: 'galactic-arena' }, 7.2);
    fight.input({ attack: 'heavy' });
    fight.step(2.5);
    const splat = fight.events.find(e => e.kind === 'wall-splat' && e.actorId === 'b');
    expect(splat, 'off the wall').toBeDefined();
    expect(splat!.reaction, 'thrown back, not pinned').toBe('launched');
    const after = fight.trace.filter(f => f.t > splat!.serverTime);
    expect(Math.max(...after.map(f => f.y)), 'up into reach').toBeGreaterThan(.8);
    expect(after.every(f => f.action !== 'splat'), 'never stuck to it').toBe(true);
    expect(fight.attacker.chaseUntil).toBeGreaterThan(splat!.serverTime);
  });
  it('a plain launch still sticks to a wall (a splat), as it always has', () => {
    const fight = bout('goku', 1.6, { stage: 'galactic-arena' }, 7.2);
    fight.input({ attack: 'heavy' });
    fight.step(2.5);
    const splat = fight.events.find(e => e.kind === 'wall-splat' && e.actorId === 'b');
    if (splat) expect(splat.reaction).toBeUndefined();
  });
  it('puts a thrown body down for its own outcome\'s time, and a kit\'s or an ultimate\'s for the old', () => {
    for (const [fighter, outcome] of [['kakashi', 'crumple'], ['luffy', 'wallBounce'], ['guts', 'groundBounce'], ['goku', 'launch']] as [FighterId, Exclude<Outcome, 'stagger' | 'spin' | 'dizzy'>][]) {
      const fight = throwHeavy(fighter, {}, 3, fighter === 'guts' ? 2.2 : 1.6);
      const downs = fight.trace.filter(f => f.action === 'knockdown');
      expect(downs.length / 60, `${fighter}: down`).toBeCloseTo(OUTCOME_DOWN[outcome], 1);
      expect(OUTCOME_DOWN[outcome]).toBeLessThan(KNOCKDOWN_SECONDS);
    }
    expect(GETUP_SECONDS).toBeLessThan(.48);
  });
});

describe('a stagger opens one follow-up, not a loop', () => {
  it('only hurts a body staggered inside STAGGER_GUARD, and for no longer than STAGGER_SPENT', () => {
    const fight = throwHeavy('jotaro', {}, .1, 3);
    fight.step(1.2);
    const first = fight.mine('hit')[0];
    expect(first.outcome).toBe('stagger');
    expect(first.serverTime + STAGGER_GUARD).toBeGreaterThan(fight.sim.serverTime + .5);
    fight.attacker.state.cooldowns.heavy = 0; fight.attacker.state.stamina = 100;
    fight.input({ attack: 'heavy' });
    let held = 0;
    fight.step(1.2, () => { if (fight.mine('hit').length > 1 && fight.victim.reaction === 'hurt') held++; });
    const second = fight.mine('hit')[1];
    expect(second, 'the second landed').toBeDefined();
    expect(second.outcome, 'no second stagger').toBeUndefined();
    expect(held / 60).toBeLessThanOrEqual(STAGGER_SPENT + HITSTOP_ALLOWANCE);
  });
  it.each(ROSTER.filter(f => ['stagger', 'spin'].includes(MOVES[f].heavy.outcome ?? '')))('%s: mashing the heavy into strings ends before the breaker', fighter => {
    const fight = bout(fighter, 2.2);
    fight.step(6, i => {
      const s = fight.attacker.state; s.stamina = 100;
      if (i % 30 === 0) fight.input({ attack: 'heavy' });
      else if (i % 4 === 0) fight.input({ attack: 'light' });
    });
    const staggers = fight.mine('hit').filter(e => e.outcome === 'stagger' || e.outcome === 'spin');
    for (let k = 1; k < staggers.length; k++) expect(staggers[k].serverTime - staggers[k - 1].serverTime).toBeGreaterThanOrEqual(STAGGER_GUARD - 1e-6);
  });
});
const HITSTOP_ALLOWANCE = .2;

describe('what the outcomes never touch', () => {
  it('never throws an anchored body (a giant), whatever the move', () => {
    const sim = new ArenaSimulation({ trainingBot: false, seed: 9 });
    sim.addPlayer('a', 'luffy', 'A', false, { x: 0, y: 0, z: 0 });
    sim.addPlayer('b', 'goku', 'B', false, { x: 0, y: 0, z: 1.6 });
    sim.actors.get('b')!.anchored = true;
    sim.submitInput('a', { seq: 1, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', attack: 'heavy' });
    let top = 0;
    for (let i = 0; i < 90; i++) { sim.step(); top = Math.max(top, sim.getPlayer('b')!.y); }
    expect(top).toBe(0);
  });
  it('leaves a guard break to dizzy them, and the breaker to let them go', () => {
    expect(LAUNCHING.has('stagger')).toBe(false);
    const fight = bout('guts', 2.2);
    fight.victim.chainHits = 5; fight.victim.lastDamageAt = fight.sim.serverTime;
    fight.input({ attack: 'heavy' });
    fight.step(1);
    expect(fight.events.filter(e => e.kind === 'break'), 'the breaker').toHaveLength(1);
    expect(fight.events.filter(e => e.kind === 'ground-bounce'), 'outranks the spike').toEqual([]);
  });
});

describe('a string that ends in a throw is still one combo', () => {
  it.each(ROSTER)('%s: every stage lands, and what the finisher says happens', fighter => {
    const fight = bout(fighter);
    fight.step(3, i => { if (i % 4 === 0 && !fight.mine('hit').some(e => e.chain === RUSH_STAGES - 1)) fight.input({ attack: 'light' }); });
    const finisher = fight.mine('hit').find(e => e.chain === RUSH_STAGES - 1);
    expect(finisher, `${fighter}: the finisher lands`).toBeDefined();
    if (finisher!.outcome !== undefined) expect(['launch', 'hop', 'groundBounce', 'wallBounce', 'stagger', 'spin']).toContain(finisher!.outcome);
    else expect(finisher!.reaction).toBe('launched');
  });
});
