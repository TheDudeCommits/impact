import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';
import { JOSUKE_MOVES } from '../src/game/fighters/josuke';
import type { Fighter } from '../src/render/Fighter';
import type { Flight } from '../src/render/CombatEffects';
import { JosukeRestoration, JOSUKE_RESTORATION_LIMITS } from '../src/render/signature/JosukeRestoration';
import { MoveStage, STAGE_LIMITS } from '../src/render/signature/MoveStage';
import { STAGED_BY_MODULE } from '../src/render/signature/StagedMoves';

const ID = 'josuke' as FighterId, ULT = JOSUKE_MOVES.ultimate, SPECIAL = JOSUKE_MOVES.special, LAST = ULT.contacts.length - 1;
function body(id: string, patch: Partial<PlayerState> = {}): Fighter {
  const group = new THREE.Group();
  return { group, handR: new THREE.Vector3(.3, 1.3, .2), handL: new THREE.Vector3(-.3, 1.3, .2), strikePoint: (out: THREE.Vector3) => out.set(.9, 1.3, 1.5),
    state: { id, fighter: id === 'josuke' ? ID : 'goku', alive: true, action: 'idle', actionSeq: 3, actionTime: 0, actionDuration: ULT.duration, yaw: 0, ...patch } as PlayerState } as unknown as Fighter;
}
const event = (patch: Partial<CombatEvent> = {}): CombatEvent => ({ id: 1, kind: 'confirm', fighter: ID, actorId: 'josuke', targetId: 'foe', actionSeq: 3, slot: 'ultimate', serverTime: 10 + ULT.contacts[0], ...patch });
function setup(patch: Partial<PlayerState> = {}, budget = 1) {
  const scene = new THREE.Scene(), stage = MoveStage.for(scene, { budget }), fx = new JosukeRestoration(scene, { budget }), josuke = body('josuke', patch), foe = body('foe'); foe.group.position.z = 2.4;
  const fighters = new Map([['josuke', josuke], ['foe', foe]]), flights = new Map<string, Flight>();
  const drawn = () => { const c = stage.counts; return c.flames + c.glows + c.bolts + c.discs + c.shells + c.shots; };
  return { scene, stage, fx, josuke, foe, fighters, flights, drawn, end() { fx.dispose(); stage.release(); } };
}

