import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';
import { ASUKA_MOVES } from '../src/game/fighters/asuka';
import type { Fighter } from '../src/render/Fighter';
import type { Flight } from '../src/render/CombatEffects';
import { AsukaField, ASUKA_VFX_LIMITS, ASUKA_KNIFE, asukaKnife } from '../src/render/signature/AsukaField';
import { MoveStage, STAGE_LIMITS } from '../src/render/signature/MoveStage';
import { STAGED_BY_MODULE } from '../src/render/signature/StagedMoves';

const ID = 'asuka' as FighterId, ULT = ASUKA_MOVES.ultimate, LAST = ULT.contacts.length - 1;
function body(id: string, patch: Partial<PlayerState> = {}) {
  const group = new THREE.Group(), knife = new THREE.Bone(); knife.position.set(.3, 1.1, .3); group.add(knife); group.updateMatrixWorld(true);
  const limb: { at?: THREE.Vector3 } = {};
  const fighter = { group, bones: new Map([['progressiveknife', knife]]), handR: new THREE.Vector3(.3, 1.1, .3), handL: new THREE.Vector3(-.3, 1.3, .3),
    strikePoint: (out: THREE.Vector3) => limb.at ? out.copy(limb.at) : out.fromArray(ASUKA_KNIFE.tip).applyMatrix4(knife.matrixWorld),
    state: { id, fighter: id === 'asuka' ? ID : 'goku', alive: true, action: 'idle', actionSeq: 4, actionTime: 0, actionDuration: ULT.duration, yaw: 0, ...patch } as PlayerState } as unknown as Fighter;
  return { fighter, knife, limb };
}
const event = (patch: Partial<CombatEvent> = {}): CombatEvent => ({ id: 1, kind: 'confirm', fighter: ID, actorId: 'asuka', targetId: 'foe', actionSeq: 4, slot: 'ultimate', serverTime: 10 + ULT.contacts[0], ...patch });
function setup(patch: Partial<PlayerState> = {}, budget = 1) {
  const scene = new THREE.Scene(), stage = MoveStage.for(scene, { budget }), fx = new AsukaField(scene, { budget }), asuka = body('asuka', patch), foe = body('foe').fighter; foe.group.position.z = 2.4;
  const fighters = new Map([['asuka', asuka.fighter], ['foe', foe]]), flights = new Map<string, Flight>();
  const drawn = () => { const c = stage.counts; return c.flames + c.glows + c.bolts + c.discs + c.shells + c.shots; };
  const first = (pool: 'stage-glow' | 'stage-bolts', attribute: 'aP' | 'aA') => { const p = (scene.getObjectByName(pool) as THREE.Mesh).geometry.getAttribute(attribute); return new THREE.Vector3(p.getX(0), p.getY(0), p.getZ(0)); };
  return { scene, stage, fx, asuka: asuka.fighter, knife: asuka.knife, limb: asuka.limb, foe, fighters, flights, drawn, first, end() { fx.dispose(); stage.release(); } };
}

