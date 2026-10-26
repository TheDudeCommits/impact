import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FollowCamera } from '../src/render/FollowCamera';
import { sightClearance } from '../src/render/CameraDirector';
import { ArenaSimulation } from '../src/game/simulation';
import { MOVES } from '../src/game/moves';
import { moveFor } from '../src/game/awakening';
import { rollerAt, ROLLER_TIMING } from '../src/render/signature/RoadRoller';
import type { Fighter } from '../src/render/Fighter';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';

type Body = Fighter & { state: PlayerState; model: { visible: boolean }; handR: THREE.Vector3 };
function body(state: PlayerState): Body {
  const group = new THREE.Group(); group.position.set(state.x, state.y, state.z);
  return { state: { ...state }, group, velocity: new THREE.Vector3(), model: { visible: true }, handR: new THREE.Vector3() } as unknown as Body;
}
function drawn(b: Body) {
  const s = b.state, elapsed = s.actionTime * s.actionDuration, p = b.group.position;
  const form = s.fighter === 'luffy' && s.action === 'ultimate' && s.confirmedAt !== undefined && elapsed < s.actionDuration - .23;
  b.model.visible = !form;
  b.handR.set(p.x + Math.sin(s.yaw) * .4, p.y + (form ? 2.3 : 1.4), p.z + Math.cos(s.yaw) * .4);
}
type Frame = { phase: string; weight: number; eye: THREE.Vector3; t: number; bodies: Map<string, THREE.Vector3>; yaw: number; camera: THREE.PerspectiveCamera; hand: THREE.Vector3 };
function film(user: FighterId, spots: [number, number][], seconds = 7, lockOn = 'v0') {
  const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, seed: 5 });
  sim.addPlayer('me', user, 'Me', false, { x: 0, y: 0, z: 0 });
  spots.forEach(([x, z], i) => sim.addPlayer('v' + i, 'goku', 'V', false, { x, y: 0, z }));
  sim.actors.get('me')!.state.ultimate = 100;
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 200), follow = new FollowCamera(camera);
  follow.mode = 'lockon'; follow.cinematics = true;
  const bodies = new Map<string, Body>(sim.playerStates().map(p => [p.id, body(p)]));
  follow.director.crowd = bodies;
  let input = 0, seq = 0;
  const frames: Frame[] = [];
  for (let i = 0; i < 60 * seconds; i++) {
    sim.submitInput('me', { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, targetId: 'v0', attack: i === 30 ? 'ultimate' : undefined });
    sim.step();
    const events: CombatEvent[] = sim.drainEvents();
    for (const p of sim.playerStates()) { const b = bodies.get(p.id)!; Object.assign(b.state, p); b.group.position.set(p.x, p.y, p.z); b.group.rotation.y = p.yaw; drawn(b); }
    follow.director.handle(events, 'me', id => bodies.get(id));
    follow.update(1 / 60, bodies.get('me')!, input, 0, [], 0, bodies.get(lockOn)!, true); input = follow.inputYaw; camera.updateMatrixWorld();
    frames.push({ phase: follow.director.phase, weight: follow.director.weight, eye: camera.position.clone(), t: sim.serverTime,
      bodies: new Map([...bodies].map(([id, b]) => [id, b.group.position.clone()])), yaw: bodies.get('me')!.state.yaw, camera: camera.clone(), hand: bodies.get('me')!.handR.clone() });
  }
  sim.dispose();
  return { frames, cast: 31 / 60 };
}
const chest = (p: THREE.Vector3) => new THREE.Vector3(p.x, p.y + 1.1, p.z);
const onScreen = (camera: THREE.PerspectiveCamera, p: THREE.Vector3) => { const v = p.clone().project(camera); return v.z < 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1; };

