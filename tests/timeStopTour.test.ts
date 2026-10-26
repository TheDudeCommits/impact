import { describe, expect, it } from 'vitest';
import { Packr, unpack } from 'msgpackr';
import { ArenaSimulation } from '../src/game/simulation';
import { Prediction } from '../src/game/prediction';
import { moveFor } from '../src/game/awakening';
import { HARD_GAP, MAX_HP, MOVES, type MoveDefinition } from '../src/game/moves';
import { BARRAGE_GAP, barrageWindow, blinkWindow, planTour, TIME_STOP_TOURS, tourBlows, tourContacts, visitCount, visitOf, visitRange, visitVictim } from '../src/game/timeStopBarrage';
import type { CollisionWorld, CombatEvent, FighterId, GameSnapshot, PlayerInput, Vec3 } from '../src/game/types';

const USERS: FighterId[] = ['jotaro', 'dio', 'gojo'];
const wire = <T>(value: T): T => unpack(new Packr({ useRecords: false }).pack(value)) as T;

type Spot = { id: string; distance: number; angle: number; fighter?: FighterId };
function arena(user: FighterId, spots: Spot[], awakened = false, collision?: CollisionWorld) {
  const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, seed: 11, collision });
  sim.addPlayer('user', user, 'User', false, { x: 0, y: 0, z: 0 });
  for (const s of spots) sim.addPlayer(s.id, s.fighter ?? 'goku', s.id, false, { x: Math.sin(s.angle) * s.distance, y: 0, z: Math.cos(s.angle) * s.distance });
  const me = sim.actors.get('user')!;
  me.state.ultimate = 100;
  if (awakened) { me.state.awakened = true; me.state.awakenedUntil = 1e9; }
  return sim;
}
function cast(sim: ArenaSimulation, target: string | null, seconds = 8) {
  sim.submitInput('user', { seq: 1, moveX: 0, moveZ: 0, yaw: 0, targetId: target, attack: 'ultimate' });
  const hits: CombatEvent[] = [], ticks: { t: number; x: number; y: number; z: number; stopped: string[]; others: { id: string; x: number; z: number; alive: boolean }[] }[] = [];
  const frozen = new Set<string>();
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    sim.step();
    for (const e of sim.drainEvents()) if (e.kind === 'hit' && e.actorId === 'user') hits.push(e);
    const me = sim.getPlayer('user')!;
    const others = sim.playerStates().filter(p => p.id !== 'user');
    for (const p of others) if (p.timeStopped) frozen.add(p.id);
    ticks.push({ t: sim.serverTime, x: me.x, y: me.y, z: me.z, stopped: others.filter(p => p.timeStopped).map(p => p.id),
      others: others.map(p => ({ id: p.id, x: p.x, z: p.z, alive: p.alive })) });
  }
  const damage = (id: string) => MAX_HP - sim.getPlayer(id)!.hp;
  return { hits, ticks, frozen, damage };
}
const radiusOf = (user: FighterId, awakened = false) => moveFor(user, 'ultimate', awakened).timeStop!.radius;

