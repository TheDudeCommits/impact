import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FollowCamera } from '../src/render/FollowCamera';
import type { Fighter } from '../src/render/Fighter';
import type { FighterId, PlayerState } from '../src/game/types';

const state = (id: string, fighter: FighterId): PlayerState => ({ id, name: id, fighter, x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000, stamina: 100, ultimate: 0,
  action: 'idle', actionStarted: 0, actionDuration: 0, actionTime: 0, target: null, alive: true, isBot: false, grounded: true, guarding: false,
  cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } });
function box(size: [number, number, number], back: number, material: THREE.Material) {
  const geometry = new THREE.BoxGeometry(...size, 2, 2, 4).translate(0, size[1] / 2, -back);
  const n = geometry.getAttribute('position').count;
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(n * 4), 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Float32Array(n * 4).map((_, i) => i % 4 === 0 ? 1 : 0), 4));
  const bone = new THREE.Bone(), mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.add(bone); mesh.bind(new THREE.Skeleton([bone]));
  return mesh;
}
function fox() {
  const group = new THREE.Group(), model = new THREE.Group(); model.visible = false; group.add(model);
  group.add(box([2.4, 3, 9.5], 3.8, new THREE.MeshToonMaterial()));
  const s = state('me', 'naruto'); s.awakened = true;
  return { state: s, group, model, velocity: new THREE.Vector3(), joints: new Map() } as unknown as Fighter;
}
function susanoo(withShell: boolean) {
  const group = new THREE.Group(), model = new THREE.Group(); group.add(model);
  model.add(box([.5, 1.8, .3], 0, new THREE.MeshToonMaterial()));
  if (withShell) group.add(box([4, 7, 3], .3, new THREE.ShaderMaterial({ depthWrite: false })));
  const s = state('me', 'sasuke'); s.awakened = true;
  return { state: s, group, model, velocity: new THREE.Vector3(), joints: new Map() } as unknown as Fighter;
}
const foe = (z: number) => { const group = new THREE.Group(); group.position.set(.4, 0, z); return { state: state('foe', 'zoro'), group, velocity: new THREE.Vector3() } as unknown as Fighter; };
function settle(me: Fighter, distance: number) {
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 200), follow = new FollowCamera(camera);
  follow.mode = 'lockon';
  const them = foe(distance);
  let input = 0;
  for (let i = 0; i < 400; i++) { me.group.updateMatrixWorld(true); follow.update(1 / 60, me, input, 0, [], 0, them, true); input = follow.inputYaw; camera.updateMatrixWorld(); }
  const ndc = (up: number) => them.group.position.clone().setY(up).project(camera);
  return { camera, height: (ndc(1.8).y - ndc(0).y) / 2, feet: ndc(0), head: ndc(1.9) };
}

describe('a big form is framed over its shoulder', () => {
  it.each([[3.5, .19], [6, .155]])('Kurama: the target %f m off is drawn at %f of the frame or more, whole and in it', (d, least) => {
    const shot = settle(fox(), d);
    expect(shot.height, 'the target\'s size on screen').toBeGreaterThan(least);
    for (const p of [shot.feet, shot.head]) { expect(Math.abs(p.x)).toBeLessThan(1); expect(Math.abs(p.y)).toBeLessThan(.9); }
    expect(shot.camera.position.y).toBeGreaterThan(1.4);
    expect(shot.camera.position.y).toBeLessThan(2.8);
    expect(Math.abs(shot.camera.position.x)).toBeGreaterThan(1.5);
    expect(shot.camera.position.distanceTo(new THREE.Vector3())).toBeLessThan(8);
  });

  it('sizes a Susanoo user\'s rig by the body, not the ghost round it', () => {
    const plain = settle(susanoo(false), 3.5), worn = settle(susanoo(true), 3.5);
    expect(worn.camera.position.distanceTo(plain.camera.position)).toBeLessThan(1e-6);
    expect(worn.height).toBeGreaterThan(.22);
  });
});
