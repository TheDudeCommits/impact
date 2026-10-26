import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { Prediction } from '../src/game/prediction';
import { InputQueue } from '../src/server/InputQueue';
import { CHARGE_BACKSTEP_UNTIL, DASH_THROUGH_PAST, HARD_GAP, MOVES, PUSH_RADIUS, SPACING_PUSH, meleeReach } from '../src/game/moves';
import { moveFor } from '../src/game/awakening';
import type { AttackSlot, CombatEvent, FighterId, GameSnapshot, PlayerInput } from '../src/game/types';

const ROSTER = Object.keys(MOVES) as FighterId[];

function bout(fighter: FighterId, gap: number, options: { stage?: 'galactic-arena'; at?: number; other?: FighterId } = {}) {
  const sim = new ArenaSimulation({ trainingBot: false, seed: 9, stage: options.stage });
  const z = options.at ?? 0;
  sim.addPlayer('a', fighter, 'A', false, { x: 0, y: 0, z });
  sim.addPlayer('b', options.other ?? (fighter === 'goku' ? 'zoro' : 'goku'), 'B', false, { x: 0, y: 0, z: z + gap });
  sim.actors.get('a')!.state.ultimate = 100;
  let seq = 0;
  const input = (more: Partial<PlayerInput> = {}) => sim.submitInput('a', { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', ...more });
  const events: CombatEvent[] = [];
  const step = (seconds: number, each?: (frame: number) => void) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) { each?.(i); sim.step(); events.push(...sim.snapshot(true).events); }
  };
  const mine = (kind: CombatEvent['kind']) => events.filter(e => e.kind === kind && e.actorId === 'a');
  const apart = () => { const a = sim.getPlayer('a')!, b = sim.getPlayer('b')!; return Math.hypot(a.x - b.x, a.z - b.z); };
  const level = () => Math.abs(sim.getPlayer('a')!.y - sim.getPlayer('b')!.y) < .9;
  return { sim, input, step, events, mine, apart, level, attacker: sim.actors.get('a')!, victim: sim.actors.get('b')! };
}

