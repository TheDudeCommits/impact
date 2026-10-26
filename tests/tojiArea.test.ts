import { describe, expect, it } from 'vitest';
import { ArenaSimulation, type ExternalBody } from '../src/game/simulation';
import { MOVES } from '../src/game/moves';
import type { CombatEvent, PlayerInput } from '../src/game/types';
import { forgeMoves, ownKit } from '../src/engine/sim/forge';
import { MOVE_LIMITS, moveProblems } from '../src/engine/sim/validate';
import { AREA_DAMAGE_CEILING } from '../src/engine/sim/areaDamage';
import { AreaAim } from '../src/input/areaAim';

function setup(borrowed = false) {
  const sim = new ArenaSimulation({ trainingBot: false, seed: 5 });
  sim.addPlayer('a', borrowed ? 'goku' : 'toji', 'A', false, { x: 0, y: 0, z: 0 });
  sim.addPlayer('near', 'toji', 'Near', false, { x: 0, y: 0, z: 1.6 });
  sim.addPlayer('far', 'jiren', 'Far', false, { x: 0, y: 0, z: 12 });
  if (borrowed) { const kit = ownKit('goku'); kit.slots.area = { from: 'toji' }; expect(sim.forge('a', forgeMoves(kit), 'test-toji-area')).toBe(true); }
  const events: CombatEvent[] = []; let seq = 0;
  const step = (n: number, command: Partial<PlayerInput> = {}, interrupt = false) => {
    for (let i = 0; i < n; i++) {
      seq++;
      sim.submitInput('a', { seq, moveX: 0, moveZ: 0, yaw: 0, ...i === 0 ? command : {} });
      sim.submitInput('near', { seq, moveX: 0, moveZ: 0, yaw: Math.PI, ...interrupt && i === 0 ? { attack: 'special', targetId: 'a' } : {} });
      sim.step(1 / 60); events.push(...sim.snapshot(true).events);
    }
  };
  return { sim, step, events };
}
const area = MOVES.toji.area, spec = area.area!;

