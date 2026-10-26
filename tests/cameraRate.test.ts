import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FollowCamera } from '../src/render/FollowCamera';
import { frameSteps } from '../src/render/frameClock';
import type { Fighter } from '../src/render/Fighter';
import type { PlayerState } from '../src/game/types';

const state = (id: string): PlayerState => ({ id, name: id, fighter: 'naruto',
  x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000, stamina: 100, ultimate: 0, action: 'idle', actionStarted: 0,
  actionDuration: 0, actionTime: 0, target: null, alive: true, isBot: false, grounded: true, guarding: false,
  cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } });
const actor = (s: PlayerState) => { const group = new THREE.Group();
  return { state: s, group, velocity: new THREE.Vector3() } as unknown as Fighter; };

const at = (t: number, me: THREE.Vector3, foe: THREE.Vector3) => {
  me.set(Math.sin(t * 1.9) * 2.2, 0, Math.cos(t * 1.3) * 2.4);
  foe.set(Math.sin(t * 1.1 + 2) * 2.6, 0, Math.cos(t * 1.7 + 1) * 2.2);
};

function run(hz: number, seconds: number, probes: number[], policy: 'camera' | 'world' = 'camera') {
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 200);
  const follow = new FollowCamera(camera);
  const me = actor(state('me')), foe = actor(state('foe'));
  const dt = 1 / hz;
  const out: { eye: THREE.Vector3; aim: THREE.Vector3 }[] = [];
  const eyes: THREE.Vector3[] = [], aims: THREE.Vector3[] = [];
  let next = 0;
  for (let i = 0; i <= Math.round(seconds * hz); i++) {
    const t = i * dt;
    at(t, me.group.position, foe.group.position);
    me.state.x = me.group.position.x; me.state.z = me.group.position.z;
    foe.state.x = foe.group.position.x; foe.state.z = foe.group.position.z;
    const heading = Math.atan2(foe.group.position.x - me.group.position.x, foe.group.position.z - me.group.position.z);
    follow.update(frameSteps(dt)[policy], me, heading, 0, [], 0, foe, true);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    eyes.push(camera.position.clone()); aims.push(camera.getWorldDirection(new THREE.Vector3()));
    while (next < probes.length && probes[next] <= t) {
      const prev = Math.max(0, i - 1), u = THREE.MathUtils.clamp((probes[next] - prev * dt) / dt, 0, 1);
      out.push({ eye: eyes[prev].clone().lerp(camera.position, u),
        aim: aims[prev].clone().lerp(aims[i], u).normalize() });
      next++;
    }
  }
  return out;
}

describe('the shot is the same shot at any frame rate', () => {
  const seconds = 8;
  const probes = Array.from({ length: 16 }, (_, k) => seconds * (.3 + .7 * (k + 1) / 16));
  const reference = run(60, seconds, probes);

  it.each([30, 20, 15, 10])('holds the 60 Hz framing at %i frames a second', hz => {
    const got = run(hz, seconds, probes);
    let eye = 0, aim = 0;
    for (let k = 0; k < Math.min(got.length, reference.length); k++) {
      eye = Math.max(eye, got[k].eye.distanceTo(reference[k].eye));
      aim = Math.max(aim, got[k].aim.angleTo(reference[k].aim) * 180 / Math.PI);
    }
    expect(eye, `the eye sat ${eye.toFixed(2)} m from where the 60 Hz shot put it`).toBeLessThan(1);
    expect(aim, `the aim was ${aim.toFixed(1)} degrees out`).toBeLessThan(10);
  });

  it('would not hold it if the camera were handed the world\'s clamped step', () => {
    const got = run(10, seconds, probes, 'world');
    let eye = 0;
    for (let k = 0; k < Math.min(got.length, reference.length); k++) eye = Math.max(eye, got[k].eye.distanceTo(reference[k].eye));
    expect(eye, 'player anchoring does not accumulate a chase lag').toBeLessThan(.2);
  });

  it('does not let the impulse spring blow up on a long frame', () => {
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 200);
    const follow = new FollowCamera(camera);
    const me = actor(state('me')), foe = actor(state('foe'));
    foe.group.position.set(0, 0, 3); foe.state.z = 3;
    follow.update(1 / 60, me, 0, 0, [], 1, foe, true);
    follow.impact(1, new THREE.Vector3(1, 0, 0));
    for (let i = 0; i < 40; i++) follow.update(.25, me, 0, 0, [], 1, foe, true);
    expect(Number.isFinite(camera.position.x) && Number.isFinite(camera.position.y) && Number.isFinite(camera.position.z),
      `the eye went to ${camera.position.toArray().join(',')}`).toBe(true);
    expect(camera.position.length(), 'the shot was thrown out of the arena').toBeLessThan(60);
  });
});

