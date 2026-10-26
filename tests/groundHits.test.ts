import { describe, expect, it } from 'vitest';
import { FIGHTERS } from '../src/config';
import { comboMove } from '../src/game/combos';
import { damageScale, GETUP_SECONDS, GROUND_HIT_BUDGET, GROUND_HIT_HOLD, GROUND_HIT_MOST, GROUND_HIT_SCALE, GROUND_HIT_SCALES, GROUND_HIT_SHOVE, groundHitDamage, MOVES, OUTCOME_DOWN, WALL_SPLAT_SPEED } from '../src/game/moves';
import { ArenaSimulation } from '../src/game/simulation';
import { MOVEMENT_PROTOCOL } from '../src/server/health';
import type { AttackSlot, CombatEvent, FighterId, PlayerInput } from '../src/game/types';

const ROSTER = Object.keys(FIGHTERS) as FighterId[];
const DT = 1 / 60;

function bout(fighter: FighterId, victim: FighterId = 'goku', gap = 1.5, roomMode: 'training' | 'match' = 'training') {
  const sim = new ArenaSimulation({ roomMode, trainingBot: false, seed: 5 });
  sim.addPlayer('a', fighter, 'A', false, { x: 0, y: 0, z: 0 });
  sim.addPlayer('b', victim, 'B', false, { x: 0, y: 0, z: gap });
  if (roomMode === 'match') { sim.startMatch(); sim.place('a', { x: 0, y: 0, z: 0 }, 0); sim.place('b', { x: 0, y: 0, z: gap }, Math.PI); }
  let seq = 0, seqB = 0;
  const input = (more: Partial<PlayerInput> = {}) => sim.submitInput('a', { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', lock: true, ...more });
  const still = () => sim.submitInput('b', { seq: seqB++, moveX: 0, moveZ: 0, yaw: Math.PI, targetId: 'a' });
  const events: CombatEvent[] = [];
  const step = (seconds: number, each?: () => void) => {
    for (let i = 0; i < Math.round(seconds / DT); i++) { each?.(); still(); sim.step(DT); events.push(...sim.drainEvents()); }
  };
  input(); step(.1);
  return { sim, a: sim.actors.get('a')!, b: sim.actors.get('b')!, input, step, events };
}

function knockDown(fight: ReturnType<typeof bout>, left = 1) {
  const { sim, b } = fight;
  b.reaction = 'knockdown'; b.stunUntil = sim.serverTime + left; b.floorUntil = b.stunUntil + GROUND_HIT_MOST; b.floorHits = b.floorTaken = 0;
  b.state.action = 'knockdown'; b.state.actionStarted = sim.serverTime; b.state.actionDuration = left;
  b.vy = b.kx = b.kz = 0; b.lastDamageAt = -10; b.chainHits = b.scalingHits = 0;
}

function knockDownByString(fight: ReturnType<typeof bout>) {
  for (let i = 0; i < 3; i++) { fight.input({ attack: 'light' }); fight.step(.24); }
  fight.input({ attack: 'heavy' });
  let guard = 0;
  while (fight.b.reaction !== 'knockdown' && guard++ < 180) fight.step(DT);
  return fight.b.reaction === 'knockdown';
}

describe('ground hits: a fighter down on the floor is hit', () => {
  it('takes a normal - the stay\'s first - at GROUND_HIT_SCALE of what it deals standing (its budget at most), and stays down where it lies', () => {
    expect(GROUND_HIT_SCALE).toBeGreaterThan(0); expect(GROUND_HIT_SCALE).toBeLessThan(1);
    for (const fighter of ['zoro', 'luffy', 'naruto', 'gojo', 'saitama', 'kaido'] as FighterId[]) {
      const moves: [string, AttackSlot, ReturnType<typeof comboMove>][] = [
        ['light', 'light', MOVES[fighter].light], ['heavy', 'heavy', MOVES[fighter].heavy], ['special', 'special', MOVES[fighter].special],
        ['knockdown ender', 'heavy', comboMove(fighter, 'lllh')], ['launcher', 'heavy', comboMove(fighter, 'llh')],
        ['air strike', 'heavy', comboMove(fighter, 'airHeavy')], ['stun', 'special', comboMove(fighter, 'llls')]];
      for (const [label, slot, move] of moves) {
        const standing = bout(fighter), floored = bout(fighter);
        knockDown(floored);
        standing.sim.strike('a', 'b', slot, move!); floored.sim.strike('a', 'b', slot, move!);
        const stood = standing.sim.drainEvents().find(e => e.kind === 'hit')!, lay = floored.sim.drainEvents().find(e => e.kind === 'hit')!;
        expect(stood.downed, `${fighter} ${label} standing`).toBeUndefined();
        expect(lay?.downed, `${fighter} ${label}: a ground hit`).toBe(true);
        const base = move!.finisherDamage ?? move!.damage;
        expect(stood.damage, `${fighter} ${label} standing`).toBe(Math.max(1, Math.round(base)));
        expect(lay.damage, `${fighter} ${label} on the floor`).toBe(Math.min(Math.round(GROUND_HIT_BUDGET * 1000), Math.max(1, Math.round(base * GROUND_HIT_SCALE))));
        expect(lay.damage).toBe(groundHitDamage(base, 0, 0, 1000));
        expect(floored.b.state.hp).toBe(1000 - lay.damage!);
        expect(lay.reaction, `${fighter} ${label}`).toBe('flinch');
        expect(lay.outcome, `${fighter} ${label}`).toBeUndefined();
        expect(floored.b.reaction, `${fighter} ${label}`).toBe('knockdown');
        expect(floored.b.state.action).toBe('knockdown');
        expect(floored.b.vy, `${fighter} ${label}: never lifted`).toBeLessThanOrEqual(0);
        expect(Math.hypot(floored.b.kx, floored.b.kz), `${fighter} ${label}: a shove along the floor at most`).toBeLessThanOrEqual(GROUND_HIT_SHOVE + 1e-9);
        floored.step(.5);
        expect(floored.b.state.y, `${fighter} ${label}: still on the floor`).toBeLessThan(.05);
        expect(floored.events.some(e => e.kind === 'ground-bounce' || e.kind === 'wall-splat'), `${fighter} ${label}`).toBe(false);
      }
    }
  });

  it('lands the light pressed into a knockdown, where it used to be a dodge, for less, and the string goes on from there', () => {
    const fight = bout('zoro');
    expect(knockDownByString(fight)).toBe(true);
    const at = fight.sim.serverTime;
    fight.step(.05);
    fight.input({ attack: 'light' }); fight.step(.4);
    const after = fight.events.filter(e => e.actorId === 'a' && e.serverTime > at);
    expect(after.some(e => e.kind === 'dodge'), 'no dodge on the floor').toBe(false);
    const ground = after.find(e => e.kind === 'hit')!;
    expect(ground.downed).toBe(true);
    expect(ground.slot).toBe('light');
    expect(ground.damage).toBeGreaterThan(0);
  });

  it('never trips the combo breaker on a body down - getting up is its escape - though the cast is charged', () => {
    const fight = bout('zoro');
    knockDown(fight);
    fight.b.chainHits = 5; fight.b.lastDamageAt = fight.sim.serverTime;
    fight.sim.strike('a', 'b', 'light', MOVES.zoro.light);
    const events = fight.sim.drainEvents();
    expect(events.some(e => e.kind === 'break')).toBe(false);
    expect(events.find(e => e.kind === 'hit')?.downed).toBe(true);
    expect(fight.b.chainHits).toBe(6);
    expect(fight.b.evadeUntil).toBeLessThanOrEqual(fight.sim.serverTime);
  });

  it('counts a wall splat come down onto the floor as down, and one still against the wall as not', () => {
    const fight = bout('zoro');
    const { sim, b } = fight;
    b.reaction = 'splat'; b.stunUntil = sim.serverTime + .8; b.floorUntil = b.stunUntil + GROUND_HIT_MOST; b.state.action = 'splat';
    b.state.grounded = true; b.lastDamageAt = -10;
    sim.strike('a', 'b', 'heavy', MOVES.zoro.heavy);
    expect(sim.drainEvents().find(e => e.kind === 'hit')?.downed).toBe(true);
    expect(b.reaction).toBe('splat');
    const high = bout('zoro');
    high.b.reaction = 'splat'; high.b.stunUntil = high.sim.serverTime + .8; high.b.state.action = 'splat';
    high.b.state.grounded = false; high.b.state.y = 1.2; high.b.lastDamageAt = -10;
    high.sim.strike('a', 'b', 'heavy', MOVES.zoro.heavy);
    expect(high.sim.drainEvents().find(e => e.kind === 'hit')?.downed, 'against the wall it is the comboable splat it was').toBeUndefined();
  });
});

describe('ground hits 2: one stay on the floor is a ledger', () => {
  it('the rule, as one shared helper: each hit of a stay worth less, the stay a budget of its body\'s health in all', () => {
    expect(GROUND_HIT_SCALES[0]).toBe(GROUND_HIT_SCALE);
    for (let i = 1; i < GROUND_HIT_SCALES.length; i++) expect(GROUND_HIT_SCALES[i], `hit ${i + 1}`).toBeLessThan(GROUND_HIT_SCALES[i - 1]);
    expect(GROUND_HIT_BUDGET).toBeGreaterThanOrEqual(.05); expect(GROUND_HIT_BUDGET).toBeLessThanOrEqual(.06);
    const budget = Math.round(GROUND_HIT_BUDGET * 1000);
    expect([0, 1, 2, 3, 4, 7].map(n => groundHitDamage(20, n, 0, 1000))).toEqual([10, 7, 4, 2, 2, 2]);
    expect(groundHitDamage(200, 0, 0, 1000)).toBe(budget);
    expect(groundHitDamage(40, 1, budget - 3, 1000)).toBe(3);
    expect(groundHitDamage(40, 2, budget, 1000)).toBe(0);
    expect(groundHitDamage(40, 9, budget + 7, 1000)).toBe(0);
    expect(groundHitDamage(.4, 3, 0, 1000)).toBe(1);
    expect(groundHitDamage(400, 0, 0, 4000)).toBe(Math.min(200, Math.round(4000 * GROUND_HIT_BUDGET)));
  });

  it('takes the same blow for less each time, down to GROUND_HIT_SCALES\' last, and never past the budget, however many land', () => {
    for (const [fighter, slot] of [['zoro', 'light'], ['kaido', 'heavy'], ['naruto', 'light']] as const) {
      const fight = bout(fighter);
      knockDown(fight, 1.2);
      const move = MOVES[fighter][slot], base = move.finisherDamage ?? move.damage;
      const taken: number[] = [];
      for (let i = 0; i < 12; i++) {
        fight.b.state.hp = 1000;
        fight.sim.strike('a', 'b', slot, move);
        const hit = fight.sim.drainEvents().find(e => e.kind === 'hit')!;
        expect(hit?.downed, `${fighter} hit ${i + 1}: a ground hit`).toBe(true);
        expect(hit.damage, `${fighter} hit ${i + 1}`).toBe(groundHitDamage(base * damageScale(i + 1), i, taken.reduce((n, d) => n + d, 0), 1000));
        taken.push(hit.damage!);
      }
      const total = taken.reduce((n, d) => n + d, 0);
      expect(total, `${fighter}: ${taken.join(' ')}`).toBeLessThanOrEqual(Math.round(GROUND_HIT_BUDGET * 1000));
      for (let i = 1; i < 4; i++) if (taken[i] > 0) expect(taken[i], `${fighter}: hit ${i + 1} is worth less than hit ${i}`).toBeLessThanOrEqual(taken[i - 1]);
      const budget = Math.round(GROUND_HIT_BUDGET * 1000), tail = GROUND_HIT_SCALES[GROUND_HIT_SCALES.length - 1];
      for (let i = GROUND_HIT_SCALES.length; i < 12; i++) expect(taken[i], `${fighter} hit ${i + 1}`).toBeLessThanOrEqual(Math.max(1, Math.round(base * tail)));
      if (total === budget) expect(taken[11], `${fighter}: spent, the twelfth lands for nothing`).toBe(0);
      expect(fight.b.floorHits).toBe(12);
      expect(fight.b.floorTaken).toBe(total);
    }
  });

  it('three attackers landing every normal every tick of a stay take no more than the budget off it', () => {
    const fight = bout('zoro');
    expect(knockDownByString(fight)).toBe(true);
    const { sim, b } = fight;
    sim.addPlayer('c', 'goku', 'C', false, { x: b.state.x + 1.2, y: 0, z: b.state.z });
    sim.addPlayer('d', 'kaido', 'D', false, { x: b.state.x - 1.2, y: 0, z: b.state.z });
    const blows: [AttackSlot, ReturnType<typeof comboMove>][] = [['light', MOVES.goku.light], ['heavy', MOVES.kaido.heavy], ['special', MOVES.naruto.special],
      ['heavy', comboMove('kaido', 'lllh')], ['heavy', comboMove('goku', 'llh')], ['special', MOVES.kaido.special]];
    const hp = b.state.hp;
    let k = 0, hits = 0;
    while (b.reaction === 'knockdown') {
      for (const id of ['a', 'c', 'd']) { const [slot, move] = blows[k++ % blows.length]; sim.strike(id, 'b', slot, move!); }
      hits += sim.drainEvents().filter(e => e.kind === 'hit' && e.downed).length;
      fight.step(DT);
    }
    expect(hits).toBeGreaterThan(30);
    expect(hp - b.state.hp).toBe(Math.round(GROUND_HIT_BUDGET * 1000));
  });

  it('opens a new ledger with every knockdown, and a wall splat come down onto the floor with its own', () => {
    const fight = bout('zoro');
    knockDown(fight);
    for (let i = 0; i < 8; i++) fight.sim.strike('a', 'b', 'heavy', MOVES.zoro.heavy);
    expect(fight.b.floorTaken).toBe(Math.round(GROUND_HIT_BUDGET * 1000));
    while (fight.b.reaction) fight.step(DT);
    fight.step(.3);
    expect(knockDownByString(fight)).toBe(true);
    expect(fight.b.floorHits).toBe(0); expect(fight.b.floorTaken).toBe(0);
    fight.b.lastDamageAt = -10; fight.b.scalingHits = 0;
    fight.sim.strike('a', 'b', 'heavy', MOVES.zoro.heavy);
    expect(fight.sim.drainEvents().find(e => e.kind === 'hit')?.damage).toBe(groundHitDamage(MOVES.zoro.heavy.damage, 0, 0, 1000));
    const wall = bout('zoro');
    const { sim, b } = wall;
    b.reaction = 'splat'; b.stunUntil = sim.serverTime + .8; b.floorUntil = b.stunUntil + GROUND_HIT_MOST; b.floorHits = b.floorTaken = 0;
    b.state.action = 'splat'; b.state.grounded = true; b.lastDamageAt = -10;
    sim.strike('a', 'b', 'light', MOVES.zoro.light);
    expect(b.floorHits).toBe(1);
    expect(b.floorTaken).toBe(groundHitDamage(MOVES.zoro.light.damage, 0, 0, 1000));
  });

  it('keeps an ultimate whole, and out of the budget: a stay that has spent it still takes an ultimate in full', () => {
    const totals: number[] = [];
    for (const spent of [false, true]) {
      const fight = bout('kaido', 'goku', 1.6);
      knockDown(fight, 1.2);
      if (spent) { fight.b.floorHits = 6; fight.b.floorTaken = Math.round(GROUND_HIT_BUDGET * 1000); }
      fight.a.state.ultimate = 100;
      fight.input({ attack: 'ultimate' });
      fight.step(MOVES.kaido.ultimate.duration + .6);
      const hits = fight.events.filter(e => e.kind === 'hit' && e.actorId === 'a' && e.slot === 'ultimate');
      expect(hits.some(e => e.downed)).toBe(false);
      totals.push(hits.reduce((n, e) => n + (e.damage ?? 0), 0));
    }
    expect(totals[0]).toBeGreaterThan(200);
    expect(totals[1]).toBe(totals[0]);
  });

  it('still draws a hit the budget left nothing for as a hit: the flinch on the floor, no number', () => {
    const fight = bout('zoro');
    knockDown(fight);
    fight.b.floorHits = 5; fight.b.floorTaken = Math.round(GROUND_HIT_BUDGET * 1000);
    fight.sim.strike('a', 'b', 'light', MOVES.zoro.light);
    const hit = fight.sim.drainEvents().find(e => e.kind === 'hit')!;
    expect(hit.downed).toBe(true);
    expect(hit.damage).toBe(0);
    expect(hit.reaction).toBe('flinch');
    expect(fight.b.state.hp).toBe(1000);
  });
});

describe('ground hits 2: Gojo\'s knockdown into his Domain', () => {
  it('Light x3, Heavy - the Flying Kick - leaves the body down inside the Domain\'s reach, and R then confirms on it', () => {
    const radius = MOVES.gojo.ultimate.timeStop!.radius;
    for (const victim of ['goku', 'kaido', 'naruto'] as FighterId[]) for (const delay of [.05, .4, .8]) {
      const fight = bout('gojo', victim, 1.6);
      expect(knockDownByString(fight), `${victim}`).toBe(true);
      fight.step(delay);
      const gap = Math.hypot(fight.b.state.x - fight.a.state.x, fight.b.state.z - fight.a.state.z);
      expect(gap, `${victim} +${delay}s: down ${gap.toFixed(2)} m off`).toBeLessThan(radius - .4);
      fight.a.state.ultimate = 100;
      const pressedAt = fight.sim.serverTime;
      fight.input({ attack: 'ultimate' });
      fight.step(MOVES.gojo.ultimate.duration + .4);
      const mine = fight.events.filter(e => e.actorId === 'a' && e.slot === 'ultimate' && e.serverTime >= pressedAt);
      expect(mine.some(e => e.kind === 'confirm' && e.targetId === 'b'), `${victim}, R +${delay}s: the Domain confirms`).toBe(true);
      expect(mine.some(e => e.kind === 'whiff')).toBe(false);
    }
  });
  it('keeps the Flying Kick a splat, thrown back flat, and the Domain as it was', () => {
    const kick = comboMove('gojo', 'lllh')!;
    expect(kick.knock).toBe('splat');
    expect(kick.outcome).toBe('knockdown');
    expect(kick.knockback).toBe(5);
    expect(kick.damage).toBe(61);
    expect(MOVES.gojo.ultimate.timeStop).toEqual({ contact: 0, duration: 1.63, radius: 3.5 });
  });
});

describe('ground hits: an ultimate catches a fighter down on the floor whole', () => {
  it('deals every fighter\'s ultimate in full - what it deals the same fighter standing - and confirms a hit-confirm one', () => {
    expect(ROSTER.length).toBeGreaterThanOrEqual(36);
    for (const fighter of ROSTER) {
      const totals: number[] = [];
      for (const down of [false, true]) {
        const fight = bout(fighter, fighter === 'goku' ? 'vegeta' : 'goku', 1.6);
        if (down) knockDown(fight, 1.2);
        fight.a.state.ultimate = 100;
        fight.input({ attack: 'ultimate' });
        fight.step(MOVES[fighter].ultimate.duration + .6);
        const mine = fight.events.filter(e => e.actorId === 'a' && e.slot === 'ultimate');
        expect(mine.some(e => e.kind === 'dodge'), `${fighter}${down ? ' on the floor' : ''}: nothing of it dodged`).toBe(false);
        expect(mine.some(e => e.kind === 'whiff'), `${fighter}${down ? ' on the floor' : ''}: no whiff`).toBe(false);
        if (MOVES[fighter].ultimate.confirm) expect(mine.some(e => e.kind === 'confirm' && e.targetId === 'b'), `${fighter}${down ? ' on the floor' : ''}: confirmed`).toBe(true);
        const hits = mine.filter(e => e.kind === 'hit' && e.targetId === 'b');
        expect(hits.some(e => e.downed), `${fighter}: an ultimate is never a ground hit`).toBe(false);
        const last = MOVES[fighter].ultimate.contacts.length - 1;
        if (MOVES[fighter].ultimate.confirm) expect(hits.some(e => e.contactIndex === last), `${fighter}${down ? ' on the floor' : ''}: its finisher landed`).toBe(true);
        totals.push(hits.reduce((n, e) => n + (e.damage ?? 0), 0));
      }
      expect(totals[0], `${fighter}: landed at all`).toBeGreaterThan(100);
      expect(totals[1], `${fighter}: on the floor it deals what it deals standing`).toBe(totals[0]);
    }
  });

  it('confirms every fighter\'s hit-confirm ultimate on a body its own knockdown ender has just put down, and plays the whole cinematic', () => {
    for (const fighter of ROSTER) {
      const fight = bout(fighter);
      expect(knockDownByString(fight), `${fighter}: the knockdown ender puts them down`).toBe(true);
      const { b } = fight;
      fight.sim.place('a', { x: b.state.x, y: 0, z: b.state.z - 1.6 }, 0);
      fight.a.cast = null; fight.a.state.ultimate = 100; fight.a.state.cooldowns.ultimate = 0;
      const pressedAt = fight.sim.serverTime;
      fight.input({ attack: 'ultimate' });
      fight.step(MOVES[fighter].ultimate.duration + .6);
      const mine = fight.events.filter(e => e.actorId === 'a' && e.slot === 'ultimate' && e.serverTime >= pressedAt);
      expect(mine.some(e => e.kind === 'dodge'), `${fighter}: nothing of it dodged`).toBe(false);
      if (!MOVES[fighter].ultimate.confirm) { expect(mine.some(e => e.kind === 'hit' && e.targetId === 'b'), `${fighter}: the blast lands`).toBe(true); continue; }
      const confirm = mine.find(e => e.kind === 'confirm');
      expect(confirm?.targetId, `${fighter}: confirmed on the body on the floor`).toBe('b');
      const contacts = MOVES[fighter].ultimate.contacts.length;
      const landed = new Set(mine.filter(e => e.kind === 'hit' && e.targetId === 'b').map(e => e.contactIndex ?? 0));
      const from = MOVES[fighter].ultimate.timeStop ? 1 : 0;
      for (let i = from; i < contacts; i++) if (!MOVES[fighter].ultimate.timeStop || i === contacts - 1) expect(landed.has(i), `${fighter}: contact ${i} landed`).toBe(true);
    }
  });

  it('takes the body up off the floor into the hold, as it does one standing', () => {
    const fight = bout('kaido');
    knockDown(fight, 1.2);
    fight.a.state.ultimate = 100;
    fight.input({ attack: 'ultimate' });
    let guard = 0;
    while (!fight.events.some(e => e.kind === 'confirm') && guard++ < 120) fight.step(DT);
    expect(fight.b.reaction, 'no longer down').not.toBe('knockdown');
    expect(fight.b.state.action).not.toBe('knockdown');
    expect(fight.b.state.heldBy).toBe('a');
  });
});

describe('ground hits never loop', () => {
  it('a scripted attacker throwing every normal at a body down cannot keep it there past GROUND_HIT_MOST beyond its own floor time', () => {
    for (const fighter of ['zoro', 'luffy', 'killua', 'kaido'] as FighterId[]) {
      const fight = bout(fighter);
      expect(knockDownByString(fight), fighter).toBe(true);
      const { sim, b } = fight, downAt = sim.serverTime, own = b.stunUntil - downAt;
      sim.addPlayer('c', 'goku', 'C', false, { x: b.state.x + 1.2, y: 0, z: b.state.z });
      sim.addPlayer('d', 'naruto', 'D', false, { x: b.state.x - 1.2, y: 0, z: b.state.z });
      const blows: [AttackSlot, ReturnType<typeof comboMove>][] = [['light', MOVES.goku.light], ['heavy', MOVES.goku.heavy], ['special', MOVES.naruto.special],
        ['heavy', comboMove('goku', 'llh')], ['heavy', comboMove('naruto', 'lllh')]];
      let down = 0, k = 0, freeAt = -1, grounds = 0;
      for (let tick = 0; tick < 240 && freeAt < 0; tick++) {
        b.state.hp = b.state.maxHp;
        if (b.reaction === 'knockdown') { down += DT; for (const id of ['a', 'c', 'd']) { const [slot, move] = blows[k++ % blows.length]; sim.strike(id, 'b', slot, move!); } }
        grounds += sim.drainEvents().filter(e => e.kind === 'hit' && e.downed).length;
        fight.step(DT);
        if (!b.reaction && sim.serverTime >= b.stunUntil) freeAt = sim.serverTime;
      }
      expect(grounds, `${fighter}: they all landed`).toBeGreaterThan(30);
      expect(down, `${fighter}: on the floor ${down.toFixed(2)} s against its own ${own.toFixed(2)}`).toBeLessThanOrEqual(own + GROUND_HIT_MOST + DT * 2);
      expect(freeAt, `${fighter}: up and free`).toBeGreaterThan(0);
      expect(freeAt - downAt, fighter).toBeLessThanOrEqual(own + GROUND_HIT_MOST + GETUP_SECONDS + DT * 3);
      expect(b.state.alive).toBe(true);
    }
  });

  it('holds a body down GROUND_HIT_HOLD past a late blow, and no more', () => {
    const fight = bout('zoro');
    knockDown(fight, .05);
    const at = fight.sim.serverTime;
    fight.sim.strike('a', 'b', 'light', MOVES.zoro.light);
    expect(fight.b.stunUntil).toBeCloseTo(at + GROUND_HIT_HOLD, 6);
    knockDown(fight, .8);
    fight.sim.strike('a', 'b', 'light', MOVES.zoro.light);
    expect(fight.b.stunUntil, 'nothing taken off a long one').toBeCloseTo(fight.sim.serverTime + .8, 6);
  });

  it('shoves a body along the floor slower than a wall splats it', () => {
    expect(GROUND_HIT_SHOVE).toBeLessThan(WALL_SPLAT_SPEED);
  });
});

describe('getting up', () => {
  it('dodges a fighter\'s every normal, and lets an ultimate through', () => {
    for (const [slot, move] of [['light', MOVES.zoro.light], ['heavy', MOVES.zoro.heavy], ['special', MOVES.zoro.special], ['heavy', comboMove('zoro', 'lllh')]] as const) {
      const fight = bout('zoro');
      fight.b.reaction = 'getup'; fight.b.stunUntil = fight.sim.serverTime + GETUP_SECONDS; fight.b.state.action = 'getup';
      fight.sim.strike('a', 'b', slot, move!);
      const events = fight.sim.drainEvents();
      expect(events.some(e => e.kind === 'dodge'), `${slot}`).toBe(true);
      expect(events.some(e => e.kind === 'hit'), `${slot}`).toBe(false);
      expect(fight.b.state.hp).toBe(1000);
    }
    const fight = bout('zoro');
    fight.b.reaction = 'getup'; fight.b.stunUntil = fight.sim.serverTime + GETUP_SECONDS; fight.b.state.action = 'getup';
    fight.sim.strike('a', 'b', 'ultimate', MOVES.zoro.ultimate);
    expect(fight.sim.drainEvents().some(e => e.kind === 'hit'), 'an ultimate connects').toBe(true);
  });

  it('lets a hit-confirm ultimate whose opener comes due on the rise confirm there', () => {
    for (const fighter of ['luffy', 'zoro', 'kakashi', 'saitama'] as FighterId[]) {
      const fight = bout(fighter);
      expect(knockDownByString(fight), fighter).toBe(true);
      const { sim, b, a } = fight, opener = MOVES[fighter].ultimate.contacts[0];
      while (b.reaction === 'knockdown' && b.stunUntil - sim.serverTime > opener - .2) fight.step(DT);
      sim.place('a', { x: b.state.x, y: 0, z: b.state.z - 1.8 }, 0);
      a.cast = null; a.state.ultimate = 100; a.state.cooldowns.ultimate = 0;
      fight.input({ attack: 'ultimate' });
      let at: string | null | undefined;
      for (let i = 0; i < 90 && at === undefined; i++) {
        const was = b.reaction;
        fight.step(DT);
        if (fight.events.some(e => e.kind === 'hit' && e.actorId === 'a' && e.slot === 'ultimate')) at = was;
      }
      expect(at, `${fighter}: the opener landed on a body getting up`).toBe('getup');
      fight.step(.3);
      expect(fight.events.some(e => e.kind === 'confirm' && e.actorId === 'a' && e.targetId === 'b'), fighter).toBe(true);
    }
  });

  it('is still the end of the floor: once it is over the body is free, and a guard held through it is up on the first tick', () => {
    const fight = bout('zoro');
    expect(knockDownByString(fight)).toBe(true);
    const { b } = fight;
    let rose = false;
    for (let i = 0; i < 180 && !(rose && !b.reaction); i++) {
      fight.sim.submitInput('b', { seq: 1000 + i, moveX: 0, moveZ: 0, yaw: Math.PI, guard: true });
      fight.sim.step(DT);
      rose ||= b.reaction === 'getup';
    }
    expect(rose).toBe(true);
    expect(b.reaction).toBeNull();
    expect(b.state.guarding, 'its guard is up the tick it is free').toBe(true);
  });
});

describe('the old rule, where the new one does not reach', () => {
  it('a horde\'s or a kit body\'s blow on a fighter down or getting up is still a dodge', () => {
    const fight = bout('zoro');
    knockDown(fight);
    fight.sim.strike('a', 'b', 'light', MOVES.zoro.light, undefined, true, true);
    expect(fight.sim.drainEvents().some(e => e.kind === 'dodge'), 'a crowd\'s blow').toBe(true);
    const boss = new ArenaSimulation({ trainingBot: false, seed: 3 });
    boss.addPlayer('hero', 'zoro', 'Hero', false, { x: 0, y: 0, z: 0 });
    boss.addCombatant('ogre', { team: 'horde', kit: MOVES.kaido, maxHp: 4000, spawn: { x: 0, y: 0, z: 1.5 } });
    const hero = boss.actors.get('hero')!, ogre = boss.actors.get('ogre')!;
    for (const [who, by] of [[hero, 'ogre'], [ogre, 'hero']] as const) {
      who.reaction = 'knockdown'; who.stunUntil = boss.serverTime + 1; who.state.action = 'knockdown';
      boss.strike(by, who.state.id, 'ultimate', by === 'ogre' ? MOVES.kaido.ultimate : MOVES.zoro.ultimate);
      expect(boss.drainEvents().some(e => e.kind === 'dodge'), `${who.state.id} down`).toBe(true);
      who.reaction = 'getup'; who.stunUntil = boss.serverTime + GETUP_SECONDS;
      boss.strike(by, who.state.id, 'light', by === 'ogre' ? MOVES.kaido.light : MOVES.zoro.light);
      expect(boss.drainEvents().some(e => e.kind === 'dodge'), `${who.state.id} getting up`).toBe(true);
    }
  });
});

describe('the bots', () => {
  it('throw a full ultimate at a body their own knockdown left on the floor', () => {
    let thrown = 0, confirmed = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const sim = new ArenaSimulation({ roomMode: 'match', trainingBot: false, seed });
      sim.addPlayer('bot', 'zoro', 'Bot', true, { x: 0, y: 0, z: 0 });
      sim.addPlayer('p', 'goku', 'P', false, { x: 0, y: 0, z: 1.8 });
      sim.startMatch(); sim.place('bot', { x: 0, y: 0, z: 0 }, 0); sim.place('p', { x: 0, y: 0, z: 1.8 }, Math.PI);
      const bot = sim.actors.get('bot')!, p = sim.actors.get('p')!;
      bot.state.ultimate = 100;
      p.reaction = 'knockdown'; p.stunUntil = sim.serverTime + .8; p.floorUntil = p.stunUntil + GROUND_HIT_MOST; p.state.action = 'knockdown';
      for (let i = 0; i < 60; i++) { sim.submitInput('p', { seq: i, moveX: 0, moveZ: 0, yaw: Math.PI }); sim.step(DT); }
      const events = sim.drainEvents();
      if (events.some(e => e.kind === 'cast' && e.actorId === 'bot' && e.slot === 'ultimate')) thrown++;
      if (events.some(e => e.kind === 'confirm' && e.actorId === 'bot')) confirmed++;
    }
    expect(thrown, 'most of the time, inside a second').toBeGreaterThanOrEqual(7);
    expect(confirmed).toBe(thrown);
  });

  it('do not swing at a body whose stay on the floor has nothing left to give', () => {
    let swung = 0, ults = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const sim = new ArenaSimulation({ roomMode: 'match', trainingBot: false, seed });
      sim.addPlayer('bot', 'zoro', 'Bot', true, { x: 0, y: 0, z: 0 });
      sim.addPlayer('p', 'goku', 'P', false, { x: 0, y: 0, z: 1.6 });
      sim.startMatch(); sim.place('bot', { x: 0, y: 0, z: 0 }, 0); sim.place('p', { x: 0, y: 0, z: 1.6 }, Math.PI);
      const p = sim.actors.get('p')!;
      p.reaction = 'knockdown'; p.stunUntil = sim.serverTime + .8; p.floorUntil = p.stunUntil + GROUND_HIT_MOST; p.state.action = 'knockdown';
      p.floorHits = 4; p.floorTaken = Math.round(GROUND_HIT_BUDGET * 1000);
      for (let i = 0; i < 40; i++) { sim.submitInput('p', { seq: i, moveX: 0, moveZ: 0, yaw: Math.PI }); sim.step(DT); }
      const casts = sim.drainEvents().filter(e => e.kind === 'cast' && e.actorId === 'bot');
      if (casts.some(e => e.slot !== 'ultimate')) swung++;
      if (casts.some(e => e.slot === 'ultimate')) ults++;
    }
    expect(swung).toBe(0);
    expect(ults).toBe(0);
  });

  it('do not swing a normal into a body getting up: it would be dodged', () => {
    let swung = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const sim = new ArenaSimulation({ roomMode: 'match', trainingBot: false, seed });
      sim.addPlayer('bot', 'zoro', 'Bot', true, { x: 0, y: 0, z: 0 });
      sim.addPlayer('p', 'goku', 'P', false, { x: 0, y: 0, z: 1.6 });
      sim.startMatch(); sim.place('bot', { x: 0, y: 0, z: 0 }, 0); sim.place('p', { x: 0, y: 0, z: 1.6 }, Math.PI);
      const p = sim.actors.get('p')!;
      p.reaction = 'getup'; p.stunUntil = sim.serverTime + GETUP_SECONDS; p.state.action = 'getup';
      for (let i = 0; i < 20; i++) { sim.submitInput('p', { seq: i, moveX: 0, moveZ: 0, yaw: Math.PI }); sim.step(DT); }
      if (sim.drainEvents().some(e => e.kind === 'cast' && e.actorId === 'bot')) swung++;
    }
    expect(swung).toBe(0);
  });
});

