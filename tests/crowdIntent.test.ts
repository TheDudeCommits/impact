import { ROSTER_PROTOCOL } from '../src/game/rosterProtocol';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Packr, unpack } from 'msgpackr';
import { matchMaker, type Client } from 'colyseus';
import { ArenaSimulation } from '../src/game/simulation';
import { Prediction } from '../src/game/prediction';
import { Targeting } from '../src/game/Targeting';
import { LAUNCH_KNOCKBACK, MOVES } from '../src/game/moves';
import { ArenaRoom } from '../src/server/ArenaRoom';
import type { AttackSlot, FighterId, GameSnapshot, PlayerInput, PlayerState } from '../src/game/types';

const wire = <T>(value: T): T => unpack(new Packr({ useRecords: false }).pack(value)) as T;
const HP = 1000;

function crowd(fighter: FighterId = 'goku', far = { x: 2.9, z: .5 }, near = 1.1) {
  const sim = new ArenaSimulation({ trainingBot: false, seed: 11 });
  sim.addPlayer('me', fighter, 'Me', false, { x: 0, y: 0, z: 0 });
  sim.addPlayer('near', 'vegeta', 'Near', false, { x: 0, y: 0, z: near });
  sim.addPlayer('far', 'naruto', 'Far', false, { x: far.x, y: 0, z: far.z });
  return sim;
}
function play(sim: ArenaSimulation, presses: Record<number, AttackSlot>, ticks: number, lock: boolean | undefined, targetId = 'far', from = 0) {
  for (let seq = from; seq < from + ticks; seq++) {
    const input: PlayerInput = { seq, moveX: 0, moveZ: 0, yaw: 0, targetId, attack: presses[seq - from] };
    if (lock !== undefined) input.lock = lock;
    sim.submitInput('me', input);
    sim.step();
  }
}
const hp = (sim: ArenaSimulation, id: string) => sim.getPlayer(id)!.hp;

