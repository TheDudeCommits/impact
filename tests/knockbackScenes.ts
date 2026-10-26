import * as THREE from 'three';
import { ArenaSimulation } from '../src/game/simulation';
import { createRapierCollision } from '../src/game/rapierCollision';
import { stageColliders } from '../src/game/environmentLayout';
import type { FollowCamera } from '../src/render/FollowCamera';
import { Fighter } from '../src/render/Fighter';
import { MOVES } from '../src/game/moves';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import type { AttackSlot, CombatEvent, FighterId, PlayerInput, PlayerState } from '../src/game/types';

export const STAGE = 'chunin-exam-room' as const;
export type KnockbackScene = { name: string; me: FighterId; foe: FighterId; at: [number, number]; foeAt: [number, number]; ticks: number; ultimate?: boolean;
  drive: (i: number, me: PlayerState, foe: PlayerState, sentAt: number) => { attack?: AttackSlot; move?: [number, number]; dash?: boolean } };
const START = 60;
const toward = (me: PlayerState, foe: PlayerState): [number, number] => { const dx = foe.x - me.x, dz = foe.z - me.z, n = Math.hypot(dx, dz) || 1; return [dx / n, dz / n]; };
export const SCENES: KnockbackScene[] = [
  { name: 'heavy launch', me: 'naruto', foe: 'goku', at: [1, 3], foeAt: [1, .8], ticks: 300, drive: i => i === START ? { attack: 'heavy' } : {} },
  { name: 'dash-through', me: 'zoro', foe: 'goku', at: [0, 3.2], foeAt: [0, .9], ticks: 300, drive: i => i === START ? { attack: 'heavy' } : {} },
  { name: 'rush into the wall', me: 'zoro', foe: 'jotaro', at: [.4, -2.9], foeAt: [.2, -4.9], ticks: 330,
    drive: (i, me, foe, sent) => i < START || sent >= 0 ? {} : { move: Math.hypot(foe.x - me.x, foe.z - me.z) > 1.8 ? toward(me, foe) : undefined, attack: i % 9 === 0 ? 'light' : undefined } },
  { name: 'melee ultimate', me: 'sanji', foe: 'law', at: [3.5, 4.2], foeAt: [2.6, 2.8], ticks: 420, ultimate: true, drive: i => i === START ? { attack: 'ultimate' } : {} },
  { name: 'spirit bomb', me: 'goku', foe: 'jotaro', at: [-1.6, .1], foeAt: [0, -2.75], ticks: 480, ultimate: true, drive: i => i === START ? { attack: 'ultimate' } : {} },
];

export function hallWalls() {
  const mat = new THREE.MeshBasicMaterial(), out: THREE.Object3D[] = [];
  const { walls, landmarks } = stageColliders(STAGE);
  for (const c of walls) {
    const alongZ = c.halfZ > c.halfX;
    const m = new THREE.Mesh(new THREE.BoxGeometry(alongZ ? 1 : c.halfX * 2, 14, alongZ ? c.halfZ * 2 : 1), mat);
    m.position.set(alongZ ? Math.sign(c.x) * (Math.abs(c.x) - c.halfX + .1) : 0, 7, alongZ ? 0 : Math.sign(c.z) * (Math.abs(c.z) - c.halfZ + .1));
    m.updateMatrixWorld(true); out.push(m);
  }
  for (const c of landmarks) { const m = new THREE.Mesh(new THREE.BoxGeometry(c.halfX * 2, c.halfY * 2, c.halfZ * 2), mat); m.position.set(c.x, c.y, c.z); m.updateMatrixWorld(true); out.push(m); }
  return out;
}

