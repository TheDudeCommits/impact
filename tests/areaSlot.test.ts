import { describe, expect, it } from 'vitest';
import { ArenaSimulation, validateInput } from '../src/game/simulation';
import { AREA_DEFAULTS, MOVES } from '../src/game/moves';
import type { CollisionWorld, CombatEvent, FighterId, PlayerInput, Vec3 } from '../src/game/types';

type Command = Partial<Omit<PlayerInput, 'seq'>>;
function arena(fighter: FighterId = 'endeavor', others: Record<string, Vec3> = {}, collision?: CollisionWorld) {
  const sim = new ArenaSimulation({ trainingBot: false, seed: 5, collision });
  sim.addPlayer('a', fighter, 'A', false, { x: 0, y: 0, z: 0 });
  for (const [id, at] of Object.entries(others)) sim.addPlayer(id, 'jiren', id, false, at);
  const events: CombatEvent[] = [];
  let seq = 1;
  const step = (ticks: number, a: Command = {}, rest: Record<string, Command> = {}) => {
    for (let i = 0; i < ticks; i++) {
      sim.submitInput('a', { seq, moveX: 0, moveZ: 0, yaw: 0, ...(i === 0 ? a : {}) });
      for (const id of Object.keys(others)) sim.submitInput(id, { seq, moveX: 0, moveZ: 0, yaw: Math.PI, ...rest[id] });
      seq++;
      sim.step(1 / 60);
      events.push(...sim.snapshot(true).events);
    }
  };
  return { sim, step, events };
}
const area = (fighter: FighterId) => MOVES[fighter].area;

describe('the area slot: the aim, as the server takes it', () => {
  it('accepts a finite ground point with an area attack, and refuses a broken one whole', () => {
    const base = { seq: 1, moveX: 0, moveZ: 0, yaw: 0 };
    expect(validateInput({ ...base, attack: 'area', aim: { x: 3.5, z: -9 } })).toMatchObject({ attack: 'area', aim: { x: 3.5, z: -9 } });
    expect(validateInput({ ...base, attack: 'area' })?.aim).toBeUndefined();
    for (const aim of [{ x: Number.NaN, z: 0 }, { x: 0, z: Infinity }, { x: '1', z: 2 }, { x: 1 }, { x: 2e4, z: 0 }, 'here', null])
      expect(validateInput({ ...base, attack: 'area', aim }), JSON.stringify(aim)).toBeNull();
  });

  it('clamps the point to the move\'s range from the caster', () => {
    const { step, events } = arena();
    step(1, { attack: 'area', aim: { x: 0, z: 40 } }); step(10);
    const cast = events.find(e => e.kind === 'cast' && e.slot === 'area')!;
    expect(cast.endpoint!.z).toBeCloseTo(area('endeavor').range, 2);
    expect(cast.endpoint!.x).toBeCloseTo(0, 5);
    expect(cast.radius).toBe(area('endeavor').radius);
    expect(area('endeavor').range).toBe(AREA_DEFAULTS.range);
  });

  it('snaps the point to the floor: a platform\'s top where there is one', () => {
    const platform: CollisionWorld = {
      move: (_id, position, d) => ({ x: position.x + d.x, y: Math.max(0, position.y + d.y), z: position.z + d.z, grounded: position.y + d.y <= 0 }),
      raycast: (from, to) => from.y > 3 && to.y < 3 && Math.abs(from.x - 6) < 2 && Math.abs(from.z - 6) < 2 ? { x: from.x, y: 3, z: from.z } : to,
    };
    const { step, events } = arena('endeavor', {}, platform);
    step(1, { attack: 'area', aim: { x: 6, z: 6 } }); step(5);
    expect(events.find(e => e.kind === 'cast' && e.slot === 'area')!.endpoint!.y).toBe(3);
  });

  it('aims itself without a point: the locked target in range, else straight ahead', () => {
    const { step, events } = arena('endeavor', { b: { x: 4, y: 0, z: 9 } });
    step(1, { attack: 'area', targetId: 'b' }); step(5);
    expect(events.find(e => e.kind === 'cast' && e.slot === 'area')!.endpoint).toMatchObject({ x: 4, z: 9 });
    const lone = arena();
    lone.step(1, { attack: 'area' }); lone.step(5);
    expect(lone.events.find(e => e.kind === 'cast' && e.slot === 'area')!.endpoint!.z).toBeCloseTo(AREA_DEFAULTS.aim, 2);
  });
});

