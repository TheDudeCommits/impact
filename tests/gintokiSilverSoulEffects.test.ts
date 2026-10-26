import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';
import { GINTOKI_MOVES } from '../src/game/fighters/gintoki';
import type { Fighter } from '../src/render/Fighter';
import type { Flight } from '../src/render/CombatEffects';
import { GintokiSilverSoul, GINTOKI_SILVER_LIMITS } from '../src/render/signature/GintokiSilverSoul';
import { MoveStage, STAGE_LIMITS } from '../src/render/signature/MoveStage';
import { STAGED_BY_MODULE } from '../src/render/signature/StagedMoves';

const ID = 'gintoki' as FighterId, ULT = GINTOKI_MOVES.ultimate, SPECIAL = GINTOKI_MOVES.special, LAST = ULT.contacts.length - 1;
function body(id: string, patch: Partial<PlayerState> = {}): Fighter {
  const group = new THREE.Group();
  return { group, handR: new THREE.Vector3(.3, 1.2, .2), handL: new THREE.Vector3(-.3, 1.2, .2), strikePoint: (out: THREE.Vector3) => out.set(.5, 1.4, 1.1),
    state: { id, fighter: id === 'gintoki' ? ID : 'goku', alive: true, action: 'idle', actionSeq: 5, actionTime: 0, actionDuration: ULT.duration, yaw: 0, ...patch } as PlayerState } as unknown as Fighter;
}
const event = (patch: Partial<CombatEvent> = {}): CombatEvent => ({ id: 1, kind: 'confirm', fighter: ID, actorId: 'gintoki', targetId: 'foe', actionSeq: 5, slot: 'ultimate', serverTime: 10 + ULT.contacts[0], ...patch });
function setup(patch: Partial<PlayerState> = {}, budget = 1) {
  const scene = new THREE.Scene(), stage = MoveStage.for(scene, { budget }), fx = new GintokiSilverSoul(scene, { budget }), gintoki = body('gintoki', patch), foe = body('foe'); foe.group.position.z = 2.4;
  const fighters = new Map([['gintoki', gintoki], ['foe', foe]]), flights = new Map<string, Flight>();
  const drawn = () => { const c = stage.counts; return c.flames + c.glows + c.bolts + c.discs + c.shells + c.shots; };
  return { scene, stage, fx, gintoki, foe, fighters, flights, drawn, end() { fx.dispose(); stage.release(); } };
}

