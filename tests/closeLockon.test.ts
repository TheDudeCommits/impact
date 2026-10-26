import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FollowCamera } from '../src/render/FollowCamera';
import { setLoomTop, clearLoomTops } from '../src/render/loomRegistry';
import type { Fighter } from '../src/render/Fighter';
import type { PlayerState } from '../src/game/types';

const state = (id: string): PlayerState => ({ id, name: id, fighter: 'zoro', x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000, stamina: 100, ultimate: 0,
  action: 'idle', actionStarted: 0, actionDuration: 0, actionTime: 0, target: null, alive: true, isBot: false, grounded: true, guarding: false,
  cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } });
const actor = (id: string, x = 0, z = 0) => {
  const group = new THREE.Group(); group.position.set(x, 0, z);
  const joints = new Map<string, THREE.Bone>();
  for (const [name, y] of [['Head', 1.62], ['LeftFoot', .08], ['RightFoot', .08]] as const) { const bone = new THREE.Bone(); bone.position.y = y; group.add(bone); joints.set(name, bone); }
  return { state: state(id), group, velocity: new THREE.Vector3(), joints, model: { visible: true } } as unknown as Fighter;
};
function settle(distance: number, frames = 300) {
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 200), follow = new FollowCamera(camera);
  follow.mode = 'lockon';
  const me = actor('me'), foe = actor('foe', .4, distance);
  let input = 0;
  for (let i = 0; i < frames; i++) { follow.update(1 / 60, me, input, 0, [], 0, foe, true); input = follow.inputYaw; camera.updateMatrixWorld(); me.group.updateMatrixWorld(true); foe.group.updateMatrixWorld(true); }
  const ndc = (b: Fighter, up: number) => b.group.position.clone().setY(up).project(camera);
  return { camera, follow, me, foe, ndc };
}

describe('close in, the lock-on lens stands back', () => {
  it('draws both bodies smaller and lower at arm\'s length, whole and apart, and leaves fighting range as it was', () => {
    const near = settle(1.1), mid = settle(3);
    const height = (r: ReturnType<typeof settle>, b: Fighter) => (r.ndc(b, 1.75).y - r.ndc(b, .04).y) / 2;
    expect(height(near, near.me), 'the player at arm\'s length').toBeLessThan(.5);
    expect(height(near, near.me)).toBeGreaterThan(.4);
    for (const b of [near.me, near.foe]) {
      expect(near.ndc(b, 1.95).y, 'crown').toBeLessThan(.5);
      expect(near.ndc(b, 0).y, 'feet').toBeGreaterThan(-.8);
    }
    expect(near.ndc(near.foe, 1).x - near.ndc(near.me, 1).x, 'apart').toBeGreaterThan(.25);
    expect(near.camera.position.distanceTo(near.me.group.position)).toBeGreaterThan(mid.camera.position.distanceTo(mid.me.group.position) + .5);
    expect(height(mid, mid.me)).toBeGreaterThan(.55);
  });

  it('eases in and out rather than stepping, within the lens\'s own pace', () => {
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 200), follow = new FollowCamera(camera);
    follow.mode = 'lockon';
    const me = actor('me'), foe = actor('foe', .4, 4);
    let input = 0, last: THREE.Vector3 | undefined, worst = 0;
    for (let i = 0; i < 480; i++) {
      const t = i / 60, d = t < 2 ? 4 : t < 2.2 ? 4 - 14.5 * (t - 2) : t < 5 ? 1.1 : Math.min(4, 1.1 + 14.5 * (t - 5));
      foe.group.position.set(.4, 0, d);
      follow.update(1 / 60, me, input, 0, [], 0, foe, true); input = follow.inputYaw; camera.updateMatrixWorld();
      if (last) worst = Math.max(worst, camera.position.distanceTo(last));
      last = camera.position.clone();
    }
    expect(worst, 'the most the lens moves in a frame').toBeLessThan(.12);
  });
});

describe('the reticle rides above the head', () => {
  it('puts the reticle and its nameplate over the crown on screen, at any range', () => {
    for (const d of [1.1, 1.6, 3, 6, 12]) {
      const { camera, follow, foe } = settle(d);
      const H = 900, marker = foe.group.position.clone().setY(1.1 + .65).project(camera);
      follow.aboveHead(marker, foe, H);
      const crown = foe.group.position.clone().setY(1.62 + .24).project(camera);
      const centre = (-marker.y * .5 + .5) * H, crownPx = (-crown.y * .5 + .5) * H;
      expect(crownPx - (centre + 66), `${d} m: plate clear of the hair`).toBeGreaterThan(0);
      expect(crownPx - (centre + 66), `${d} m: and not floating off`).toBeLessThan(20);
      expect(Math.abs(marker.x - crown.x), 'straight above').toBeLessThan(1e-9);
      expect(marker.z).toBeLessThan(1);
    }
  });

  it('never leaves the frame for a head near its top, and leaves anything else alone', () => {
    const { camera, follow, foe } = settle(3);
    foe.group.position.y = 2.6; foe.group.updateMatrixWorld(true);
    const marker = new THREE.Vector3(), H = 900;
    follow.aboveHead(marker.set(0, 0, .5), foe, H);
    expect((-marker.y * .5 + .5) * H, 'inside the band the HUD draws a reticle in').toBeGreaterThanOrEqual(61.9);
    const other = new THREE.Vector3(.1, .2, .5);
    follow.aboveHead(other, undefined, H);
    expect(other.toArray()).toEqual([.1, .2, .5]);
    void camera;
  });
});

describe('a Stand looming over its user is framed with them', () => {
  it('holds the Stand\'s crown under the health bars as well as the user\'s, at fighting range and at arm\'s length', () => {
    for (const d of [4.2, 1.6]) {
      const camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 200), follow = new FollowCamera(camera);
      follow.mode = 'lockon';
      const me = actor('me'), foe = actor('foe', .4, d);
      setLoomTop('me', 2.4);
      let input = 0;
      for (let i = 0; i < 300; i++) { follow.update(1 / 60, me, input, 0, [], 0, foe, true); input = follow.inputYaw; camera.updateMatrixWorld(); }
      const crown = new THREE.Vector3(.6, 2.4 + .4, -.55).project(camera);
      expect(crown.y, `${d} m: the Stand's crown under the bars`).toBeLessThan(.64);
      expect(Math.abs(crown.x)).toBeLessThan(1);
      expect(me.group.position.clone().setY(1.95).project(camera).y, 'the user\'s crown').toBeLessThan(.64);
      expect(me.group.position.clone().setY(0).project(camera).y, 'the user\'s feet').toBeGreaterThan(-.83);
      clearLoomTops();
    }
  });
});
