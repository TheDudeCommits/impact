import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';
import type { Fighter } from '../src/render/Fighter';
import type { Flight } from '../src/render/CombatEffects';
import { BrolyBerserker, brolyMouth } from '../src/render/signature/BrolyBerserker';
import { BROLY_MOVES } from '../src/game/fighters/broly';

const BROLY = 'broly' as FighterId;
function actor(id: string, patch: Partial<PlayerState> = {}): Fighter {
  const group = new THREE.Group(), model = new THREE.Group(), head = new THREE.Bone(), jaw = new THREE.Bone();
  head.name = 'Head'; jaw.name = 'Jaw'; head.position.set(0, 1.9, 0); jaw.position.set(0, -.10, .05); head.add(jaw); model.add(head); group.add(model); group.updateMatrixWorld(true);
  return { group, model, joints: new Map([['Head', head]]), handR: new THREE.Vector3(.3, 1.4, .2), handL: new THREE.Vector3(-.3, 1.4, .2),
    state: { id, fighter: id === 'broly' ? BROLY : 'goku', alive: true, action: 'idle', actionSeq: 2,
      actionTime: 0, actionDuration: 3.24, ...patch } as PlayerState } as unknown as Fighter;
}
const event = (patch: Partial<CombatEvent> = {}): CombatEvent => ({ id: 1, kind: 'confirm', fighter: BROLY, actorId: 'broly', targetId: 'foe',
  actionSeq: 2, slot: 'ultimate', serverTime: 10.48, ...patch });
