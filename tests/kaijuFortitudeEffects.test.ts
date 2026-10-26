import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';
import { KAIJU_MOVES } from '../src/game/fighters/kaiju-no-8';
import type { Fighter } from '../src/render/Fighter';
import type { Flight } from '../src/render/CombatEffects';
import { KaijuFortitude, KAIJU_FORTITUDE_LIMITS } from '../src/render/signature/KaijuFortitude';
import { MoveStage, STAGE_LIMITS } from '../src/render/signature/MoveStage';
import { STAGED_BY_MODULE } from '../src/render/signature/StagedMoves';

const ID = 'kaiju-no-8' as FighterId, ULT = KAIJU_MOVES.ultimate, SPECIAL = KAIJU_MOVES.special, LAST = ULT.contacts.length - 1;
function body(id: string, patch: Partial<PlayerState> = {}): Fighter {
  const group = new THREE.Group();
  return { group, handR: new THREE.Vector3(.3, 1.4, .3), handL: new THREE.Vector3(-.3, 1.4, .3), strikePoint: (out: THREE.Vector3) => out.set(.3, 1.4, .9),
    state: { id, fighter: id === 'kaiju' ? ID : 'goku', alive: true, action: 'idle', actionSeq: 6, actionTime: 0, actionDuration: ULT.duration, yaw: 0, ...patch } as PlayerState } as unknown as Fighter;
}
const event = (patch: Partial<CombatEvent> = {}): CombatEvent => ({ id: 1, kind: 'confirm', fighter: ID, actorId: 'kaiju', targetId: 'foe', actionSeq: 6, slot: 'ultimate', serverTime: 10 + ULT.contacts[0], ...patch });
function setup(patch: Partial<PlayerState> = {}, budget = 1) {
  const scene = new THREE.Scene(), stage = MoveStage.for(scene, { budget }), fx = new KaijuFortitude(scene, { budget }), kaiju = body('kaiju', patch), foe = body('foe'); foe.group.position.z = 2.4;
  const fighters = new Map([['kaiju', kaiju], ['foe', foe]]), flights = new Map<string, Flight>();
  const drawn = () => { const c = stage.counts; return c.flames + c.glows + c.bolts + c.discs + c.shells + c.shots; };
  const glows = () => { const p = (scene.getObjectByName('stage-glow') as THREE.Mesh).geometry.getAttribute('aP'); return Array.from({ length: stage.counts.glows }, (_, i) => new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i))); };
  return { scene, stage, fx, kaiju, foe, fighters, flights, drawn, glows, end() { fx.dispose(); stage.release(); } };
}

