import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { MOVES, RUSH_AIR_STAGES, RUSH_STAGES, meleeReach } from '../src/game/moves';
import { moveFor, rushMove } from '../src/game/awakening';
import type { FighterId } from '../src/game/types';

const ROSTER = Object.keys(MOVES) as FighterId[];

describe('every light is melee', () => {
  it.each(ROSTER)('%s: the light, awakened or not, and every stage of its string is a blow at arm\'s length', fighter => {
    for (const awakened of [false, true]) {
      const light = moveFor(fighter, 'light', awakened);
      expect(light.style, `${fighter} light${awakened ? ' (awakened)' : ''}`).toBe('melee');
      expect(light.speed, 'nothing about it flies').toBeUndefined();
      for (let stage = 0; stage < RUSH_STAGES; stage++) {
        const move = rushMove(fighter, stage, awakened);
        expect(move.style, `${fighter} rush stage ${stage}${awakened ? ' (awakened)' : ''}`).toBe('melee');
        expect(meleeReach(fighter, 'light', move), `${fighter} stage ${stage} reach`).toBeLessThan(3.5);
      }
    }
  });

  it.each(ROSTER)('%s: a mashed string, on the floor and in the air, never looses a shot', fighter => {
    for (const aloft of [false, true]) {
      const sim = new ArenaSimulation({ trainingBot: false, seed: 13 });
      sim.addPlayer('a', fighter, 'A', false, { x: 0, y: 0, z: 0 });
      sim.addPlayer('b', 'goku', 'B', false, { x: 0, y: 0, z: 1.6 });
      const hold = () => { if (!aloft) return; for (const id of ['a', 'b']) { const actor = sim.actors.get(id)!; actor.state.y = 5; actor.state.grounded = false; actor.vy = 0; } };
      let seq = 0, shots = 0, lights = 0;
      for (let tick = 0; tick < 180; tick++) {
        hold();
        sim.submitInput('a', { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', attack: tick % 4 === 0 ? 'light' : undefined });
        sim.step();
        shots = Math.max(shots, sim.predictionCheckpoint('a')!.shots.length);
        lights += sim.snapshot(true).events.filter(e => e.kind === 'cast' && e.actorId === 'a' && e.slot === 'light').length;
      }
      expect(lights, `${fighter} threw its string${aloft ? ' in the air' : ''}`).toBeGreaterThanOrEqual(aloft ? RUSH_AIR_STAGES : RUSH_STAGES);
      expect(shots, `${fighter}${aloft ? ' in the air' : ''}`).toBe(0);
    }
  });

  it('gives Vegeta a straight on the roster\'s light cadence', () => {
    const light = MOVES.vegeta.light;
    expect(light.name).toBe('Ki-Charged Straight');
    expect(light.contacts).toHaveLength(1);
    expect(light.duration).toBeGreaterThanOrEqual(.4); expect(light.duration).toBeLessThanOrEqual(.5);
    expect(light.contacts[0]).toBeGreaterThanOrEqual(.15); expect(light.contacts[0]).toBeLessThanOrEqual(.18);
    expect(light.range).toBeGreaterThanOrEqual(2.2); expect(light.range).toBeLessThanOrEqual(2.5);
    expect(light.lunge).toBeGreaterThanOrEqual(2); expect(light.lunge).toBeLessThanOrEqual(4);
    const sim = new ArenaSimulation({ trainingBot: false, seed: 2 });
    sim.addPlayer('a', 'vegeta', 'Vegeta', false, { x: 0, y: 0, z: 0 });
    sim.addPlayer('b', 'goku', 'Goku', false, { x: 0, y: 0, z: 1.8 });
    sim.submitInput('a', { seq: 0, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', attack: 'light' });
    const hits = [];
    for (let tick = 0; tick < 40; tick++) { sim.step(); hits.push(...sim.snapshot(true).events.filter(e => e.kind === 'hit' && e.actorId === 'a')); }
    expect(hits).toHaveLength(1);
    expect(hits[0].damage).toBe(light.damage);
    expect(hits[0].move).toBe(light.name);
  });
});
