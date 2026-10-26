import { describe, expect, it } from 'vitest';
import { Packr, unpack } from 'msgpackr';
import { ArenaSimulation } from '../src/game/simulation';
import { Prediction } from '../src/game/prediction';
import { MOVES } from '../src/game/moves';
import type { AttackSlot, FighterId, GameSnapshot, PlayerInput } from '../src/game/types';

const wire = <T>(value: T): T => unpack(new Packr({ useRecords: false }).pack(value)) as T;
const HP = 1000;

type Where = [number, number, number];
const CASES: [string, FighterId, AttackSlot, Where, Where, Where][] = [
  ['Hiken', 'ace', 'special', [1.11, -0.07, -1.11], [2.51, 2.34, 0.92], [7.29, -2.99, 6.65]],
  ['1080 Pound Phoenix', 'zoro', 'special', [1.11, -0.05, -1.1], [2.37, 2.15, 1.01], [7.46, -3.17, 6.75]],
  ['Cannon Arm', 'guts', 'special', [1.08, 0.59, -0.9], [2.75, 2.42, 1.31], [6.95, -3.8, 5.81]],
  ['Big Bang Attack', 'vegeta', 'heavy', [1.1, 0.62, -0.91], [2.75, 2.4, 1.34], [7.09, -3.99, 5.86]],
  ['Kagero', 'ace', 'heavy', [1.1, 0.55, -0.95], [2.92, 2.67, 1.18], [6.96, -3.52, 6.01]],
  ['Kamehameha', 'goku', 'special', [1.08, 0.52, -0.95], [2.82, 2.59, 1.11], [7.15, -3.31, 6.33]],
  ['Galick Gun', 'vegeta', 'special', [1.1, 0.6, -0.92], [2.38, 1.7, 1.67], [7.39, -4.22, 6.07]],
  ['Lion’s Song', 'zoro', 'heavy', [1.1, 0.61, -0.92], [2.72, 2.37, 1.33], [7.11, -3.95, 5.91]],
  ['Instant Transmission Strike', 'goku', 'heavy', [1.1, 0.59, -0.93], [3.44, 3.21, 1.24], [7, -3.75, 5.91]],
  ['Knife Throw', 'dio', 'heavy', [1.1, 0.63, -0.9], [2.66, 2.28, 1.38], [7.09, -4.05, 5.82]],
  ['Cleave', 'guts', 'heavy', [1.1, 0.77, -0.78], [2.71, 2.06, 1.76], [6.97, -4.91, 4.95]],
];
const at = (w: Where) => ({ x: -w[2], y: 0, z: w[1] });

function crowd(fighter: FighterId, bot: Where, A: Where, B: Where) {
  const sim = new ArenaSimulation({ trainingBot: false, seed: 7 });
  sim.addPlayer('me', fighter, 'Me', false, { x: 0, y: 0, z: 0 });
  sim.addPlayer('bot', 'naruto', 'Bot', false, at(bot));
  sim.addPlayer('A', 'vegeta', 'A', false, at(A));
  sim.addPlayer('B', 'zoro', 'B', false, at(B));
  const b = at(bot);
  sim.actors.get('me')!.state.yaw = Math.atan2(b.x, b.z);
  return sim;
}
function play(sim: ArenaSimulation, presses: Record<number, AttackSlot>, ticks: number, lock: boolean, targetId = 'A', off = .35, from = 0) {
  const target = sim.getPlayer(targetId)!, me = sim.getPlayer('me')!;
  const yaw = Math.atan2(target.x - me.x, target.z - me.z) + off;
  for (let seq = from; seq < from + ticks; seq++) {
    sim.submitInput('me', { seq, moveX: 0, moveZ: 0, yaw, targetId, lock, attack: presses[seq - from] });
    sim.step();
  }
}
const hp = (sim: ArenaSimulation, id: string) => sim.getPlayer(id)!.hp;

