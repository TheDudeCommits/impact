import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { Prediction } from '../src/game/prediction';
import { InputQueue } from '../src/server/InputQueue';
import { JUST_GUARD_METER, JUST_GUARD_WINDOW, MOVES, PUSH_RADIUS, VANISH_AIM, VANISH_BEHIND, VANISH_COOLDOWN,
  VANISH_ON_JUST_GUARD } from '../src/game/moves';
import type { CollisionWorld, CombatEvent, FighterId, GameSnapshot, PlayerInput, Vec3 } from '../src/game/types';

function bout(fighter: FighterId = 'zoro', options: ConstructorParameters<typeof ArenaSimulation>[0] = {}, at?: { a: Vec3; b: Vec3 }) {
  const sim = new ArenaSimulation({ trainingBot: false, seed: 9, ...options });
  sim.addPlayer('a', fighter, 'A', false, at?.a ?? { x: 0, y: 0, z: 0 });
  sim.addPlayer('b', 'goku', 'B', false, at?.b ?? { x: 0, y: 0, z: 1.6 });
  let seq = 0;
  const input = (id: string, more: Partial<PlayerInput> = {}) =>
    sim.submitInput(id, { seq: seq++, moveX: 0, moveZ: 0, yaw: id === 'a' ? 0 : Math.PI, targetId: id === 'a' ? 'b' : 'a', ...more });
  const events: CombatEvent[] = [];
  const step = (seconds: number, each?: () => void) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) { each?.(); sim.step(); events.push(...sim.snapshot(true).events); }
  };
  input('a'); input('b');
  const parry = (slot: 'light' | 'heavy' = 'light') => {
    input('a', { attack: slot });
    step(MOVES[fighter][slot].contacts[0] - JUST_GUARD_WINDOW * .5);
    let attackerAtVanish: Vec3 | undefined;
    step(JUST_GUARD_WINDOW * .5 + .07, () => {
      input('b', { guard: true });
      if (!attackerAtVanish && events.some(e => e.kind === 'vanish')) { const a = sim.getPlayer('a')!; attackerAtVanish = { x: a.x, y: a.y, z: a.z }; }
    });
    return attackerAtVanish;
  };
  return { sim, input, step, events, parry, saw: (kind: CombatEvent['kind']) => events.filter(e => e.kind === kind) };
}
const flat = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.z - b.z);

