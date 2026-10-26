import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';
import { JOLYNE_MOVES } from '../src/game/fighters/jolyne';
import type { Fighter } from '../src/render/Fighter';
import type { Flight } from '../src/render/CombatEffects';
import { JolyneStoneThread, JOLYNE_THREAD_LIMITS, jolyneCommandJoint } from '../src/render/signature/JolyneStoneThread';
import { MoveStage, STAGE_LIMITS } from '../src/render/signature/MoveStage';
import { STAGED_BY_MODULE } from '../src/render/signature/StagedMoves';

const ID = 'jolyne' as FighterId, ULT = JOLYNE_MOVES.ultimate, SPECIAL = JOLYNE_MOVES.special, LAST = ULT.contacts.length - 1;
function body(id: string, patch: Partial<PlayerState> = {}): Fighter {
  const group = new THREE.Group();
  return { group, handR: new THREE.Vector3(-.3, 1.3, .4), handL: new THREE.Vector3(.3, 1.2, .4), strikePoint: (out: THREE.Vector3) => out.set(.9, 1.3, 1.6),
    state: { id, fighter: id === 'jolyne' ? ID : 'goku', alive: true, action: 'idle', actionSeq: 7, actionTime: 0, actionDuration: ULT.duration, yaw: 0, ...patch } as PlayerState } as unknown as Fighter;
}
const event = (patch: Partial<CombatEvent> = {}): CombatEvent => ({ id: 1, kind: 'confirm', fighter: ID, actorId: 'jolyne', targetId: 'foe', actionSeq: 7, slot: 'ultimate', serverTime: 10 + ULT.contacts[0], ...patch });
function setup(patch: Partial<PlayerState> = {}, budget = 1) {
  const scene = new THREE.Scene(), stage = MoveStage.for(scene, { budget }), fx = new JolyneStoneThread(scene, { budget }), jolyne = body('jolyne', patch), foe = body('foe'); foe.group.position.z = 2.4;
  const fighters = new Map([['jolyne', jolyne], ['foe', foe]]), flights = new Map<string, Flight>();
  const drawn = () => { const c = stage.counts; return c.flames + c.glows + c.bolts + c.discs + c.shells + c.shots; };
  const start = (i: number) => { const p = (scene.getObjectByName('stage-bolts') as THREE.Mesh).geometry.getAttribute('aA'); return new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)); };
  return { scene, stage, fx, jolyne, foe, fighters, flights, drawn, start, end() { fx.dispose(); stage.release(); } };
}

