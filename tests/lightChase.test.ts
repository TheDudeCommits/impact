import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { Prediction } from '../src/game/prediction';
import { InputQueue } from '../src/server/InputQueue';
import { CHASE_SECONDS, LAUNCH_HOLD_RANGE, LIGHT_CHASE_WINDOW, MOVES } from '../src/game/moves';
import type { CombatEvent, FighterId, GameSnapshot, PlayerInput } from '../src/game/types';

function bout(fighter: FighterId = 'zoro', gap = 1.6, other: FighterId = 'goku') {
  const sim = new ArenaSimulation({ trainingBot: false, seed: 9 });
  sim.addPlayer('a', fighter, 'A', false, { x: 0, y: 0, z: 0 });
  sim.addPlayer('b', other, 'B', false, { x: 0, y: 0, z: gap });
  let seq = 0;
  const input = (more: Partial<PlayerInput> = {}) => sim.submitInput('a', { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', ...more });
  const events: CombatEvent[] = [];
  const lights: { at: number; chain: number; grounded: boolean; victimAirborne: boolean; apart: number }[] = [];
  const tick = () => {
    sim.step();
    const fresh = sim.snapshot(true).events;
    events.push(...fresh);
    const a = sim.getPlayer('a')!, b = sim.getPlayer('b')!;
    for (const e of fresh) if (e.kind === 'cast' && e.actorId === 'a' && e.slot === 'light') {
      lights.push({ at: e.serverTime, chain: e.chain!, grounded: a.grounded, victimAirborne: !b.grounded, apart: Math.hypot(a.x - b.x, a.z - b.z) });
    }
  };
  const step = (seconds: number, each?: (frame: number) => void) => { for (let i = 0; i < Math.round(seconds * 60); i++) { each?.(i); tick(); } };
  const mine = (kind: CombatEvent['kind']) => events.filter(e => e.kind === kind && e.actorId === 'a');
  return { sim, input, tick, step, events, lights, mine, attacker: sim.actors.get('a')!, victim: sim.actors.get('b')! };
}
const mash = (fight: ReturnType<typeof bout>, seconds: number) => fight.step(seconds, i => { if (i % 4 === 0) fight.input({ attack: 'light' }); });
const mashThenTime = (fight: ReturnType<typeof bout>, seconds: number, after = .2) => {
  let landed = -1;
  fight.step(seconds, i => {
    if (landed < 0 && fight.mine('hit').some(e => e.chain === 3)) landed = i;
    if (landed < 0) { if (i % 4 === 0) fight.input({ attack: 'light' }); }
    else if (i - landed >= after * 60 && (i - landed - after * 60) % 15 === 0) fight.input({ attack: 'light' });
  });
};

describe('the chase on the light button', () => {
  it.each(['zoro', 'goku', 'naruto', 'vegeta', 'guts', 'killua', 'luffy', 'sanji'] as FighterId[])(
    '%s: mashing light plays the string but never chases - it waits under the airborne victim', fighter => {
      const fight = bout(fighter);
      mash(fight, 3.4);
      const hits = fight.mine('hit');
      const finisher = hits.find(e => e.chain === 3)!;
      expect(finisher?.reaction, 'the finisher launches').toBe('launched');
      expect([...new Set(hits.filter(e => e.serverTime <= finisher.serverTime).map(e => e.chain))]).toEqual([0, 1, 2, 3]);
      expect(fight.mine('chase'), 'a mashed light is no chase').toEqual([]);
      const under = fight.lights.filter(l => l.at > finisher.serverTime && l.grounded && l.victimAirborne && l.apart <= LAUNCH_HOLD_RANGE && l.chain === 0);
      expect(under, 'no light swung at the air under them').toEqual([]);
    });
  it.each(['zoro', 'goku', 'naruto', 'vegeta', 'guts', 'killua', 'luffy', 'sanji'] as FighterId[])(
    '%s: a timed light after the mashed string chases, the air string connects, and nothing swings under the victim', fighter => {
      const fight = bout(fighter);
      mashThenTime(fight, 3.4);
      const hits = fight.mine('hit');
      const finisher = hits.find(e => e.chain === 3)!;
      expect(finisher?.reaction, 'the finisher launches').toBe('launched');
      const chases = fight.mine('chase');
      expect(chases, 'one chase').toHaveLength(1);
      expect(chases[0].slot, 'thrown by the light button').toBe('light');
      expect(chases[0].serverTime).toBeGreaterThan(finisher.serverTime);
      expect(chases[0].serverTime - finisher.serverTime).toBeLessThan(.45);
      const air = hits.filter(e => e.serverTime > chases[0].serverTime);
      expect(air.length, 'the air string connects more than once').toBeGreaterThanOrEqual(2);
      expect(air.slice(0, 2).every(e => e.reaction === 'launched'), 'and keeps them up').toBe(true);
      const under = fight.lights.filter(l => l.at > finisher.serverTime && l.grounded && l.victimAirborne && l.apart <= LAUNCH_HOLD_RANGE && l.chain === 0);
      expect(under, 'no light swung at the air under them').toEqual([]);
    });

  it.each(['zoro', 'ichigo', 'goku', 'vegeta'] as FighterId[])('%s: a light after a launching heavy is the chase, and lands in the air', fighter => {
    const fight = bout(fighter);
    fight.input({ attack: 'heavy' });
    let pressed = false;
    fight.step(3, () => {
      const launched = fight.mine('hit').some(e => e.slot === 'heavy' && e.reaction === 'launched');
      if (launched && !pressed) { fight.input({ attack: 'light' }); pressed = true; }
    });
    const heavy = fight.mine('hit').find(e => e.slot === 'heavy')!;
    expect(heavy?.reaction, `${fighter}'s heavy launches`).toBe('launched');
    const [chase] = fight.mine('chase');
    expect(chase?.slot, 'the light is the chase').toBe('light');
    const follow = fight.mine('hit').filter(e => e.slot === 'light' && e.serverTime > chase.serverTime);
    expect(follow.length, 'and its light connects').toBeGreaterThan(0);
    expect(fight.lights[0].grounded, 'thrown from the air').toBe(false);
  });

  it('chases on an empty bar: a chase is never refused for stamina, and spends what is left', () => {
    const fight = bout('zoro');
    let landed = -1;
    fight.step(4, i => {
      if (!fight.mine('hit').some(e => e.chain === 3)) fight.attacker.state.stamina = Math.min(fight.attacker.state.stamina, 6);
      else if (landed < 0) landed = i;
      if (landed < 0 ? i % 4 === 0 : (i - landed) % 15 === 12) fight.input({ attack: 'light' });
    });
    const finisher = fight.mine('hit').find(e => e.chain === 3)!;
    expect(finisher?.reaction, 'the finisher launches').toBe('launched');
    const [chase] = fight.mine('chase');
    expect(chase?.slot, 'the light is still the chase').toBe('light');
    expect(fight.mine('rejected').filter(e => e.reason === 'stamina'), 'and nothing is refused for stamina').toEqual([]);
    expect(fight.mine('hit').filter(e => e.serverTime > chase.serverTime).length, 'the air string lands').toBeGreaterThan(0);
    expect(fight.lights.filter(l => l.at > finisher.serverTime && l.grounded && l.victimAirborne && l.apart <= LAUNCH_HOLD_RANGE), 'nothing swung under them').toEqual([]);
  });

  it('still refuses a plain dash that the bar cannot pay for', () => {
    const fight = bout('zoro', 6);
    fight.step(.2);
    fight.attacker.state.stamina = 10;
    fight.input({ dash: true });
    fight.step(.05);
    expect(fight.sim.getPlayer('a')!.action, 'no chase to go on, and 10 is not a dash').not.toBe('dash');
    fight.step(.3);
    fight.attacker.state.stamina = 30;
    fight.input({ dash: true });
    fight.step(.05);
    expect(fight.sim.getPlayer('a')!.action).toBe('dash');
  });

  it('holds a light pressed after the window while the victim is still up, and chases nothing', () => {
    const fight = bout('ace');
    let lateAt = -1, upAtPress = false;
    fight.step(3, i => {
      if (!fight.mine('cast').some(e => e.chain === 3) && i % 4 === 0) fight.input({ attack: 'light' });
      const blow = fight.mine('hit').find(e => e.chain === 3);
      if (blow && lateAt < 0 && fight.sim.serverTime >= blow.serverTime + LIGHT_CHASE_WINDOW + .15) {
        upAtPress = !fight.sim.getPlayer('b')!.grounded;
        fight.input({ attack: 'light' }); lateAt = fight.sim.serverTime;
      }
    });
    expect(lateAt).toBeGreaterThan(0);
    expect(upAtPress, 'pressed while they were still up').toBe(true);
    expect(fight.mine('chase'), 'the window has shut').toHaveLength(0);
    expect(fight.lights.filter(l => l.at >= lateAt && l.victimAirborne), 'and nothing is thrown under them').toEqual([]);
  });

  it('keeps the dash as the explicit chase, and does not make a special\'s launch a light chase', () => {
    const fight = bout('law');
    fight.input({ attack: 'special' });
    let pressed = false;
    fight.step(3, () => {
      const launched = fight.mine('hit').some(e => e.slot === 'special' && e.reaction === 'launched');
      if (launched && !pressed) { fight.input({ attack: 'light' }); pressed = true; }
    });
    expect(fight.mine('hit').find(e => e.slot === 'special')?.reaction).toBe('launched');
    expect(fight.mine('chase'), 'a light is not a chase after a special').toHaveLength(0);
    expect(fight.lights.every(l => !l.victimAirborne || !l.grounded), 'and it is not thrown under them').toBe(true);
    const dash = bout('law');
    dash.input({ attack: 'special' });
    let dashed = false;
    dash.step(3, () => {
      const launched = dash.mine('hit').some(e => e.slot === 'special' && e.reaction === 'launched');
      if (launched && !dashed) { dash.input({ dash: true }); dashed = true; }
    });
    expect(dash.mine('chase')).toHaveLength(1);
    expect(dash.mine('chase')[0].slot, 'the dash button threw it').toBeUndefined();
  });

  it('jabs somebody else standing in front instead of chasing or holding', () => {
    const fight = bout('ace');
    let turned = false;
    fight.step(3, i => {
      const blow = fight.mine('hit').find(e => e.chain === 3);
      if (!blow && i % 4 === 0) fight.input({ attack: 'light' });
      if (blow && !turned) {
        turned = true;
        const a = fight.sim.getPlayer('a')!;
        fight.sim.addPlayer('c', 'naruto', 'C', false, { x: a.x + 1.2, y: 0, z: a.z + .3 });
        fight.input({ attack: 'light', yaw: Math.atan2(1.2, .3), targetId: 'c' });
      }
    });
    expect(fight.mine('hit').find(e => e.chain === 3)?.reaction).toBe('launched');
    expect(fight.mine('chase'), 'no chase past the body in front').toHaveLength(0);
    expect(fight.mine('hit').some(e => e.targetId === 'c'), 'C takes the jab').toBe(true);
  });

  it('does not hold a light for a body launched across the arena', () => {
    const fight = bout('ichigo', 12);
    fight.input({ attack: 'special' });
    let pressedAt = -1;
    fight.step(MOVES.ichigo.special.duration + 1, () => {
      const launched = fight.mine('hit').some(e => e.slot === 'special' && e.reaction === 'launched');
      if (launched && pressedAt < 0 && !fight.attacker.cast) { fight.input({ attack: 'light' }); pressedAt = fight.sim.serverTime; }
    });
    expect(pressedAt).toBeGreaterThan(0);
    expect(fight.lights).toHaveLength(1);
    expect(fight.lights[0].victimAirborne, 'still up').toBe(true);
    expect(fight.lights[0].at - pressedAt, 'but far away, so it is thrown at once').toBeLessThan(.05);
  });

  it('lets a skilled bot chase with the light', () => {
    let light = 0;
    for (const fighter of ['sasuke', 'luffy', 'ace'] as FighterId[]) for (const seed of [3, 8]) {
      const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, seed });
      sim.addPlayer('me', 'zoro', 'Me', false, { x: 0, y: 0, z: 0 });
      sim.addPlayer('bot', fighter, 'Bot', true, { x: 0, y: 0, z: 3 });
      sim.actors.get('bot')!.botSkill = 1;
      let seq = 0;
      for (let i = 0; i < 60 * 30; i++) {
        const me = sim.getPlayer('me')!, bot = sim.getPlayer('bot')!;
        sim.submitInput('me', { seq: seq++, moveX: 0, moveZ: 0, yaw: Math.atan2(bot.x - me.x, bot.z - me.z), targetId: 'bot' });
        sim.step();
        light += sim.snapshot(true).events.filter(e => e.kind === 'chase' && e.actorId === 'bot' && e.slot === 'light').length;
      }
      sim.dispose();
    }
    expect(light).toBeGreaterThan(0);
  });
});