describe('an attack goes to the enemy the player faces', () => {
  it('the critic\'s crowd: the rush, the heavy and the special all land on the body in front', () => {
    for (const [slot, presses] of [
      ['light', { 0: 'light', 9: 'light', 18: 'light', 27: 'light', 36: 'light', 45: 'light' }],
      ['heavy', { 0: 'heavy' }],
      ['special', { 0: 'special' }],
    ] as const) {
      const sim = crowd();
      try {
        play(sim, presses, 170, false);
        expect(hp(sim, 'near'), `${slot}: Vegeta, 1.1 m in front, is hit`).toBeLessThan(HP);
        expect(hp(sim, 'far'), `${slot}: Naruto, 2.9 m off to the side, is not`).toBe(HP);
      } finally { sim.dispose(); }
    }
  });

  it('the view on one fighter, the body face to face with another: the nearer one the body faces', () => {
    const sim = crowd('goku', { x: 2.5, z: -1.4 }, 1.1);
    try {
      for (let seq = 0; seq < 150; seq++) {
        sim.submitInput('me', { seq, moveX: 0, moveZ: seq < 4 ? 1 : 0, yaw: 2.78, targetId: 'far', lock: false, attack: seq === 12 ? 'heavy' : undefined });
        sim.step();
      }
      expect(hp(sim, 'near')).toBeLessThan(HP);
      expect(hp(sim, 'far')).toBe(HP);
    } finally { sim.dispose(); }
  });

  it('the nearest in front, even when the one the camera holds is in front as well', () => {
    const sim = crowd('goku', { x: 1.7, z: 2.2 });
    try {
      play(sim, { 0: 'heavy' }, 120, false);
      expect(hp(sim, 'near')).toBeLessThan(HP);
      expect(hp(sim, 'far')).toBe(HP);
    } finally { sim.dispose(); }
  });

  it.each(['zoro', 'law', 'kakashi', 'guts', 'ace', 'killua'] as FighterId[])('%s: the ultimate goes to the body 1.2 m in front, not the soft target 2.8 m off', fighter => {
    const sim = crowd(fighter, { x: 2.6, z: 1 }, 1.2);
    try {
      sim.trainingCommand('me', 'awakening');
      play(sim, { 0: 'ultimate' }, 60 * 8, false);
      expect(hp(sim, 'near'), 'the body in front takes it').toBeLessThan(HP);
      if (fighter === 'ace') {
        const cast = sim.snapshot().events.find(e => e.kind === 'cast' && e.actorId === 'me' && e.slot === 'ultimate')!;
        expect(Math.hypot(cast.endpoint!.x - 0, cast.endpoint!.z - 1.2)).toBeLessThan(.01);
      } else expect(hp(sim, 'far'), 'the one the camera was on does not').toBe(HP);
    } finally { sim.dispose(); }
  });

  it('a Tab lock still wins: the heavy and the special go to the locked fighter', () => {
    for (const slot of ['heavy', 'special'] as const) {
      const sim = crowd();
      try {
        play(sim, { 0: slot }, 150, true);
        expect(hp(sim, 'far'), `${slot}: the lock is hit`).toBeLessThan(HP);
      } finally { sim.dispose(); }
    }
  });

  it('a Tab lock wins wherever the locked fighter stands, within the move\'s reach', () => {
    for (const [lock, hit, spared] of [[true, 'far', 'near'], [false, 'near', 'far']] as const) {
      const sim = crowd('goku', { x: 0, z: -1.5 }, 1.2);
      try {
        play(sim, { 0: 'light' }, 60, lock);
        expect(hp(sim, hit), `${lock ? 'locked' : 'soft'}: ${hit} is hit`).toBeLessThan(HP);
        expect(hp(sim, spared)).toBe(HP);
      } finally { sim.dispose(); }
    }
  });

  it('bots and old clients, which do not say whether they are locked, keep the target they send', () => {
    const sim = crowd();
    try {
      play(sim, { 0: 'heavy' }, 120, undefined);
      expect(hp(sim, 'far'), 'Instant Transmission goes for the target it was sent').toBeLessThan(HP);
      expect(hp(sim, 'near')).toBe(HP);
    } finally { sim.dispose(); }
  });

  it('arcade survival (a fighter on a side) is left to its own aim', () => {
    const sim = crowd();
    try {
      sim.setTeam('me', 'party');
      play(sim, { 0: 'heavy' }, 120, false);
      expect(hp(sim, 'far')).toBeLessThan(HP);
      expect(hp(sim, 'near')).toBe(HP);
    } finally { sim.dispose(); }
  });

  it('the pick is the cast\'s target for its whole length, whatever the next packets nominate', () => {
    const sim = crowd('zoro', { x: 2.6, z: 1 }, 1.4);
    try {
      sim.trainingCommand('me', 'awakening');
      const seen: (string | null)[] = [];
      for (let seq = 0; seq < 60 * 6; seq++) {
        sim.submitInput('me', { seq, moveX: 0, moveZ: 0, yaw: 0, targetId: 'far', lock: false, attack: seq === 0 ? 'ultimate' : undefined });
        sim.step();
        const me = sim.getPlayer('me')!;
        seen.push(me.action === 'ultimate' ? me.target : null);
      }
      const during = seen.filter(t => t !== null);
      expect(during.length).toBeGreaterThan(MOVES.zoro.ultimate.duration * 60);
      expect(new Set(during), 'held on the body in front through the whole ultimate').toEqual(new Set(['near']));
      expect(sim.getPlayer('me')!.target, 'and handed back to the client once it is over').toBe('far');
    } finally { sim.dispose(); }
  });

  it('a string stays on the body it began against while it is still in front and in reach', () => {
    const sim = new ArenaSimulation({ trainingBot: false, seed: 5 });
    try {
      sim.addPlayer('me', 'goku', 'Me', false, { x: 0, y: 0, z: 0 });
      sim.addPlayer('first', 'vegeta', 'First', false, { x: 0, y: 0, z: 1.25 });
      sim.addPlayer('beside', 'naruto', 'Beside', false, { x: -1.15, y: 0, z: 1.35 });
      for (let seq = 0; seq < 150; seq++) {
        sim.submitInput('me', { seq, moveX: 0, moveZ: 0, yaw: 0, targetId: null, lock: false, attack: seq % 12 === 0 && seq < 48 ? 'light' : undefined });
        sim.step();
      }
      expect(hp(sim, 'first')).toBeLessThan(HP - 60);
      expect(hp(sim, 'beside')).toBe(HP);
    } finally { sim.dispose(); }
  });
});