describe('Kaiju No. 8 manually triggered fortitude presentation', () => {
  it('stages his own moves, so the baseline stands aside', () => { expect(STAGED_BY_MODULE.has(ID)).toBe(true); });

  it('keeps idle and awakened idle clear with no gameplay writes', () => {
    const h = setup({ awakened: true }); try {
      const before = JSON.stringify(h.kaiju.state);
      h.fx.update(10, h.fighters, h.flights); expect(h.drawn()).toBe(0); expect(JSON.stringify(h.kaiju.state)).toBe(before);
      Object.assign(h.kaiju.state, { action: 'ultimate', actionTime: 2 / ULT.duration });
      h.fx.update(12, h.fighters, h.flights); expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('stages entry lightning only inside deliberate awakening', () => {
    const h = setup({ action: 'awaken', actionDuration: .9, actionTime: .05 }); try {
      h.fx.update(10, h.fighters, h.flights); expect(h.drawn()).toBe(0);
      h.kaiju.state.actionTime = .45; h.fx.update(10.4, h.fighters, h.flights);
      expect(h.stage.counts.bolts).toBe(25); expect(h.stage.counts.lights).toBe(1);
      h.kaiju.state.actionTime = .99; h.fx.update(10.9, h.fighters, h.flights); expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('uses authoritative endpoints, deduplicates accepted hits, and carries the shockwave on through the victim', () => {
    const h = setup({ action: 'special', actionDuration: SPECIAL.duration, actionTime: SPECIAL.contacts[0] / SPECIAL.duration }); try {
      const hit = event({ id: 7, kind: 'hit', slot: 'special', contactIndex: 0, serverTime: 10.78, endpoint: { x: 0, y: 1.2, z: 2.4 } });
      h.fx.handle(hit, h.fighters); h.fx.handle(hit, h.fighters);
      Object.assign(h.kaiju.state, { action: 'idle', actionTime: 0 });
      h.fx.update(10.9, h.fighters, h.flights);
      expect(h.stage.counts.shots).toBe(4);
      const rings = h.glows().filter(p => Math.abs(p.x) < .01 && p.z > 3).map(p => p.z).sort((a, b) => a - b);
      expect(rings.length).toBeGreaterThanOrEqual(4); expect(rings[rings.length - 1]).toBeGreaterThan(rings[0] + 1.5);
      h.fx.update(14, h.fighters, h.flights); expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('requires the confirm before Maximum Output gathers, round him and never on him', () => {
    const h = setup({ action: 'ultimate', actionTime: 2 / ULT.duration }); try {
      h.fx.update(12, h.fighters, h.flights); expect(h.drawn()).toBe(0);
      h.fx.handle(event(), h.fighters);
      h.fx.update(12, h.fighters, h.flights);
      expect(h.stage.counts.bolts).toBeGreaterThanOrEqual(40); expect(h.stage.counts.lights).toBeLessThanOrEqual(STAGE_LIMITS.lights / 2);
      const a = (h.scene.getObjectByName('stage-bolts') as THREE.Mesh).geometry.getAttribute('aA');
      let standing = 0; for (let i = 0; i < h.stage.counts.bolts; i++) if (a.getY(i) > .5 && Math.hypot(a.getX(i), a.getZ(i)) > 1.5) standing++;
      expect(standing).toBeGreaterThan(20);
    } finally { h.end(); }
  });

  it.each(['interrupted', 'new action', 'whiff', 'target death', 'reset'])('cancels a confirmed output on %s', reason => {
    const h = setup({ action: 'ultimate', actionTime: 2.2 / ULT.duration }); try {
      h.fx.handle(event(), h.fighters); h.fx.update(12.2, h.fighters, h.flights);
      expect(h.drawn()).toBeGreaterThan(0);
      if (reason === 'interrupted') h.kaiju.state.action = 'hurt';
      if (reason === 'new action') h.kaiju.state.actionSeq = 7;
      if (reason === 'whiff') h.fx.handle(event({ id: 2, kind: 'whiff' }), h.fighters);
      if (reason === 'target death') h.foe.state.alive = false;
      if (reason === 'reset') h.fx.reset();
      h.fx.update(12.21, h.fighters, h.flights); expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('gives the last blow nothing without its confirm; bounds a crowd, draws less on a low budget, and disposes once', () => {
    const h = setup({ action: 'ultimate', actionTime: ULT.contacts[LAST] / ULT.duration }), low = setup({ action: 'ultimate', actionTime: 2 / ULT.duration }, .35), full = setup({ action: 'ultimate', actionTime: 2 / ULT.duration }); try {
      const last = event({ id: 9, kind: 'hit', contactIndex: LAST, serverTime: 10 + ULT.contacts[LAST] });
      h.fx.handle(last, h.fighters);
      h.fx.update(10 + ULT.contacts[LAST] + .02, h.fighters, h.flights); expect(h.drawn()).toBe(0);
      h.fx.handle(event(), h.fighters); h.fx.handle({ ...last, id: 10 }, h.fighters);
      h.foe.state.alive = false;
      h.fx.update(10 + ULT.contacts[LAST] + .2, h.fighters, h.flights);
      expect(h.stage.counts.shots).toBe(7);
      for (let i = 0; i < 500; i++) h.fx.handle(event({ id: 100 + i, kind: 'hit', slot: 'heavy', contactIndex: 0, serverTime: 10 + ULT.contacts[LAST] + .2 }), h.fighters);
      h.fx.update(10 + ULT.contacts[LAST] + .3, h.fighters, h.flights);
      expect(h.stage.counts.shots).toBeLessThanOrEqual(STAGE_LIMITS.shots); expect(h.stage.counts.glows).toBeLessThanOrEqual(STAGE_LIMITS.glows / 2); expect(KAIJU_FORTITUDE_LIMITS.marks).toBe(10);
      for (const x of [low, full]) { x.fx.handle(event(), x.fighters); x.fx.update(12, x.fighters, x.flights); }
      expect(low.stage.counts.bolts).toBeLessThan(full.stage.counts.bolts);
      h.fx.dispose(); h.fx.dispose();
    } finally { h.end(); low.end(); full.end(); }
  });
});
