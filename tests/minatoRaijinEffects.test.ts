import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';
import type { Fighter } from '../src/render/Fighter';
import { MinatoRaijin, MINATO_RAIJIN_LIMITS, MINATO_TEMPEST } from '../src/render/signature/MinatoRaijin';
import { MoveStage, STAGE_LIMITS } from '../src/render/signature/MoveStage';

const ID = 'minato' as FighterId;
function harness(budget = 1) {
  const scene = new THREE.Scene(), stage = MoveStage.for(scene, { budget }), fx = new MinatoRaijin(scene, { budget });
  function make(id: string) {
    const group = new THREE.Group(), joints = new Map<string, THREE.Object3D>();
    for (const name of ['RightHand', 'LeftHand', 'Head']) { const joint = new THREE.Object3D(); joint.position.set(name === 'LeftHand' ? -.3 : .3, 1, .4); group.add(joint); joints.set(name, joint); }
    scene.add(group);
    return { group, joints, handR: new THREE.Vector3(.3, 1, .4), handL: new THREE.Vector3(-.3, 1, .4), strikePoint: (out: THREE.Vector3) => joints.get('LeftHand')!.getWorldPosition(out),
      state: { id, fighter: id === 'minato' ? ID : 'goku', alive: true, grounded: true, action: 'idle', actionSeq: 2, actionTime: 0, actionDuration: 1, yaw: 0 } as PlayerState } as unknown as Fighter;
  }
  const actor = make('minato'), foe = make('foe'); foe.group.position.z = 2;
  const fighters = new Map([['minato', actor], ['foe', foe]]);
  const pool = (name: string) => (scene.getObjectByName(`minato-${name}`) as THREE.InstancedMesh).count;
  const own = () => [pool('spiral-arcs'), pool('seal-rings'), pool('flash-strokes')];
  const staged = () => { const c = stage.counts; return c.flames + c.glows + c.bolts + c.discs + c.lights; };
  const kunai = () => { actor.strikePoint = (out: THREE.Vector3) => actor.joints.get('RightHand')!.getWorldPosition(out); scene.updateMatrixWorld(true); };
  return { scene, stage, fx, actor, foe, fighters, pool, own, staged, kunai, end() { fx.dispose(); stage.release(); } };
}
const event = (p: Partial<CombatEvent> = {}): CombatEvent => ({ id: 1, kind: 'hit', actorId: 'minato', fighter: ID, targetId: 'foe', actionSeq: 2, slot: 'heavy', serverTime: 10, endpoint: { x: 0, y: 1, z: 2 }, ...p });

