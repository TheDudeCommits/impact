import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';
import type { Fighter } from '../src/render/Fighter';
import type { Flight } from '../src/render/CombatEffects';
import { BOA_EMPRESS_ASSETS, BOA_EMPRESS_LIMITS, BoaEmpress, boaFingertip, boaHeelContact } from '../src/render/signature/BoaEmpress';
import { SIGNATURE } from '../src/render/signature/context';
import { damageScale } from '../src/game/moves';
import { BOA_HANCOCK_MOVES } from '../src/game/fighters/boa-hancock';

const BOA = 'boa-hancock' as FighterId;
function fighter(id: string, patch: Partial<PlayerState> = {}): Fighter {
  const group = new THREE.Group();
  const state = { id, fighter: id === 'boa' ? BOA : 'goku', alive: true, action: 'idle', actionSeq: 1,
    actionTime: 0, actionDuration: 2.85, actionStarted: 10, grounded: true, ...patch } as PlayerState;
  const forearm = new THREE.Bone(), hand = new THREE.Bone(), head = new THREE.Bone(), foot = new THREE.Bone();
  forearm.position.set(.2, 1.6, 0); hand.position.set(0, 0, .3); head.position.set(0, 2, 0); foot.position.set(.2, .2, .4);
  forearm.add(hand); group.add(forearm, head, foot); group.updateMatrixWorld(true);
  return { state, group, handR: hand.getWorldPosition(new THREE.Vector3()),
    joints: new Map([['RightHand', hand], ['Head', head], ['RightFoot', foot], ['LeftFoot', foot]]) } as unknown as Fighter;
}
const receipt = (patch: Partial<CombatEvent> = {}): CombatEvent => ({ id: 1, kind: 'cast', serverTime: 10.42,
  actorId: 'boa', targetId: 'victim', fighter: BOA, slot: 'ultimate', actionSeq: 1,
  endpoint: { x: 3, y: 1.05, z: 0 }, ...patch });
function harness(patch: Partial<PlayerState> = {}) {
  const scene = new THREE.Scene(), fx = new BoaEmpress(scene, { budget: 1 });
  const actor = fighter('boa', patch), victim = fighter('victim'); victim.group.position.x = 3;
  const fighters = new Map([['boa', actor], ['victim', victim]]);
  const mesh = (name: string) => scene.getObjectByName(`boa-empress-${name}`) as THREE.InstancedMesh;
  return { scene, fx, actor, victim, fighters, mesh };
}