describe('Jolyne deliberate thread effects', () => {
  it('stages her own moves, so the baseline stands aside', () => { expect(STAGED_BY_MODULE.has(ID)).toBe(true); });

  it('uses each manual command hand without reading allocating motion evidence', () => {
    const h = setup(); try {
      const s = h.jolyne.state;
      Object.assign(s, { action: 'light', chain: 3, actionTime: .4, actionDuration: .7 }); expect(jolyneCommandJoint(s)).toBe('LeftHand');
      Object.assign(s, { action: 'heavy', branch: 'lh' }); expect(jolyneCommandJoint(s)).toBe('RightHand');
      Object.assign(s, { branch: 'airHeavy' }); expect(jolyneCommandJoint(s)).toBe('LeftHand');
      Object.assign(s, { branch: undefined, action: 'special', actionDuration: 1.48, actionTime: .72 / 1.48 }); expect(jolyneCommandJoint(s)).toBe('LeftHand');
      Object.assign(s, { action: 'ultimate', actionDuration: 4, actionTime: 3.18 / 4 }); expect(jolyneCommandJoint(s)).toBe('LeftHand');
      Object.assign(h.jolyne, { motionEvidence: () => { throw Error('per-frame evidence allocation'); } });
      h.fx.update(10, h.fighters, h.flights);
    } finally { h.end(); }
  });

  it('emits no idle effects or unconfirmed late-ultimate target threads, and never writes a state', () => {
    const h = setup(); try {
      const before = JSON.stringify(h.jolyne.state);
      h.fx.update(10, h.fighters, h.flights); expect(h.drawn()).toBe(0); expect(JSON.stringify(h.jolyne.state)).toBe(before);
      Object.assign(h.jolyne.state, { action: 'ultimate', actionTime: 2 / ULT.duration });
      h.fx.update(12, h.fighters, h.flights); expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('runs thread from the hand she commands with to the Stand\'s fist, and throws five for the reel', () => {
    const h = setup({ action: 'light', chain: 1, actionDuration: JOLYNE_MOVES.light.duration, actionTime: .5 }); try {
      h.fx.update(10, h.fighters, h.flights);
      expect(h.stage.counts.bolts).toBe(14); expect(h.start(0).distanceTo(h.jolyne.handR)).toBeLessThan(1e-6);
      Object.assign(h.jolyne.state, { action: 'heavy', actionDuration: JOLYNE_MOVES.heavy.duration, actionTime: .3 / JOLYNE_MOVES.heavy.duration });
      h.fx.update(10.3, h.fighters, h.flights);
      expect(h.stage.counts.bolts).toBe(70); expect(h.start(0).distanceTo(h.jolyne.handL)).toBeCloseTo(.5, 5);
      h.jolyne.state.actionTime = (JOLYNE_MOVES.heavy.contacts[0] + .4) / JOLYNE_MOVES.heavy.duration;
      h.fx.update(10.98, h.fighters, h.flights); expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('draws the rush only while its blows go on, and a burst for each of them once', () => {
    const h = setup({ action: 'special', actionDuration: SPECIAL.duration, actionTime: .2 / SPECIAL.duration }); try {
      h.fx.update(10.2, h.fighters, h.flights);
      const gathering = h.stage.counts.bolts;
      h.jolyne.state.actionTime = .7 / SPECIAL.duration;
      h.fx.update(10.7, h.fighters, h.flights);
      expect(gathering).toBeGreaterThan(14); expect(h.stage.counts.bolts).toBe(20); expect(h.stage.counts.lights).toBe(1);
      for (const [i, at] of SPECIAL.contacts.entries()) { const hit = event({ id: 20 + i, kind: 'hit', slot: 'special', contactIndex: i, serverTime: 10 + at }); h.fx.handle(hit, h.fighters); h.fx.handle(hit, h.fighters); }
      h.jolyne.state.actionTime = (SPECIAL.contacts[2] + .05) / SPECIAL.duration;
      h.fx.update(10 + SPECIAL.contacts[2] + .05, h.fighters, h.flights);
      expect(h.stage.counts.shots).toBe(4);
      h.jolyne.state.actionTime = 1.4 / SPECIAL.duration;
      h.fx.update(13, h.fighters, h.flights); expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('shows the confirmed web only for its current action and target', () => {
    const h = setup({ action: 'ultimate', actionTime: 2 / ULT.duration }); try {
      h.fx.handle(event(), h.fighters); h.fx.handle(event(), h.fighters);
      h.fx.update(12, h.fighters, h.flights);
      expect(h.stage.counts.bolts).toBe(96 + 24 + 14 + 24); expect(h.stage.counts.lights).toBeLessThanOrEqual(STAGE_LIMITS.lights / 2);
      h.jolyne.state.actionSeq = 8;
      h.fx.update(12.02, h.fighters, h.flights); expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it.each(['interrupted', 'whiff', 'target death', 'reset'])('clears a confirmed web on %s', reason => {
    const h = setup({ action: 'ultimate', actionTime: 2.2 / ULT.duration }); try {
      h.fx.handle(event(), h.fighters); h.fx.update(12.2, h.fighters, h.flights);
      expect(h.drawn()).toBeGreaterThan(0);
      if (reason === 'interrupted') h.jolyne.state.action = 'hurt';
      if (reason === 'whiff') h.fx.handle(event({ id: 2, kind: 'whiff' }), h.fighters);
      if (reason === 'target death') h.foe.state.alive = false;
      if (reason === 'reset') h.fx.reset();
      h.fx.update(12.21, h.fighters, h.flights); expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('gives the last blow nothing without its confirm; with it, the web breaks, outlives the victim, and ends', () => {
    const h = setup({ action: 'ultimate', actionTime: ULT.contacts[LAST] / ULT.duration }); try {
      const last = event({ id: 9, kind: 'hit', contactIndex: LAST, serverTime: 10 + ULT.contacts[LAST] });
      h.fx.handle(last, h.fighters);
      h.fx.update(10 + ULT.contacts[LAST] + .02, h.fighters, h.flights); expect(h.drawn()).toBe(0);
      h.fx.handle(event(), h.fighters); h.fx.handle({ ...last, id: 10 }, h.fighters);
      h.foe.state.alive = false;
      h.fx.update(10 + ULT.contacts[LAST] + .2, h.fighters, h.flights);
      expect(h.stage.counts.shots).toBe(5); expect(h.stage.counts.bolts).toBeGreaterThan(100);
      Object.assign(h.jolyne.state, { action: 'idle', actionTime: 0 });
      h.fx.update(10 + ULT.contacts[LAST] + 4, h.fighters, h.flights); expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('maps awakening to its normalized runtime, bounds crowded events and disposes once', () => {
    const h = setup({ action: 'awaken', actionDuration: .9, actionTime: .5 }); try {
      h.fx.update(10.45, h.fighters, h.flights);
      expect(h.stage.counts.bolts).toBe(42);
      h.jolyne.state.actionTime = .95;
      h.fx.update(10.86, h.fighters, h.flights); expect(h.drawn()).toBe(0);
      for (let i = 0; i < 500; i++) h.fx.handle(event({ id: 100 + i, kind: 'hit', slot: 'heavy', serverTime: 12 }), h.fighters);
      h.fx.update(12.05, h.fighters, h.flights);
      expect(h.stage.counts.bolts).toBe(JOLYNE_THREAD_LIMITS.marks * 30); expect(h.stage.counts.shots).toBeLessThanOrEqual(STAGE_LIMITS.shots);
      h.fx.dispose(); h.fx.dispose();
    } finally { h.end(); }
  });
});