describe('the wire', () => {
  it('carries the floor\'s limit with the reaction keys, so the client\'s copy lands its blows as the server does', () => {
    const fight = bout('zoro');
    knockDown(fight);
    const reaction = fight.sim.snapshot().reactions!.b;
    expect(reaction.floorUntil).toBeCloseTo(fight.b.floorUntil, 9);
    expect(reaction.reaction).toBe('knockdown');
    fight.sim.strike('a', 'b', 'light', MOVES.zoro.light);
    const after = fight.sim.snapshot().reactions!.b;
    expect(after.floorHits).toBe(1);
    expect(after.floorTaken).toBe(fight.b.floorTaken);
    expect(after.floorTaken).toBeGreaterThan(0);
  });
  it('is a new movement protocol', () => {
    expect(Number(/-v(\d+)-/.exec(MOVEMENT_PROTOCOL)?.[1])).toBeGreaterThanOrEqual(24);
  });
  it('keeps a knockdown ender\'s own floor time', () => {
    const fight = bout('kaido');
    expect(knockDownByString(fight)).toBe(true);
    const downAt = fight.sim.serverTime;
    while (fight.b.reaction === 'knockdown') fight.step(DT);
    expect(fight.sim.serverTime - downAt).toBeCloseTo(OUTCOME_DOWN.knockdown, 1);
  });
});
