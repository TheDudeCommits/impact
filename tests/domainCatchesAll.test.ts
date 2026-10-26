import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { MAX_HP, MOVES } from '../src/game/moves';
import { ENEMIES, kitOf } from '../src/survival/enemies';
import { SurvivalGame, PLAYER_ID } from '../src/survival/SurvivalGame';
import type { CollisionWorld, CombatEvent, FighterId, Vec3 } from '../src/game/types';

const DOMAINS: FighterId[] = ['gojo', 'sukuna'];
const at = (distance: number, angle: number): Vec3 => ({ x: Math.sin(angle) * distance, y: 0, z: Math.cos(angle) * distance });

function cast(sim: ArenaSimulation, user: FighterId, seconds = 4.5, during?: (t: number) => void) {
  sim.submitInput(user, { seq: 1, moveX: 0, moveZ: 0, yaw: 0, attack: 'ultimate' });
  const hits: CombatEvent[] = [], frozen = new Set<string>();
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    during?.(sim.serverTime);
    sim.step();
    for (const e of sim.drainEvents()) if (e.kind === 'hit' && e.actorId === user) hits.push(e);
    for (const p of sim.playerStates()) if (p.timeStopped) frozen.add(p.id);
  }
  return { hits, frozen };
}

const WALL = 1.2;
const crosses = (a: Vec3, b: Vec3) => (a.z - WALL) * (b.z - WALL) < 0;
const walled: CollisionWorld = {
  move: (_id, p, d) => {
    const to = { x: p.x + d.x, y: Math.max(0, p.y + d.y), z: p.z + d.z };
    const z = crosses(p, to) ? (p.z > WALL ? WALL + .46 : WALL - .46) : to.z;
    return { x: d.x, y: to.y - p.y, z: z - p.z, grounded: to.y <= 0 };
  },
  raycast: (a, b) => {
    if (!crosses(a, b)) return { ...b };
    const t = (WALL - a.z) / (b.z - a.z);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: WALL };
  },
};