describe('hard-locked, every attack goes to the lock', () => {
  it.each(CASES)('%s (%s %s): the lock takes it and the fighter at the shoulder does not', (_name, fighter, slot, bot, A, B) => {
    const sim = crowd(fighter, bot, A, B);
    try {
      play(sim, {}, 20, true);
      play(sim, { 0: slot }, 60 * 4, true, 'A', .35, 20);
      expect(hp(sim, 'A'), 'the locked fighter is hit').toBeLessThan(HP);
      expect(hp(sim, 'bot'), 'the fighter 1.1 m off the side is not').toBe(HP);
      expect(hp(sim, 'B'), 'nor the one far behind').toBe(HP);
    } finally { sim.dispose(); }
  });

  it('the cast turns to the lock as it starts, wherever the view is', () => {
    for (const [, fighter, slot, bot, A, B] of CASES) for (const off of [-.6, 0, .6]) {
      const sim = crowd(fighter, bot, A, B);
      try {
        play(sim, {}, 10, true, 'A', off);
        play(sim, { 0: slot }, 1, true, 'A', off, 10);
        const me = sim.getPlayer('me')!, a = sim.getPlayer('A')!;
        const bearing = Math.atan2(a.x - me.x, a.z - me.z), turned = Math.atan2(Math.sin(me.yaw - bearing), Math.cos(me.yaw - bearing));
        expect(Math.abs(turned), `${fighter} ${slot}, view ${off}`).toBeLessThan(.2);
      } finally { sim.dispose(); }
    }
  });

  it('out of reach, a locked swing still turns to the lock and never snaps to somebody else', () => {
    const sim = new ArenaSimulation({ trainingBot: false, seed: 3 });
    try {
      sim.addPlayer('me', 'goku', 'Me', false, { x: 0, y: 0, z: 0 });
      sim.addPlayer('A', 'vegeta', 'A', false, { x: 0, y: 0, z: 6 });
      sim.addPlayer('near', 'naruto', 'Near', false, { x: Math.sin(.7) * 1.2, y: 0, z: Math.cos(.7) * 1.2 });
      play(sim, {}, 5, true, 'A', .5);
      play(sim, { 0: 'light' }, 1, true, 'A', .5, 5);
      expect(Math.abs(sim.getPlayer('me')!.yaw), 'faces the lock').toBeLessThan(.05);
      const free = new ArenaSimulation({ trainingBot: false, seed: 3 });
      free.addPlayer('me', 'goku', 'Me', false, { x: 0, y: 0, z: 0 });
      free.addPlayer('A', 'vegeta', 'A', false, { x: 0, y: 0, z: 6 });
      free.addPlayer('near', 'naruto', 'Near', false, { x: Math.sin(.7) * 1.2, y: 0, z: Math.cos(.7) * 1.2 });
      play(free, { 0: 'light' }, 40, false, 'A', 0);
      expect(hp(free, 'near')).toBeLessThan(HP);
      free.dispose();
    } finally { sim.dispose(); }
  });

  it('a body that steps into the path is still hit: first in line takes a shot, a beam burns through both', () => {
    for (const [fighter, slot, style] of [['ace', 'special', 'projectile'], ['goku', 'special', 'beam'], ['vegeta', 'heavy', 'projectile']] as const) {
      expect(MOVES[fighter][slot].style).toBe(style);
      const sim = new ArenaSimulation({ trainingBot: false, seed: 5 });
      try {
        sim.addPlayer('me', fighter, 'Me', false, { x: 0, y: 0, z: 0 });
        sim.addPlayer('A', 'vegeta', 'A', false, { x: .3, y: 0, z: 5 });
        sim.addPlayer('between', 'naruto', 'Between', false, { x: -.2, y: 0, z: 2.2 });
        play(sim, {}, 5, true);
        play(sim, { 0: slot }, 60 * 3, true, 'A', .35, 5);
        expect(hp(sim, 'between'), `${fighter} ${slot}: in the way`).toBeLessThan(HP);
        if (style === 'beam') expect(hp(sim, 'A'), 'the beam goes on through').toBeLessThan(HP);
        else expect(hp(sim, 'A'), 'the shot stopped in the first body').toBe(HP);
      } finally { sim.dispose(); }
    }
  });

  it('a locked drive is not stopped short by a body beside the fighter', () => {
    const [, , , bot, A, B] = CASES.find(c => c[0] === 'Kagero')!;
    const fighter: FighterId = 'law', slot: AttackSlot = 'heavy';
    expect(MOVES[fighter][slot].style).toBe('melee');
    const sim = crowd(fighter, bot, A, B);
    try {
      play(sim, {}, 10, true);
      const a0 = sim.getPlayer('A')!, m0 = sim.getPlayer('me')!, before = Math.hypot(a0.x - m0.x, a0.z - m0.z);
      play(sim, { 0: slot }, Math.round(MOVES[fighter][slot].contacts[0] * 60) + 2, true, 'A', .35, 10);
      const a1 = sim.getPlayer('A')!, m1 = sim.getPlayer('me')!;
      expect(Math.hypot(a1.x - m1.x, a1.z - m1.z), 'closed on the lock').toBeLessThan(before - 1);
    } finally { sim.dispose(); }
  });

  it('arcade survival\'s sides are left exactly as they were (they aim their own way)', () => {
    const [, fighter, slot, bot, A, B] = CASES[0];
    const sim = crowd(fighter, bot, A, B);
    try {
      sim.setTeam('me', 'party');
      for (const id of ['bot', 'A', 'B']) sim.setTeam(id, 'horde');
      play(sim, {}, 20, true);
      play(sim, { 0: slot }, 60 * 4, true, 'A', .35, 20);
      expect(hp(sim, 'bot'), 'Hiken still bursts on the body at the shoulder there').toBeLessThan(HP);
    } finally { sim.dispose(); }
  });

  it('a beam burns nobody behind or beside its caster (Final Flash in the critic\'s crowd)', () => {
    const sim = new ArenaSimulation({ trainingBot: false, seed: 9 });
    try {
      sim.addPlayer('me', 'vegeta', 'Me', false, { x: 0, y: 0, z: 0 });
      sim.addPlayer('bot', 'jotaro', 'Bot', false, at([1.5, 1.18, .93]));
      sim.addPlayer('A', 'vegeta', 'A', false, at([1.78, .4, -1.74]));
      sim.addPlayer('B', 'zoro', 'B', false, at([5.96, 3.85, 4.55]));
      sim.trainingCommand('me', 'awakening');
      const bot = sim.getPlayer('bot')!;
      play(sim, { 0: 'ultimate' }, 60 * 5, false, 'bot', 0);
      expect(hp(sim, 'bot'), 'the one it is fired at').toBeLessThan(HP);
      expect(hp(sim, 'A'), 'the one behind its shoulder').toBe(HP);
      expect(hp(sim, 'B'), 'the one in the beam further out').toBeLessThan(HP);
      expect(bot.id).toBe('bot');
    } finally { sim.dispose(); }
  });
});