describe('deterministic and consistent between prediction and authority', () => {
  const run = () => {
    const sim = crowd('goku', { x: 1.7, z: 2.2 });
    play(sim, { 0: 'light', 10: 'light', 20: 'heavy', 90: 'special' }, 260, false);
    const out = JSON.stringify(sim.snapshot().players);
    sim.dispose();
    return out;
  };
  it('the same inputs replay to the same state', () => { expect(run()).toBe(run()); });

  it('a rollback replay across the wire predicts the same victim as the server', () => {
    const server = crowd('goku', { x: 1.7, z: 2.2 }), prediction = new Prediction();
    prediction.start('me', wire(server.snapshot(false, true)));
    const local = (prediction as unknown as { sim: ArenaSimulation }).sim;
    try {
      const queue: PlayerInput[] = [];
      for (let seq = 0; seq < 150; seq++) {
        const input: PlayerInput = { seq, moveX: 0, moveZ: 0, yaw: 0, targetId: 'far', lock: false, attack: seq === 4 ? 'heavy' : seq === 70 ? 'light' : undefined };
        prediction.submit(input); queue.push(input);
        while (queue.length && queue[0].seq <= seq - 3) server.submitInput('me', queue.shift()!);
        server.step();
        if (seq % 2 === 1) prediction.reconcile(wire<GameSnapshot>(server.snapshot(false, true)));
        if (seq === 20) expect(local.getPlayer('me')!.target, 'the predicted cast holds the body in front').toBe('near');
      }
      while (queue.length) server.submitInput('me', queue.shift()!);
      for (let i = 0; i < 6; i++) server.step();
      prediction.reconcile(wire<GameSnapshot>(server.snapshot(false, true)));
      expect(hp(server, 'near')).toBeLessThan(HP);
      expect(hp(server, 'far')).toBe(HP);
      expect(hp(local, 'near'), 'the local copy agrees on who was hit').toBe(hp(server, 'near'));
      expect(hp(local, 'far')).toBe(HP);
    } finally { prediction.stop(); server.dispose(); }
  });

  it('a checkpoint taken mid-cast restores the pick with it', () => {
    const source = crowd('zoro', { x: 2.6, z: 1 }, 1.4), restored = crowd('zoro', { x: 2.6, z: 1 }, 1.4);
    try {
      source.trainingCommand('me', 'awakening'); restored.trainingCommand('me', 'awakening');
      play(source, { 0: 'ultimate' }, 40, false);
      const checkpoint = wire(source.predictionCheckpoint('me')!);
      const snapshot = wire(source.snapshot(false, true)), state = snapshot.players;
      for (const p of state) Object.assign(restored.actors.get(p.id)!.state, p, { cooldowns: { ...p.cooldowns } });
      for (const [id, reaction] of Object.entries(snapshot.reactions ?? {})) if (id !== 'me') Object.assign(restored.actors.get(id)!, reaction);
      restored.restorePrediction('me', checkpoint);
      restored.serverTime = source.serverTime;
      play(source, {}, 300, false, 'far', 40);
      play(restored, {}, 300, false, 'far', 40);
      expect(hp(restored, 'near')).toBe(hp(source, 'near'));
      expect(hp(source, 'near')).toBeLessThan(HP);
      expect(hp(restored, 'far')).toBe(HP);
    } finally { source.dispose(); restored.dispose(); }
  });
});

