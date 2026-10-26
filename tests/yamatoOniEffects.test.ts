import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';
import type { Fighter } from '../src/render/Fighter';
import type { Flight } from '../src/render/CombatEffects';
import { YamatoOni, YAMATO_ONI_LIMITS } from '../src/render/signature/YamatoOni';
const id = 'yamato' as FighterId;
function harness() {
  const scene = new THREE.Scene(), fx = new YamatoOni(scene, { budget: 1 });
  function fighter(name: string) {
    const group = new THREE.Group(); return { group, model: new THREE.Group(), handR: new THREE.Vector3(.3, 1.3, .2), handL: new THREE.Vector3(-.3, 1.3, .2), strikePoint: (out: THREE.Vector3) => out.set(.3, 1.7, 2),
      state: { id: name, fighter: name === 'yamato' ? id : 'goku', alive: true, action: 'idle', actionTime: 0, actionDuration: 3.72, actionSeq: 4 } as PlayerState } as unknown as Fighter;
  }
  const actor = fighter('yamato'), foe = fighter('foe'); foe.group.position.z = 2;
  return { scene, fx, actor, foe, fighters: new Map([['yamato', actor], ['foe', foe]]), flights: new Map<string, Flight>(), mesh: (n: string) => scene.getObjectByName('yamato-oni-' + n) as THREE.InstancedMesh };
}
const event = (patch: Partial<CombatEvent> = {}): CombatEvent => ({ id: 1, kind: 'confirm', fighter: id, actorId: 'yamato', targetId: 'foe', slot: 'ultimate', actionSeq: 4, serverTime: 10.54, ...patch });
describe('Yamato bounded manual kanabo presentation', () => {
  it('does not mutate simulation state or generate effects from idle awakened state', () => {
    const h = harness(); try { h.actor.state.awakened = true; const before = JSON.stringify(h.actor.state); h.fx.update(10, h.fighters, h.flights);
      expect(h.mesh('haki').count).toBe(0); expect(JSON.stringify(h.actor.state)).toBe(before);
      Object.assign(h.actor.state, { action: 'awaken', actionTime: .7, actionDuration: .9 }); h.fx.update(10.6, h.fighters, h.flights); expect(h.mesh('haki').count).toBeGreaterThan(0);
    } finally { h.fx.dispose(); }
  });
  it('draws only released authoritative shockwaves and removes their geometry on expiry', () => {
    const h = harness(); try {
      const flight = { fighter: id, slot: 'special', released: false, position: new THREE.Vector3(0, 1, 3), heading: new THREE.Vector3(0, 0, 1) } as Flight;
      h.flights.set('arrow', flight); h.fx.update(10, h.fighters, h.flights); expect(h.mesh('shockwaves').count).toBe(0);
      flight.released = true; h.fx.update(10.1, h.fighters, h.flights); expect(h.mesh('shockwaves').count).toBe(3);
      h.flights.clear(); h.fx.update(10.2, h.fighters, h.flights); expect(h.mesh('shockwaves').count).toBe(0);
    } finally { h.fx.dispose(); }
  });
  it('anchors the confirmed final floor ring to the authoritative contact endpoint', () => {
    const h = harness(); try {
      Object.assign(h.actor.state, { action: 'ultimate', actionTime: 3.2 / 3.72, confirmedAt: 10.54 });
      h.fx.handle(event(), h.fighters);
      h.fx.handle(event({ id: 2, kind: 'hit', contactIndex: 2, serverTime: 13.12, endpoint: { x: 7, y: 1.5, z: 8 } }), h.fighters);
      h.fx.update(13.2, h.fighters, h.flights);
      const matrix = new THREE.Matrix4(); h.mesh('impact-fronts').getMatrixAt(0, matrix);
      const point = new THREE.Vector3().setFromMatrixPosition(matrix);
      expect(point.x).toBeCloseTo(7); expect(point.z).toBeCloseTo(8); expect(point.y).toBeCloseTo(.035);
    } finally { h.fx.dispose(); }
  });
  it.each(['whiff', 'interrupt', 'new action', 'target removed', 'reset'])('requires confirmed final contact and cancels ultimate presentation on %s', why => {
    const h = harness(); try {
      Object.assign(h.actor.state, { action: 'ultimate', actionTime: 3.2 / 3.72, confirmedAt: 10.54 });
      h.fx.handle(event(), h.fighters); h.fx.update(13.2, h.fighters, h.flights); expect(h.mesh('impact-fronts').count).toBe(0);
      if (why === 'whiff') h.fx.handle(event({ id: 2, kind: 'whiff' }), h.fighters);
      if (why === 'interrupt') h.actor.state.action = 'hurt';
      if (why === 'new action') h.actor.state.actionSeq = 5;
      if (why === 'target removed') h.fighters.delete('foe');
      if (why === 'reset') h.fx.reset();
      h.fx.update(13.2, h.fighters, h.flights); h.fx.handle(event({ id: 3, kind: 'hit', contactIndex: 2, serverTime: 13.12, endpoint: { x: 0, y: 1, z: 2 } }), h.fighters);
      h.fx.update(13.21, h.fighters, h.flights); expect(h.mesh('impact-fronts').count).toBe(0);
    } finally { h.fx.dispose(); }
  });
  it('keeps the final ground ring fixed while a living target launches and bounds crowded effects', () => {
    const h = harness(); try {
      Object.assign(h.actor.state, { action: 'ultimate', actionTime: 3.2 / 3.72, confirmedAt: 10.54 }); h.fx.handle(event(), h.fighters);
      h.fx.handle(event({ id: 2, kind: 'hit', contactIndex: 2, serverTime: 13.12 }), h.fighters); h.fx.update(13.2, h.fighters, h.flights);
      const m = new THREE.Matrix4(), p = new THREE.Vector3(); h.mesh('impact-fronts').getMatrixAt(0, m); p.setFromMatrixPosition(m);
      h.foe.group.position.set(8, 4, 5); h.actor.state.actionTime = 3.45 / 3.72; h.fx.update(13.45, h.fighters, h.flights);
      h.mesh('impact-fronts').getMatrixAt(0, m); expect(new THREE.Vector3().setFromMatrixPosition(m).distanceTo(p)).toBeLessThan(1e-6);
      for (let i = 3; i < 250; i++) h.fx.handle(event({ id: i, kind: 'hit', slot: 'heavy', serverTime: 13.45 }), h.fighters);
      h.fx.update(13.5, h.fighters, h.flights);
      for (const [name, limit] of [['haki', YAMATO_ONI_LIMITS.bolts], ['shockwaves', YAMATO_ONI_LIMITS.crescents], ['impact-fronts', YAMATO_ONI_LIMITS.rings]] as const) {
        expect(h.mesh(name).count).toBeLessThanOrEqual(limit); expect(Array.from(h.mesh(name).instanceMatrix.array).every(Number.isFinite)).toBe(true);
      }
      h.fx.dispose(); expect(h.scene.children).toHaveLength(0); h.fx.dispose();
    } finally { h.fx.dispose(); }
  });
});