describe('ultimate shots keep what the move summons out of the way', () => {
  it('King Kong Gun: the release shot sees the victim past the inflating fist', () => {
    const { frames, cast } = film('luffy', [[.2, 2.4], [3.4, 3.4], [-2.4, 5.4]], 8);
    const kong = MOVES.luffy.ultimate, blow = kong.contacts[kong.contacts.length - 1], from = kong.contacts[0] + .12, full = blow - .35, drive = blow - .3;
    const release = frames.filter(f => f.phase === 'release' && f.weight > .99 && f.t - cast > from && f.t - cast < drive);
    expect(release.length, 'the release shot is taken').toBeGreaterThan(20);
    let hidden = 0;
    for (const f of release) {
      const h = f.hand, v = f.bodies.get('v0')!, age = f.t - cast;
      const size = .45 + 1.75 * THREE.MathUtils.smoothstep(age, from, full), n = Math.hypot(1, 1.1), reach = size * .95;
      const ax = v.x - h.x, az = v.z - h.z, l = Math.hypot(ax, az) || 1;
      const cx = h.x + ax / l / n * reach, cz = h.z + az / l / n * reach, cy = h.y + 1.1 / n * reach, radius = size * .8;
      if (sightClearance(f.eye, chest(v), cx, cz, cy, cy) < radius) hidden++;
    }
    expect(hidden / release.length, 'frames with the victim behind the fist').toBeLessThan(.05);
  });

  it('Indra\'s Arrow: no lens inside the Susanoo, and the victim seen past it', () => {
    const { frames, cast } = film('sasuke', [[0, 2.2], [3.2, 2.9], [-2.1, 5]], 6);
    const shot = frames.filter(f => f.weight > .5 && f.t - cast < 4.5);
    expect(shot.some(f => f.phase === 'release')).toBe(true);
    for (const f of shot) {
      const me = f.bodies.get('me')!, x = me.x - Math.sin(f.yaw) * .35, z = me.z - Math.cos(f.yaw) * .35;
      if (f.eye.y > me.y + 4.3 + .3) continue;
      expect(Math.hypot(f.eye.x - x, f.eye.z - z), `lens out of the Susanoo at ${(f.t - cast).toFixed(2)} (${f.phase})`).toBeGreaterThan(1.35);
    }
    let hidden = 0;
    const release = shot.filter(f => f.phase === 'release' && f.weight > .99);
    for (const f of release) {
      const me = f.bodies.get('me')!, x = me.x - Math.sin(f.yaw) * .35, z = me.z - Math.cos(f.yaw) * .35;
      if (sightClearance(f.eye, chest(f.bodies.get('v0')!), x, z, me.y + 1.35, me.y + 2.95) < 1.35) hidden++;
    }
    expect(hidden / Math.max(1, release.length), 'release frames with the victim behind the Susanoo').toBeLessThan(.05);
  });

  it('a bystander where the shot would stand: the lens keeps off them and sees the victim past them', () => {
    const { frames, cast } = film('vegeta', [[.3, 3], [-1.3, -1.4]], 6);
    const release = frames.filter(f => f.phase === 'release' && f.weight > .99 && f.t - cast < 3.2);
    expect(release.length).toBeGreaterThan(20);
    for (const f of release) {
      const by = f.bodies.get('v1')!;
      expect(Math.hypot(f.eye.x - by.x, f.eye.z - by.z), 'lens off the bystander').toBeGreaterThan(1.1);
      expect(sightClearance(f.eye, chest(f.bodies.get('v0')!), by.x, by.z, by.y + .42, by.y + 1.43), 'victim clear of them').toBeGreaterThan(.42);
    }
  });
});

describe('the shot is about whoever the move is aimed at', () => {
  it('frames the fighter the ultimate goes to, not the one the lock-on had at the cast', () => {
    const { frames, cast } = film('vegeta', [[.3, 3], [3.5, 1.5]], 6, 'v1');
    const release = frames.filter(f => f.phase === 'release' && f.weight > .99 && f.t - cast < 3);
    expect(release.length).toBeGreaterThan(20);
    const framed = release.filter(f => onScreen(f.camera, chest(f.bodies.get('v0')!))).length;
    expect(framed / release.length, 'release frames holding the victim').toBeGreaterThan(.95);
  });

  it('swings from the close-up to the release round the side nobody stands on', () => {
    for (const [user, spots] of [['vegeta', [[.2, 1.4]]], ['goku', [[.3, 1.6], [-1.2, 2.6]]], ['ichigo', [[-.3, 1.5]]]] as [FighterId, [number, number][]][]) {
      const { frames } = film(user, spots, 5);
      for (const f of frames.filter(x => x.phase === 'swing' && x.weight > .99)) for (const [id, p] of f.bodies) {
        if (id === 'me' || f.eye.y > p.y + 2.2) continue;
        expect(Math.hypot(f.eye.x - p.x, f.eye.z - p.z), `${user}: the lens past ${id}`).toBeGreaterThan(.8);
      }
    }
  });
});

describe('the time stops keep their people in the frame', () => {
  it.each(['jotaro', 'dio'] as FighterId[])('%s: the main victim stays in the field through the resume blast', user => {
    const { frames, cast } = film(user, [[.1, 2], [1.7 * Math.sin(1.7), 4 * Math.cos(1.7)], [-4.8 * Math.sin(2.3), 4.8 * Math.cos(2.3)]], 7);
    const move = moveFor(user, 'ultimate', false), finish = cast + move.contacts[move.contacts.length - 1];
    const resume = frames.filter(f => f.phase === 'field' && f.weight > .99 && f.t >= finish);
    expect(resume.length, 'the field holds through the resume').toBeGreaterThan(10);
    for (const f of resume) expect(onScreen(f.camera, chest(f.bodies.get('v0')!)), `v0 at ${(f.t - finish).toFixed(2)} after the finisher`).toBe(true);
  });

  it('DIO: the road roller is in the field before it slams down', () => {
    const { frames, cast } = film('dio', [[.1, 2], [1.7 * Math.sin(1.7), 4 * Math.cos(1.7)], [-4.8 * Math.sin(2.3), 4.8 * Math.cos(2.3)]], 7);
    const finisher = MOVES.dio.ultimate.contacts[MOVES.dio.ultimate.contacts.length - 1];
    const hang = frames.filter(f => f.phase === 'field' && f.weight > .99 && f.t - cast > finisher - ROLLER_TIMING.hold + .1 && f.t - cast < finisher - ROLLER_TIMING.slam);
    expect(hang.length).toBeGreaterThan(10);
    for (const f of hang) {
      const pose = rollerAt(f.t - cast, finisher)!, v = f.bodies.get('v0')!;
      const top = new THREE.Vector3(v.x, v.y + pose.height + 3.25 * .9, v.z);
      expect(onScreen(f.camera, top), `the roller's top at ${(f.t - cast - finisher).toFixed(2)}`).toBe(true);
    }
  });
});