describe('Minato manually committed presentation', () => {
  it('renders no idle attacks including Sage idle and never changes state', () => {
    const h = harness();
    try {
      Object.assign(h.actor.state, { awakened: true }); const before = JSON.stringify(h.actor.state);
      h.fx.update(10, h.fighters);
      expect(h.own()).toEqual([0, 0, 0]); expect(h.staged()).toBe(0); expect(JSON.stringify(h.actor.state)).toBe(before);
    } finally { h.end(); }
  });
  it('awakening is the bounded formula at his feet, without a Rasengan or a state mutation', () => {
    const h = harness();
    try {
      Object.assign(h.actor.state, { action: 'awaken', actionTime: .6 }); const before = JSON.stringify(h.actor.state);
      h.fx.update(10, h.fighters);
      expect(h.pool('spiral-arcs')).toBe(0); expect(h.pool('seal-rings')).toBeGreaterThan(0); expect(h.stage.counts.lights).toBe(0); expect(JSON.stringify(h.actor.state)).toBe(before);
    } finally { h.end(); }
  });
  it('an unconfirmed ultimate and a whiff draw nothing', () => {
    const h = harness();
    try {
      Object.assign(h.actor.state, { action: 'ultimate', actionTime: .85, actionDuration: 3.5 });
      h.fx.update(10, h.fighters);
      expect(h.own()).toEqual([0, 0, 0]); expect(h.staged()).toBe(0);
      Object.assign(h.actor.state, { action: 'heavy', actionTime: .5, whiffedAt: 10 });
      h.fx.update(10.1, h.fighters);
      expect(h.own()).toEqual([0, 0, 0]); expect(h.staged()).toBe(0);
    } finally { h.end(); }
  });
  it('winds the Rasengan up at the true shown strike socket, with its halo and its light on the room', () => {
    const h = harness();
    try {
      h.actor.joints.get('LeftHand')!.position.set(-.4, 1.3, .8); h.scene.updateMatrixWorld(true);
      Object.assign(h.actor.state, { action: 'heavy', actionTime: .45, actionDuration: .96 });
      h.fx.update(10, h.fighters);
      const arcs = h.scene.getObjectByName('minato-spiral-arcs') as THREE.InstancedMesh;
      expect(arcs.count).toBeGreaterThan(3);
      const m = new THREE.Matrix4(); arcs.getMatrixAt(0, m);
      expect(m.elements[12]).toBeCloseTo(-.4); expect(m.elements[13]).toBeCloseTo(1.3); expect(m.elements[14]).toBeCloseTo(.8);
      expect(h.stage.counts.glows).toBe(1); expect(h.stage.counts.bolts).toBeGreaterThan(3); expect(h.stage.counts.lights).toBe(1);
    } finally { h.end(); }
  });
  it.each(['lh', 'lllh', 'airHeavy'])('keeps a right-kunai %s branch free of the Rasengan: a glint of gold on the blade', branch => {
    const h = harness();
    try {
      Object.assign(h.actor.state, { action: 'heavy', branch, actionTime: .5 }); h.kunai();
      h.fx.update(10, h.fighters);
      expect(h.pool('spiral-arcs')).toBe(0); expect(h.stage.counts.glows).toBe(2); expect(h.stage.counts.bolts).toBe(1);
    } finally { h.end(); }
  });
  it.each([1, 2])('uses the native left palm on Rush stage %s', chain => {
    const h = harness();
    try {
      Object.assign(h.actor.state, { action: 'light', chain, actionTime: .5 }); h.scene.updateMatrixWorld(true);
      h.fx.update(10, h.fighters);
      expect(h.pool('spiral-arcs')).toBeGreaterThan(0);
    } finally { h.end(); }
  });
  it('classifies the shown Sage socket independently of the hidden base pose', () => {
    const h = harness();
    try {
      const formLeft = new THREE.Object3D(); formLeft.position.set(-.6, 1.4, .9); h.scene.add(formLeft);
      Object.defineProperty(h.actor, 'shownBody', { value: { joints: new Map([['LeftHand', formLeft]]) } });
      h.actor.strikePoint = (out: THREE.Vector3) => formLeft.getWorldPosition(out);
      Object.assign(h.actor.state, { action: 'special', branch: 'airSpecial', actionTime: .5 }); h.scene.updateMatrixWorld(true);
      h.fx.update(10, h.fighters);
      expect(h.pool('spiral-arcs')).toBeGreaterThan(0);
    } finally { h.end(); }
  });
  it('stages Flying Raijin: the formula and the marked kunai through the wind-up, the flash once he has crossed the floor', () => {
    const h = harness();
    try {
      Object.assign(h.actor.state, { action: 'special', actionTime: .3 / 1.05, actionDuration: 1.05 }); h.kunai();
      h.fx.update(10, h.fighters);
      expect(h.pool('seal-rings')).toBe(4); expect(h.pool('flash-strokes')).toBeGreaterThan(20); expect(h.stage.counts.lights).toBeGreaterThan(0);
      const still = h.stage.counts.bolts;
      h.actor.group.position.z = 1.4; h.scene.updateMatrixWorld(true);
      h.fx.update(10.05, h.fighters);
      expect(h.stage.counts.bolts).toBe(still + 3);
    } finally { h.end(); }
  });
  it('does not draw the flash across a server correction or a new action sequence', () => {
    const h = harness();
    try {
      Object.assign(h.actor.state, { action: 'special', actionTime: .3 / 1.05, actionDuration: 1.05 }); h.kunai();
      h.fx.update(10, h.fighters);
      const still = h.stage.counts.bolts;
      h.actor.group.position.x = 40; h.scene.updateMatrixWorld(true);
      h.fx.update(10.02, h.fighters);
      expect(h.stage.counts.bolts).toBe(still);
      h.actor.state.actionSeq = 3; h.actor.group.position.x = 43; h.scene.updateMatrixWorld(true);
      h.fx.update(10.04, h.fighters);
      expect(h.stage.counts.bolts).toBe(still);
    } finally { h.end(); }
  });
  it('deduplicates a confirmed receipt, without damage or position mutation', () => {
    const h = harness();
    try {
      Object.assign(h.actor.state, { action: 'heavy', actionTime: .6 });
      const before = JSON.stringify([...h.fighters.values()].map(f => f.state));
      h.fx.handle(event(), h.fighters); h.fx.update(10.12, h.fighters);
      const shots = h.stage.counts.shots, arcs = h.pool('spiral-arcs');
      expect(shots).toBeGreaterThan(3); expect(arcs).toBeGreaterThan(6);
      h.fx.handle(event(), h.fighters); h.fx.update(10.12, h.fighters);
      expect(h.stage.counts.shots).toBe(shots); expect(h.pool('spiral-arcs')).toBe(arcs);
      expect(JSON.stringify([...h.fighters.values()].map(f => f.state))).toBe(before); expect(h.actor.group.position.toArray()).toEqual([0, 0, 0]);
    } finally { h.end(); }
  });
  it('requires a confirmed hit before the Tempest gathers, then plants its marks one after another', () => {
    const h = harness();
    try {
      Object.assign(h.actor.state, { action: 'ultimate', actionDuration: 3.5, actionTime: 1.3 / 3.5 }); h.kunai();
      h.fx.update(11.3, h.fighters);
      expect(h.own()).toEqual([0, 0, 0]);
      h.actor.state.confirmedAt = 10.56; h.fx.handle(event({ kind: 'confirm', slot: 'ultimate' }), h.fighters);
      h.fx.update(11.3, h.fighters);
      expect(h.pool('seal-rings')).toBe(MINATO_TEMPEST.marks * 2); expect(h.pool('flash-strokes')).toBeGreaterThan(MINATO_TEMPEST.marks * 11);
      expect(h.stage.counts.bolts).toBeGreaterThan(2); expect(h.stage.counts.discs).toBe(1); expect(h.stage.counts.lights).toBeGreaterThan(1);
    } finally { h.end(); }
  });
  it.each(['new sequence', 'interruption', 'death', 'whiff', 'target death', 'reset'])('lets a confirmed Tempest go on %s', why => {
    const h = harness();
    try {
      Object.assign(h.actor.state, { action: 'ultimate', actionDuration: 3.5, actionTime: 1.3 / 3.5, confirmedAt: 10.56 }); h.kunai();
      h.fx.handle(event({ kind: 'confirm', slot: 'ultimate' }), h.fighters); h.fx.update(11.3, h.fighters);
      expect(h.pool('seal-rings')).toBeGreaterThan(0);
      if (why === 'new sequence') h.actor.state.actionSeq = 3;
      if (why === 'death') h.actor.state.alive = false;
      if (why === 'target death') h.foe.state.alive = false;
      if (why === 'whiff') h.fx.handle(event({ kind: 'whiff', id: 2 }), h.fighters);
      if (why === 'reset') h.fx.reset();
      if (why === 'interruption') h.actor.state.action = 'hurt';
      h.fx.update(11.31, h.fighters);
      expect(h.pool('seal-rings')).toBe(0); expect(h.stage.counts.discs).toBe(0);
    } finally { h.end(); }
  });
  it('lets the last blow outlive its victim, and end', () => {
    const h = harness();
    try {
      Object.assign(h.actor.state, { action: 'ultimate', actionDuration: 3.5, actionTime: 2.85 / 3.5, confirmedAt: 10.56 }); h.kunai();
      h.fx.handle(event({ kind: 'confirm', slot: 'ultimate' }), h.fighters);
      h.fx.handle(event({ id: 2, slot: 'ultimate', contactIndex: 2, serverTime: 12.8 }), h.fighters);
      h.foe.state.alive = false; h.fighters.delete('foe');
      h.fx.update(12.9, h.fighters);
      expect(h.stage.counts.shots).toBeGreaterThan(3); expect(h.pool('spiral-arcs')).toBeGreaterThan(3); expect(h.pool('seal-rings')).toBeGreaterThanOrEqual(MINATO_TEMPEST.marks * 2 + 2);
      Object.assign(h.actor.state, { action: 'idle', actionTime: 0 });
      h.fx.update(13.6, h.fighters);
      expect(h.stage.counts.shots).toBeGreaterThan(0);
      h.fx.update(19, h.fighters);
      expect(h.stage.counts.shots).toBe(0); expect(h.own()).toEqual([0, 0, 0]); expect(h.staged()).toBe(0);
    } finally { h.end(); }
  });
  it('bounds a crowd of blows and disposes every owned draw idempotently', () => {
    const h = harness();
    Object.assign(h.actor.state, { action: 'ultimate', actionTime: .8, confirmedAt: 10 });
    for (let i = 0; i < 200; i++) h.fx.handle(event({ id: i + 1, slot: 'ultimate', contactIndex: 2 }), h.fighters);
    h.fx.update(10.12, h.fighters);
    expect(h.pool('spiral-arcs')).toBeLessThanOrEqual(MINATO_RAIJIN_LIMITS.arcs); expect(h.pool('seal-rings')).toBeLessThanOrEqual(MINATO_RAIJIN_LIMITS.rings); expect(h.pool('flash-strokes')).toBeLessThanOrEqual(MINATO_RAIJIN_LIMITS.strokes);
    for (const p of ['flames', 'glows', 'bolts', 'lights', 'discs', 'shells'] as const) expect(h.stage.counts[p], p).toBeLessThanOrEqual(STAGE_LIMITS[p]);
    h.fx.dispose(); h.fx.dispose(); h.stage.release();
    expect(h.scene.children.filter(o => o instanceof THREE.InstancedMesh)).toEqual([]);
  });
});