describe('Josuke manually triggered restoration presentation', () => {
  it('stages his own moves, so the baseline stands aside', () => { expect(STAGED_BY_MODULE.has(ID)).toBe(true); });

  it('leaves idle and unconfirmed input silent, and never writes a state', () => {
    const h = setup(); try {
      const before = JSON.stringify(h.josuke.state);
      h.fx.update(10, h.fighters, h.flights); expect(h.drawn()).toBe(0); expect(JSON.stringify(h.josuke.state)).toBe(before);
      Object.assign(h.josuke.state, { action: 'ultimate', actionTime: 2 / ULT.duration });
      h.fx.update(12, h.fighters, h.flights); expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('anchors a heavy to the authoritative endpoint, breaks the floor there, and mends it; replayed receipts count once', () => {
    const h = setup({ action: 'heavy', actionDuration: JOSUKE_MOVES.heavy.duration, actionTime: JOSUKE_MOVES.heavy.contacts[0] / JOSUKE_MOVES.heavy.duration }); try {
      const hit = event({ id: 7, kind: 'hit', slot: 'heavy', contactIndex: 0, serverTime: 10.48, endpoint: { x: 4, y: 1.2, z: 9 } });
      h.fx.handle(hit, h.fighters); h.fx.handle(hit, h.fighters);
      h.fx.update(10.55, h.fighters, h.flights);
      expect(h.stage.counts.shots).toBe(3);
      const cracks = (h.scene.getObjectByName('stage-bolts') as THREE.Mesh).geometry.getAttribute('aA');
      const first = new THREE.Vector3(cracks.getX(0), cracks.getY(0), cracks.getZ(0));
      expect(Math.hypot(first.x - 4, first.z - 9)).toBeLessThan(1); expect(first.y).toBeCloseTo(.06, 5);
      Object.assign(h.josuke.state, { action: 'idle', actionTime: 0 });
      h.fx.update(11, h.fighters, h.flights);
      expect(h.stage.counts.shots).toBe(0); expect(h.stage.counts.bolts).toBeGreaterThan(9); expect(h.stage.counts.glows).toBeGreaterThanOrEqual(9);
      h.fx.update(12, h.fighters, h.flights); expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('draws the rush only while its blows go on', () => {
    const h = setup({ action: 'special', actionDuration: SPECIAL.duration, actionTime: .7 / SPECIAL.duration }); try {
      h.fx.update(10.7, h.fighters, h.flights);
      expect(h.stage.counts.bolts).toBe(20); expect(h.stage.counts.lights).toBe(1);
      h.josuke.state.actionTime = 1.3 / SPECIAL.duration;
      h.fx.update(11.3, h.fighters, h.flights); expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('requires the confirm, then cracks the floor and the air wider with every blow that has landed', () => {
    const h = setup({ action: 'ultimate', actionTime: 1 / ULT.duration }); try {
      h.fx.update(11, h.fighters, h.flights); expect(h.drawn()).toBe(0);
      h.fx.handle(event(), h.fighters);
      const reach = (t: number) => { h.josuke.state.actionTime = t / ULT.duration; h.fx.update(10 + t, h.fighters, h.flights); const a = (h.scene.getObjectByName('stage-bolts') as THREE.Mesh).geometry.getAttribute('aA'), b = (h.scene.getObjectByName('stage-bolts') as THREE.Mesh).geometry.getAttribute('aB'); let far = 0; for (let i = 0; i < 40; i++) far = Math.max(far, Math.hypot(b.getX(i) - a.getX(0), b.getZ(i) - a.getZ(0))); return far; };
      const early = reach(1), late = reach(2.4);
      expect(late).toBeGreaterThan(early * 1.5); expect(h.stage.counts.lights).toBeLessThanOrEqual(STAGE_LIMITS.lights / 2);
    } finally { h.end(); }
  });

  it.each(['interrupted', 'new action', 'whiff', 'target death', 'reset'])('cancels a pending break on %s', reason => {
    const h = setup({ action: 'ultimate', actionTime: 2 / ULT.duration }); try {
      h.fx.handle(event(), h.fighters); h.fx.update(12, h.fighters, h.flights);
      expect(h.drawn()).toBeGreaterThan(0);
      if (reason === 'interrupted') h.josuke.state.action = 'hurt';
      if (reason === 'new action') h.josuke.state.actionSeq = 4;
      if (reason === 'whiff') h.fx.handle(event({ id: 2, kind: 'whiff' }), h.fighters);
      if (reason === 'target death') h.foe.state.alive = false;
      if (reason === 'reset') h.fx.reset();
      h.fx.update(12.01, h.fighters, h.flights); expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('releases only a final hit that was confirmed, restores what it broke, bounds a crowd and disposes once', () => {
    const h = setup({ action: 'ultimate', actionTime: ULT.contacts[LAST] / ULT.duration }); try {
      const last = event({ id: 9, kind: 'hit', contactIndex: LAST, serverTime: 10 + ULT.contacts[LAST] });
      h.fx.handle(last, h.fighters);
      h.fx.update(10 + ULT.contacts[LAST] + .02, h.fighters, h.flights); expect(h.drawn()).toBe(0);
      h.fx.handle(event(), h.fighters); h.fx.handle({ ...last, id: 10 }, h.fighters);
      h.foe.state.alive = false;
      h.fx.update(10 + ULT.contacts[LAST] + .2, h.fighters, h.flights);
      expect(h.stage.counts.shots).toBe(5); expect(h.stage.counts.shells).toBe(0);
      Object.assign(h.josuke.state, { action: 'idle', actionTime: 0 });
      h.fx.update(10 + ULT.contacts[LAST] + 1, h.fighters, h.flights);
      expect(h.stage.counts.shells).toBe(1); expect(h.stage.counts.bolts).toBeGreaterThan(14);
      h.fx.update(10 + ULT.contacts[LAST] + 4, h.fighters, h.flights); expect(h.drawn()).toBe(0);
      for (let i = 0; i < 400; i++) h.fx.handle(event({ id: 100 + i, kind: 'hit', slot: 'heavy', contactIndex: 0, serverTime: 20 }), h.fighters);
      h.fx.update(20.5, h.fighters, h.flights);
      expect(h.stage.counts.bolts).toBeLessThanOrEqual(STAGE_LIMITS.bolts); expect(h.stage.counts.shots).toBeLessThanOrEqual(STAGE_LIMITS.shots); expect(JOSUKE_RESTORATION_LIMITS.marks).toBe(10);
      h.fx.dispose(); h.fx.dispose();
    } finally { h.end(); }
  });
});
