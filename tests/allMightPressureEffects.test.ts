import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';
import type { Fighter } from '../src/render/Fighter';
import type { Flight } from '../src/render/CombatEffects';
import { AllMightPressure } from '../src/render/signature/AllMightPressure';
const ID = 'all-might' as FighterId;
function actor(id: string, patch: Partial<PlayerState> = {}): Fighter {
  const group = new THREE.Group();
  return { group, handR: new THREE.Vector3(.3, 1.5, .4), handL: new THREE.Vector3(-.3, 1.5, .4),
    state: { id, fighter: id === 'hero' ? ID : 'goku', alive: true, action: 'idle', actionSeq: 2,
      actionTime: 0, actionDuration: 3.4, ...patch } as PlayerState } as unknown as Fighter;
}
const event = (patch: Partial<CombatEvent> = {}): CombatEvent => ({ id: 1, kind: 'confirm', fighter: ID, actorId: 'hero', targetId: 'foe', actionSeq: 2, slot: 'ultimate', serverTime: 10.51, ...patch });
function harness(patch: Partial<PlayerState> = {}, budget = 1) {
  const scene = new THREE.Scene(), fx = new AllMightPressure(scene, { budget }), hero = actor('hero', patch), foe = actor('foe');
  foe.group.position.z = 2;
  const fighters = new Map([['hero', hero], ['foe', foe]]), flights = new Map<string, Flight>();
  const mesh = (name: string) => scene.getObjectByName(`all-might-pressure-${name}`) as THREE.InstancedMesh;
  return { scene, fx, hero, foe, fighters, flights, mesh };
}
describe('All Might manual pressure presentation', () => {
  it('does nothing at idle and never mutates state during a distinctive steam/pressure entry', () => {
    const h = harness();
    try {
      h.fx.update(10, h.fighters, h.flights); expect(h.mesh('rings').count + h.mesh('gusts').count).toBe(0);
      Object.assign(h.hero.state, { action: 'awaken', actionDuration: .9, actionTime: .60 / .9 });
      const before = JSON.stringify(h.hero.state); h.fx.update(10.6, h.fighters, h.flights);
      expect(h.mesh('gusts').count).toBeGreaterThan(0); expect(h.mesh('rings').count).toBe(2);
      expect(JSON.stringify(h.hero.state)).toBe(before);
    } finally { h.fx.dispose(); }
  });
  it('requires confirmation plus the final authoritative contact before drawing the finisher vortex', () => {
    const h = harness({ action: 'ultimate', actionTime: 2.8 / 3.4 });
    try {
      h.fx.update(12.8, h.fighters, h.flights); expect(h.mesh('rings').count).toBe(0);
      h.fx.handle(event(), h.fighters); h.fx.update(12.8, h.fighters, h.flights); expect(h.mesh('rings').count).toBe(0);
      h.fx.handle(event({ id: 2, kind: 'hit', contactIndex: 2, serverTime: 12.72 }), h.fighters);
      h.fx.update(12.8, h.fighters, h.flights); expect(h.mesh('rings').count).toBeGreaterThan(5);
    } finally { h.fx.dispose(); }
  });
  it.each(['interrupt', 'sequence', 'whiff', 'target-death', 'reset'])('cancels the gathered finisher on %s', reason => {
    const h = harness({ action: 'ultimate', actionTime: 2.2 / 3.4 });
    try {
      h.fx.handle(event(), h.fighters); h.fx.update(12.2, h.fighters, h.flights); expect(h.mesh('gusts').count).toBe(1);
      if (reason === 'interrupt') h.hero.state.action = 'hurt';
      if (reason === 'sequence') h.hero.state.actionSeq = 3;
      if (reason === 'whiff') h.fx.handle(event({ id: 2, kind: 'whiff' }), h.fighters);
      if (reason === 'target-death') h.foe.state.alive = false;
      if (reason === 'reset') h.fx.reset();
      h.fx.update(12.21, h.fighters, h.flights); expect(h.mesh('gusts').count + h.mesh('rings').count).toBe(0);
    } finally { h.fx.dispose(); }
  });
  it('retains only a verified lethal final hit after victim removal, then expires', () => {
    const h = harness({ action: 'ultimate', actionTime: 2.8 / 3.4 });
    try {
      h.fx.handle(event(), h.fighters); h.fx.handle(event({ id: 2, kind: 'hit', contactIndex: 2, serverTime: 12.72 }), h.fighters);
      h.foe.state.alive = false; h.fighters.delete('foe'); h.fx.update(12.8, h.fighters, h.flights);
      expect(h.mesh('rings').count).toBeGreaterThan(5);
      h.hero.state.action = 'idle'; h.fx.update(14, h.fighters, h.flights); expect(h.mesh('rings').count).toBe(0);
    } finally { h.fx.dispose(); }
  });
  it('uses released flights only, keeps low detail bounded and releases every owned draw', () => {
    const h = harness({}, .3), flight = { fighter: ID, slot: 'special', released: false, position: new THREE.Vector3(1, 2, 3), heading: new THREE.Vector3(0, 0, 1) } as Flight;
    h.flights.set('shot', flight); h.fx.update(10, h.fighters, h.flights); expect(h.mesh('rings').count).toBe(0);
    flight.released = true; h.fx.update(10.1, h.fighters, h.flights); expect(h.mesh('rings').count).toBe(2);
    h.flights.clear(); h.fx.update(10.2, h.fighters, h.flights); expect(h.mesh('rings').count).toBe(0);
    h.fx.dispose(); h.fx.dispose(); expect(h.scene.children).toHaveLength(0);
  });
});
