import { describe, expect, it, vi } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { createRapierCollision } from '../src/game/rapierCollision';
import type { EnvironmentCollider } from '../src/game/environmentLayout';
import type { StageId } from '../src/game/stages';

const TOWER: EnvironmentCollider = { x: 26, y: 9, z: 26, halfX: 3.5, halfY: 9, halfZ: 3.5 } as EnvironmentCollider;
vi.mock('../src/game/environmentLayout', async original => {
  const layout = await original<typeof import('../src/game/environmentLayout')>();
  return { ...layout, stageColliders: (stage: StageId) => {
    const colliders = layout.stageColliders(stage);
    return stage === 'chunin-final' && process.env.RULES_TOWER === '1' ? { ...colliders, landmarks: [...colliders.landmarks, TOWER] } : colliders;
  } };
});

interface Run { lowest: number; drop: number; deepest: number; end: { x: number; z: number }; away: number }

async function run(stage: StageId, x: number, z: number, deg: number, ticks: number, y = 0): Promise<Run> {
  const collision = await createRapierCollision(stage);
  const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, stage, collision });
  try {
    sim.addPlayer('me', 'goku', 'Me', false, { x, y, z });
    const p = sim.actors.get('me')!.state, a = deg * Math.PI / 180;
    let lowest = Infinity, drop = 0, deepest = 0, prev = p.y, seq = 0;
    for (let t = 0; t < ticks; t++) {
      sim.submitInput('me', { seq: ++seq, moveX: Math.sin(a), moveZ: Math.cos(a), yaw: a });
      sim.step(1 / 60);
      if (t > 1) { lowest = Math.min(lowest, p.y); drop = Math.max(drop, prev - p.y); }
      prev = p.y;
      deepest = Math.max(deepest, collision.penetration(p));
    }
    const end = { x: p.x, z: p.z };
    for (let t = 0; t < 60; t++) {
      sim.submitInput('me', { seq: ++seq, moveX: -Math.sin(a), moveZ: -Math.cos(a), yaw: a + Math.PI });
      sim.step(1 / 60);
    }
    return { lowest, drop, deepest, end, away: Math.hypot(p.x - end.x, p.z - end.z) };
  } finally { sim.dispose(); }
}

describe('a fighter is never carried into the floor, or through a corner', () => {
  it('the Black Fortress\'s tower, run at along its diagonal: never inside it (the integrator\'s case)', async () => {
    process.env.RULES_TOWER = '1';
    try {
      const support = 3.5 * Math.SQRT1_2 * 2 + .45, back = (support + 2.5) * Math.SQRT1_2;
      const r = await run('chunin-final', 26 - back, 26 - back, 45, 90, .01);
      expect(r.deepest, 'inside the tower or the floor, metres').toBeLessThan(.005);
      expect(r.lowest, 'the feet never below the floor').toBeGreaterThanOrEqual(0);
      expect(Math.hypot(r.end.x - (26 - 3.5), r.end.z - (26 - 3.5)), 'stopped at its corner, a capsule off it').toBeGreaterThan(.45);
      expect(r.away, 'and walks away').toBeGreaterThan(1);
    } finally { delete process.env.RULES_TOWER; }
  });

  it.each([
    ['galactic-arena', 5, 5, 45],
    ['martial-arts-tournament', -8, 8, 315],
    ['chunin-final', 42, -42, 135],
  ] as [StageId, number, number, number][])('%s: pinned diagonally into the stage\'s corner for two seconds, the feet stay on the floor', async (stage, x, z, deg) => {
    const r = await run(stage, x, z, deg, 120);
    expect(r.lowest).toBeGreaterThanOrEqual(0);
    expect(r.deepest).toBeLessThan(.005);
    expect(r.away).toBeGreaterThan(1);
  });

  it('a diagonal run across the Chunin arena\'s open floor never drops into it', async () => {
    const r = await run('chunin-final', 20, 20, 45, 30);
    expect(r.lowest).toBeGreaterThanOrEqual(0);
    expect(r.drop, 'no one-tick drop over a centimetre').toBeLessThan(.01);
  });

  it('keeps round 3e\'s open-floor fix: a step from inside the skin is not refused', async () => {
    const collision = await createRapierCollision('chunin-exam-room');
    try {
      const moved = collision.move('probe', { x: 0, y: .004, z: 0 }, { x: .1, y: -.0064, z: .05 });
      expect(Math.hypot(moved.x, moved.z)).toBeGreaterThan(.1);
      expect(moved.grounded).toBe(true);
    } finally { collision.dispose?.(); }
  });
});
