import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';
import type { Fighter } from '../src/render/Fighter';
import type { Flight } from '../src/render/CombatEffects';
import { TodorokiPhosphor, TODOROKI_PHOSPHOR_LIMITS, TODOROKI_WALL } from '../src/render/signature/TodorokiPhosphor';
const id = 'todoroki' as FighterId;
function actor(name: string, patch: Partial<PlayerState> = {}): Fighter {
  const group = new THREE.Group();
  return { group, model: new THREE.Group(), handR: new THREE.Vector3(.3, 1.25, .2), handL: new THREE.Vector3(-.3, 1.25, .2),
    state: { id: name, fighter: name === 'todoroki' ? id : 'goku', alive: true, action: 'idle', actionTime: 0, actionDuration: 3.6, actionSeq: 4, ...patch } as PlayerState } as unknown as Fighter;
}
const event = (patch: Partial<CombatEvent> = {}): CombatEvent => ({ id: 1, kind: 'confirm', fighter: id, actorId: 'todoroki', targetId: 'foe', slot: 'ultimate', actionSeq: 4, serverTime: 10.558, ...patch });
function harness(patch: Partial<PlayerState> = {}, budget = 1) {
  const scene = new THREE.Scene(), fx = new TodorokiPhosphor(scene, { budget }), fighter = actor('todoroki', patch), foe = actor('foe');
  foe.group.position.z = 2; const fighters = new Map([['todoroki', fighter], ['foe', foe]]), flights = new Map<string, Flight>();
  const mesh = (name: string) => scene.getObjectByName(`todoroki-${name}`) as THREE.InstancedMesh;
  return { scene, fx, fighter, foe, fighters, flights, mesh };
}
describe('Todoroki bounded manual ice/fire presentation', () => {
  it('never alters simulation state or emits passive attacks', () => {
    const h = harness(); try {
      const before = JSON.stringify(h.fighter.state); h.fx.update(10, h.fighters, h.flights);
      expect(h.mesh('ice-facets').count).toBe(0); expect(h.mesh('fire-strokes').count).toBe(0); expect(JSON.stringify(h.fighter.state)).toBe(before);
      Object.assign(h.fighter.state, { awakened: true, action: 'awaken', actionDuration: .9, actionTime: .75 });
      const entry = JSON.stringify(h.fighter.state); h.fx.update(10.7, h.fighters, h.flights);
      expect(h.mesh('temperature-fronts').count).toBeGreaterThan(0); expect(JSON.stringify(h.fighter.state)).toBe(entry);
    } finally { h.fx.dispose(); }
  });
  it('only dresses released authoritative special flights and clears expired flights', () => {
    const h = harness(); try {
      const flight = { fighter: id, slot: 'special', released: false, position: new THREE.Vector3(0, 1, 3), heading: new THREE.Vector3(0, 0, 1), since: 10 } as Flight;
      h.flights.set('ice', flight); h.fx.update(10, h.fighters, h.flights); expect(h.mesh('ice-facets').count).toBe(0);
      flight.released = true; h.fx.update(10.1, h.fighters, h.flights); expect(h.mesh('ice-facets').count).toBeGreaterThan(3);
      flight.position.set(0, 1, 8); h.fx.update(10.2, h.fighters, h.flights); const crest = h.mesh('ice-facets').count; expect(crest).toBeGreaterThan(3);
      h.flights.clear(); h.fx.update(10.3, h.fighters, h.flights); expect(h.mesh('ice-facets').count).toBeGreaterThan(0); expect(h.mesh('ice-facets').count).toBeLessThan(crest);
      h.fx.update(10.2 + TODOROKI_WALL.stand + TODOROKI_WALL.sink + .01, h.fighters, h.flights); expect(h.mesh('ice-facets').count).toBe(0);
    } finally { h.fx.dispose(); }
  });
  it.each(['whiff', 'interrupt', 'new action', 'target removed', 'reset'])('requires confirmation and cancels Aegir on %s', why => {
    const h = harness({ action: 'ultimate', actionTime: 3 / 3.6, confirmedAt: 10.558 }); try {
      h.fx.update(13, h.fighters, h.flights); expect(h.mesh('ice-facets').count).toBe(0);
      h.fx.handle(event(), h.fighters); h.fx.update(13, h.fighters, h.flights); expect(h.mesh('ice-facets').count).toBeGreaterThan(0);
      if (why === 'whiff') h.fx.handle(event({ id: 2, kind: 'whiff' }), h.fighters);
      if (why === 'interrupt') h.fighter.state.action = 'hurt';
      if (why === 'new action') h.fighter.state.actionSeq = 5;
      if (why === 'target removed') h.fighters.delete('foe');
      if (why === 'reset') h.fx.reset();
      h.fx.update(13.01, h.fighters, h.flights); expect(h.mesh('ice-facets').count).toBe(0);
    } finally { h.fx.dispose(); }
  });
  it('keeps the glacier footprint on the captured floor while the victim launches away', () => {
    const h = harness({ action: 'ultimate', actionTime: 3 / 3.6, confirmedAt: 10.558 }); try {
      h.foe.group.position.set(1, .2, 2); h.fighter.group.position.y = .2;
      h.fx.handle(event(), h.fighters);
      h.fx.handle(event({ id: 2, kind: 'hit', contactIndex: 2, serverTime: 12.916 }), h.fighters);
      h.fx.update(13, h.fighters, h.flights);
      const before = new THREE.Matrix4(), after = new THREE.Matrix4(), a = new THREE.Vector3(), b = new THREE.Vector3();
      h.mesh('temperature-fronts').getMatrixAt(0, before); a.setFromMatrixPosition(before);
      h.foe.group.position.set(6, 4, 9); h.fighter.state.actionTime = 3.25 / 3.6;
      h.fx.update(13.25, h.fighters, h.flights);
      h.mesh('temperature-fronts').getMatrixAt(0, after); b.setFromMatrixPosition(after);
      expect(b.distanceTo(a)).toBeLessThan(1e-6); expect(b.y).toBeCloseTo(.24, 5);
      expect(h.mesh('ice-facets').count).toBeGreaterThan(0);
    } finally { h.fx.dispose(); }
  });
  it('preserves a verified lethal endpoint briefly and bounds every pool under repeated events', () => {
    const h = harness({ action: 'ultimate', actionTime: 3 / 3.6, confirmedAt: 10.558 }); try {
      h.fx.handle(event(), h.fighters); h.fx.handle(event({ id: 2, kind: 'hit', contactIndex: 2, serverTime: 12.916 }), h.fighters);
      h.fighters.delete('foe'); h.fx.update(13, h.fighters, h.flights); expect(h.mesh('ice-facets').count).toBeGreaterThan(0);
      for (let i = 3; i < 400; i++) h.fx.handle(event({ id: i, kind: 'hit', slot: 'heavy', serverTime: 13, endpoint: { x: 0, y: 1, z: 2 } }), h.fighters);
      h.fx.update(13.1, h.fighters, h.flights);
      for (const [name, limit] of [['ice-facets', TODOROKI_PHOSPHOR_LIMITS.ice], ['fire-strokes', TODOROKI_PHOSPHOR_LIMITS.flames], ['temperature-fronts', TODOROKI_PHOSPHOR_LIMITS.rings]] as const) {
        const mesh = h.mesh(name); expect(mesh.count).toBeLessThanOrEqual(limit);
        expect(Array.from(mesh.instanceMatrix.array).every(Number.isFinite)).toBe(true);
      }
      h.fx.dispose(); expect(h.scene.children).toHaveLength(0); h.fx.dispose();
    } finally { h.fx.dispose(); }
  });
});