describe('Tab visits every fighter, then goes round again (round 4b: released only deliberately)', () => {
  const p = (id: string, x = 0, z = 0, extras: Partial<PlayerState> = {}): PlayerState => ({ id, name: id, fighter: 'goku', x, y: 0, z, yaw: 0, hp: 1000, maxHp: 1000,
    stamina: 100, ultimate: 0, action: 'idle', actionStarted: 0, actionTime: 0, actionDuration: 0, target: null, alive: true, isBot: false,
    grounded: true, guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 }, ...extras });
  it('centre first, then outward - including whoever is left of the first pick', () => {
    const t = new Targeting(), self = p('self'), left = p('left', -3, 5), centre = p('centre', .3, 6), right = p('right', 2.5, 5), list = [self, left, centre, right];
    const seen: string[] = [];
    for (let i = 0; i < 3; i++) { seen.push(t.cycle(list, self, 0)!); expect(t.locked).toBe(true); }
    expect(seen).toEqual(['centre', 'right', 'left']);
    expect(t.cycle(list, self, 0), 'and after the last, round again from the middle').toBe('centre');
    expect(t.locked).toBe(true);
  });
  it('reaches everyone while the lock-on camera turns to each new pick', () => {
    const t = new Targeting(), self = p('self'), a = p('a', -4, 4), b = p('b', 0, 7), c = p('c', 4, 5), d = p('d', -1, 3), list = [self, a, b, c, d];
    let yaw = 0;
    const seen = new Set<string>();
    for (let i = 0; i < 4; i++) {
      const id = t.cycle(list, self, yaw)!; seen.add(id);
      const q = list.find(x => x.id === id)!; yaw = Math.atan2(q.x, q.z) + .5;
    }
    expect(seen).toEqual(new Set(['a', 'b', 'c', 'd']));
    t.cycle(list, self, yaw);
    expect(t.locked, 'round again, not released').toBe(true);
  });
  it('a lock whose fighter falls starts the next cycle afresh', () => {
    const t = new Targeting(), self = p('self'), one = p('one', 0, 4), two = p('two', 2, 4), list = [self, one, two];
    expect(t.cycle(list, self, 0)).toBe('one');
    one.alive = false; t.update(list, self, [], 1, 0);
    expect(t.locked).toBe(false);
    one.alive = true;
    expect(t.cycle(list, self, 0)).toBe('one');
  });
});

describe('Ace\'s Dai Enkai Entei burns everybody under the drawn sun', () => {
  it('the footprint is the sun and its corona, not a smaller circle inside it', () => {
    const sim = new ArenaSimulation({ trainingBot: false, seed: 3 });
    try {
      sim.addPlayer('me', 'ace', 'Ace', false, { x: 0, y: 0, z: 0 });
      sim.addPlayer('under', 'vegeta', 'Under', false, { x: 0, y: 0, z: 4 });
      sim.addPlayer('edge', 'naruto', 'Edge', false, { x: 2.8, y: 0, z: 4 });
      sim.addPlayer('clear', 'luffy', 'Clear', false, { x: -3.2, y: 0, z: 4 });
      sim.trainingCommand('me', 'awakening');
      play(sim, { 0: 'ultimate' }, 60 * 4.5, false, 'under');
      expect(hp(sim, 'under')).toBeLessThan(HP);
      expect(hp(sim, 'edge'), '2.8 m from the centre is under the sun').toBeLessThan(HP);
      expect(hp(sim, 'clear'), '3.2 m from it is not').toBe(HP);
      expect(MOVES.ace.ultimate.radius).toBe(3);
    } finally { sim.dispose(); }
  });
});