describe('Gintoki manually triggered wooden-sword presentation', () => {
  it('stages his own moves, so the baseline stands aside, and draws no flame: he has no energy', () => {
    expect(STAGED_BY_MODULE.has(ID)).toBe(true);
    const h = setup({ action: 'ultimate', actionTime: 2 / ULT.duration }); try {
      h.fx.handle(event(), h.fighters);
      for (const [i, at] of ULT.contacts.entries()) h.fx.handle(event({ id: 30 + i, kind: 'hit', contactIndex: i, serverTime: 10 + at }), h.fighters);
      for (let t = .5; t < 4; t += .1) { h.gintoki.state.actionTime = Math.min(1, t / ULT.duration); h.fx.update(10 + t, h.fighters, h.flights); expect(h.stage.counts.flames).toBe(0); }
    } finally { h.end(); }
  });

  it('leaves idle silent and stops an unconfirmed or whiffed ultimate wake, and never writes a state', () => {
    const h = setup(); try {
      const before = JSON.stringify(h.gintoki.state);
      h.fx.update(10, h.fighters, h.flights); expect(h.drawn()).toBe(0); expect(JSON.stringify(h.gintoki.state)).toBe(before);
      Object.assign(h.gintoki.state, { action: 'ultimate', actionTime: 2 / ULT.duration });
      h.fx.update(12, h.fighters, h.flights); expect(h.drawn()).toBe(0);
      h.fx.handle(event(), h.fighters); h.fx.update(12.02, h.fighters, h.flights); expect(h.drawn()).toBeGreaterThan(0);
      h.gintoki.state.whiffedAt = 12.03;
      h.fx.update(12.04, h.fighters, h.flights); expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('draws speed lines back along his run through the drive\'s wind-up, beside his back and never straight behind it', () => {
    const h = setup({ action: 'special', actionDuration: SPECIAL.duration, actionTime: .5 / SPECIAL.duration }); try {
      h.fx.update(10.5, h.fighters, h.flights);
      const a = (h.scene.getObjectByName('stage-bolts') as THREE.Mesh).geometry.getAttribute('aA'), b = (h.scene.getObjectByName('stage-bolts') as THREE.Mesh).geometry.getAttribute('aB');
      expect(h.stage.counts.bolts).toBe(11);
      for (let i = 0; i < 10; i++) { expect(Math.abs(a.getX(i))).toBeGreaterThanOrEqual(.45); expect(b.getZ(i)).toBeLessThan(a.getZ(i)); }
    } finally { h.end(); }
  });

  it('uses authoritative impact points, deduplicates and expires all impact receipts', () => {
    const h = setup({ action: 'special', actionDuration: SPECIAL.duration, actionTime: SPECIAL.contacts[0] / SPECIAL.duration }); try {
      const hit = event({ id: 7, kind: 'hit', slot: 'special', contactIndex: 0, serverTime: 10.66, endpoint: { x: 4, y: 1.2, z: 9 } });
      h.fx.handle(hit, h.fighters); h.fx.handle(hit, h.fighters);
      h.fx.update(10.76, h.fighters, h.flights);
      expect(h.stage.counts.shots).toBe(3);
      const a = (h.scene.getObjectByName('stage-bolts') as THREE.Mesh).geometry.getAttribute('aA');
      const mid = new THREE.Vector3(a.getX(0), a.getY(0), a.getZ(0)).add(new THREE.Vector3((h.scene.getObjectByName('stage-bolts') as THREE.Mesh).geometry.getAttribute('aB').getX(0), (h.scene.getObjectByName('stage-bolts') as THREE.Mesh).geometry.getAttribute('aB').getY(0), (h.scene.getObjectByName('stage-bolts') as THREE.Mesh).geometry.getAttribute('aB').getZ(0))).multiplyScalar(.5);
      expect(mid.distanceTo(new THREE.Vector3(4, 1.2, 9))).toBeLessThan(.4);
      Object.assign(h.gintoki.state, { action: 'idle', actionTime: 0 });
      h.fx.update(14, h.fighters, h.flights); expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it.each(['interrupted', 'new action', 'whiff', 'target death', 'reset'])('cancels a confirmed rampage on %s', reason => {
    const h = setup({ action: 'ultimate', actionTime: 2 / ULT.duration }); try {
      h.fx.handle(event(), h.fighters); h.fx.update(12, h.fighters, h.flights);
      expect(h.drawn()).toBeGreaterThan(0); expect(h.stage.counts.lights).toBeLessThanOrEqual(STAGE_LIMITS.lights / 2);
      if (reason === 'interrupted') h.gintoki.state.action = 'hurt';
      if (reason === 'new action') h.gintoki.state.actionSeq = 6;
      if (reason === 'whiff') h.fx.handle(event({ id: 2, kind: 'whiff' }), h.fighters);
      if (reason === 'target death') h.foe.state.alive = false;
      if (reason === 'reset') h.fx.reset();
      h.fx.update(12.01, h.fighters, h.flights); expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('gives the last cut nothing without its confirm; keeps a late-wave event burst bounded and disposes once', () => {
    const h = setup({ action: 'ultimate', actionTime: ULT.contacts[LAST] / ULT.duration }); try {
      const last = event({ id: 9, kind: 'hit', contactIndex: LAST, serverTime: 10 + ULT.contacts[LAST] });
      h.fx.handle(last, h.fighters);
      h.fx.update(10 + ULT.contacts[LAST] + .02, h.fighters, h.flights); expect(h.drawn()).toBe(0);
      h.fx.handle(event(), h.fighters); h.fx.handle({ ...last, id: 10 }, h.fighters);
      h.foe.state.alive = false;
      h.fx.update(10 + ULT.contacts[LAST] + .2, h.fighters, h.flights);
      expect(h.stage.counts.shots).toBe(5); expect(h.stage.counts.bolts).toBeGreaterThan(40);
      for (let i = 0; i < 500; i++) h.fx.handle(event({ id: 100 + i, kind: 'hit', slot: 'heavy', contactIndex: 0, serverTime: 10 + ULT.contacts[LAST] + .2 }), h.fighters);
      h.fx.update(10 + ULT.contacts[LAST] + .3, h.fighters, h.flights);
      expect(h.stage.counts.bolts).toBeLessThanOrEqual(STAGE_LIMITS.bolts / 2); expect(h.stage.counts.shots).toBeLessThanOrEqual(STAGE_LIMITS.shots); expect(GINTOKI_SILVER_LIMITS.marks).toBe(14);
      Object.assign(h.gintoki.state, { action: 'idle', actionTime: 0 });
      h.fx.update(20, h.fighters, h.flights); expect(h.drawn()).toBe(0);
      h.fx.dispose(); h.fx.dispose();
    } finally { h.end(); }
  });
});