describe('the tour of a time stop (planning)', () => {
  it.each(USERS.flatMap(u => [[u, false], [u, true]] as [FighterId, boolean][]))('%s (awakened %s): the stop first, the tour inside it, the finisher as it ends', (user, awakened) => {
    const move = moveFor(user, 'ultimate', awakened), stop = move.timeStop!, blows = tourContacts(move)!;
    expect(stop.contact).toBe(0);
    expect(blows.first).toBe(1);
    expect(blows.last).toBe(move.contacts.length - 2);
    const stopEnd = move.contacts[0] + stop.duration, finisher = move.contacts[move.contacts.length - 1];
    expect(move.contacts[blows.last]).toBeLessThan(stopEnd);
    expect(finisher).toBeGreaterThanOrEqual(stopEnd);
    expect(finisher - stopEnd).toBeLessThan(.1);
    expect(finisher).toBeLessThan(move.duration);
    expect(move.lunge).toBe(0);
  });

  it.each(USERS.flatMap(u => [[u, false], [u, true]] as [FighterId, boolean][]))('%s (awakened %s): barrageWindow is the one stretch the ORA/MUDA loop covers', (user, awakened) => {
    const move = moveFor(user, 'ultimate', awakened), blows = tourContacts(move)!, window = barrageWindow(move);
    const times = move.contacts.slice(blows.first, blows.last + 1);
    const gaps = times.slice(1).map((t, i) => t - times[i]);
    if (user === 'gojo') {
      expect(Math.max(...gaps)).toBeGreaterThan(BARRAGE_GAP);
      expect(window).toBeNull();
      return;
    }
    expect(window).not.toBeNull();
    expect(window!.start).toBe(times[0]);
    expect(window!.end).toBe(times[times.length - 1]);
    for (const t of times) { expect(t).toBeGreaterThanOrEqual(window!.start); expect(t).toBeLessThanOrEqual(window!.end); }
    expect(window!.start).toBeGreaterThan(move.contacts[0]);
    expect(window!.end).toBeLessThan(move.contacts[move.contacts.length - 1]);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(BARRAGE_GAP);
    expect(barrageWindow(moveFor(user, 'special', awakened))).toBeNull();
  });

  it('splits the blows into contiguous visits, the later ones never shorter, and never runs a move into a blow', () => {
    for (const user of USERS) for (const awakened of [false, true]) {
      const move = moveFor(user, 'ultimate', awakened), style = TIME_STOP_TOURS[user]!, blows = tourBlows(move);
      for (let victims = 1; victims <= 11; victims++) {
        const visits = visitCount(move, style, Math.min(victims, blows));
        let expected = tourContacts(move)!.first, previous = 0;
        for (let k = 0; k < visits; k++) {
          const [first, last] = visitRange(move, k, visits);
          expect(first).toBe(expected);
          expect(last).toBeGreaterThanOrEqual(first);
          expect(last - first + 1).toBeGreaterThanOrEqual(previous);
          previous = last - first + 1; expected = last + 1;
          for (let c = first; c <= last; c++) expect(visitOf(move, c, visits)).toBe(k);
          const [start, end] = blinkWindow(move, k, visits, style);
          expect(end).toBeGreaterThanOrEqual(start);
          expect(end).toBeLessThan(move.contacts[first]);
          expect(start).toBeGreaterThan(k ? move.contacts[visitRange(move, k - 1, visits)[1]] : move.contacts[0]);
        }
        expect(expected - 1).toBe(tourContacts(move)!.last);
        expect(visitVictim(move, style, visits - 1, Math.min(victims, blows))).toBe(Math.min(victims, blows) - 1);
      }
    }
  });

  it('puts the locked target last, else the one squarely in front, and is independent of storage order', () => {
    const victims = [{ id: 'c', x: 5, z: 0 }, { id: 'a', x: 0, z: 2 }, { id: 'b', x: -3, z: 4 }];
    const locked = planTour({ x: 0, z: 0 }, { x: 0, z: 1 }, victims, 'c', 11);
    expect(locked.order[locked.order.length - 1]).toBe('c');
    const front = planTour({ x: 0, z: 0 }, { x: 0, z: 1 }, victims, null, 11);
    expect(front.order[front.order.length - 1]).toBe('a');
    expect(planTour({ x: 0, z: 0 }, { x: 0, z: 1 }, [...victims].reverse(), null, 11)).toEqual(front);
    const many = Array.from({ length: 8 }, (_, i) => ({ id: 'v' + i, x: Math.cos(i) * 4, z: Math.sin(i) * 4 }));
    const few = planTour({ x: 0, z: 0 }, { x: 0, z: 1 }, many, 'v3', 5);
    expect(few.visited).toBe(5);
    expect(few.order).toHaveLength(8);
    expect(few.order[4]).toBe('v3');
  });
});

