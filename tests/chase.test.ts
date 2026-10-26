import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { Prediction } from '../src/game/prediction';
import { InputQueue } from '../src/server/InputQueue';
import { CHASE_RANGE, CHASE_SECONDS, CHASE_WINDOW, MOVES } from '../src/game/moves';
import type { CombatEvent, FighterId, GameSnapshot, PlayerInput } from '../src/game/types';

function bout(fighter: FighterId = 'zoro', gap = 1.6) {
  const sim = new ArenaSimulation({ trainingBot: false, seed: 9 });
  sim.addPlayer('a', fighter, 'A', false, { x: 0, y: 0, z: 0 });
  sim.addPlayer('b', 'goku', 'B', false, { x: 0, y: 0, z: gap });
  let seq = 0;
  const input = (more: Partial<PlayerInput> = {}) => sim.submitInput('a', { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', ...more });
  const events: CombatEvent[] = [];
  const tick = () => { sim.step(); events.push(...sim.snapshot(true).events); };
  const step = (seconds: number) => { for (let i = 0; i < Math.round(seconds * 60); i++) tick(); };
  const mine = (kind: CombatEvent['kind']) => events.filter(e => e.kind === kind && e.actorId === 'a');
  const launch = () => {
    for (let i = 0; i < 300 && !mine('hit').some(e => e.chain === 3); i++) {
      if (i % 4 === 0 && !mine('cast').some(e => e.chain === 3)) input({ attack: 'light' });
      tick();
    }
    expect(mine('hit').find(e => e.chain === 3)?.reaction, `${fighter}'s finisher launches`).toBe('launched');
  };
  return { sim, input, tick, step, events, mine, launch, attacker: sim.actors.get('a')!, victim: sim.actors.get('b')! };
}
const apart = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

describe('chase', () => {
  it.each(['zoro', 'goku', 'naruto', 'vegeta', 'guts', 'killua'] as FighterId[])(
    '%s chases the rush finisher from the ground and the air light connects', fighter => {
      const fight = bout(fighter);
      fight.launch();
      fight.step(.1);
      expect(fight.sim.getPlayer('a')!.grounded, 'from the ground').toBe(true);
      fight.input({ dash: true });
      fight.tick();
      const [chase] = fight.mine('chase');
      expect(chase, 'the dash is a chase').toBeDefined();
      expect(chase.targetId).toBe('b');
      expect(fight.sim.getPlayer('a')!.dashKind).toBe('forward');
      fight.step(CHASE_SECONDS);
      const a = fight.sim.getPlayer('a')!, b = fight.sim.getPlayer('b')!;
      expect(a.grounded, 'up with them').toBe(false);
      expect(apart(a, chase.endpoint!), 'where the chase said it would arrive').toBeLessThan(.25);
      expect(apart(a, b), 'at striking distance').toBeLessThan(1.8);
      const before = fight.mine('hit').length;
      fight.input({ attack: 'light' });
      fight.step(.6);
      const follow = fight.mine('hit').slice(before);
      expect(follow.length, 'the air light connects').toBeGreaterThan(0);
      expect(follow[0].reaction, 'and keeps them up').toBe('launched');
    });

  it('chases any launch of the fighter\'s own, not only the rush\'s', () => {
    const fight = bout('zoro');
    fight.input({ attack: 'heavy' });
    fight.step(MOVES.zoro.heavy.contacts[0] + .2);
    expect(fight.sim.getPlayer('b')!.action).toBe('launched');
    fight.input({ dash: true });
    fight.step(.05);
    expect(fight.mine('chase')).toHaveLength(1);
  });

  it('is a plain dash once the window has shut', () => {
    const fight = bout('zoro');
    fight.launch();
    fight.step(CHASE_WINDOW + .25);
    fight.input({ dash: true });
    fight.step(CHASE_SECONDS);
    expect(fight.mine('chase'), 'too late to chase').toHaveLength(0);
    expect(fight.sim.getPlayer('a')!.grounded, 'a ground dash').toBe(true);
  });

  it('goes forward whatever the stick says, for a dash\'s stamina and a dash\'s evade', () => {
    const fight = bout('zoro');
    fight.launch();
    fight.step(.1);
    const stamina = fight.sim.getPlayer('a')!.stamina;
    fight.input({ dash: true, moveZ: -1 });
    fight.tick();
    expect(fight.mine('chase')).toHaveLength(1);
    expect(fight.sim.getPlayer('a')!.dashKind).toBe('forward');
    expect(fight.sim.getPlayer('a')!.stamina).toBeCloseTo(stamina - 20, 5);
    expect(fight.attacker.evadeUntil).toBeGreaterThan(fight.sim.serverTime);
  });

  it('holds a follow-up pressed during the chase until it arrives', () => {
    const fight = bout('zoro');
    fight.launch();
    fight.step(.1);
    fight.input({ dash: true });
    fight.step(.05);
    const chase = fight.mine('chase')[0];
    fight.input({ attack: 'light' });
    fight.step(.6);
    const follow = fight.mine('cast').find(e => e.serverTime > chase.serverTime)!;
    expect(follow, 'the follow-up comes out').toBeDefined();
    expect(follow.serverTime - chase.serverTime, 'once the chase has arrived, not halfway there')
      .toBeGreaterThanOrEqual(CHASE_SECONDS - 1 / 60 - 1e-9);
    expect(fight.mine('hit').filter(e => e.serverTime > chase.serverTime).length, 'and it lands').toBeGreaterThan(0);
  });

  it('will not chase across the arena', () => {
    const fight = bout('ichigo', CHASE_RANGE + 3);
    fight.input({ attack: 'special' });
    fight.step(MOVES.ichigo.special.contacts[0] + .6);
    expect(fight.sim.getPlayer('b')!.action).toBe('launched');
    fight.input({ dash: true });
    fight.step(.1);
    expect(fight.mine('chase')).toHaveLength(0);
  });

  it('leaves a standing forward dash covering exactly what it always did', () => {
    const fight = bout('zoro');
    fight.launch();
    fight.step(CHASE_WINDOW + 2.5);
    const from = fight.sim.getPlayer('a')!.z;
    fight.input({ dash: true, yaw: Math.PI });
    fight.step(.4);
    expect(from - fight.sim.getPlayer('a')!.z).toBeCloseTo(5.277, 2);
  });
});

describe('chase under rollback', () => {
  it.each(['zoro', 'naruto'] as FighterId[])('%s replays a chase and its follow-up under WAN batching without a correction', fighter => {
    const server = new ArenaSimulation({ trainingBot: false, seed: 4 });
    server.addPlayer('me', fighter, 'Me', false, { x: 0, y: 0, z: 0 });
    server.addPlayer('foe', 'goku', 'Foe', false, { x: 0, y: 0, z: 1.6 });
    const prediction = new Prediction(), queue = new InputQueue();
    prediction.start('me', server.snapshot(true, true));
    const upload: { tick: number; input: PlayerInput }[] = [], download: { tick: number; s: GameSnapshot }[] = [];
    let maxCorrection = 0, chased = false, finisherAt = -1;
    const local = () => (prediction as unknown as { sim: ArenaSimulation }).sim;
    try {
      for (let tick = 0; tick < 280; tick++) {
        const casts = local().actors.get('me')!.state;
        if (finisherAt < 0 && casts.action === 'light' && casts.chain === 3) finisherAt = tick;
        const input: PlayerInput = { seq: tick, moveX: 0, moveZ: 0, yaw: 0, targetId: 'foe',
          attack: finisherAt < 0 && tick % 4 === 0 ? 'light' : finisherAt >= 0 && tick === finisherAt + 45 ? 'light' : undefined,
          dash: finisherAt >= 0 && tick === finisherAt + 30 };
        prediction.submit(input); upload.push({ tick: tick + 9, input });
        while (upload.length && upload[0].tick <= tick) queue.push(upload.shift()!.input);
        const next = queue.take(); if (next) server.submitInput('me', next);
        server.step(1 / 60, new Set(next ? [] : ['me']));
        if (tick % 2 === 0) {
          const snapshot = server.snapshot(true, true);
          if (snapshot.events.some(e => e.kind === 'chase' && e.actorId === 'me')) chased = true;
          download.push({ tick: tick + 9, s: snapshot });
        }
        while (download.length && download[0].tick <= tick) {
          const before = prediction.diagnostics.position!; prediction.reconcile(download.shift()!.s); const after = prediction.diagnostics.position!;
          maxCorrection = Math.max(maxCorrection, Math.hypot(before.x - after.x, before.y - after.y, before.z - after.z));
        }
      }
      expect(chased, 'the server chased').toBe(true);
      expect(maxCorrection).toBeLessThan(.001);
    } finally { prediction.stop(); server.dispose(); }
  });
});