export type Frame = { i: number; me: PlayerState; foe: PlayerState; sentAt: number; foeBody: Fighter; meBody: Fighter };
export async function playScene(scene: KnockbackScene, follow: FollowCamera, each: (frame: Frame) => void,
  yaw: (i: number, follow: FollowCamera, bearing: number, last: number) => number = (_i, f, b, last) => f.mode === 'lockon' ? last : b, pitch = (_i: number) => 0,
  rigs?: ReadonlyMap<FighterId, GLTF>) {
  const collision = await createRapierCollision(STAGE);
  const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, stage: STAGE, collision, seed: 17017 });
  const occluders = hallWalls();
  try {
    sim.addPlayer('me', scene.me, 'Me', false, { x: scene.at[0], y: 0, z: scene.at[1] });
    sim.addPlayer('foe', scene.foe, 'Foe', false, { x: scene.foeAt[0], y: 0, z: scene.foeAt[1] });
    sim.startMatch();
    if (scene.ultimate) sim.trainingCommand('me', 'awakening');
    const body = (s: PlayerState) => rigs?.get(s.fighter) ? new Fighter({ ...s }, rigs.get(s.fighter)!) : ({ state: { ...s }, group: new THREE.Group(), velocity: new THREE.Vector3() } as unknown as Fighter);
    const meBody = body(sim.getPlayer('me')!), foeBody = body(sim.getPlayer('foe')!);
    follow.director.crowd = new Map([['me', meBody], ['foe', foeBody]]);
    let input = Math.atan2(scene.foeAt[0] - scene.at[0], scene.foeAt[1] - scene.at[1]), sentAt = -1, seq = 0;
    for (let i = 0; i < scene.ticks; i++) {
      const me = sim.getPlayer('me')!, foe = sim.getPlayer('foe')!;
      const c = scene.drive(i, me, foe, sentAt);
      const command: PlayerInput = { seq: seq, moveX: c.move?.[0] ?? 0, moveZ: c.move?.[1] ?? 0, yaw: follow.movementYaw, targetId: 'foe', attack: c.attack, dash: c.dash };
      sim.submitInput('me', command);
      sim.submitInput('foe', { seq: seq++, moveX: 0, moveZ: 0, yaw: Math.atan2(me.x - foe.x, me.z - foe.z), targetId: 'me' });
      sim.step();
      const events: CombatEvent[] = sim.snapshot(true).events;
      for (const e of events) {
        if (e.kind === 'hit' && e.actorId === 'me' && (e.reaction === 'launched' || e.reaction === 'stun') && sentAt < 0) sentAt = i;
        if (e.kind === 'hit' && e.damage) {
          const heading = e.origin && e.endpoint ? new THREE.Vector3(e.endpoint.x - e.origin.x, 0, e.endpoint.z - e.origin.z) : undefined;
          follow.impact(Math.min(1, .2 + e.damage / 460), heading, e.slot === 'ultimate' || (e.slot === 'light' && (e.chain ?? 0) >= 3) ? 2 : e.slot === 'heavy' || e.slot === 'special' ? 1 : 0);
          follow.holdFor(Math.min(1, e.damage / 240));
        }
        if (e.kind === 'wall-splat') follow.impact(.46);
        if (e.kind === 'ground-bounce') follow.impact(.36);
        if (rigs && (e.kind === 'hit' || e.kind === 'blocked') && e.endpoint && e.damage) {
          const toward = e.origin ? new THREE.Vector3(e.endpoint.x - e.origin.x, e.endpoint.y - e.origin.y, e.endpoint.z - e.origin.z) : undefined;
          const struck = e.targetId === 'me' ? meBody : e.targetId === 'foe' ? foeBody : undefined;
          const style = e.fighter && e.slot ? MOVES[e.fighter][e.slot].style : undefined;
          if (struck && rigs.get(struck.state.fighter)) struck.impact(true, e.slot, style, e.contactIndex, toward, e.kind === 'hit' ? e.damage : e.damage * 2.2, e.endpoint.y - struck.state.y, { chain: e.chain, fromBehind: e.fromBehind, reaction: e.reaction });
        }
      }
      follow.director.handle(events, 'me', id => id === 'me' ? meBody : id === 'foe' ? foeBody : undefined);
      const m = sim.getPlayer('me')!, t = sim.getPlayer('foe')!;
      for (const [b, s, o] of [[meBody, m, t], [foeBody, t, m]] as const) {
        if (rigs?.get(s.fighter)) {
          b.targetDistance = Math.hypot(o.x - s.x, o.z - s.z); b.targetPoint = (b.targetPoint ?? new THREE.Vector3()).set(o.x, o.y + 1.45, o.z);
          b.cameraPoint = follow.camera.position; b.update(1 / 60, s, true, 1 / 60);
        } else {
          b.velocity.set(s.x - b.group.position.x, s.y - b.group.position.y, s.z - b.group.position.z).multiplyScalar(i ? 60 : 0);
          Object.assign(b.state, s); b.group.position.set(s.x, s.y, s.z);
        }
      }
      const bearing = Math.atan2(t.x - m.x, t.z - m.z);
      follow.update(1 / 60, meBody, yaw(i, follow, bearing, input), pitch(i), occluders, .5, t.alive ? foeBody : undefined, true);
      input = follow.inputYaw;
      follow.camera.updateMatrixWorld();
      each({ i, me: m, foe: t, sentAt, foeBody, meBody });
    }
  } finally {
    sim.dispose();
    if (rigs) for (const b of follow.director.crowd?.values() ?? []) if (rigs.get(b.state.fighter)) b.dispose();
  }
}