describe('Boa Empress manual presentation', () => {
  it('uses the authored contacts and runtime damage scaling rather than the raw schedule sum', () => {
    const move = BOA_HANCOCK_MOVES.ultimate;
    expect(move.contacts).toEqual([.42, 1.86]);
    expect(move.schedule!.reduce((sum, damage, index) => sum + Math.max(1, Math.round(damage * damageScale(index + 1))), 0)).toBe(282);
  });

  it('attaches the kiss to the live wrist direction, including a rotated native pose', () => {
    const actor = fighter('boa'), hand = actor.joints.get('RightHand')!;
    const out = new THREE.Vector3(), wrist = new THREE.Vector3();
    boaFingertip(actor, out); hand.getWorldPosition(wrist);
    expect(out.distanceTo(wrist)).toBeCloseTo(.10);
    expect(out.z).toBeCloseTo(.4);
    hand.parent!.rotation.y = Math.PI / 2; actor.group.updateMatrixWorld(true);
    boaFingertip(actor, out); hand.getWorldPosition(wrist);
    expect(out.distanceTo(wrist)).toBeCloseTo(.10);
    expect(out.x).toBeCloseTo(.6); expect(out.z).toBeCloseTo(0);
  });

  it('uses the native left heel for sweeps and the right heel for descending finishers', () => {
    const actor = fighter('boa', { action: 'heavy' }), left = new THREE.Bone(), right = actor.joints.get('RightFoot')!;
    left.position.set(-.3, 1.3, .8); actor.group.add(left); actor.joints.set('LeftFoot', left); actor.group.updateMatrixWorld(true);
    const out = new THREE.Vector3();
    for (let contact = 0; contact < 3; contact++) {
      expect(boaHeelContact(actor, contact, out)).toBe(true); expect(out.toArray()).toEqual(left.position.toArray());
    }
    actor.state.action = 'ultimate'; boaHeelContact(actor, 0, out); expect(out.toArray()).toEqual(left.position.toArray());
    boaHeelContact(actor, 1, out); expect(out.toArray()).toEqual(right.position.toArray());
    actor.state.action = 'light'; actor.state.chain = 2; actor.state.grounded = false;
    boaHeelContact(actor, 0, out); expect(out.toArray()).toEqual(right.position.toArray());
  });

  it('prepares all resources before the fight without requesting any textures', async () => {
    const { scene, fx } = harness();
    try {
      const geometries = scene.children.map(o => (o as THREE.Mesh).geometry);
      expect(BOA_EMPRESS_ASSETS).toEqual([]);
      await fx.load([BOA]); await fx.load(['goku']);
      expect(scene.children).toHaveLength(5);
      expect(scene.children.map(o => (o as THREE.Mesh).geometry)).toEqual(geometries);
    } finally { fx.dispose(); }
  });

  it('does not petrify from a cast, release, block, whiff or awakened idle', () => {
    const { fx, fighters, mesh, actor } = harness({ action: 'ultimate', actionTime: .7 / 2.85 });
    try {
      for (const kind of ['cast', 'release', 'blocked', 'whiff'] as const) fx.handle(receipt({ kind }), fighters);
      fx.update(10.7, fighters, new Map());
      expect(mesh('stone').count).toBe(0); expect(mesh('slave-arrows').count).toBe(0);
      actor.state.action = 'idle'; actor.state.awakened = true;
      fx.update(11, fighters, new Map());
      const stones = mesh('stone'), matrix = new THREE.Matrix4(), p = new THREE.Vector3();
      expect(stones.count).toBe(5);
      for (let i = 0; i < stones.count; i++) {
        stones.getMatrixAt(i, matrix); p.setFromMatrixPosition(matrix);
        expect(p.distanceTo(actor.group.position)).toBeLessThan(.7);
      }
      expect(mesh('regal-ink').count).toBe(6);
    } finally { fx.dispose(); }
  });

  it('keeps the stone shell attached to the confirmed victim and shatters only on the final hit receipt', () => {
    const { fx, fighters, mesh, victim, actor } = harness({ action: 'ultimate', actionTime: .8 / 2.85, confirmedAt: 10.42 });
    try {
      fx.handle(receipt({ kind: 'confirm' }), fighters); fx.update(10.8, fighters, new Map());
      expect(mesh('stone').count).toBe(8);
      victim.group.position.set(4, .5, -2); fx.update(10.9, fighters, new Map());
      const matrix = new THREE.Matrix4(), p = new THREE.Vector3();
      mesh('stone').getMatrixAt(0, matrix); p.setFromMatrixPosition(matrix);
      expect(p.x).toBeCloseTo(4); expect(p.z).toBeCloseTo(-1.71);
      actor.state.actionTime = 1.9 / 2.85;
      fx.update(11.9, fighters, new Map());
      expect(mesh('stone').count).toBe(0);
      fx.handle(receipt({ id: 2, kind: 'hit', contactIndex: 1, serverTime: 11.9 }), fighters);
      fx.update(12, fighters, new Map()); expect(mesh('stone').count).toBe(16);
      fx.update(12.35, fighters, new Map()); expect(mesh('stone').count).toBe(0);
    } finally { fx.dispose(); }
  });

  it.each(['interrupt', 'sequence', 'whiff', 'target-death', 'reset'] as const)('clears a confirmed shell on %s', reason => {
    const { fx, fighters, mesh, actor, victim } = harness({ action: 'ultimate', actionTime: .8 / 2.85, confirmedAt: 10.42 });
    try {
      fx.handle(receipt({ kind: 'confirm' }), fighters); fx.update(10.8, fighters, new Map());
      expect(mesh('stone').count).toBeGreaterThan(0);
      if (reason === 'interrupt') actor.state.action = 'hurt';
      if (reason === 'sequence') actor.state.actionSeq = 2;
      if (reason === 'whiff') fx.handle(receipt({ kind: 'whiff', id: 2 }), fighters);
      if (reason === 'target-death') victim.state.alive = false;
      if (reason === 'reset') fx.reset();
      fx.update(10.81, fighters, new Map()); expect(mesh('stone').count).toBe(0);
    } finally { fx.dispose(); }
  });

  it('draws hearts and feathered arrows only for released tracked flights and clears them when the cast disappears', () => {
    const { fx, fighters, mesh } = harness();
    const flight: Flight = { fighter: BOA, slot: 'light', position: new THREE.Vector3(5, 2, 3), heading: new THREE.Vector3(1, 0, 0), released: false, since: 10.19 };
    const flights = new Map([['shot', flight]]), matrix = new THREE.Matrix4();
    try {
      fx.update(10.2, fighters, flights); expect(mesh('hearts').count).toBe(0);
      flight.released = true; fx.update(10.3, fighters, flights);
      expect(mesh('hearts').count).toBe(1);
      mesh('hearts').getMatrixAt(0, matrix); expect(new THREE.Vector3().setFromMatrixPosition(matrix).toArray()).toEqual([5, 2, 3]);
      flight.slot = 'special'; fx.update(10.4, fighters, flights);
      expect(mesh('hearts').count).toBe(0); expect(mesh('slave-arrows').count).toBe(5);
      mesh('slave-arrows').getMatrixAt(2, matrix);
      expect(new THREE.Vector3(0, 1, 0).transformDirection(matrix).distanceTo(flight.heading)).toBeLessThan(1e-6);
      flights.clear(); fx.update(10.5, fighters, flights);
      expect(mesh('slave-arrows').count).toBe(0); expect(mesh('heart-contours').count).toBe(0);
    } finally { fx.dispose(); }
  });

  it('keeps the low-detail variant recognizable and bounded', () => {
    const scene = new THREE.Scene(), fx = new BoaEmpress(scene, { budget: .3 });
    const actor = fighter('boa', { awakened: true }), fighters = new Map([['boa', actor]]);
    const flights = new Map([['shot', { fighter: BOA, slot: 'special', position: new THREE.Vector3(), heading: new THREE.Vector3(0, 0, 1), released: true, since: 1 } as Flight]]);
    try {
      fx.update(2, fighters, flights);
      expect((scene.getObjectByName('boa-empress-slave-arrows') as THREE.InstancedMesh).count).toBe(3);
      expect((scene.getObjectByName('boa-empress-regal-ink') as THREE.InstancedMesh).count).toBe(4);
      expect((scene.getObjectByName('boa-empress-stone') as THREE.InstancedMesh).count).toBe(3);
    } finally { fx.dispose(); }
  });

  it('ends a short petrification touch immediately when its attacker is interrupted', () => {
    const { fx, fighters, actor, mesh } = harness({ action: 'heavy', actionDuration: 1.28, actionTime: .65 / 1.28 });
    try {
      fx.handle(receipt({ kind: 'hit', slot: 'heavy', serverTime: 10.62 }), fighters);
      fx.update(10.7, fighters, new Map()); expect(mesh('stone').count).toBeGreaterThan(0);
      actor.state.action = 'hurt'; fx.update(10.71, fighters, new Map());
      expect(mesh('stone').count).toBe(0); expect(mesh('hearts').count).toBe(0);
    } finally { fx.dispose(); }
  });

  it('does not mutate either fighter and retires the persistent regalia at the awakening deadline', () => {
    const { fx, fighters, actor, victim, mesh } = harness({ awakened: true, awakenedUntil: 12 });
    const before = JSON.stringify([actor.state, victim.state]);
    try {
      fx.update(11, fighters, new Map()); expect(mesh('regal-ink').count).toBeGreaterThan(0);
      fx.update(12.01, fighters, new Map()); expect(mesh('regal-ink').count).toBe(0); expect(mesh('stone').count).toBe(0);
      expect(JSON.stringify([actor.state, victim.state])).toBe(before);
    } finally { fx.dispose(); }
  });

  it('deduplicates final impacts and bounds repeated events without allocating scene nodes', () => {
    const { scene, fx, fighters, mesh } = harness({ action: 'ultimate', actionTime: 1.9 / 2.85 });
    const previous = SIGNATURE.screen, impactFrame = vi.fn(); SIGNATURE.screen = { impactFrame };
    try {
      const event = receipt({ kind: 'hit', contactIndex: 1, serverTime: 11.9 });
      fx.handle(event, fighters); fx.handle(event, fighters); fx.update(12, fighters, new Map());
      expect(impactFrame).toHaveBeenCalledTimes(1); expect(mesh('stone').count).toBe(16);
      for (let id = 2; id < 1000; id++) fx.handle({ ...event, id }, fighters);
      fx.update(12, fighters, new Map());
      expect(scene.children.filter(child => child.name.startsWith('boa-'))).toHaveLength(5);
      expect(mesh('stone').count).toBeLessThanOrEqual(BOA_EMPRESS_LIMITS.stones);
      expect(mesh('hearts').count).toBeLessThanOrEqual(BOA_EMPRESS_LIMITS.hearts);
    } finally { SIGNATURE.screen = previous; fx.dispose(); }
  });

  it('disposes every owned GPU resource once, and ignores work after disposal', () => {
    const { scene, fx, fighters } = harness();
    const disposals = scene.children.flatMap(o => {
      const mesh = o as THREE.InstancedMesh<THREE.BufferGeometry, THREE.Material>;
      return [vi.spyOn(mesh, 'dispose'), vi.spyOn(mesh.geometry, 'dispose'), vi.spyOn(mesh.material, 'dispose')];
    });
    fx.dispose(); fx.dispose(); fx.handle(receipt({ kind: 'hit' }), fighters); fx.update(11, fighters, new Map());
    expect(scene.children).toHaveLength(0);
    for (const spy of disposals) expect(spy).toHaveBeenCalledTimes(1);
  });
});