describe('bodies never end a tick inside each other', () => {
  it('holds every pair a metre apart through a mashed string, its chase and the air string, for all sixteen', () => {
    for (const fighter of ROSTER) for (const gap of [1.2, 2.2]) {
      const fight = bout(fighter, gap);
      let closest = Infinity;
      fight.step(4, i => {
        if (i % 4 === 0) fight.input({ attack: 'light' });
        if (fight.level()) closest = Math.min(closest, fight.apart());
      });
      expect(closest, `${fighter} from ${gap} m`).toBeGreaterThanOrEqual(1);
    }
  });

  it('holds them apart through every heavy and ultimate but the iai pass', () => {
    for (const fighter of ROSTER) for (const slot of ['heavy', 'ultimate'] as AttackSlot[]) {
      if (fighter === 'zoro' && slot === 'heavy') continue;
      const fight = bout(fighter, 1.2);
      let closest = Infinity;
      fight.input({ attack: slot });
      fight.step(5, () => { if (fight.level()) closest = Math.min(closest, fight.apart()); });
      expect(closest, `${fighter} ${slot}`).toBeGreaterThanOrEqual(1);
    }
  });

  it('keeps a committed attacker walking into a pinned body out of it', () => {
    for (const fighter of ['luffy', 'zoro', 'kakashi', 'naruto'] as FighterId[]) for (const slot of ['light', 'heavy'] as AttackSlot[]) {
      const sim = new ArenaSimulation({ trainingBot: false, seed: 9, stage: 'galactic-arena' });
      const { halfZ } = sim.bounds;
      sim.addPlayer('a', fighter, 'A', false, { x: 0, y: 0, z: halfZ - 2.2 });
      sim.addPlayer('b', 'goku', 'B', false, { x: 0, y: 0, z: halfZ - .5 });
      let seq = 0, closest = Infinity;
      for (let tick = 0; tick < 150; tick++) {
        sim.submitInput('a', { seq: seq++, moveX: 0, moveZ: 1, yaw: 0, targetId: 'b', attack: tick % 20 === 0 ? slot : undefined });
        sim.step();
        const a = sim.getPlayer('a')!, b = sim.getPlayer('b')!;
        if (Math.abs(a.y - b.y) < .9) closest = Math.min(closest, Math.hypot(a.x - b.x, a.z - b.z));
      }
      expect(closest, `${fighter} ${slot}`).toBeGreaterThanOrEqual(HARD_GAP - 1e-6);
      sim.dispose();
    }
  });

  it('stops an approach with nobody selected at the body in front, instead of driving into it', () => {
    for (const fighter of ['zoro', 'law', 'guts', 'ace'] as FighterId[]) {
      const fight = bout(fighter, 2.2);
      fight.input({ attack: 'light', targetId: null });
      let closest = Infinity;
      fight.step(1, () => { closest = Math.min(closest, fight.apart()); });
      expect(closest, fighter).toBeGreaterThanOrEqual(PUSH_RADIUS * 2 - .02);
      expect(fight.mine('hit').length, `${fighter} still lands`).toBe(1);
    }
  });

  it('ends a chase whose target was stopped on a wall, and the follow-up lands on them there', () => {
    const sim = new ArenaSimulation({ trainingBot: false, seed: 9, stage: 'galactic-arena' });
    const { halfZ } = sim.bounds;
    sim.addPlayer('a', 'luffy', 'A', false, { x: 0, y: 0, z: halfZ - 2.2 });
    sim.addPlayer('b', 'goku', 'B', false, { x: 0, y: 0, z: halfZ - .5 });
    const events: CombatEvent[] = [];
    let seq = 0, highest = 0;
    for (let tick = 0; tick < 150; tick++) {
      sim.submitInput('a', { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', attack: tick % 4 === 0 ? 'light' : undefined });
      sim.step(); events.push(...sim.snapshot(true).events);
      if (events.some(e => e.kind === 'wall-splat')) highest = Math.max(highest, sim.getPlayer('a')!.y);
    }
    expect(events.some(e => e.kind === 'wall-splat' && e.actorId === 'b'), 'the finisher splats them').toBe(true);
    expect(highest, 'the chase does not fly on up to where they would have been').toBeLessThan(1);
    const splat = events.find(e => e.kind === 'wall-splat')!;
    expect(events.some(e => e.kind === 'hit' && e.actorId === 'a' && e.serverTime > splat.serverTime), 'and the follow-up lands on the wall').toBe(true);
    sim.dispose();
  });
});

describe('a multi-blade ultimate holds everybody at its blade length', () => {
  it('eases a body inside Zoro\'s nine blades back out to them, holds his ground, and still lands', () => {
    const spacing = MOVES.zoro.ultimate.spacing!;
    expect(spacing).toBeGreaterThan(2);
    expect(meleeReach('zoro', 'ultimate', MOVES.zoro.ultimate), 'the blow still reaches').toBeGreaterThan(spacing + .5);
    for (const gap of [1.2, 1.8, 3]) {
      const fight = bout('zoro', gap);
      fight.input({ attack: 'ultimate' });
      let previous = fight.apart(), fastest = 0, hitGap = 0;
      const start = fight.sim.getPlayer('a')!;
      fight.step(MOVES.zoro.ultimate.contacts[0] + .1, () => {
        const now = fight.apart();
        fastest = Math.max(fastest, (now - previous) * 60);
        previous = now;
        if (!hitGap && fight.mine('hit').length) hitGap = now;
      });
      expect(fight.mine('hit').length, `from ${gap} m the blow lands`).toBe(1);
      expect(hitGap, `from ${gap} m it lands at blade length`).toBeGreaterThanOrEqual(spacing - .02);
      expect(fastest, 'eased out, not flung').toBeLessThanOrEqual(SPACING_PUSH + .01);
      if (gap < spacing) {
        const now = fight.sim.getPlayer('a')!;
        expect(Math.hypot(now.x - start.x, now.z - start.z), 'Zoro holds his ground').toBeLessThan(.01);
      }
    }
  });
});

describe('charge-in moves are charged at a distance and land on arrival', () => {
  const charges: [FighterId, number][] = [['naruto', MOVES.naruto.heavy.contacts[0]], ['sasuke', MOVES.sasuke.heavy.contacts[0]], ['kakashi', MOVES.kakashi.heavy.contacts[0]]];

  it.each(charges)('%s slides back from a body on top of it during the early charge, then drives in onto the blow', (fighter, contact) => {
    const move = MOVES[fighter].heavy;
    expect(move.chargeIn, `${fighter}'s heavy is a charge-in`).toBeGreaterThan(1.5);
    const fight = bout(fighter, 1.2);
    fight.input({ attack: 'heavy' });
    let widest = 0, hitGap = 0;
    const from = fight.sim.getPlayer('a')!;
    fight.step(contact + .3, () => {
      widest = Math.max(widest, fight.apart());
      if (!hitGap && fight.mine('hit').length) hitGap = fight.apart();
    });
    const hitAt = fight.mine('hit')[0]?.serverTime - fight.mine('cast')[0].serverTime;
    expect(widest, 'opens the gap to charge from').toBeGreaterThanOrEqual(move.chargeIn! - .05);
    expect(fight.mine('hit'), 'and the blow lands').toHaveLength(1);
    expect(hitAt, 'on the authored contact').toBeGreaterThanOrEqual(contact - 1e-9);
    expect(hitAt).toBeLessThanOrEqual(contact + 1 / 60 + 1e-9);
    expect(hitGap, 'at striking distance, not inside them').toBeGreaterThanOrEqual(PUSH_RADIUS * 2 - .02);
    expect(hitGap).toBeLessThanOrEqual(meleeReach(fighter, 'heavy', move) + .02);
    const at = fight.sim.getPlayer('a')!;
    expect(Math.abs(at.x - from.x)).toBeLessThan(.01);
  });

  it.each(charges)('%s keeps its early charge planted once the slide is over, and does not slide at all from its distance', (fighter) => {
    const move = MOVES[fighter].heavy;
    const near = bout(fighter, 1.2);
    near.input({ attack: 'heavy' });
    const positions: number[] = [];
    near.step(fighter === 'naruto' ? move.lungeDelay! : move.contacts[0] - .05, () => positions.push(near.sim.getPlayer('a')!.z));
    for (let i = 2; i < positions.length; i++) {
      expect(Math.abs((positions[i] - positions[i - 1]) - (positions[i - 1] - positions[i - 2])) * 3600, 'eased').toBeLessThan(96);
    }
    const far = bout(fighter, move.chargeIn! + .3);
    far.input({ attack: 'heavy' });
    let backed = 0;
    far.step(CHARGE_BACKSTEP_UNTIL + .1, () => { backed = Math.min(backed, far.sim.getPlayer('a')!.z); });
    expect(backed, 'nothing to open').toBeGreaterThan(-.001);
  });

  it('yields the slide back to a held stick', () => {
    const fight = bout('sasuke', 1.2);
    fight.input({ attack: 'heavy', moveX: 1 });
    fight.step(.25, () => fight.input({ moveX: 1 }));
    const p = fight.sim.getPlayer('a')!;
    expect(p.x, 'walked where the stick said').toBeGreaterThan(1);
    expect(p.z, 'and did not slide back').toBeGreaterThan(-.05);
  });

  it('leaves the fox\'s Crushing Fang as it was', () => {
    expect(moveFor('naruto', 'heavy', true).chargeIn).toBeUndefined();
    expect(moveFor('naruto', 'heavy', false).chargeIn).toBe(MOVES.naruto.heavy.chargeIn);
  });
});

describe('an iai draw ends past the body it cuts', () => {
  const contact = MOVES.zoro.heavy.contacts[0];
  it.each([1.2, 2.4, 3.6, 4.5])('Lion\'s Song from %s m dashes past them, cuts them on the way and lands on the authored contact', gap => {
    const fight = bout('zoro', gap);
    fight.input({ attack: 'heavy' });
    fight.step(contact + .1);
    const a = fight.sim.getPlayer('a')!, b = fight.sim.getPlayer('b')!;
    expect(fight.mine('hit'), 'the cut lands').toHaveLength(1);
    expect(fight.mine('hit')[0].reaction).toBe('launched');
    const hitAt = fight.mine('hit')[0].serverTime - fight.mine('cast')[0].serverTime;
    expect(hitAt, 'on the authored contact').toBeGreaterThanOrEqual(contact - 1e-9);
    expect(hitAt).toBeLessThanOrEqual(contact + 1 / 60 + 1e-9);
    const ahead = Math.sin(a.yaw) * (b.x - a.x) + Math.cos(a.yaw) * (b.z - a.z);
    expect(ahead, 'the victim is behind Zoro').toBeLessThan(-DASH_THROUGH_PAST + .2);
    expect(Math.hypot(a.x - b.x, a.z - b.z), 'and clear of him').toBeGreaterThan(PUSH_RADIUS * 2);
    const release = fight.mine('release')[0];
    expect(Math.hypot(release.endpoint!.x - release.origin!.x, release.endpoint!.z - release.origin!.z)).toBeGreaterThan(gap);
    fight.step(.6);
    expect(fight.sim.getPlayer('b')!.z, 'knocked back toward where he set off').toBeLessThan(b.z);
  });

  it('whiffs from across the room rather than cutting from three metres out', () => {
    const fight = bout('zoro', 6);
    fight.input({ attack: 'heavy' });
    fight.step(contact + .3);
    expect(fight.mine('hit')).toHaveLength(0);
    expect(fight.sim.getPlayer('a')!.z, 'but it still dashes').toBeGreaterThan(2);
  });

  it('stops short of a body against the stage bound and cuts into them there', () => {
    const sim = new ArenaSimulation({ trainingBot: false, seed: 9, stage: 'galactic-arena' });
    const { halfZ } = sim.bounds;
    sim.addPlayer('a', 'zoro', 'A', false, { x: 0, y: 0, z: halfZ - 3 });
    sim.addPlayer('b', 'goku', 'B', false, { x: 0, y: 0, z: halfZ - .5 });
    sim.submitInput('a', { seq: 0, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', attack: 'heavy' });
    const events: CombatEvent[] = [];
    for (let i = 0; i < 60; i++) { sim.step(); events.push(...sim.snapshot(true).events); }
    const a = sim.getPlayer('a')!, b = sim.getPlayer('b')!;
    expect(events.some(e => e.kind === 'hit' && e.actorId === 'a')).toBe(true);
    expect(b.z - a.z, 'in front of them, not through the wall').toBeGreaterThan(PUSH_RADIUS * 2 - .05);
    sim.dispose();
  });

  it('is guarded from the side it came from', () => {
    const fight = bout('zoro', 2.4);
    fight.input({ attack: 'heavy' });
    let seq = 1000;
    fight.step(contact + .1, i => { if (i % 10 === 0) fight.sim.submitInput('b', { seq: seq++, moveX: 0, moveZ: 0, yaw: Math.PI, guard: true, targetId: 'a' }); });
    expect(fight.events.some(e => (e.kind === 'blocked' || e.kind === 'just-guard') && e.actorId === 'a'), 'a guard facing him holds').toBe(true);
    expect(fight.mine('hit')).toHaveLength(0);
  });
});

describe('spacing under rollback', () => {
  it.each([['zoro', 'heavy'], ['kakashi', 'heavy'], ['naruto', 'heavy'], ['zoro', 'ultimate']] as [FighterId, AttackSlot][])(
    '%s %s replays under WAN batching without a correction', (fighter, slot) => {
      const server = new ArenaSimulation({ trainingBot: false, seed: 4 });
      server.addPlayer('me', fighter, 'Me', false, { x: 0, y: 0, z: 0 });
      server.addPlayer('foe', 'goku', 'Foe', false, { x: 0, y: 0, z: 1.2 });
      server.actors.get('me')!.state.ultimate = 100;
      const prediction = new Prediction(), queue = new InputQueue();
      prediction.start('me', server.snapshot(true, true));
      const upload: { tick: number; input: PlayerInput }[] = [], download: { tick: number; s: GameSnapshot }[] = [];
      let maxCorrection = 0, hits = 0;
      try {
        for (let tick = 0; tick < 280; tick++) {
          const input: PlayerInput = { seq: tick, moveX: 0, moveZ: 0, yaw: 0, targetId: 'foe', attack: tick === 10 ? slot : undefined };
          prediction.submit(input); upload.push({ tick: tick + 9, input });
          while (upload.length && upload[0].tick <= tick) queue.push(upload.shift()!.input);
          const next = queue.take(); if (next) server.submitInput('me', next);
          server.step(1 / 60, new Set(next ? [] : ['me']));
          if (tick % 2 === 0) {
            const snapshot = server.snapshot(true, true);
            hits += snapshot.events.filter(e => e.kind === 'hit' && e.actorId === 'me').length;
            download.push({ tick: tick + 9, s: snapshot });
          }
          while (download.length && download[0].tick <= tick) {
            const before = prediction.diagnostics.position!; prediction.reconcile(download.shift()!.s); const after = prediction.diagnostics.position!;
            maxCorrection = Math.max(maxCorrection, Math.hypot(before.x - after.x, before.y - after.y, before.z - after.z));
          }
        }
        expect(hits, 'it landed').toBeGreaterThan(0);
        expect(maxCorrection).toBeLessThan(.001);
      } finally { prediction.stop(); server.dispose(); }
    });
});