describe('the area slot: telegraph, then the strike', () => {
  it('shows the circle for its telegraph, then hits only inside its radius', () => {
    const m = area('endeavor');
    const { sim, step, events } = arena('endeavor', { inside: { x: 1.5, y: 0, z: 10 }, outside: { x: m.radius + 1.6, y: 0, z: 10 } });
    step(1, { attack: 'area', aim: { x: 0, z: 10 } });
    step(Math.ceil(m.contacts[0] * 60) + 2);
    const release = events.find(e => e.kind === 'release' && e.slot === 'area')!;
    expect(release).toMatchObject({ radius: m.radius, endpoint: { x: 0, z: 10 } });
    expect(release.due! - release.serverTime).toBeCloseTo(m.area!.telegraph, 3);
    step(Math.floor(m.area!.telegraph * 60) - 4);
    expect(events.some(e => e.kind === 'impact' || (e.kind === 'hit' && e.slot === 'area'))).toBe(false);
    expect(sim.getPlayer('inside')!.hp).toBe(sim.getPlayer('inside')!.maxHp);
    step(12);
    const impact = events.find(e => e.kind === 'impact')!;
    expect(impact).toMatchObject({ actorId: 'a', slot: 'area', radius: m.radius, endpoint: { x: 0, z: 10 } });
    expect(impact.serverTime).toBeGreaterThanOrEqual(release.due! - 1e-6);
    expect(events.filter(e => e.kind === 'hit' && e.slot === 'area').map(e => e.targetId)).toEqual(['inside']);
    expect(sim.getPlayer('inside')!.hp).toBeLessThan(sim.getPlayer('inside')!.maxHp);
    expect(sim.getPlayer('outside')!.hp).toBe(sim.getPlayer('outside')!.maxHp);
    const casts = () => events.filter(e => e.kind === 'cast' && e.slot === 'area').length;
    step(1, { attack: 'area', aim: { x: 0, z: 10 } }); step(5);
    expect(casts()).toBe(1);
  });

  it('can be dodged: a body that runs out of the circle during the telegraph is not hit', () => {
    const m = area('endeavor');
    const { sim, step, events } = arena('endeavor', { b: { x: 0, y: 0, z: 10 } });
    step(1, { attack: 'area', aim: { x: 0, z: 10 } });
    step(Math.ceil((m.contacts[0] + m.area!.telegraph) * 60) + 20, {}, { b: { moveX: 1 } });
    expect(events.some(e => e.kind === 'impact')).toBe(true);
    expect(events.some(e => e.kind === 'hit' && e.slot === 'area')).toBe(false);
    expect(sim.getPlayer('b')!.hp).toBe(sim.getPlayer('b')!.maxHp);
  });

  it('lands a many-strike circle strike by strike, the last the finisher (a pinned schedule: hits every interval)', () => {
    const m = area('vegeta');
    expect(m.area!.hits).toBeGreaterThan(1);
    const { step, events } = arena('vegeta', { b: { x: 0, y: 0, z: 8 } });
    step(1, { attack: 'area', aim: { x: 0, z: 8 } });
    step(Math.ceil((m.contacts[0] + m.area!.telegraph + m.area!.interval! * m.area!.hits!) * 60) + 30);
    expect(events.filter(e => e.kind === 'impact').map(e => e.contactIndex)).toEqual([...Array(m.area!.hits!).keys()]);
  });

  it('keeps its strike once the circle is down, whatever its caster does next', () => {
    const { step, events } = arena('endeavor', { b: { x: 0, y: 0, z: 9 } });
    const m = area('endeavor');
    step(1, { attack: 'area', aim: { x: 0, z: 9 } });
    step(Math.ceil(m.contacts[0] * 60) + 2);
    step(1, { attack: 'light' });
    step(Math.ceil(m.area!.telegraph * 60) + 10, { moveX: -1 });
    expect(events.some(e => e.kind === 'hit' && e.slot === 'area' && e.targetId === 'b')).toBe(true);
  });
});

describe('the area slot: bots', () => {
  it('cast it in a royale, aimed where their opponents will be', () => {
    const sim = new ArenaSimulation({ roomMode: 'match', seed: 11 });
    const roster: FighterId[] = ['endeavor', 'zoro', 'goku', 'luffy', 'gojo', 'naruto'];
    roster.forEach((fighter, i) => sim.addPlayer(`bot${i}`, fighter, `Bot ${i}`, true, { x: Math.cos(i) * 7, y: 0, z: Math.sin(i) * 7 }));
    sim.startMatch();
    const events: CombatEvent[] = [];
    for (let t = 0; t < 60 * 40 && !events.some(e => e.kind === 'impact'); t++) { sim.step(1 / 60); events.push(...sim.snapshot(true).events); }
    const cast = events.find(e => e.kind === 'cast' && e.slot === 'area');
    expect(cast, 'a bot cast its area move').toBeDefined();
    const caster = sim.getPlayer(cast!.actorId)!;
    expect(Math.hypot(cast!.endpoint!.x - cast!.origin!.x, cast!.endpoint!.z - cast!.origin!.z)).toBeLessThanOrEqual(MOVES[caster.fighter].area.range + 1.5);
    expect(events.some(e => e.kind === 'impact')).toBe(true);
  });
});
