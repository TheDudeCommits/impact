import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FollowCamera } from '../src/render/FollowCamera';
import { ArenaSimulation } from '../src/game/simulation';
import { moveFor } from '../src/game/awakening';
import type { Fighter } from '../src/render/Fighter';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';

const DEG = 180 / Math.PI;
type Body = Fighter & { state: PlayerState };
function body(state: PlayerState): Body {
  const group = new THREE.Group(); group.position.set(state.x, state.y, state.z);
  return { state: { ...state }, group, velocity: new THREE.Vector3() } as unknown as Body;
}
type Frame = { phase: string; weight: number; eye: THREE.Vector3; aim: THREE.Vector3; on: Record<string, boolean>; inside: number; t: number };
function film(user: FighterId, cinematics = true, spots: [number, number][] = [[.1, 2], [1.7, 4], [-2.3, 4.8]]) {
  const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, seed: 3 });
  sim.addPlayer('me', user, 'Me', false, { x: 0, y: 0, z: 0 });
  spots.forEach(([angle, d], i) => sim.addPlayer('v' + i, 'goku', 'V', false, { x: Math.sin(angle) * d, y: 0, z: Math.cos(angle) * d }));
  sim.actors.get('me')!.state.ultimate = 100;
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 200), follow = new FollowCamera(camera);
  follow.mode = 'lockon'; follow.cinematics = cinematics;
  const bodies = new Map<string, Body>(sim.playerStates().map(p => [p.id, body(p)]));
  follow.director.crowd = bodies;
  let input = 0, seq = 0;
  const frames: Frame[] = [];
  for (let i = 0; i < 60 * 7; i++) {
    sim.submitInput('me', { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, targetId: 'v0', attack: i === 30 ? 'ultimate' : undefined });
    sim.step();
    const events: CombatEvent[] = sim.drainEvents();
    for (const p of sim.playerStates()) { const b = bodies.get(p.id)!; Object.assign(b.state, p); b.group.position.set(p.x, p.y, p.z); b.group.rotation.y = p.yaw; }
    follow.director.handle(events, 'me', id => bodies.get(id));
    const me = bodies.get('me')!, foe = bodies.get('v0')!;
    follow.update(1 / 60, me, input, 0, [], 0, foe, true); input = follow.inputYaw; camera.updateMatrixWorld();
    const on: Record<string, boolean> = {};
    for (const [id, b] of bodies) for (const [part, up] of [['head', 1.8], ['feet', .05]] as const) {
      const p = b.group.position.clone().setY(b.group.position.y + up).project(camera);
      on[`${id}:${part}`] = Math.abs(p.x) < 1 && Math.abs(p.y) < 1 && p.z < 1;
    }
    let inside = Infinity;
    for (const b of bodies.values()) inside = Math.min(inside, Math.hypot(camera.position.x - b.group.position.x, camera.position.z - b.group.position.z) + (camera.position.y > b.group.position.y + 2.1 ? 10 : 0));
    frames.push({ phase: follow.director.phase, weight: follow.director.weight, eye: camera.position.clone(), aim: camera.getWorldDirection(new THREE.Vector3()), on, inside, t: sim.serverTime });
  }
  sim.dispose();
  return { frames, cast: 31 / 60 };
}

describe('the time-stop ultimates are filmed as a sequence', () => {
  it.each(['jotaro', 'dio', 'gojo'] as FighterId[])('%s: the opener pushed in, then the frozen field holding everyone, then back to the fight', user => {
    const { frames, cast } = film(user, true, user === 'gojo' ? [[.1, 2], [1.7, 2.35], [-2.3, 2.8]] : undefined);
    const move = moveFor(user, 'ultimate', false), stopAt = cast + move.contacts[0], finish = cast + move.contacts[move.contacts.length - 1];
    const phases = frames.map(f => f.phase);
    expect(phases).toContain('opener');
    expect(phases).toContain('field');
    expect(phases, 'no close-up: the stop is the opener').not.toContain('close');
    expect(phases, 'no over-the-shoulder release shot: the field is the second shot').not.toContain('release');
    const cinematic = phases.findIndex(p => p === 'swing' || p === 'field');
    expect(phases.indexOf('opener')).toBeLessThan(cinematic);
    expect(frames[cinematic].t, 'the swing to the field starts on the stop').toBeGreaterThanOrEqual(stopAt - 1 / 120);
    expect(frames[cinematic].t).toBeLessThan(stopAt + .05);
    const held = frames.filter(f => f.phase === 'field' && f.weight > .99 && f.t > stopAt + .2 && f.t < finish);
    expect(held.length, 'the field holds through the tour').toBeGreaterThan(60);
    for (const f of held) for (const id of ['me', 'v0', 'v1', 'v2']) {
      expect(f.on[`${id}:head`], `${id}'s head at ${f.t.toFixed(2)}`).toBe(true);
      expect(f.on[`${id}:feet`], `${id}'s feet at ${f.t.toFixed(2)}`).toBe(true);
    }
    let whip = 0;
    for (let i = 1; i < frames.length; i++) if (frames[i].weight > .5) whip = Math.max(whip, frames[i].aim.angleTo(frames[i - 1].aim) * 60 * DEG);
    expect(whip, 'degrees a second of aim').toBeLessThan(400);
    for (const f of frames) if (f.weight > .5) expect(f.inside).toBeGreaterThan(.45);
    const resume = frames.findIndex(f => f.t >= finish);
    expect(frames[resume + 10].phase).toBe('field');
    expect(frames[frames.length - 1].phase).toBe('none');
  });

  it('films nothing of the kind with the cinematic camera off', () => {
    const { frames } = film('jotaro', false);
    expect(frames.every(f => f.phase === 'none' && f.weight === 0)).toBe(true);
  });

  it.each(['jotaro', 'dio', 'gojo'] as FighterId[])('%s: a stop that catches nobody lets the push-in go at once - no field, no cinematic', user => {
    const { frames, cast } = film(user, true, [[.1, 12]]);
    const move = moveFor(user, 'ultimate', false), stopAt = cast + move.contacts[0];
    const phases = frames.map(f => f.phase);
    expect(phases).toContain('opener');
    for (const phase of ['close', 'field', 'release', 'impact']) expect(phases, phase).not.toContain(phase);
    const back = frames.findIndex(f => f.t > stopAt && f.weight === 0);
    expect(frames[back].t - stopAt, 'the quick return').toBeLessThan(.35);
    for (const f of frames.slice(back)) expect(f.weight).toBe(0);
  });

  it('gives a lone victim the impact shot on the resume, as any ultimate', () => {
    const { frames, cast } = film('dio', true, [[.1, 2]]);
    const move = moveFor('dio', 'ultimate', false), finish = cast + move.contacts[move.contacts.length - 1];
    const after = frames.filter(f => f.t > finish + .05 && f.t < finish + .6).map(f => f.phase);
    expect(after).toContain('impact');
  });
});
