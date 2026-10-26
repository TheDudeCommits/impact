import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { MOVES } from '../src/game/moves';
import type { AttackSlot, FighterId, PlayerInput } from '../src/game/types';

const roster = Object.keys(MOVES) as FighterId[];

function walked(fighter: FighterId, slot: AttackSlot, seconds: number, stick = { moveX: 0, moveZ: 1 }) {
  const sim = new ArenaSimulation({ trainingBot: false, seed: 5, stage: 'harbor' });
  sim.addPlayer('a', fighter, 'A', false, { x: 0, y: 0, z: 0 });
  sim.actors.get('a')!.state.ultimate = 100;
  let seq = 0;
  const press = (more: Partial<PlayerInput> = {}) => sim.submitInput('a', { seq: seq++, yaw: 0, ...stick, ...more });
  press({ attack: slot });
  const ticks = Math.round(seconds * 60);
  for (let i = 0; i < ticks; i++) { if (i) press(); sim.step(); }
  const p = sim.getPlayer('a')!;
  const out = { travel: Math.hypot(p.x, p.z), action: p.action, x:p.x, z:p.z };
  sim.dispose();
  return out;
}

describe('omnidirectional travel during every roster attack', () => {
  for (const fighter of roster) for (const slot of ['light','heavy','special','ultimate'] as const) {
    it(`${fighter} ${slot} respects all eight held directions, including against its lunge`, () => {
      const distances=[];
      const blink=MOVES[fighter][slot].teleport;
      const seconds=blink?Math.min(.4,blink.appear-1/60):.4;
      for(let d=0;d<8;d++) {
        const angle=d*Math.PI/4;
        const result=walked(fighter,slot,seconds,{moveX:Math.sin(angle),moveZ:Math.cos(angle)});
        distances.push(result.travel);
        expect(result.travel).toBeGreaterThan(blink?7.5*seconds-.4:2.5);
        expect(result.x).toBeCloseTo(result.travel*Math.sin(angle),5);
        expect(result.z).toBeCloseTo(result.travel*Math.cos(angle),5);
      }
      expect(Math.max(...distances)-Math.min(...distances)).toBeLessThan(.001);
    });
  }

  it('does not re-aim a beam by walking: the release goes where the cast was taken', () => {
    const sim = new ArenaSimulation({ trainingBot: false, seed: 5 });
    sim.addPlayer('a', 'goku', 'A', false, { x: 0, y: 0, z: 0 });
    sim.addPlayer('b', 'naruto', 'B', false, { x: 0, y: 0, z: 8 });
    let seq = 0;
    sim.submitInput('a', { seq: seq++, moveX: 1, moveZ: 0, yaw: 0, attack: 'special', targetId: 'b' });
    const events = [];
    for (let i = 0; i < Math.round((MOVES.goku.special.contacts[0] + .05) * 60); i++) {
      sim.submitInput('a', { seq: seq++, moveX: 1, moveZ: 0, yaw: 0 });
      sim.step();
      events.push(...sim.snapshot(true).events);
    }
    const cast = events.find(e => e.kind === 'cast' && e.actorId === 'a')!;
    const release = events.find(e => e.kind === 'release' && e.actorId === 'a')!;
    expect(release, 'the beam fired').toBeDefined();
    expect(sim.getPlayer('a')!.x, 'and the caster walked sideways meanwhile').toBeGreaterThan(2);
    expect(release.endpoint).toEqual(cast.endpoint);
    sim.dispose();
  });

  it('never walks while stunned', () => {
    const sim = new ArenaSimulation({ trainingBot: false, seed: 5 });
    sim.addPlayer('a', 'goku', 'A', false, { x: 0, y: 0, z: 0 });
    sim.addPlayer('b', 'zoro', 'B', false, { x: 0, y: 0, z: 1.6 });
    let seq = 0;
    sim.submitInput('b', { seq: seq++, moveX: 0, moveZ: 0, yaw: Math.PI, attack: 'heavy', targetId: 'a' });
    for (let i = 0; i < Math.round((MOVES.zoro.heavy.contacts[0] + .3) * 60); i++) sim.step();
    expect(sim.getPlayer('a')!.action).toBe('launched');
    const from = sim.getPlayer('a')!;
    for (let i = 0; i < 12; i++) { sim.submitInput('a', { seq: seq++, moveX: 1, moveZ: 0, yaw: 0, attack: 'special' }); sim.step(); }
    expect(sim.getPlayer('a')!.action, 'no cast came out of a launched body').not.toBe('special');
    expect(sim.getPlayer('a')!.x - from.x, 'and the stick moved nothing').toBeLessThan(.01);
    sim.dispose();
  });
});
