import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { createRapierCollision } from '../src/game/rapierCollision';
import { CHIP, MAX_HP, MOVES } from '../src/game/moves';
import type { PlayerInput } from '../src/game/types';

function duel(mode: 'training' | 'match' = 'match') {
  const sim = new ArenaSimulation({ roomMode: mode, trainingBot: false, seed: 5 });
  sim.addPlayer('a', 'goku', 'A', false, { x: 0, y: 0, z: 0 });
  sim.addPlayer('b', 'naruto', 'B', false, { x: 0, y: 0, z: 1.6 });
  if (mode === 'match') sim.startMatch();
  let seq = 0;
  const input = (id: string, more: Partial<PlayerInput> = {}) =>
    sim.submitInput(id, { seq: seq++, moveX: 0, moveZ: 0, yaw: id === 'a' ? 0 : Math.PI, ...more });
  const step = (seconds: number) => { for (let i = 0; i < Math.round(seconds * 60); i++) sim.step(); };
  const square = () => {
    Object.assign(sim.actors.get('a')!.state, { x: 0, z: 0, yaw: 0 });
    Object.assign(sim.actors.get('b')!.state, { x: 0, z: 1.1, yaw: Math.PI });
    const b = sim.actors.get('b')!; b.scalingHits = 0; b.chainHits = 0;
  };
  return { sim, input, step, square };
}

describe('a duel is booked to the last point', () => {
  it('gives the winner one kill and every point dealt, and the loser every point taken', () => {
    const { sim, input, square } = duel('match');
    square();
    let ticks = 0;
    while (sim.getPlayer('b')!.alive && ticks++ < 60 * 90) {
      square();
      input('a', { attack: 'light', targetId: 'b' });
      sim.step();
    }
    const a = sim.getPlayer('a')!, b = sim.getPlayer('b')!;
    expect(b.alive, 'the duel was fought to the end').toBe(false);
    expect(sim.snapshot().winnerId).toBe('a');
    expect(a.kills).toBe(1);
    expect(a.damageDealt).toBe(MAX_HP);
    expect(a.damageTaken).toBe(0);
    expect(b.damageTaken).toBe(MAX_HP);
    expect(b.damageDealt).toBe(0);
    expect(b.kills).toBe(0);
    const killed = sim.snapshot().events.find(e => e.kind === 'eliminated')!;
    expect(killed.actorId).toBe('a');
    expect(killed.targetId).toBe('b');
  });

  it('books chip to both ledgers', () => {
    const { sim, input, step } = duel('training');
    for (let i = 0; i < 36; i++) { input('b', { guard: true, targetId: 'a' }); sim.step(); }
    input('a', { attack: 'light', targetId: 'b' });
    for (let i = 0; i < 30; i++) { input('b', { guard: true, targetId: 'a' }); sim.step(); }
    step(0);
    const chip = Math.max(1, Math.round(MOVES.goku.light.damage * CHIP.light));
    expect(sim.snapshot().events.some(e => e.kind === 'blocked')).toBe(true);
    expect(sim.getPlayer('b')!.damageTaken).toBe(chip);
    expect(sim.getPlayer('a')!.damageDealt).toBe(chip);
    expect(sim.getPlayer('b')!.hp).toBe(MAX_HP - chip);
  });

  it('gives a fall into the water to nobody', async () => {
    const sim = new ArenaSimulation({ roomMode: 'match', trainingBot: false, seed: 5, stage: 'galactic-arena',
      collision: await createRapierCollision('galactic-arena') });
    sim.addPlayer('a', 'goku'); sim.addPlayer('b', 'naruto'); sim.addPlayer('c', 'zoro');
    sim.startMatch();
    Object.assign(sim.actors.get('b')!.state, { x: 0, y: -5, z: 0, grounded: false });
    Object.assign(sim.actors.get('a')!.state, { x: 3, z: 0 });
    Object.assign(sim.actors.get('c')!.state, { x: -3, z: 1.5 });
    for (let i = 0; i < 10 && sim.getPlayer('b')!.alive; i++) {
      for (const id of ['a', 'b', 'c']) sim.submitInput(id, { seq: i, moveX: 0, moveZ: 0, yaw: 0 });
      sim.step();
    }
    expect(sim.getPlayer('b')!.alive).toBe(false);
    const dead = sim.snapshot().events.find(e => e.kind === 'eliminated' && e.targetId === 'b')!;
    expect(dead.actorId).toBe('water');
    for (const id of ['a', 'c']) expect(sim.getPlayer(id)!.kills, `${id} did not kill anybody`).toBe(0);
    for (const id of ['a', 'c']) expect(sim.getPlayer(id)!.damageDealt, `${id} dealt nothing`).toBe(0);
    sim.dispose();
  });

  it('has no storm to take a point off a fighter waiting at the edge', () => {
    const sim = new ArenaSimulation({ roomMode: 'match', trainingBot: false, seed: 5, stage: 'galactic-arena' });
    sim.addPlayer('a', 'goku'); sim.addPlayer('b', 'naruto'); sim.addPlayer('c', 'zoro');
    sim.startMatch();
    (sim as unknown as { startedAt: number }).startedAt = -400;
    Object.assign(sim.actors.get('b')!.state, { x: sim.bounds.halfX - 1, z: 0, hp: 40 });
    for (let i = 0; i < 60 * 6; i++) {
      for (const id of ['a', 'b', 'c']) sim.submitInput(id, { seq: i, moveX: 0, moveZ: 0, yaw: 0 });
      sim.step();
    }
    expect(sim.getPlayer('b')!.alive).toBe(true);
    expect(sim.getPlayer('b')!.hp).toBe(40);
    expect(sim.getPlayer('b')!.damageTaken ?? 0).toBe(0);
    sim.dispose();
  });

  it('survives a training respawn and is cleared by the practice reset and by a match start', () => {
    const { sim, input, step } = duel('training');
    sim.actors.get('b')!.state.hp = 1;
    input('a', { attack: 'light', targetId: 'b' });
    step(4);
    expect(sim.getPlayer('b')!.alive, 'respawned').toBe(true);
    expect(sim.getPlayer('a')!.kills).toBe(1);
    expect(sim.getPlayer('a')!.damageDealt).toBe(1);
    expect(sim.getPlayer('b')!.damageTaken).toBe(1);
    sim.trainingCommand('a', 'reset');
    for (const id of ['a', 'b']) expect(sim.getPlayer(id)).toMatchObject({ kills: 0, damageDealt: 0, damageTaken: 0 });

    const match = new ArenaSimulation({ roomMode: 'match', trainingBot: false, seed: 5 });
    match.addPlayer('a', 'goku'); match.addPlayer('b', 'naruto');
    Object.assign(match.actors.get('a')!.state, { kills: 4, damageDealt: 900, damageTaken: 300 });
    match.startMatch();
    expect(match.snapshot().players.find(p => p.id === 'a')).toMatchObject({ kills: 0, damageDealt: 0, damageTaken: 0 });
  });

  it('is on the wire from the first snapshot', () => {
    const sim = new ArenaSimulation({ seed: 5 });
    sim.addPlayer('me', 'goku', 'Me');
    for (const p of sim.snapshot().players) {
      expect(p.kills).toBe(0); expect(p.damageDealt).toBe(0); expect(p.damageTaken).toBe(0);
    }
    sim.dispose();
  });
});
