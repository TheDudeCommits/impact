import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { BLOCK_STUN, DASH_RISE, DASH_SECONDS, HITSTOP, MOVES, PLAYER_RADIUS, PUSH_RADIUS, dashShape } from '../src/game/moves';
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
  input('a', { targetId: 'b' }); input('b', { targetId: 'a' });
  return { sim, input, step, hold, drain };
}

describe('a fighter has weight', () => {
  const run = (seconds: number) => {
    const sim = new ArenaSimulation({ trainingBot: false });
    sim.addPlayer('a', 'goku', 'A', false, { x: 0, y: 0, z: 0 });
    let seq = 0;
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      sim.submitInput('a', { seq: seq++, moveX: 0, moveZ: 1, yaw: 0 });
      sim.step();
    }
    return sim;
  };

  it('ramps up to speed instead of snapping to it', () => {
    const firstFrame = run(1 / 60).getPlayer('a')!.z;
    expect(firstFrame).toBeGreaterThan(0);
    expect(firstFrame, 'a single tick is not a full stride').toBeLessThan(7.5 / 60 * .4);
    const early = run(.2).getPlayer('a')!.z, later = run(.4).getPlayer('a')!.z;
    expect((later - early) / .2, 'at speed by 0.2s').toBeGreaterThan(7.2);
  });

  it('takes a moment to stop, and stops', () => {
    const sim = run(.5);
    const moving = sim.getPlayer('a')!.z;
    let seq = 1000;
    sim.submitInput('a', { seq: seq++, moveX: 0, moveZ: 0, yaw: 0 });
    sim.step();
    const afterOneFrame = sim.getPlayer('a')!.z;
    expect(afterOneFrame, 'a released stick is not a handbrake').toBeGreaterThan(moving);
    for (let i = 0; i < 30; i++) { sim.submitInput('a', { seq: seq++, moveX: 0, moveZ: 0, yaw: 0 }); sim.step(); }
    const stopped = sim.getPlayer('a')!.z;
    sim.submitInput('a', { seq: seq++, moveX: 0, moveZ: 0, yaw: 0 });
    sim.step();
    expect(sim.getPlayer('a')!.z, 'and it does come to rest').toBeCloseTo(stopped, 6);
  });
});

describe('a blocked hit is something both fighters feel', () => {
  it('shoves the defender, shoves the attacker back less, and freezes both', () => {
    const { sim, input, hold } = bout('zoro', 'goku', 1.9);
    hold('b', { guard: true, targetId: 'a' }, .6);
    input('a', { attack: 'light', targetId: 'b' });
    hold('b', { guard: true, targetId: 'a' }, MOVES.zoro.light.contacts[0] + .02);
    const contact = { a: sim.getPlayer('a')!.z, b: sim.getPlayer('b')!.z };
    let frozen = false;
    for (let i = 0; i < 4; i++) {
      hold('b', { guard: true, targetId: 'a' }, 1 / 60);
      frozen ||= !!(sim.getPlayer('a')!.hitstop && sim.getPlayer('b')!.hitstop);
    }
    expect(frozen, 'both stop dead for a moment').toBe(true);
    hold('b', { guard: true, targetId: 'a' }, .1);
    const a = sim.getPlayer('a')!, b = sim.getPlayer('b')!;
    const gave = b.z - contact.b, rebound = contact.a - a.z;
    expect(gave, 'the guard gives ground').toBeGreaterThan(.03);
    expect(rebound, 'and the swing comes back at you').toBeGreaterThan(.01);
    expect(gave, 'the defender gives more than the attacker').toBeGreaterThan(rebound);
  });

  it('holds the defender in their guard and stops them swinging back', () => {
    const { sim, input, hold, step } = bout('zoro', 'goku', 1.9);
    hold('b', { guard: true, targetId: 'a' }, .6);
    input('a', { attack: 'light', targetId: 'b' });
    hold('b', { guard: true, targetId: 'a' }, MOVES.zoro.light.contacts[0] + .02);
    expect(sim.getPlayer('b')!.action, 'still a guard, not a hurt').toBe('guard');
    input('b', { attack: 'light', targetId: 'a', guard: false });
    step(.02);
    expect(sim.getPlayer('b')!.action, 'no answer while held').toBe('guard');
    step(BLOCK_STUN.light);
    input('b', { attack: 'light', targetId: 'a', guard: false });
    step(.05);
    expect(sim.getPlayer('b')!.action, 'and then they are free').toBe('light');
  });

  it('still breaks a guard rather than holding it', () => {
    const { sim, input, hold, drain } = bout('zoro', 'goku', 1.9);
    (sim as unknown as { actors: Map<string, { state: { stamina: number } }> }).actors.get('b')!.state.stamina = 1;
    hold('b', { guard: true, targetId: 'a' }, .3);
    input('a', { attack: 'light', targetId: 'b' });
    hold('b', { guard: true, targetId: 'a' }, MOVES.zoro.light.contacts[0] + .05);
    expect(drain().some(e => e.kind === 'guard-break')).toBe(true);
    expect(sim.getPlayer('b')!.action).toBe('stun');
  });
});