describe('every opponent the stop catches takes damage', () => {
  it.each(USERS.flatMap(u => [[u, false], [u, true]] as [FighterId, boolean][]))('%s (awakened %s): near, middle and edge of the radius, and not beyond it', (user, awakened) => {
    const r = radiusOf(user, awakened);
    const sim = arena(user, [
      { id: 'near', distance: r * .25, angle: .1 },
      { id: 'middle', distance: r * .625, angle: 1.9 },
      { id: 'edge', distance: r * .94, angle: -2.4 },
      { id: 'outside', distance: r + 1.5, angle: .6 },
    ], awakened);
    const { frozen, damage, hits } = cast(sim, 'near');
    expect([...frozen].sort()).toEqual(['edge', 'middle', 'near']);
    for (const id of ['near', 'middle', 'edge']) expect(damage(id), `${id} took damage`).toBeGreaterThan(0);
    expect(damage('outside')).toBe(0);
    const scale = awakened ? 1.3 : 1;
    for (const id of ['near', 'middle', 'edge']) {
      expect(damage(id)).toBeGreaterThan(170 * scale);
      expect(damage(id)).toBeLessThan(360 * scale);
    }
    const move = moveFor(user, 'ultimate', awakened), last = move.contacts.length - 1;
    const finishers = hits.filter(h => h.contactIndex === last);
    expect(finishers.map(h => h.targetId).sort()).toEqual(['edge', 'middle', 'near']);
    expect(finishers[finishers.length - 1].targetId, 'the finisher proper is the last word, on the lock').toBe('near');
    expect(new Set(finishers.map(h => h.serverTime)).size).toBe(1);
    for (const h of finishers) expect(h.reaction).toBe('launched');
    expect(hits.some(h => h.targetId === 'outside')).toBe(false);
    sim.dispose();
  });

  it('alone in the stop, one opponent takes every blow and the finisher, as before', () => {
    for (const user of USERS) {
      const sim = arena(user, [{ id: 'b', distance: 2.2, angle: 0 }]);
      const { hits, damage } = cast(sim, 'b');
      const move = moveFor(user, 'ultimate', false);
      expect(hits.filter(h => h.targetId === 'b')).toHaveLength(move.contacts.length - 1);
      expect(damage('b')).toBeGreaterThan(280);
      expect(damage('b')).toBeLessThan(340);
      sim.dispose();
    }
  });

  it('leaves out an opponent behind a wall and one who was evading when the clock stopped', () => {
    const wall = -3;
    const crosses = (a: Vec3, b: Vec3) => (a.z - wall) * (b.z - wall) < 0;
    const world: CollisionWorld = {
      move: (_id, p, d) => {
        const to = { x: p.x + d.x, y: Math.max(0, p.y + d.y), z: p.z + d.z };
        const z = crosses(p, to) ? (p.z > wall ? wall + .46 : wall - .46) : to.z;
        return { x: d.x, y: to.y - p.y, z: z - p.z, grounded: to.y <= 0 };
      },
      raycast: (a, b) => {
        if (!crosses(a, b)) return { ...b };
        const t = (wall - a.z) / (b.z - a.z);
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: wall };
      },
    };
    for (const user of USERS) {
      const sim = arena(user, [
        { id: 'open', distance: 2.2, angle: 0 },
        { id: 'walled', distance: 5, angle: Math.PI },
        { id: 'evading', distance: 3.4, angle: 1.3 },
      ], false, world);
      sim.actors.get('evading')!.evadeUntil = 1.2;
      const { frozen, damage, ticks } = cast(sim, 'open');
      const domain = !!TIME_STOP_TOURS[user]?.domain;
      expect([...frozen]).toEqual(domain ? ['open', 'evading'] : ['open']);
      expect(damage('open')).toBeGreaterThan(0);
      expect(damage('walled')).toBe(0);
      if (domain) expect(damage('evading')).toBeGreaterThan(0);
      else expect(damage('evading')).toBe(0);
      for (const t of ticks) expect(t.z).toBeGreaterThan(wall);
      sim.dispose();
    }
  });

  it('whiffs when the stop catches nobody: the blows swing at the air in front, nobody is moved', () => {
    for (const user of USERS) {
      const sim = arena(user, [{ id: 'far', distance: radiusOf(user) + 3, angle: 0 }]);
      const { frozen, damage, ticks } = cast(sim, null);
      expect(frozen.size).toBe(0);
      expect(damage('far')).toBe(0);
      expect(Math.hypot(ticks[ticks.length - 1].x, ticks[ticks.length - 1].z)).toBeLessThan(.05);
      expect(sim.actors.get('user')!.cast).toBeNull();
      sim.dispose();
    }
  });
});