describe.each(DOMAINS)("%s's Domain catches everyone inside it", user => {
  const STOP = MOVES[user].ultimate.timeStop!;
  const CLOSES = MOVES[user].ultimate.contacts[STOP.contact];
  it('a royale or training room: four opponents round him, in front, beside and behind - every one frozen and hurt', () => {
    const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, seed: 3 });
    sim.addPlayer(user, user, user, false, { x: 0, y: 0, z: 0 });
    const ids = ['front', 'left', 'right', 'back'];
    [0, Math.PI / 2, -Math.PI / 2, Math.PI].forEach((angle, i) => sim.addPlayer(ids[i], 'goku', ids[i], false, at(2.6, angle)));
    sim.actors.get(user)!.state.ultimate = 100;
    const { frozen } = cast(sim, user);
    for (const id of ids) {
      expect(frozen.has(id), `${id} frozen`).toBe(true);
      expect(MAX_HP - sim.getPlayer(id)!.hp, `${id} hurt`).toBeGreaterThan(100);
    }
  });

  it('a body whose dash is still evading as it closes is caught once the evasion is spent, if it is still inside', () => {
    const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, seed: 4 });
    sim.addPlayer(user, user, user, false, { x: 0, y: 0, z: 0 });
    sim.addPlayer('anchor', 'goku', 'Anchor', false, at(2.4, 0));
    sim.addPlayer('dasher', 'naruto', 'Dasher', false, at(3, Math.PI / 2));
    sim.actors.get(user)!.state.ultimate = 100;
    let seq = 0;
    const { frozen } = cast(sim, user, 4.5, t => { if (Math.abs(t - (CLOSES - .06)) < 1 / 120) sim.submitInput('dasher', { seq: ++seq, moveX: -1, moveZ: 0, yaw: -Math.PI / 2, dash: true }); });
    expect(frozen.has('dasher')).toBe(true);
    expect(MAX_HP - sim.getPlayer('dasher')!.hp).toBeGreaterThan(100);
  });

  it('a body that dashes out across the ring as it closes gets away: the ring is the warning, and the way out', () => {
    const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, seed: 4 });
    sim.addPlayer(user, user, user, false, { x: 0, y: 0, z: 0 });
    sim.addPlayer('runner', 'naruto', 'Runner', false, at(2.6, Math.PI / 2));
    sim.actors.get(user)!.state.ultimate = 100;
    let seq = 0;
    const { frozen } = cast(sim, user, 4.5, t => { if (Math.abs(t - (CLOSES - .06)) < 1 / 120) sim.submitInput('runner', { seq: ++seq, moveX: 1, moveZ: 0, yaw: Math.PI / 2, dash: true }); });
    expect(frozen.has('runner')).toBe(false);
    expect(sim.getPlayer('runner')!.hp).toBe(MAX_HP);
  });

  it('a body that walks into it while it stands is caught too', () => {
    const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, seed: 5 });
    sim.addPlayer(user, user, user, false, { x: 0, y: 0, z: 0 });
    sim.addPlayer('inside', 'goku', 'Inside', false, at(2.4, 0));
    sim.addPlayer('walker', 'luffy', 'Walker', false, at(STOP.radius + 2.5, Math.PI));
    sim.actors.get(user)!.state.ultimate = 100;
    let seq = 0;
    const { frozen } = cast(sim, user, 4.5, t => { if (t > CLOSES + .05) sim.submitInput('walker', { seq: ++seq, moveX: 0, moveZ: 1, yaw: 0 }); });
    expect(frozen.has('walker')).toBe(true);
    expect(MAX_HP - sim.getPlayer('walker')!.hp).toBeGreaterThan(100);
    expect(MAX_HP - sim.getPlayer('inside')!.hp).toBeGreaterThan(100);
  });

  it('a wall between him and a body inside it is no shelter: the body behind it is frozen and hurt', () => {
    const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, seed: 7, collision: walled });
    sim.addPlayer(user, user, user, false, { x: 0, y: 0, z: 0 });
    sim.addPlayer('open', 'goku', 'Open', false, at(2.4, Math.PI));
    sim.addPlayer('behind', 'luffy', 'Behind', false, at(2.4, 0));
    sim.actors.get(user)!.state.ultimate = 100;
    const { frozen } = cast(sim, user);
    for (const id of ['open', 'behind']) {
      expect(frozen.has(id), `${id} frozen`).toBe(true);
      expect(MAX_HP - sim.getPlayer(id)!.hp, `${id} hurt`).toBeGreaterThan(100);
    }
  });

  it('Last Stand: on the defenders among the raiders (kit-bodied grunts) - every raider inside is frozen and hurt, none outside', () => {
    const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, seed: 6 });
    sim.addPlayer(user, user, user, false, { x: 0, y: 0, z: 0 });
    sim.setTeam(user, 'defenders');
    const kinds = Object.values(ENEMIES).filter(e => e.role === 'fodder').slice(0, 3);
    const inside: string[] = [], outside: string[] = [];
    [0, 1.2, 2.4, 3.6, 4.8].forEach((angle, i) => {
      const id = `siege-${i}`, def = kinds[i % kinds.length];
      sim.addCombatant(id, { enemy: def.id, name: def.name, team: 'horde', kit: kitOf(def), maxHp: 2000, size: def.size, spawn: at(2.4, angle) });
      inside.push(id);
    });
    for (let i = 0; i < 2; i++) {
      const id = `siege-far-${i}`, def = kinds[0];
      sim.addCombatant(id, { enemy: def.id, name: def.name, team: 'horde', kit: kitOf(def), maxHp: 2000, size: def.size, spawn: at(12, i * Math.PI) });
      outside.push(id);
    }
    sim.actors.get(user)!.state.ultimate = 100;
    const { frozen, hits } = cast(sim, user);
    for (const id of inside) {
      expect(frozen.has(id), `${id} frozen`).toBe(true);
      expect(2000 - sim.getPlayer(id)!.hp, `${id} hurt`).toBeGreaterThan(100);
    }
    for (const id of outside) expect(sim.getPlayer(id)!.hp, `${id} untouched`).toBe(2000);
    expect(hits.some(h => h.slot === 'ultimate')).toBe(true);
  });

  it('Arcade Survival: the horde frozen round him is struck, every grunt inside the Domain, and the crowd outside is not', () => {
    const game = new SurvivalGame({ fighter: user, seed: 9, god: true, quiet: true, hunt: false, slowMotion: false });
    try {
      let seq = 0;
      const idle = () => ({ seq: ++seq, moveX: 0, moveZ: 0, yaw: 0 });
      for (let t = 0; t < 60; t++) game.tick(idle());
      const me = game.sim.actors.get(PLAYER_ID)!.state;
      const call = (name: string, ...args: unknown[]) => (game as unknown as Record<string, (...a: unknown[]) => unknown>)[name](...args);
      const h = game.horde as unknown as { isAlive(i: number): boolean; hp: Float32Array; maxHp: Float32Array; x: Float32Array; z: Float32Array };
      const ring = (distance: number, n: number, phase = 0) => Array.from({ length: n }, (_, i) =>
        call('spawnGrunt', 0, { x: me.x + Math.sin(phase + i * Math.PI * 2 / n) * distance, y: 0, z: me.z + Math.cos(phase + i * Math.PI * 2 / n) * distance }, false) as number);
      const near = ring(2.2, 6), far = ring(14, 4, .3);
      for (let t = 0; t < 40; t++) game.tick(idle());
      const hp = (slot: number) => h.isAlive(slot) ? h.hp[slot] : 0;
      const before = new Map([...near, ...far].map(slot => [slot, hp(slot)]));
      me.ultimate = 100;
      game.tick({ ...idle(), attack: 'ultimate' });
      let caught: number[] = [];
      for (let t = 0; t < 60 * 4; t++) {
        game.tick(idle());
        if (!caught.length && game.sim.serverTime - me.actionStarted >= CLOSES + .02 && me.action === 'ultimate')
          caught = near.filter(slot => h.isAlive(slot) && Math.hypot(h.x[slot] - me.x, h.z[slot] - me.z) <= STOP.radius);
      }
      expect(caught.length).toBeGreaterThanOrEqual(4);
      for (const slot of caught) expect(hp(slot), `grunt ${slot} struck`).toBeLessThan(before.get(slot)!);
      for (const slot of far) if (h.isAlive(slot)) expect(Math.abs(hp(slot) - before.get(slot)!), `far grunt ${slot}`).toBeLessThan(1);
    } finally { game.dispose(); }
  }, 60000);
});