describe('landing a hit pays', () => {
  const roster: FighterId[] = ['zoro', 'jotaro', 'ichigo', 'kakashi', 'sasuke', 'sanji', 'goku', 'luffy', 'naruto', 'killua', 'dio', 'ace', 'law', 'gojo', 'guts'];

  it('leaves a landed light linking into the next one instead of handing the turn back', () => {
    for (const fighter of roster) {
      const { sim, input, step } = bout(fighter, 'goku', 1.6);
      input('a', { attack: 'light', targetId: 'b' });
      const victim = sim.actors.get('b')!;
      let landed = 0;
      for (let frame = 0; frame < 120 && !landed; frame++) { sim.step(); if (victim.state.hp < 1000) landed = victim.state.hp; }
      expect(landed, `${fighter} connects`).toBeGreaterThan(0);
      input('a', { attack: 'light', targetId: 'b' });
      let recovered = false, second = false;
      for (let frame = 0; frame < 120 && !second; frame++) {
        sim.step();
        if (sim.serverTime >= victim.stunUntil) recovered = true;
        if (victim.state.hp < landed) second = true;
      }
      expect(second, `${fighter} links`).toBe(true);
      expect(recovered, `${fighter}'s target never gets a turn between the two`).toBe(false);
    }
  });

  it('lets a blocked light cancel into a heavy instead of locking the attacker in recovery', () => {
    const { sim, input, hold } = bout('zoro', 'goku', 1.9);
    hold('b', { guard: true, targetId: 'a' }, .6);
    input('a', { attack: 'light', targetId: 'b' });
    hold('b', { guard: true, targetId: 'a' }, MOVES.zoro.light.contacts[0] + .02);
    expect(sim.snapshot().events.some(e => e.kind === 'blocked')).toBe(true);
    input('a', { attack: 'heavy', targetId: 'b' });
    hold('b', { guard: true, targetId: 'a' }, .15);
    expect(sim.getPlayer('a')!.action, 'the exchange continues').toBe('heavy');
  });

  it('holds the fighter who was hit in the freeze longer than the one who threw it', () => {
    const { sim, input } = bout('zoro', 'goku', 1.6);
    input('a', { attack: 'heavy', targetId: 'b' });
    const attacker = sim.actors.get('a')!, victim = sim.actors.get('b')!;
    for (let frame = 0; frame < 120 && victim.state.hp === 1000; frame++) sim.step();
    expect(victim.state.hp).toBeLessThan(1000);
    expect(victim.hitstopUntil - sim.serverTime).toBeGreaterThan(HITSTOP.heavy * .9);
    expect(attacker.hitstopUntil, 'the attacker is out of it first').toBeLessThan(victim.hitstopUntil);
  });

  it('keeps an eight-hit barrage on its authored rhythm', () => {
    const { sim, input, step, drain } = bout('jotaro', 'goku', 2);
    const barrage = MOVES.jotaro.special;
    input('a', { attack: 'special', targetId: 'b' });
    step(barrage.duration + .4);
    const hits = drain().filter(e => e.kind === 'hit' && e.actorId === 'a');
    expect(hits).toHaveLength(8);
    const authored = barrage.contacts[1] - barrage.contacts[0];
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i].serverTime - hits[i - 1].serverTime, `ORA hit ${i + 1} on time`).toBeLessThan(authored * 1.4);
    }
  });
});

