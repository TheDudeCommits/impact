import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { createRapierCollision, initRapier } from '../src/game/rapierCollision';
import { STAGES, type StageId } from '../src/game/stages';
import { PLAYER_HEIGHT, PLAYER_RADIUS, jumpArc } from '../src/game/moves';
import ceilings from '../src/game/data/stageCeilings.json';
import type { FighterId, PlayerInput } from '../src/game/types';

type Roof = { x: number; z: number; halfX: number; halfZ: number; y: number };
const ROOFS = ceilings as Partial<Record<StageId, Roof[]>>;
const HIGHEST: FighterId = 'killua';

async function arena(stage: StageId, fighter: FighterId, at: { x: number; z: number }) {
  const sim = new ArenaSimulation({ stage, collision: await createRapierCollision(stage), trainingBot: false, seed: 3 });
  sim.addPlayer('a', fighter, 'A', false, { x: at.x, y: 0, z: at.z });
  let seq = 0;
  const go = (input: Partial<PlayerInput> = {}) => { sim.submitInput('a', { seq: ++seq, moveX: 0, moveZ: 0, yaw: 0, ...input }); sim.step(); };
  return { sim, go, a: sim.actors.get('a')! };
}

describe('the round 4b jump on the stages', () => {
  it('carries a roof for every stage the probe found one on, and the exam hall\'s balconies among them', async () => {
    await initRapier();
    expect(ROOFS['chunin-exam-room']?.length, 'the training hall').toBeGreaterThan(0);
    for (const [stage, roofs] of Object.entries(ROOFS) as [StageId, Roof[]][]) {
      const world = await createRapierCollision(stage);
      expect(world.ceilings, stage).toBe(roofs.length);
      for (const r of roofs) expect(r.y, stage).toBeLessThanOrEqual(Math.max(8, jumpArc(HIGHEST).apex + PLAYER_HEIGHT + .5));
      world.dispose?.();
    }
  });

  it('stops the head at every roof a jump reaches, and brings the body back down', async () => {
    await initRapier();
    for (const [stage, roofs] of Object.entries(ROOFS) as [StageId, Roof[]][]) {
      const { halfX, halfZ } = STAGES[stage];
      for (const roof of roofs) {
        const at = { x: Math.max(-halfX + PLAYER_RADIUS, Math.min(halfX - PLAYER_RADIUS, roof.x)), z: Math.max(-halfZ + PLAYER_RADIUS, Math.min(halfZ - PLAYER_RADIUS, roof.z)) };
        const { sim, go, a } = await arena(stage, HIGHEST, at);
        for (let i = 0; i < 10; i++) go();
        if (!a.state.grounded || a.state.y > .2) { sim.dispose(); continue; }
        const floor = a.state.y;
        go({ jump: true, jumpHeld: true });
        let top = 0, ticks = 0;
        for (; ticks < 150 && !(a.state.grounded && ticks > 3); ticks++) { top = Math.max(top, a.state.y); go({ jumpHeld: true }); }
        if (Math.abs(a.state.x - roof.x) < roof.halfX && Math.abs(a.state.z - roof.z) < roof.halfZ)
          expect(top + PLAYER_HEIGHT, `${stage}: roof at ${roof.y} m over (${roof.x}, ${roof.z})`).toBeLessThan(roof.y + .05);
        expect(a.state.grounded, `${stage} (${roof.x}, ${roof.z}): back on the floor`).toBe(true);
        expect(a.state.y, stage).toBeLessThan(floor + .5);
        sim.dispose();
      }
    }
  }, 30000);

  it('lets a leap that comes down over a roof pass it: no standing on a balcony\'s edge', async () => {
    await initRapier();
    for (const dx of [1, -1]) {
      const { sim, go, a } = await arena('chunin-exam-room', 'goku', { x: 0, z: 0 });
      for (let i = 0; i < 30; i++) go({ moveX: dx });
      go({ moveX: dx, jump: true, jumpHeld: true });
      for (let i = 0; i < 120; i++) go({ moveX: dx, jumpHeld: true });
      expect(Math.abs(a.state.x), 'at the wall').toBeGreaterThan(5.9);
      expect(a.state.grounded).toBe(true);
      expect(a.state.y, 'on the floor').toBeLessThan(.2);
      sim.dispose();
    }
  });

  it('keeps a running leap at every edge of every stage on the stage', async () => {
    await initRapier();
    const stages = (Object.keys(STAGES) as StageId[]).filter(id => id !== 'harbor');
    for (const stage of stages) {
      const { halfX, halfZ } = STAGES[stage];
      for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5, Math.PI / 4, Math.PI * 1.25]) {
        const dx = Math.sin(angle), dz = Math.cos(angle);
        const { sim, go, a } = await arena(stage, HIGHEST, { x: 0, z: 0 });
        for (let i = 0; i < 30; i++) go({ moveX: dx, moveZ: dz });
        go({ moveX: dx, moveZ: dz, jump: true, jumpHeld: true });
        let low = 0;
        for (let i = 0; i < 240; i++) { go({ moveX: dx, moveZ: dz, jumpHeld: true, jump: i % 70 === 69 }); low = Math.min(low, a.state.y); }
        expect(Math.abs(a.state.x), `${stage} at ${angle.toFixed(2)}`).toBeLessThanOrEqual(halfX);
        expect(Math.abs(a.state.z), `${stage} at ${angle.toFixed(2)}`).toBeLessThanOrEqual(halfZ);
        expect(low, `${stage}: never through the floor`).toBeGreaterThan(-.5);
        expect(a.state.alive, stage).toBe(true);
        sim.dispose();
      }
    }
  }, 30000);

  it('lets a fighter walk and jump out of Enies Lobby\'s bridge corner', async () => {
    await initRapier();
    const { halfX, halfZ } = STAGES['enies-lobby'];
    const cx = halfX - .5, cz = -(halfZ - .5);
    for (const [ax, az] of [[1, -1], [.7, -.3], [.3, -.7]]) {
      const { sim, go, a } = await arena('enies-lobby', 'goku', { x: halfX - 2, z: -(halfZ - 2) });
      for (let i = 0; i < 90; i++) go({ moveX: ax, moveZ: az });
      expect(Math.hypot(a.state.x - cx, a.state.z - cz), 'in the corner').toBeLessThan(.2);
      let from = { x: a.state.x, z: a.state.z };
      for (let i = 0; i < 60; i++) go({ moveX: -.7, moveZ: .7 });
      expect(Math.hypot(a.state.x - from.x, a.state.z - from.z), 'walked out').toBeGreaterThan(5);
      for (let i = 0; i < 90; i++) go({ moveX: ax, moveZ: az });
      from = { x: a.state.x, z: a.state.z };
      go({ moveX: -.7, moveZ: .7, jump: true, jumpHeld: true });
      for (let i = 0; i < 59; i++) go({ moveX: -.7, moveZ: .7, jumpHeld: true });
      expect(Math.hypot(a.state.x - from.x, a.state.z - from.z), 'jumped out').toBeGreaterThan(5);
      sim.dispose();
    }
  });
});