describe('vanish', () => {
  it('is on', () => { expect(VANISH_ON_JUST_GUARD).toBe(true); });

  it('steps behind a melee attacker on a just guard, facing their back, and keeps every parry benefit', () => {
    const fight = bout('zoro');
    const staminaBefore = fight.sim.getPlayer('b')!.stamina;
    fight.parry();
    expect(fight.saw('just-guard'), 'still a parry').toHaveLength(1);
    const [vanish] = fight.saw('vanish');
    expect(vanish, 'and a vanish').toBeDefined();
    expect(vanish.actorId).toBe('b');
    expect(vanish.targetId).toBe('a');
    expect(flat(vanish.origin!, { x: 0, y: 0, z: 1.6 }), 'from where the defender stood').toBeLessThan(.3);
    const a = fight.sim.getPlayer('a')!, b = fight.sim.getPlayer('b')!;
    expect(vanish.endpoint!.z, 'past the attacker').toBeLessThan(a.z);
    expect(flat(vanish.endpoint!, b), 'the body is where the event says').toBeLessThan(.05);
    const bearing = Math.atan2(a.x - b.x, a.z - b.z);
    expect(Math.abs(Math.atan2(Math.sin(bearing - b.yaw), Math.cos(bearing - b.yaw)))).toBeLessThan(.25);
    expect(b.hp).toBe(1000);
    expect(b.stamina, 'no chip, no stamina - the vanish costs a cooldown instead').toBeGreaterThanOrEqual(staminaBefore - 1);
    expect(b.ultimate).toBe(JUST_GUARD_METER);
    expect(a.action).toBe('hurt');
    expect(a.hp).toBe(1000);
  });

  it('lands VANISH_BEHIND behind the attacker, for heavies as well as lights', () => {
    for (const [fighter, slot] of [['zoro', 'light'], ['goku', 'light'], ['guts', 'light'], ['zoro', 'heavy'], ['law', 'heavy']] as const) {
      const fight = bout(fighter);
      const attacker = fight.parry(slot);
      const [vanish] = fight.saw('vanish');
      expect(vanish, `${fighter} ${slot}`).toBeDefined();
      expect(flat(vanish.endpoint!, attacker!), `${fighter} ${slot}`).toBeCloseTo(VANISH_BEHIND, 1);
      expect(flat(vanish.endpoint!, attacker!)).toBeGreaterThanOrEqual(PUSH_RADIUS * 2);
    }
  });

  it('lets the defender punish the back it stepped behind', () => {
    const fight = bout('zoro');
    fight.parry();
    expect(fight.saw('vanish')).toHaveLength(1);
    fight.input('b', { guard: false, yaw: Math.PI });
    fight.input('b', { attack: 'light', yaw: Math.PI });
    fight.step(.5);
    const punish = fight.saw('hit').find(e => e.actorId === 'b');
    expect(punish, 'the punish lands').toBeDefined();
    expect(punish!.fromBehind, 'in the back').toBe(true);
  });

  it('keeps facing that back while the camera catches up, and only that long', () => {
    const fight = bout('zoro');
    fight.parry();
    const facing = fight.sim.getPlayer('b')!.yaw;
    fight.step(VANISH_AIM * .5, () => fight.input('b', { guard: true, yaw: Math.PI }));
    expect(fight.sim.getPlayer('b')!.yaw).toBeCloseTo(facing, 5);
    fight.step(VANISH_AIM, () => fight.input('b', { guard: true, yaw: Math.PI }));
    const yaw = fight.sim.getPlayer('b')!.yaw;
    expect(Math.abs(Math.atan2(Math.sin(yaw - Math.PI), Math.cos(yaw - Math.PI))), 'and then the aim is the player\'s again').toBeLessThan(1e-6);
  });

  it('goes to the side when the stage edge is right behind the attacker', () => {
    const sim = new ArenaSimulation({ stage: 'galactic-arena' });
    const { halfZ } = sim.bounds;
    sim.dispose();
    const fight = bout('zoro', { stage: 'galactic-arena' }, { a: { x: 0, y: 0, z: -halfZ + 1 }, b: { x: 0, y: 0, z: -halfZ + 2.6 } });
    const attacker = fight.parry();
    const [vanish] = fight.saw('vanish');
    expect(vanish, 'a vanish still').toBeDefined();
    const to = vanish.endpoint!;
    expect(Math.abs(to.z), 'inside the stage').toBeLessThanOrEqual(halfZ);
    expect(flat(to, attacker!), 'a body clear of the attacker').toBeGreaterThanOrEqual(PUSH_RADIUS * 2);
    expect(Math.abs(to.x - attacker!.x), 'beside them').toBeGreaterThan(1);
  });

  it('will not step through a wall', () => {
    const wall = -.6;
    const collision: CollisionWorld = {
      move: (_id, p, d) => ({ x: d.x, y: Math.max(-p.y, d.y), z: p.z + d.z < wall + .45 ? Math.max(d.z, wall + .45 - p.z) : d.z }),
      raycast: (from, to) => (from.z - wall) * (to.z - wall) < 0
        ? { x: from.x + (to.x - from.x) * (wall - from.z) / (to.z - from.z), y: from.y, z: wall } : to,
    };
    const fight = bout('zoro', { collision });
    fight.parry();
    const [vanish] = fight.saw('vanish');
    expect(vanish, 'there is room beside them').toBeDefined();
    expect(vanish.endpoint!.z, 'on this side of the wall').toBeGreaterThan(wall);
  });

  it('cools down: a second just guard inside VANISH_COOLDOWN is the plain parry', () => {
    const soon = bout('zoro');
    soon.sim.actors.get('b')!.vanishedAt = soon.sim.serverTime - (VANISH_COOLDOWN - .5);
    soon.parry();
    expect(soon.saw('just-guard')).toHaveLength(1);
    expect(soon.saw('vanish'), 'still cooling down').toHaveLength(0);
    expect(flat(soon.sim.getPlayer('b')!, { x: 0, y: 0, z: 1.6 }), 'and stood its ground').toBeLessThan(.6);
    const later = bout('zoro');
    later.sim.actors.get('b')!.vanishedAt = later.sim.serverTime - (VANISH_COOLDOWN + .1);
    later.parry();
    expect(later.saw('vanish'), 'ready again').toHaveLength(1);
  });

  it('parries a projectile the way it always did', () => {
    const fight = bout('vegeta');
    fight.parry('heavy');
    expect(fight.saw('just-guard').length).toBeGreaterThanOrEqual(1);
    expect(fight.saw('vanish'), 'nobody\'s back to step behind').toHaveLength(0);
    expect(flat(fight.sim.getPlayer('b')!, { x: 0, y: 0, z: 1.6 })).toBeLessThan(.6);
  });
});