describe('Lapse: Blue pulls', () => {
  it('draws the victim in toward Gojo instead of blowing them away', () => {
    const sim = new ArenaSimulation({ trainingBot: false, seed: 2 });
    try {
      sim.addPlayer('me', 'gojo', 'Gojo', false, { x: 0, y: 0, z: 0 });
      sim.addPlayer('foe', 'naruto', 'Foe', false, { x: 0, y: 0, z: 7 });
      let hitAt = -1, grounded = true;
      for (let seq = 0; seq < 120; seq++) {
        sim.submitInput('me', { seq, moveX: 0, moveZ: 0, yaw: 0, targetId: 'foe', lock: false, attack: seq === 0 ? 'heavy' : undefined });
        sim.step();
        const foe = sim.getPlayer('foe')!;
        if (hitAt < 0 && foe.hp < HP) hitAt = seq;
        if (hitAt >= 0) grounded &&= foe.grounded;
      }
      const foe = sim.getPlayer('foe')!;
      expect(hitAt).toBeGreaterThan(0);
      expect(foe.z, 'pulled a clear two metres in').toBeLessThan(7 - 2);
      expect(foe.z, 'and not through him').toBeGreaterThan(1);
      expect(grounded, 'along the floor, not launched').toBe(true);
      expect(MOVES.gojo.heavy.knockback).toBeLessThan(0);
      expect(-MOVES.gojo.heavy.knockback).toBeLessThan(LAUNCH_KNOCKBACK * 4);
    } finally { sim.dispose(); }
  });
});

describe('a training room is one player\'s own', () => {
  const fake = (sessionId: string) => ({ sessionId, send: vi.fn() } as unknown as Client);
  beforeAll(async () => {
    await matchMaker.setup();
    matchMaker.defineRoomType('arena', ArenaRoom).filterBy(['mode']);
  });
  afterAll(async () => { await matchMaker.gracefullyShutdown().catch(() => {}); });
  const training = (fighter: FighterId) => matchMaker.joinOrCreate('arena', { rosterProtocol: ROSTER_PROTOCOL, mode: 'training', fighter, name: fighter });

  it('two players entering training at the same moment get a room each', async () => {
    const seats = await Promise.all([training('goku'), training('naruto'), training('luffy')]);
    expect(new Set(seats.map(s => s.roomId)).size).toBe(3);
  });

  it('nor does a later entrant join somebody else\'s training room', async () => {
    const first = await training('zoro');
    const room = matchMaker.getLocalRoomById(first.roomId) as ArenaRoom;
    room.onJoin(fake(first.sessionId), {rosterProtocol:ROSTER_PROTOCOL, fighter: 'zoro', name: 'zoro' });
    const second = await training('sanji');
    expect(second.roomId).not.toBe(first.roomId);
    const [a, b] = await Promise.all([
      matchMaker.joinOrCreate('arena', { rosterProtocol: ROSTER_PROTOCOL, mode: 'match', fighter: 'goku', name: 'a' }),
      matchMaker.joinOrCreate('arena', { rosterProtocol: ROSTER_PROTOCOL, mode: 'match', fighter: 'naruto', name: 'b' })]);
    expect(a.roomId).toBe(b.roomId);
  });

  it('a tool can still bring a sparring dummy in by the room\'s id', async () => {
    const owner = await training('ichigo');
    const room = matchMaker.getLocalRoomById(owner.roomId) as ArenaRoom;
    await expect(matchMaker.joinById(owner.roomId, { rosterProtocol: ROSTER_PROTOCOL, mode: 'training', fighter: 'luffy', name: 'early' }),
      'not before its player is in').rejects.toThrow();
    room.onJoin(fake(owner.sessionId), {rosterProtocol:ROSTER_PROTOCOL, fighter: 'ichigo', name: 'ichigo' });
    const guest = await matchMaker.joinById(owner.roomId, { rosterProtocol: ROSTER_PROTOCOL, mode: 'training', fighter: 'luffy', name: 'dummy' });
    expect(guest.roomId).toBe(owner.roomId);
  });
});