describe('a hit is framed by what it was worth', () => {
  const hit = (amount: number) => {
    const run = (strike: boolean) => {
      const camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 200);
      const follow = new FollowCamera(camera);
      const me = actor(state('me')), foe = actor(state('foe'));
      foe.group.position.set(0, 0, 3); foe.state.z = 3;
      for (let i = 0; i < 240; i++) follow.update(1 / 60, me, 0, 0, [], 1, foe, true);
      if (strike) { follow.impact(amount, new THREE.Vector3(1, 0, 0)); follow.holdFor(1); }
      const frames: { q: THREE.Quaternion; fov: number }[] = [];
      for (let i = 0; i < 240; i++) {
        follow.update(1 / 60, me, 0, 0, [], 1, foe, true);
        frames.push({ q: camera.quaternion.clone(), fov: camera.fov });
      }
      return frames;
    };
    const still = run(false), struck = run(true);
    let roll = 0, settle = 0, lens = 0;
    for (let i = 0; i < struck.length; i++) {
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(struck[i].q);
      roll = Math.max(roll, Math.abs(Math.atan2(right.y, Math.hypot(right.x, right.z))) * 180 / Math.PI);
      const off = struck[i].q.angleTo(still[i].q) * 180 / Math.PI, fov = Math.abs(struck[i].fov - still[i].fov);
      lens = Math.max(lens, fov);
      if (off > .1 || fov > .1) settle = (i + 1) / 60;
    }
    return { roll, settle, lens };
  };

  it('kicks harder and settles longer up the tiers', () => {
    const light = hit(.15), heavy = hit(.4), finisher = hit(.8);
    expect(light.roll, `light ${light.roll.toFixed(2)} vs heavy ${heavy.roll.toFixed(2)} deg`).toBeLessThan(heavy.roll);
    expect(heavy.roll, `heavy ${heavy.roll.toFixed(2)} vs finisher ${finisher.roll.toFixed(2)} deg`).toBeLessThan(finisher.roll);
    expect(light.settle, `light ${light.settle} s vs heavy ${heavy.settle} s`).toBeLessThan(heavy.settle);
    expect(heavy.settle, `heavy ${heavy.settle} s vs finisher ${finisher.settle} s`).toBeLessThan(finisher.settle);
    expect(light.lens, 'a jab punched in').toBeLessThan(1e-6);
    expect(heavy.lens).toBeLessThan(1e-6);
    expect(finisher.lens).toBeLessThan(1e-6);
  });

  it('holds the finisher for a beat before it settles', () => {
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 200);
    const follow = new FollowCamera(camera);
    const me = actor(state('me')), foe = actor(state('foe'));
    foe.group.position.set(0, 0, 3); foe.state.z = 3;
    for (let i = 0; i < 240; i++) follow.update(1 / 60, me, 0, 0, [], 0, foe, true);
    follow.impact(.8); follow.holdFor(1);
    const fovs: number[] = [];
    for (let i = 0; i < 30; i++) { follow.update(1 / 60, me, 0, 0, [], 0, foe, true); fovs.push(camera.fov); }
    expect(fovs[12], 'the finisher let go inside its beat').toBeLessThanOrEqual(fovs[6] + 1e-6);
  });
});