function harness(patch: Partial<PlayerState> = {}, budget = 1) {
  const scene = new THREE.Scene(), fx = new BrolyBerserker(scene, { budget }), broly = actor('broly', patch), foe = actor('foe');
  foe.group.position.set(0, 0, 2); foe.group.updateMatrixWorld(true);
  const fighters = new Map([['broly', broly], ['foe', foe]]), flights = new Map<string, Flight>();
  const mesh = (name: string) => scene.getObjectByName(`broly-berserker-${name}`) as THREE.InstancedMesh;
  return { scene, fx, broly, foe, fighters, flights, mesh };
}
describe('Broly manual berserker presentation', () => {
  it('takes its mouth from the displayed awakened body rather than the hidden base head', () => {
    const base = actor('broly'), form = actor('broly'); form.group.position.y = .4; form.group.updateMatrixWorld(true);
    Object.defineProperty(base, 'shownBody', { get: () => form });
    const p = brolyMouth(base, new THREE.Vector3());
    expect(p.y).toBeCloseTo(2.212); expect(p.z).toBeCloseTo(.119);
  });
  it('leaves idle and awakening free of damage and attack beams', () => {
    const { fx, fighters, flights, broly, mesh } = harness();
    try {
      const before = JSON.stringify(broly.state);
      fx.update(10, fighters, flights); expect(mesh('beams').count).toBe(0); expect(mesh('cores').count).toBe(0);
      expect(JSON.stringify(broly.state)).toBe(before);
      Object.assign(broly.state, { action: 'awaken', actionDuration: .9, actionTime: .6 });
      const awakened = JSON.stringify(broly.state); fx.update(10.54, fighters, flights);
      expect(mesh('rings').count).toBeGreaterThan(0); expect(mesh('beams').count).toBe(0); expect(JSON.stringify(broly.state)).toBe(awakened);
    } finally { fx.dispose(); }
  });
  it('never draws an ultimate beam from elapsed time alone, then anchors the confirmed beam to the live mouth', () => {
    const h = harness({ action: 'ultimate', actionTime: 2.55 / 3.24, confirmedAt: 10.48 });
    try {
      h.fx.update(12.55, h.fighters, h.flights); expect(h.mesh('beams').count).toBe(0);
      h.fx.handle(event(), h.fighters); h.fx.update(12.55, h.fighters, h.flights); expect(h.mesh('beams').count).toBe(2);
      const m = new THREE.Matrix4(), p = new THREE.Vector3(); h.mesh('beams').getMatrixAt(0, m);
      p.set(0, -.5, 0).applyMatrix4(m);
      expect(p.distanceTo(brolyMouth(h.broly, new THREE.Vector3()))).toBeLessThan(1e-5);
      h.broly.joints.get('Head')!.position.y += .15; h.broly.group.updateMatrixWorld(true);
      h.fx.update(12.56, h.fighters, h.flights); h.mesh('beams').getMatrixAt(0, m); p.set(0, -.5, 0).applyMatrix4(m);
      expect(p.distanceTo(brolyMouth(h.broly, new THREE.Vector3()))).toBeLessThan(1e-5);
    } finally { h.fx.dispose(); }
  });
  it.each(['interrupt', 'new action', 'whiff', 'target eliminated', 'reset'])('ends the confirmed beam on %s', reason => {
    const h = harness({ action: 'ultimate', actionTime: 2.55 / 3.24, confirmedAt: 10.48 });
    try {
      h.fx.handle(event(), h.fighters); h.fx.update(12.55, h.fighters, h.flights); expect(h.mesh('beams').count).toBe(2);
      if (reason === 'interrupt') h.broly.state.action = 'hurt';
      if (reason === 'new action') h.broly.state.actionSeq = 3;
      if (reason === 'whiff') h.fx.handle(event({ id: 2, kind: 'whiff' }), h.fighters);
      if (reason === 'target eliminated') h.foe.state.alive = false;
      if (reason === 'reset') h.fx.reset();
      h.fx.update(12.56, h.fighters, h.flights); expect(h.mesh('beams').count).toBe(0);
    } finally { h.fx.dispose(); }
  });
  it('shows the verified lethal finisher through its short beam tail after the target disappears', () => {
    const h = harness({ action: 'ultimate', actionTime: 2.55 / 3.24, confirmedAt: 10.48 });
    try {
      h.fx.handle(event(), h.fighters);
      h.fx.handle(event({ id: 2, kind: 'hit', contactIndex: 2, serverTime: 12.4948 }), h.fighters);
      h.foe.state.alive = false;
      h.fx.handle(event({ id: 3, kind: 'eliminated', actorId: 'foe', fighter: 'goku', serverTime: 12.4948 }), h.fighters);
      h.fighters.delete('foe');
      h.fx.update(12.55, h.fighters, h.flights); expect(h.mesh('beams').count).toBe(2);
      const m = new THREE.Matrix4(), end = new THREE.Vector3(); h.mesh('beams').getMatrixAt(0, m);
      end.set(0, .5, 0).applyMatrix4(m); expect(end.distanceTo(new THREE.Vector3(0, 1.05, 2))).toBeLessThan(1e-5);
      h.broly.state.actionTime = 2.83 / 3.24;
      h.fx.update(12.83, h.fighters, h.flights); expect(h.mesh('beams').count).toBe(0);
    } finally { h.fx.dispose(); }
  });
  it('emits Eraser Blow only from the authoritative released flight and clears expired flights', () => {
    const h = harness();
    const flight = { fighter: BROLY, slot: 'special', released: false, position: new THREE.Vector3(1, 2, 3), heading: new THREE.Vector3(0, 0, 1), since: 10 } as Flight;
    try {
      h.flights.set('shot', flight); h.fx.update(10, h.fighters, h.flights); expect(h.mesh('cores').count).toBe(0);
      flight.released = true; h.fx.update(10.2, h.fighters, h.flights); expect(h.mesh('cores').count).toBe(2);
      h.flights.clear(); h.fx.update(10.3, h.fighters, h.flights); expect(h.mesh('beams').count).toBe(0);
    } finally { h.fx.dispose(); }
  });
  it('retains a real distant projectile impact after the actor has recovered and deduplicates its receipt', () => {
    const h = harness();
    try {
      const hit = event({ kind: 'hit', slot: 'special', serverTime: 12, actionSeq: 1 });
      h.fx.handle(hit, h.fighters); h.fx.handle(hit, h.fighters); h.fx.update(12.03, h.fighters, h.flights);
      expect(h.mesh('debris').count).toBe(10);
      h.fx.update(12.4, h.fighters, h.flights); expect(h.mesh('debris').count).toBe(0);
    } finally { h.fx.dispose(); }
  });
  it('keeps the low-quality silhouette recognizable and releases all owned GPU resources', () => {
    const h = harness({ action: 'awaken', actionDuration: .9, actionTime: .6 }, .3);
    h.fx.update(10, h.fighters, h.flights); expect(h.mesh('debris').count).toBe(6); expect(h.mesh('rings').count).toBe(1);
    h.fx.dispose(); h.fx.dispose(); expect(h.scene.children.length).toBe(0);
  });
  it('fits the heavy and special native contact fractions to the established fast pace', () => {
    expect(BROLY_MOVES.heavy.contacts[0]).toBeCloseTo(BROLY_MOVES.heavy.duration * .54);
    expect(BROLY_MOVES.special.contacts[0]).toBeCloseTo(BROLY_MOVES.special.duration * .56);
    expect(BROLY_MOVES.special.contacts[0]).toBeGreaterThan(BROLY_MOVES.heavy.contacts[0]);
    expect(BROLY_MOVES.heavy.contacts[0]).toBeLessThanOrEqual(.5); expect(BROLY_MOVES.special.duration).toBeGreaterThanOrEqual(1.2);
  });
});