describe('the light chase under rollback', () => {
  it.each(['zoro', 'naruto', 'vegeta'] as FighterId[])('%s replays a mashed launch, a timed chase and the air string under WAN batching without a correction', fighter => {
    const server = new ArenaSimulation({ trainingBot: false, seed: 4 });
    server.addPlayer('me', fighter, 'Me', false, { x: 0, y: 0, z: 0 });
    server.addPlayer('foe', 'goku', 'Foe', false, { x: 0, y: 0, z: 1.6 });
    const prediction = new Prediction(), queue = new InputQueue();
    prediction.start('me', server.snapshot(true, true));
    const upload: { tick: number; input: PlayerInput }[] = [], download: { tick: number; s: GameSnapshot }[] = [];
    let maxCorrection = 0, chased = false, airHits = 0, finisher = -1;
    const local = () => (prediction as unknown as { sim: ArenaSimulation }).sim;
    try {
      for (let tick = 0; tick < 300; tick++) {
        const s = local().actors.get('me')!.state;
        if (finisher < 0 && s.action === 'light' && s.chain === 3) finisher = tick;
        const pressed = finisher < 0 ? tick % 4 === 0 : tick >= finisher + 24 && (tick - finisher - 24) % 15 === 0;
        const input: PlayerInput = { seq: tick, moveX: 0, moveZ: 0, yaw: 0, targetId: 'foe', attack: pressed ? 'light' : undefined };
        prediction.submit(input); upload.push({ tick: tick + 9, input });
        while (upload.length && upload[0].tick <= tick) queue.push(upload.shift()!.input);
        const next = queue.take(); if (next) server.submitInput('me', next);
        server.step(1 / 60, new Set(next ? [] : ['me']));
        if (tick % 2 === 0) {
          const snapshot = server.snapshot(true, true);
          for (const e of snapshot.events) {
            if (e.kind === 'chase' && e.actorId === 'me' && e.slot === 'light') chased = true;
            if (e.kind === 'hit' && e.actorId === 'me' && chased) airHits++;
          }
          download.push({ tick: tick + 9, s: snapshot });
        }
        while (download.length && download[0].tick <= tick) {
          const before = prediction.diagnostics.position!; prediction.reconcile(download.shift()!.s); const after = prediction.diagnostics.position!;
          maxCorrection = Math.max(maxCorrection, Math.hypot(before.x - after.x, before.y - after.y, before.z - after.z));
        }
      }
      expect(chased, 'the server chased on the light').toBe(true);
      expect(airHits, 'and the air string landed').toBeGreaterThanOrEqual(2);
      expect(maxCorrection).toBeLessThan(.001);
    } finally { prediction.stop(); server.dispose(); }
  });

  it('carries the light-chase window through the checkpoint', () => {
    const fight = bout('zoro');
    mash(fight, 1.6);
    const checkpoint = fight.sim.predictionCheckpoint('a')!;
    expect(checkpoint).toHaveProperty('lightChaseUntil');
    expect(CHASE_SECONDS).toBeGreaterThan(0);
  });
});