describe('the user crosses the stop legally', () => {
  it.each(USERS.flatMap(u => [[u, false], [u, true]] as [FighterId, boolean][]))('%s (awakened %s): visits each victim, never inside a body, spots inside the stage', (user, awakened) => {
    const r = radiusOf(user, awakened);
    const sim = arena(user, [
      { id: 'a', distance: 1.9, angle: .15 },
      { id: 'b', distance: 3.1, angle: .45 },
      { id: 'c', distance: r * .8, angle: -1.2 },
      { id: 'd', distance: r * .6, angle: 2.7 },
    ], awakened);
    const { ticks, hits } = cast(sim, 'a');
    const move = moveFor(user, 'ultimate', awakened), last = move.contacts.length - 1;
    const stopAt = ticks.find(t => t.stopped.length)!.t, finishAt = hits.find(h => h.contactIndex === last)!.serverTime;
    let closest = Infinity;
    for (const t of ticks) {
      if (t.t < stopAt || t.t > finishAt) continue;
      for (const o of t.others) if (o.alive) closest = Math.min(closest, Math.hypot(o.x - t.x, o.z - t.z));
    }
    expect(closest, 'the rigid spacing is never broken').toBeGreaterThanOrEqual(HARD_GAP);
    const style = TIME_STOP_TOURS[user]!;
    for (const h of hits.filter(h => h.contactIndex! < last)) {
      const at = ticks.find(t => Math.abs(t.t - h.serverTime) < 1e-9)!, victim = at.others.find(o => o.id === h.targetId)!;
      expect(Math.hypot(victim.x - at.x, victim.z - at.z)).toBeCloseTo(style.strike, 1);
    }
    expect(new Set(hits.filter(h => h.contactIndex! < last).map(h => h.targetId))).toEqual(new Set(['a', 'b', 'c', 'd']));
    const { halfX, halfZ } = sim.bounds;
    for (const t of ticks) { expect(Math.abs(t.x)).toBeLessThanOrEqual(halfX); expect(Math.abs(t.z)).toBeLessThanOrEqual(halfZ); }
    sim.dispose();
  });

  it('Gojo strikes from a new side every visit', () => {
    const sim = arena('gojo', [{ id: 'b', distance: 2.4, angle: 0 }]);
    const { ticks, hits } = cast(sim, 'b');
    const move = moveFor('gojo', 'ultimate', false), last = move.contacts.length - 1;
    const bearings = hits.filter(h => h.contactIndex! < last).map(h => {
      const at = ticks.find(t => Math.abs(t.t - h.serverTime) < 1e-9)!, b = at.others.find(o => o.id === 'b')!;
      return Math.atan2(at.x - b.x, at.z - b.z);
    });
    expect(bearings.length).toBe(move.contacts.length - 2);
    for (let i = 1; i < bearings.length; i++) {
      const turn = Math.abs(Math.atan2(Math.sin(bearings[i] - bearings[i - 1]), Math.cos(bearings[i] - bearings[i - 1])));
      expect(turn).toBeGreaterThan(1);
    }
    sim.dispose();
  });
});

