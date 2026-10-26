import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';
import type { Fighter } from '../src/render/Fighter';
import type { Flight } from '../src/render/CombatEffects';
import { DoflamingoStrings, DOFLAMINGO_STRINGS_LIMITS, doflamingoStrikePoint } from '../src/render/signature/DoflamingoStrings';
const id = 'doflamingo' as FighterId;
function harness() {
  const scene = new THREE.Scene(), fx = new DoflamingoStrings(scene, { budget: 1 });
  function fighter(name: string) {
    const group = new THREE.Group(); return { group, model: new THREE.Group(), bones: new Map(), handR: new THREE.Vector3(.3, 1.3, .2), handL: new THREE.Vector3(-.3, 1.3, .2), strikePoint: (out: THREE.Vector3) => out.set(.3, 1.7, 2),
      state: { id: name, fighter: name === 'doflamingo' ? id : 'goku', alive: true, action: 'idle', yaw: 0, actionTime: 0, actionDuration: 3.88, actionSeq: 4 } as PlayerState } as unknown as Fighter;
  }
  const actor = fighter('doflamingo'), foe = fighter('foe'); foe.group.position.z = 2;
  return { scene, fx, actor, foe, fighters: new Map([['doflamingo', actor], ['foe', foe]]), flights: new Map<string, Flight>(), mesh: (n: string) => scene.getObjectByName('doflamingo-strings-' + n) as THREE.InstancedMesh };
}
const event = (patch: Partial<CombatEvent> = {}): CombatEvent => ({ id: 1, kind: 'confirm', fighter: id, actorId: 'doflamingo', targetId: 'foe', slot: 'ultimate', actionSeq: 4, serverTime: 10.56, ...patch });
function groundRings(mesh:THREE.InstancedMesh){
 const m=new THREE.Matrix4(),rows:THREE.Vector3[]=[];
 for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m);const p=new THREE.Vector3().setFromMatrixPosition(m);if(p.y<.1)rows.push(p);}
 return rows;
}
describe('Doflamingo bounded manual threads and God Thread presentation', () => {
  it('uses native finger and dual-hand contact without recursive strike queries', () => {
    const h = harness(); try {
      h.actor.strikePoint = () => { throw new Error('Recursive strike query'); };
      h.actor.state.action = 'light'; expect(doflamingoStrikePoint(h.actor, new THREE.Vector3()).equals(h.actor.handR)).toBe(true);
      h.actor.state.action = 'heavy'; expect(doflamingoStrikePoint(h.actor, new THREE.Vector3()).equals(h.actor.handR)).toBe(true);
      h.actor.state.action = 'ultimate'; h.actor.state.actionTime = 3.18 / 3.88;
      expect(doflamingoStrikePoint(h.actor, new THREE.Vector3()).equals(h.actor.handL.clone().lerp(h.actor.handR, .5))).toBe(true);
    } finally { h.fx.dispose(); }
  });
  it('does not mutate simulation state or generate effects from idle awakened state', () => {
    const h = harness(); try { h.actor.state.awakened = true; const before = JSON.stringify(h.actor.state); h.fx.update(10, h.fighters, h.flights);
      expect(h.mesh('filaments').count).toBe(0); expect(JSON.stringify(h.actor.state)).toBe(before);
      Object.assign(h.actor.state, { action: 'awaken', actionTime: .7, actionDuration: .9 }); h.fx.update(10.6, h.fighters, h.flights); expect(h.mesh('filaments').count).toBeGreaterThan(0);
    } finally { h.fx.dispose(); }
  });
  it('draws only released authoritative shockwaves and removes their geometry on expiry', () => {
    const h = harness(); try {
      const flight = { fighter: id, slot: 'special', released: false, position: new THREE.Vector3(0, 1, 3), heading: new THREE.Vector3(0, 0, 1) } as Flight;
      h.flights.set('arrow', flight); h.fx.update(10, h.fighters, h.flights); expect(h.mesh('filaments').count).toBe(0);
      flight.released = true; h.fx.update(10.1, h.fighters, h.flights); flight.position.z += .4; h.fx.update(10.11, h.fighters, h.flights); expect(h.mesh('filaments').count).toBeGreaterThan(0);
      h.flights.clear(); h.fx.update(10.2, h.fighters, h.flights); expect(h.mesh('filaments').count).toBe(0);
    } finally { h.fx.dispose(); }
  });
  it('grows Overheat only through travelled space and caps its trail at 2.9m', () => {
    const h = harness(); try {
      const origin = new THREE.Vector3(0, 1.4, 1);
      const flight = { fighter: id, slot: 'special', released: true, since: 10, origin, position: origin.clone(), heading: new THREE.Vector3(0, 0, 1) } as Flight & { origin: THREE.Vector3 };
      h.flights.set('overheat', flight); h.fx.update(10, h.fighters, h.flights);
      expect(h.mesh('filaments').count).toBe(0);
      for (const travelled of [.03, .25, 1.2, 4.5]) {
        flight.position.copy(origin).addScaledVector(flight.heading, travelled); h.fx.update(10 + travelled / 29, h.fighters, h.flights);
        const mesh = h.mesh('filaments'), m = new THREE.Matrix4(), p = new THREE.Vector3();
        let min = Infinity, max = -Infinity;
        for (let i = 0; i < mesh.count; i++) {
          mesh.getMatrixAt(i, m);
          for (let j = 0; j < mesh.geometry.attributes.position.count; j++) {
            p.fromBufferAttribute(mesh.geometry.attributes.position, j).applyMatrix4(m); min = Math.min(min, p.z); max = Math.max(max, p.z);
          }
        }
        expect(min).toBeGreaterThanOrEqual(origin.z + Math.max(0, travelled - 2.9) - .04);
        expect(max).toBeLessThanOrEqual(flight.position.z + .04);
        expect(max - min).toBeLessThanOrEqual(Math.min(2.9, travelled) + .08);
      }
    } finally { h.fx.dispose(); }
  });
  it('prefers the authoritative impact endpoint while retaining the captured floor', () => {
    const h = harness(); try {
      Object.assign(h.actor.state, { action: 'ultimate', actionTime: 3.4 / 3.88, confirmedAt: 10.56 });
      h.fx.handle(event(), h.fighters);
      h.fx.handle(event({ id: 2, kind: 'hit', contactIndex: 2, serverTime: 13.18, endpoint: { x: 7, y: 1.5, z: 8 } }), h.fighters);
      h.fx.update(13.4, h.fighters, h.flights); const point = groundRings(h.mesh('webs'))[0];
      expect(point.x).toBeCloseTo(7); expect(point.z).toBeCloseTo(8); expect(point.y).toBeCloseTo(.035);
    } finally { h.fx.dispose(); }
  });
  it.each(['whiff', 'interrupt', 'new action', 'target removed', 'reset'])('requires confirmed final contact and cancels ultimate presentation on %s', why => {
    const h = harness(); try {
      Object.assign(h.actor.state, { action: 'ultimate', actionTime: 3.2 / 3.88, confirmedAt: 10.56 });
      h.fx.handle(event(), h.fighters); h.fx.update(13.2, h.fighters, h.flights); expect(groundRings(h.mesh('webs')).length).toBe(0); expect(h.mesh('holy-bullets').count).toBeGreaterThan(0);
      if (why === 'whiff') h.fx.handle(event({ id: 2, kind: 'whiff' }), h.fighters);
      if (why === 'interrupt') h.actor.state.action = 'hurt';
      if (why === 'new action') h.actor.state.actionSeq = 5;
      if (why === 'target removed') h.fighters.delete('foe');
      if (why === 'reset') h.fx.reset();
      h.fx.update(13.2, h.fighters, h.flights); h.fx.handle(event({ id: 3, kind: 'hit', contactIndex: 2, serverTime: 13.18, endpoint: { x: 0, y: 1, z: 2 } }), h.fighters);
      h.fx.update(13.21, h.fighters, h.flights); expect(groundRings(h.mesh('webs')).length).toBe(0);
    } finally { h.fx.dispose(); }
  });
  it('keeps the final ground ring fixed while a living target launches and bounds crowded effects', () => {
    const h = harness(); try {
      Object.assign(h.actor.state, { action: 'ultimate', actionTime: 3.2 / 3.88, confirmedAt: 10.56 }); h.fx.handle(event(), h.fighters);
      h.fx.handle(event({ id: 2, kind: 'hit', contactIndex: 2, serverTime: 13.18 }), h.fighters); h.fx.update(13.2, h.fighters, h.flights);
      const p = new THREE.Vector3(); p.copy(groundRings(h.mesh('webs'))[0]);
      h.foe.group.position.set(8, 4, 5); h.actor.state.actionTime = 3.45 / 3.88; h.fx.update(13.45, h.fighters, h.flights);
      expect(groundRings(h.mesh('webs'))[0].distanceTo(p)).toBeLessThan(1e-6);
      for (let i = 3; i < 250; i++) h.fx.handle(event({ id: i, kind: 'hit', slot: 'heavy', serverTime: 13.45 }), h.fighters);
      h.fx.update(13.5, h.fighters, h.flights);
      for (const [name, limit] of [['filaments', DOFLAMINGO_STRINGS_LIMITS.threads], ['holy-bullets', DOFLAMINGO_STRINGS_LIMITS.needles], ['webs', DOFLAMINGO_STRINGS_LIMITS.rings]] as const) {
        expect(h.mesh(name).count).toBeLessThanOrEqual(limit); expect(Array.from(h.mesh(name).instanceMatrix.array).every(Number.isFinite)).toBe(true);
      }
      h.fx.dispose(); expect(h.scene.children).toHaveLength(0); h.fx.dispose();
    } finally { h.fx.dispose(); }
  });
});