describe('Toji aimed area move (Heavenly Ambush)', () => {
  it('sits inside the limits every area move keeps (docs/engine/AREA.md)', () => {
    expect(moveProblems(area, 'area')).toEqual({ errors: [], warnings: [] });
    for (const [value, [low, high]] of [[area.range, MOVE_LIMITS.areaRange], [area.radius, MOVE_LIMITS.areaRadius], [spec.telegraph, MOVE_LIMITS.areaTelegraph]] as const) {
      expect(value).toBeGreaterThanOrEqual(low); expect(value).toBeLessThanOrEqual(high);
    }
    expect(area.style).toBe('field'); expect(area.contacts).toHaveLength(1);
    expect(area.damage).toBeLessThanOrEqual(AREA_DAMAGE_CEILING);
  });
  it.each([false, true])('strikes the circle the player aimed, a telegraph after the release, and not his own feet (borrowed=%s)', borrowed => {
    const { sim, step, events } = setup(borrowed);
    try {
      step(1, { attack: 'area', aim: { x: 0, z: 12 } }); step(Math.ceil((area.contacts[0] + spec.telegraph) * 60) - 4);
      expect(events.some(e => e.kind === 'impact')).toBe(false);
      step(12);
      const cast = events.find(e => e.kind === 'cast' && e.slot === 'area')!;
      const release = events.find(e => e.kind === 'release' && e.slot === 'area')!;
      const impact = events.find(e => e.kind === 'impact' && e.slot === 'area')!;
      expect(cast.endpoint).toMatchObject({ x: 0, z: 12 });
      expect(release.endpoint).toMatchObject({ x: 0, z: 12 });
      expect(impact.endpoint).toMatchObject({ x: 0, z: 12 });
      expect(release.serverTime - cast.serverTime).toBeCloseTo(area.contacts[0], 1);
      expect(impact.serverTime - release.serverTime).toBeCloseTo(spec.telegraph, 1);
      expect(events.filter(e => e.kind === 'hit' && e.slot === 'area').map(e => e.targetId)).toEqual(['far']);
      expect(sim.getPlayer('far')!.hp).toBeLessThan(sim.getPlayer('far')!.maxHp);
      expect(sim.getPlayer('near')!.hp).toBe(sim.getPlayer('near')!.maxHp);
    } finally { sim.dispose(); }
  });
  it('lands all of it in the bullseye and half at the rim', () => {
    const centre = setup(); const rim = setup();
    try {
      centre.step(1, { attack: 'area', aim: { x: 0, z: 12 } }); centre.step(90);
      rim.step(1, { attack: 'area', aim: { x: 0, z: 12 - area.radius } }); rim.step(90);
      const dealt = (events: CombatEvent[]) => events.filter(e => e.kind === 'hit' && e.slot === 'area' && e.targetId === 'far').reduce((sum, e) => sum + (e.damage ?? 0), 0);
      expect(dealt(centre.events)).toBe(area.damage);
      expect(dealt(rim.events)).toBeGreaterThan(0); expect(dealt(rim.events)).toBeLessThan(area.damage * .62);
    } finally { centre.sim.dispose(); rim.sim.dispose(); }
  });
  it('is held to its range, and with no aim goes to the locked body in range', () => {
    const past = setup();
    try {
      past.step(1, { attack: 'area', aim: { x: 0, z: 60 } }); past.step(4);
      expect(past.events.find(e => e.kind === 'cast' && e.slot === 'area')!.endpoint).toMatchObject({ x: 0, z: area.range });
    } finally { past.sim.dispose(); }
    const locked = setup();
    try {
      locked.step(1, { attack: 'area', targetId: 'far' }); locked.step(90);
      expect(locked.events.find(e => e.kind === 'cast' && e.slot === 'area')!.endpoint).toMatchObject({ x: 0, z: 12 });
      expect(locked.events.filter(e => e.kind === 'hit' && e.slot === 'area').map(e => e.targetId)).toEqual(['far']);
    } finally { locked.sim.dispose(); }
  });
  it('once released, the strike lands where it was aimed whatever its caster does next', () => {
    const { sim, step, events } = setup();
    try {
      step(1, { attack: 'area', aim: { x: 0, z: 12 } }); step(Math.ceil(area.contacts[0] * 60) + 2);
      const release = events.find(e => e.kind === 'release' && e.slot === 'area')!;
      expect(release).toBeDefined();
      sim.actors.get('a')!.state.x = 6;
      step(70);
      const impact = events.find(e => e.kind === 'impact' && e.slot === 'area')!;
      expect(impact.endpoint).toEqual(release.endpoint);
      expect(events.filter(e => e.kind === 'hit' && e.slot === 'area').map(e => e.targetId)).toEqual(['far']);
    } finally { sim.dispose(); }
  });
  it('interrupting the windup produces no release or delayed impact', () => {
    const { sim, step, events } = setup();
    try {
      step(1, {}, true); step(Math.round((MOVES.toji.special.contacts[0] - area.contacts[0] / 2) * 60));
      step(1, { attack: 'area', aim: { x: 0, z: 12 } }); step(150);
      expect(events.some(e => e.actorId === 'a' && e.slot === 'area' && e.kind === 'cast')).toBe(true);
      expect(events.some(e => e.kind === 'hit' && e.targetId === 'a')).toBe(true);
      expect(events.some(e => e.actorId === 'a' && e.slot === 'area' && (e.kind === 'release' || e.kind === 'impact'))).toBe(false);
    } finally { sim.dispose(); }
  });
  it('strikes the horde at the aimed circle, not round his feet', () => {
    const { sim, step } = setup();
    const bodies: ExternalBody[] = [{ id: 'grunt-near', x: 1, y: 0, z: 0, radius: .3, height: 1.8, airborne: false }, { id: 'grunt-far', x: 0, y: 0, z: 12, radius: .3, height: 1.8, airborne: false }];
    const hit: string[] = [];
    sim.external = {
      query: (a, _b, r, out) => { out.length = 0; for (const body of bodies) if (Math.hypot(body.x - a.x, body.z - a.z) <= r) out.push(body); return out.length; },
      receive: (body, blow) => { hit.push(body.id); return { damage: blow.damage, killed: false }; },
      freeze: () => {}, locate: id => bodies.find(body => body.id === id),
    };
    try { step(1, { attack: 'area', aim: { x: 0, z: 12 } }); step(90); expect(hit).toEqual(['grunt-far']); }
    finally { sim.dispose(); }
  });
  it('every input device moves the reticle out to its range', () => {
    for (const source of ['keyboard', 'pad', 'touch'] as const) {
      const aim = new AreaAim(); aim.begin(source); aim.follow({ x: 3, z: 4 }, 0, { x: 3, z: 12 }, area.range, area.radius, true);
      expect(aim.release()).toEqual({ x: 3, z: 12 });
    }
  });
});