describe('the whole roster, hard-locked in the critic\'s crowd', () => {
  const area = (m: (typeof MOVES)[FighterId][AttackSlot]) => !!m.timeStop || m.style === 'bomb' || m.style === 'field';
  it.each(Object.keys(MOVES) as FighterId[])('%s: nothing single-target lands on the fighter at the shoulder, and every heavy, special and ultimate lands on the lock', fighter => {
    const [, , , bot, A, B] = CASES.find(c => c[0] === 'Big Bang Attack')!;
    for (const slot of ['light', 'heavy', 'special', 'ultimate'] as AttackSlot[]) {
      const sim = crowd(fighter, bot, A, B), move = MOVES[fighter][slot];
      try {
        sim.trainingCommand('me', 'awakening');
        play(sim, {}, 10, true);
        play(sim, { 0: slot }, 60 * 9, true, 'A', .35, 10);
        if (!area(move)) expect(hp(sim, 'bot'), `${slot}: ${move.name}`).toBe(HP);
        if (slot !== 'light') expect(hp(sim, 'A'), `${slot}: ${move.name}`).toBeLessThan(HP);
      } finally { sim.dispose(); }
    }
  });
});

describe('hard lock: deterministic, and the prediction agrees with the server', () => {
  const run = () => {
    const [, fighter, slot, bot, A, B] = CASES[0];
    const sim = crowd(fighter, bot, A, B);
    play(sim, {}, 10, true);
    play(sim, { 0: slot, 150: 'heavy' }, 260, true, 'A', .35, 10);
    const out = JSON.stringify(sim.snapshot().players);
    sim.dispose();
    return out;
  };
  it('the same inputs replay to the same state', () => { expect(run()).toBe(run()); });

  it.each([CASES[0], CASES[5], CASES[7]])('a rollback replay across the wire lands %s on the same body as the server', (_name, fighter, slot, bot, A, B) => {
    const server = crowd(fighter, bot, A, B), prediction = new Prediction();
    prediction.start('me', wire(server.snapshot(false, true)));
    const local = (prediction as unknown as { sim: ArenaSimulation }).sim;
    const a = server.getPlayer('A')!, yaw = Math.atan2(a.x, a.z) + .35;
    try {
      const queue: PlayerInput[] = [];
      for (let seq = 0; seq < 240; seq++) {
        const input: PlayerInput = { seq, moveX: 0, moveZ: 0, yaw, targetId: 'A', lock: true, attack: seq === 6 ? slot : undefined };
        prediction.submit(input); queue.push(input);
        while (queue.length && queue[0].seq <= seq - 3) server.submitInput('me', queue.shift()!);
        server.step();
        if (seq % 2 === 1) prediction.reconcile(wire<GameSnapshot>(server.snapshot(false, true)));
      }
      while (queue.length) server.submitInput('me', queue.shift()!);
      for (let i = 0; i < 6; i++) server.step();
      prediction.reconcile(wire<GameSnapshot>(server.snapshot(false, true)));
      expect(hp(server, 'A')).toBeLessThan(HP);
      expect(hp(server, 'bot')).toBe(HP);
      expect(hp(local, 'A'), 'the local copy agrees').toBe(hp(server, 'A'));
      expect(hp(local, 'bot')).toBe(HP);
    } finally { prediction.stop(); server.dispose(); }
  });
});