describe('Asuka manual A.T. Field presentation', () => {
  it('stages her own moves, so the baseline stands aside', () => { expect(STAGED_BY_MODULE.has(ID)).toBe(true); });

  it('keeps awakened idle completely quiet and does not write combat state', () => {
    const h = setup({ awakened: true });
    try {
      const before = JSON.stringify(h.asuka.state);
      h.fx.update(10, h.fighters, h.flights);
      expect(h.drawn()).toBe(0); expect(JSON.stringify(h.asuka.state)).toBe(before);
    } finally { h.end(); }
  });

  it('lights the knife that is shown along its own bone, and the limb that strikes when it is not the knife', () => {
    const h = setup({ action: 'light', actionDuration: ASUKA_MOVES.light.duration, actionTime: .5 });
    try {
      h.knife.position.set(3, 2, 1); h.asuka.group.updateMatrixWorld(true);
      const root = new THREE.Vector3(), tip = new THREE.Vector3();
      expect(asukaKnife(h.asuka, root, tip)).toBe(true);
      h.fx.update(10, h.fighters, h.flights);
      expect(h.stage.counts.bolts).toBe(2); expect(h.first('stage-bolts', 'aA').distanceTo(root)).toBeLessThan(1e-5); expect(h.first('stage-glow', 'aP').distanceTo(tip)).toBeLessThan(1e-5);
      h.limb.at = new THREE.Vector3(.2, .3, .9); Object.assign(h.asuka, { displayedClipName: 'Rush 2' });
      h.fx.update(10.02, h.fighters, h.flights);
      expect(h.stage.counts.bolts).toBe(0); expect(h.first('stage-glow', 'aP').distanceTo(h.limb.at)).toBeLessThan(1e-5);
    } finally { h.end(); }
  });

  it('starts and dismisses the manual awakening flare at normalized source phases', () => {
    const h = setup({ action: 'awaken', actionDuration: .9, actionTime: .3 });
    try {
      h.fx.update(10, h.fighters, h.flights); expect(h.drawn()).toBe(0);
      h.asuka.state.actionTime = .6; h.fx.update(10.3, h.fighters, h.flights);
      expect(h.stage.counts.bolts).toBe(24); expect(h.stage.counts.discs).toBe(1);
      h.asuka.state.actionTime = .98; h.fx.update(10.6, h.fighters, h.flights); expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('opens her Field on the striking hand through the special\'s wind-up, and breaks the victim\'s where the blow lands, once', () => {
    const move = ASUKA_MOVES.special, h = setup({ action: 'special', actionDuration: move.duration, actionTime: .5 / move.duration });
    try {
      h.limb.at = new THREE.Vector3(-.3, 1.3, .5);
      h.fx.update(10.5, h.fighters, h.flights);
      expect(h.stage.counts.bolts).toBeGreaterThan(24); expect(h.first('stage-glow', 'aP').distanceTo(h.limb.at)).toBeLessThan(1e-5);
      const hit = event({ id: 7, kind: 'hit', slot: 'special', contactIndex: 0, serverTime: 10.64 });
      h.fx.handle(hit, h.fighters); h.fx.handle(hit, h.fighters);
      h.asuka.state.actionTime = .7 / move.duration;
      h.fx.update(10.7, h.fighters, h.flights);
      expect(h.stage.counts.shots).toBe(5); expect(h.stage.counts.bolts).toBe(48);
      h.fx.update(14, h.fighters, h.flights);
      expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('shows no late unconfirmed or whiffed ultimate flare, and requires the confirm before the execution', () => {
    const h = setup({ action: 'ultimate', actionTime: 1.5 / ULT.duration });
    try {
      h.fx.update(11.5, h.fighters, h.flights); expect(h.drawn()).toBe(0);
      h.fx.handle(event(), h.fighters);
      h.fx.update(11.5, h.fighters, h.flights);
      expect(h.stage.counts.bolts).toBeGreaterThan(16); expect(h.stage.counts.lights).toBeLessThanOrEqual(STAGE_LIMITS.lights / 2);
      h.asuka.state.whiffedAt = 11.51;
      h.fx.update(11.52, h.fighters, h.flights); expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it.each(['interrupted', 'new action', 'whiff', 'target death', 'reset'])('cancels a confirmed execution on %s', reason => {
    const h = setup({ action: 'ultimate', actionTime: 2.2 / ULT.duration });
    try {
      h.fx.handle(event(), h.fighters); h.fx.update(12.2, h.fighters, h.flights);
      expect(h.drawn()).toBeGreaterThan(0);
      if (reason === 'interrupted') h.asuka.state.action = 'hurt';
      if (reason === 'new action') h.asuka.state.actionSeq = 5;
      if (reason === 'whiff') h.fx.handle(event({ id: 2, kind: 'whiff' }), h.fighters);
      if (reason === 'target death') h.foe.state.alive = false;
      if (reason === 'reset') h.fx.reset();
      h.fx.update(12.21, h.fighters, h.flights);
      expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('gives the last blow nothing without its confirm; with it, the cross outlives the victim, and ends', () => {
    const h = setup({ action: 'ultimate', actionTime: ULT.contacts[LAST] / ULT.duration });
    try {
      const last = event({ id: 9, kind: 'hit', contactIndex: LAST, serverTime: 10 + ULT.contacts[LAST] });
      h.fx.handle(last, h.fighters);
      h.fx.update(10 + ULT.contacts[LAST] + .02, h.fighters, h.flights); expect(h.drawn()).toBe(0);
      h.fx.handle(event(), h.fighters); h.fx.handle({ ...last, id: 10 }, h.fighters);
      h.foe.state.alive = false;
      const before = JSON.stringify(h.foe.state);
      h.fx.update(10 + ULT.contacts[LAST] + .3, h.fighters, h.flights);
      expect(h.stage.counts.shots).toBe(5); expect(h.stage.counts.bolts).toBeGreaterThan(2); expect(JSON.stringify(h.foe.state)).toBe(before);
      Object.assign(h.asuka.state, { action: 'idle', actionTime: 0 });
      h.fx.update(10 + ULT.contacts[LAST] + 4, h.fighters, h.flights); expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('caps crowded impacts and disposes idempotently', () => {
    const h = setup();
    try {
      for (let i = 0; i < 500; i++) h.fx.handle(event({ id: 100 + i, kind: 'hit', slot: 'heavy', serverTime: 12 }), h.fighters);
      h.fx.update(12.05, h.fighters, h.flights);
      expect(h.stage.counts.bolts).toBe(ASUKA_VFX_LIMITS.marks * 32); expect(h.stage.counts.bolts).toBeLessThanOrEqual(STAGE_LIMITS.bolts);
      h.fx.dispose(); h.fx.dispose();
    } finally { h.end(); }
  });
});
