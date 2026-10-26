import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { MOVES, BACKDASH_EVADE, BACKDASH_SECONDS, BACKDASH_TRAVEL, DASH_EVADE, DASH_SECONDS,
  SIDESTEP_SECONDS, SIDESTEP_TRAVEL, dashPeakSpeed, dashShape } from '../src/game/moves';
import type { PlayerInput } from '../src/game/types';

const dt = 1 / 60;

function dash(moveX: number, moveZ: number) {
  const sim = new ArenaSimulation({ trainingBot: false, seed: 5 });
  sim.addPlayer('a', 'goku', 'A', false, { x: 0, y: 0, z: 0 });
  let seq = 0;
  const press = (more: Partial<PlayerInput> = {}) => sim.submitInput('a', { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, ...more });
  for (let i = 0; i < 60; i++) { press(); sim.step(); }
  press({ dash: true, moveX, moveZ }); sim.step();
  const actor = sim.actors.get('a')!;
  const kind = actor.dashKind, seconds = actor.dashSeconds;
  const evade = actor.evadeUntil - sim.serverTime, action = { ...sim.getPlayer('a')! };
  const ticks = Math.ceil(seconds / dt);
  for (let i = 1; i < ticks; i++) { press({ moveX, moveZ }); sim.step(); }
  const p = sim.getPlayer('a')!;
  const out = { kind, seconds, evade, action, travel: Math.hypot(p.x, p.z), x: p.x, z: p.z };
  sim.dispose();
  return out;
}

describe('three dashes', () => {
  it('backdashes with the stick pulled back: shorter, and an evade on the way out', () => {
    const r = dash(0, -1);
    expect(r.kind).toBe('back');
    expect(r.seconds).toBe(BACKDASH_SECONDS);
    expect(r.action.action).toBe('dash');
    expect(r.action.actionDuration).toBe(BACKDASH_SECONDS);
    expect(r.travel, `covered ${r.travel.toFixed(3)} m`).toBeCloseTo(BACKDASH_TRAVEL, 2);
    expect(r.z, 'backwards').toBeLessThan(0);
    expect(r.evade).toBeCloseTo(BACKDASH_EVADE, 2);
  });

  it('sidesteps with the stick across the facing: shorter again, and no evade', () => {
    for (const [moveX, label] of [[1, 'right'], [-1, 'left']] as const) {
      const r = dash(moveX, 0);
      expect(r.kind, label).toBe('side');
      expect(r.seconds).toBe(SIDESTEP_SECONDS);
      expect(r.action.actionDuration).toBe(SIDESTEP_SECONDS);
      expect(r.travel, `${label} covered ${r.travel.toFixed(3)} m`).toBeCloseTo(SIDESTEP_TRAVEL, 2);
      expect(Math.sign(r.x)).toBe(moveX);
      expect(r.evade, 'a sidestep is not an escape').toBeLessThanOrEqual(0);
    }
  });

  it('keeps the forward and neutral dash exactly as it was', () => {
    for (const [moveX, moveZ, label] of [[0, 1, 'forward'], [0, 0, 'neutral'], [.5, 1, 'forward diagonal']] as const) {
      const r = dash(moveX, moveZ);
      expect(r.kind, label).toBe('forward');
      expect(r.seconds).toBe(DASH_SECONDS);
      expect(r.action.actionDuration).toBe(DASH_SECONDS);
      expect(r.evade).toBeCloseTo(DASH_EVADE, 2);
      if (moveX === 0) expect(r.travel, `${label} covered ${r.travel.toFixed(3)} m`).toBeCloseTo(5.277, 2);
    }
    expect(dash(1, -1).kind).toBe('back');
    expect(dash(1, 1).kind).toBe('forward');
  });

  it('costs the same stamina whichever way it goes', () => {
    const cost = (moveX: number, moveZ: number) => {
      const sim = new ArenaSimulation({ trainingBot: false, seed: 5 });
      sim.addPlayer('a', 'goku', 'A', false, { x: 0, y: 0, z: 0 });
      for (let i = 0; i < 60; i++) { sim.submitInput('a', { seq: i, moveX: 0, moveZ: 0, yaw: 0 }); sim.step(); }
      const before = sim.getPlayer('a')!.stamina;
      sim.submitInput('a', { seq: 100, moveX, moveZ, yaw: 0, dash: true }); sim.step();
      const spent = before - sim.getPlayer('a')!.stamina;
      sim.dispose();
      return spent;
    };
    const forward = cost(0, 1);
    expect(forward).toBeGreaterThan(15);
    expect(cost(0, -1)).toBeCloseTo(forward, 6);
    expect(cost(1, 0)).toBeCloseTo(forward, 6);
  });

  it('dodges a hit inside the backdash\'s evade frames and not after them', () => {
    const run = (delay: number) => {
      const sim = new ArenaSimulation({ trainingBot: false, seed: 5 });
      sim.addPlayer('a', 'goku', 'A', false, { x: 0, y: 0, z: 0 });
      sim.addPlayer('b', 'vegeta', 'B', false, { x: 0, y: 0, z: 6 });
      let seq = 0;
      for (let i = 0; i < 60; i++) { sim.submitInput('a', { seq: seq++, moveX: 0, moveZ: 0, yaw: 0 }); sim.step(); }
      sim.submitInput('b', { seq: seq++, moveX: 0, moveZ: 0, yaw: Math.PI, attack: 'special', targetId: 'a' });
      const contact = Math.round(MOVES.vegeta.special.contacts[0] * 60);
      const dashAt = contact - Math.round(delay * 60);
      let dodged = false, hit = false;
      for (let i = 0; i <= contact + 2; i++) {
        sim.submitInput('a', { seq: seq++, moveX: 0, moveZ: -1, yaw: 0, dash: i === dashAt });
        sim.step();
        for (const e of sim.snapshot(true).events) { if (e.kind === 'dodge' && e.targetId === 'a') dodged = true; if (e.kind === 'hit' && e.targetId === 'a') hit = true; }
      }
      sim.dispose();
      return { dodged, hit };
    };
    expect(run(.06), 'inside the evade').toEqual({ dodged: true, hit: false });
    expect(run(.15), 'past it').toEqual({ dodged: false, hit: true });
  });

  it('sizes the short dashes so the sampled shape covers exactly their ground', () => {
    for (const [seconds, travel] of [[BACKDASH_SECONDS, BACKDASH_TRAVEL], [SIDESTEP_SECONDS, SIDESTEP_TRAVEL]] as const) {
      const peak = dashPeakSpeed(seconds, travel);
      let sum = 0;
      for (let k = 0; k * dt < seconds; k++) sum += peak * dashShape(k * dt / seconds) * dt;
      expect(sum).toBeCloseTo(travel, 9);
      expect(peak, 'a burst, not a jog').toBeGreaterThan(15);
    }
  });
});