describe('a hit knows which side it landed on', () => {
  it('reports a hit taken in the back', () => {
    const sim = new ArenaSimulation({ trainingBot: false });
    sim.addPlayer('a', 'zoro', 'A', false, { x: 0, y: 0, z: 0 });
    sim.addPlayer('b', 'goku', 'B', false, { x: 0, y: 0, z: 1.6 });
    sim.actors.get('b')!.state.yaw = 0;
    sim.submitInput('b', { seq: 1, moveX: 0, moveZ: 0, yaw: 0, targetId: 'a' });
    sim.submitInput('a', { seq: 2, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', attack: 'light' });
    const events: CombatEvent[] = [];
    for (let i = 0; i < 60; i++) { sim.step(); events.push(...sim.snapshot().events); }
    const hit = events.find(e => e.kind === 'hit' && e.targetId === 'b');
    expect(hit?.fromBehind, 'struck from behind').toBe(true);
  });
});

describe('two bodies settle instead of shoving', () => {
  it('walks two fighters together without a frame-by-frame fight over the gap', () => {
    const sim = new ArenaSimulation({ trainingBot: false });
    sim.addPlayer('a', 'zoro', 'A', false, { x: 0, y: 0, z: 0 });
    sim.addPlayer('b', 'goku', 'B', false, { x: 0, y: 0, z: 3 });
    let seq = 0;
    const gaps: number[] = [];
    for (let i = 0; i < 180; i++) {
      sim.submitInput('a', { seq: seq++, moveX: 0, moveZ: 1, yaw: 0 });
      sim.submitInput('b', { seq: seq++, moveX: 0, moveZ: -1, yaw: Math.PI });
      sim.step();
      const a = sim.getPlayer('a')!, b = sim.getPlayer('b')!;
      gaps.push(Math.hypot(b.x - a.x, b.z - a.z));
    }
    const settled = gaps.slice(-60);
    expect(Math.max(...settled)).toBeLessThan(PUSH_RADIUS * 2 + .05);
    const jitter = Math.max(...settled.slice(1).map((gap, i) => Math.abs(gap - settled[i])));
    expect(jitter, 'no ping-pong').toBeLessThan(.06);
  });
});

describe('a dash is a burst with a shape', () => {
  it('ramps instead of switching on, and covers the same ground', () => {
    const dt = 1 / 60;
    let square = 0, shaped = 0, worst = 0, previous = 0;
    for (let t = dt; t <= DASH_SECONDS + 1e-9; t += dt) {
      const speed = 24 * dashShape(t / DASH_SECONDS);
      square += 24 * dt; shaped += speed * dt;
      worst = Math.max(worst, Math.abs(speed - previous));
      previous = speed;
    }
    expect(Math.abs(shaped - square) / square, 'the same ground').toBeLessThan(.03);
    expect(worst, `the largest one-tick change is ${worst.toFixed(1)} m/s`).toBeLessThan(14);
    expect(dashShape(.02)).toBeLessThan(dashShape(.5));
    expect(dashShape(.98)).toBeLessThan(dashShape(.5));
  });

  it('joins a run at both ends without changing the ground it covers', () => {
    const dt = 1 / 60, ticks = Math.ceil(DASH_SECONDS / dt);
    const dash = (running: boolean) => {
      const sim = new ArenaSimulation({ trainingBot: false });
      sim.addPlayer('a', 'goku', 'A', false, { x: 0, y: 0, z: 0 });
      let seq = 0;
      const press = (more: Partial<PlayerInput> = {}) =>
        sim.submitInput('a', { seq: seq++, moveX: 0, moveZ: running ? 1 : 0, yaw: 0, ...more });
      const lead = 60, z: number[] = [];
      for (let i = 0; i < lead; i++) { press(); sim.step(); z.push(sim.getPlayer('a')!.z); }
      press({ dash: true }); sim.step(); z.push(sim.getPlayer('a')!.z);
      for (let i = 0; i < ticks + 1; i++) { press(); sim.step(); z.push(sim.getPlayer('a')!.z); }
      sim.dispose();
      const speed = z.map((v, i) => (i ? v - z[i - 1] : v) / dt);
      return { before: speed[lead - 1], during: speed.slice(lead, lead + ticks), after: speed[lead + ticks],
        travel: z[lead + ticks - 1] - z[lead - 1] };
    };
    const standing = dash(false), running = dash(true);
    expect(standing.travel, 'a standing dash covers what it always did').toBeCloseTo(5.277, 2);
    for (let k = 0; k < ticks; k++) expect(standing.during[k]).toBeCloseTo(24 * dashShape(k * dt / DASH_SECONDS), 6);
    expect(Math.abs(running.travel - standing.travel) / standing.travel, `running ${running.travel.toFixed(3)} m against standing ${standing.travel.toFixed(3)}`).toBeLessThan(.02);
    expect(running.before, 'at full sprint when the dash is pressed').toBeCloseTo(7.5, 3);
    const rise = running.during.slice(0, Math.ceil(DASH_RISE * ticks));
    for (const [k, v] of rise.entries()) expect(v, `rise tick ${k} at ${v.toFixed(2)} m/s`).toBeGreaterThanOrEqual(running.before - 1e-6);
    expect(Math.abs(running.after - running.during[ticks - 1]), 'no step out of the dash').toBeLessThan(.5);
  });
});