describe('vanish under prediction', () => {
  it('snaps the local fighter to where the server put it instead of sliding it there', () => {
    const server = new ArenaSimulation({ trainingBot: false, seed: 5 });
    server.addPlayer('me', 'goku', 'Me', false, { x: 0, y: 0, z: 1.6 });
    server.addPlayer('foe', 'zoro', 'Foe', false, { x: 0, y: 0, z: 0 });
    const prediction = new Prediction(), queue = new InputQueue();
    prediction.start('me', server.snapshot(true, true));
    const lag = 6, upload: { tick: number; input: PlayerInput }[] = [], download: { tick: number; s: GameSnapshot }[] = [];
    const swing = 30, guardAt = swing + Math.round((MOVES.zoro.light.contacts[0] - JUST_GUARD_WINDOW * .5) * 60) - lag - 3;
    let checked = false;
    try {
      for (let tick = 0; tick < 120; tick++) {
        const input: PlayerInput = { seq: tick, moveX: 0, moveZ: 0, yaw: Math.PI, targetId: 'foe', guard: tick >= guardAt && tick < guardAt + 30 };
        prediction.submit(input); upload.push({ tick: tick + lag, input });
        while (upload.length && upload[0].tick <= tick) queue.push(upload.shift()!.input);
        const next = queue.take(); if (next) server.submitInput('me', next);
        server.submitInput('foe', { seq: tick, moveX: 0, moveZ: 0, yaw: 0, targetId: 'me', attack: tick === swing ? 'light' : undefined });
        server.step(1 / 60, new Set(next ? [] : ['me']));
        if (tick % 2 === 0) download.push({ tick: tick + lag, s: server.snapshot(true, true) });
        while (download.length && download[0].tick <= tick) {
          const snapshot = download.shift()!.s;
          prediction.reconcile(snapshot);
          if (snapshot.events.some(e => e.kind === 'vanish' && e.actorId === 'me')) {
            const offset = prediction.diagnostics.offset;
            expect(Math.hypot(offset.x, offset.y, offset.z), 'no correction left to slide out').toBeLessThan(1e-9);
            const shown = prediction.sample(1 / 60, server.getPlayer('me')!)!;
            const vanish = snapshot.events.find(e => e.kind === 'vanish')!;
            expect(flat(shown, vanish.endpoint!), 'drawn at the vanish, not on the way to it').toBeLessThan(.25);
            checked = true;
          }
        }
      }
      expect(checked, 'the parry vanished').toBe(true);
    } finally { prediction.stop(); server.dispose(); }
  });
});