describe('prediction replays the tour the server plays', () => {
  it.each(USERS)('%s: the predicting client and the server put the user in the same places and land the same blows', user => {
    const local = (prediction: Prediction) => (prediction as unknown as { sim: ArenaSimulation }).sim;
    const reach = MOVES[user].ultimate.timeStop!.radius / 6;
    const server = arena(user, [
      { id: 'a', distance: 2, angle: .1 },
      { id: 'b', distance: 4.5 * reach, angle: 1.6 },
      { id: 'c', distance: 5.6 * reach, angle: -2.2 },
    ]);
    const prediction = new Prediction();
    prediction.start('user', wire(server.snapshot(false, true)));
    const inbox: { at: number; snapshot: GameSnapshot }[] = [];
    let worst = 0;
    try {
      for (let seq = 0; seq < 60 * 5; seq++) {
        const input: PlayerInput = { seq, moveX: 0, moveZ: 0, yaw: 0, targetId: 'a', attack: seq === 0 ? 'ultimate' : undefined };
        prediction.submit(input); server.submitInput('user', input); server.step();
        if (seq % 3 === 0) inbox.push({ at: seq + 4, snapshot: wire<GameSnapshot>(server.snapshot(false, true)) });
        while (inbox.length && inbox[0].at <= seq) prediction.reconcile(inbox.shift()!.snapshot);
        const authoritative = server.actors.get('user')!.state, predicted = local(prediction).actors.get('user')!.state;
        worst = Math.max(worst, Math.hypot(authoritative.x - predicted.x, authoritative.z - predicted.z));
        server.drainEvents();
      }
      expect(worst, 'the predicted user never strays from the authoritative one').toBeLessThan(1e-6);
      for (const id of ['a', 'b', 'c']) expect(server.getPlayer(id)!.hp).toBeLessThan(MAX_HP);
      for (const id of ['a', 'b', 'c']) expect(local(prediction).getPlayer(id)!.hp).toBe(server.getPlayer(id)!.hp);
    } finally { prediction.stop(); server.dispose(); }
  });

  it('carries a tour in flight through the wire checkpoint', () => {
    const source = arena('dio', [{ id: 'a', distance: 2, angle: 0 }, { id: 'b', distance: 4, angle: 2 }]);
    const copy = arena('dio', [{ id: 'a', distance: 2, angle: 0 }, { id: 'b', distance: 4, angle: 2 }]);
    try {
      source.submitInput('user', { seq: 1, moveX: 0, moveZ: 0, yaw: 0, targetId: 'a', attack: 'ultimate' });
      copy.submitInput('user', { seq: 1, moveX: 0, moveZ: 0, yaw: 0, targetId: 'a', attack: 'ultimate' });
      for (let i = 0; i < 90; i++) { source.step(); copy.step(); }
      const checkpoint = wire(source.predictionCheckpoint('user')!);
      expect(checkpoint.cast!.tour!.order).toEqual(['b', 'a']);
      copy.restorePrediction('user', checkpoint);
      for (let i = 0; i < 150; i++) {
        source.step(); copy.step();
        const s = source.getPlayer('user')!, c = copy.getPlayer('user')!;
        expect(Math.hypot(s.x - c.x, s.z - c.z)).toBeLessThan(1e-9);
      }
      for (const id of ['a', 'b']) expect(copy.getPlayer(id)!.hp).toBe(source.getPlayer(id)!.hp);
    } finally { source.dispose(); copy.dispose(); }
  });
});

describe('the moves as data', () => {
  it('keeps DIO a mirror of Jotaro and the finishers where they were', () => {
    for (const awakened of [false, true]) {
      const jotaro = moveFor('jotaro', 'ultimate', awakened), dio = moveFor('dio', 'ultimate', awakened);
      expect(dio.contacts).toEqual(jotaro.contacts);
      expect(dio.timeStop).toEqual(jotaro.timeStop);
      expect(dio.damage).toBe(jotaro.damage);
    }
    const plain: MoveDefinition = moveFor('gojo', 'ultimate', false);
    expect(plain.timeStop!.radius).toBe(3.5);
  });
});
