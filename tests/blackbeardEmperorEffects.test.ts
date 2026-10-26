import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';
import type { Fighter } from '../src/render/Fighter';
import type { Flight } from '../src/render/CombatEffects';
import { BlackbeardEmperor, blackbeardStrikePoint } from '../src/render/signature/BlackbeardEmperor';
import { MoveStage, STAGE_LIMITS } from '../src/render/signature/MoveStage';

const id = 'blackbeard' as FighterId;
function harness() {
  const scene = new THREE.Scene(), stage = MoveStage.for(scene, { budget: 1 }), fx = new BlackbeardEmperor(scene, { budget: 1 });
  function fighter(name: string) {
    const group = new THREE.Group(); return { group, model: new THREE.Group(), handR: new THREE.Vector3(.3, 1.3, .2), handL: new THREE.Vector3(-.3, 1.3, .2), strikePoint: (out: THREE.Vector3) => out.set(.3, 1.7, 2),
      state: { id: name, fighter: name === 'blackbeard' ? id : 'goku', alive: true, action: 'idle', actionTime: 0, actionDuration: 3.92, actionSeq: 4, yaw: 0 } as PlayerState } as unknown as Fighter;
  }
  const actor = fighter('blackbeard'), foe = fighter('foe'); foe.group.position.z = 2;
  const drawn = () => { const c = stage.counts; return c.flames + c.glows + c.bolts + c.discs + c.shells; };
  const discs = () => { const mesh = scene.getObjectByName('stage-discs') as THREE.Mesh<THREE.InstancedBufferGeometry>, data = (mesh.geometry.getAttribute('aP') as THREE.InterleavedBufferAttribute).data.array; return Array.from({ length: stage.counts.discs }, (_, i) => [data[i * 12], data[i * 12 + 1], data[i * 12 + 2], data[i * 12 + 3]]); };
  return { scene, stage, fx, actor, foe, fighters: new Map([['blackbeard', actor], ['foe', foe]]), flights: new Map<string, Flight>(), drawn, discs, end() { fx.dispose(); stage.release(); } };
}
const event = (patch: Partial<CombatEvent> = {}): CombatEvent => ({ id: 1, kind: 'confirm', fighter: id, actorId: 'blackbeard', targetId: 'foe', slot: 'ultimate', actionSeq: 4, serverTime: 10.52, ...patch });

describe('Blackbeard bounded manual darkness and quake presentation', () => {
  it('uses the native left jab, right strike and final two-palm contact without recursive strike queries', () => {
    const h = harness(); try {
      h.actor.strikePoint = () => { throw new Error('Recursive strike query'); };
      h.actor.state.action = 'light'; expect(blackbeardStrikePoint(h.actor, new THREE.Vector3()).equals(h.actor.handR)).toBe(true);
      h.actor.state.action = 'heavy'; expect(blackbeardStrikePoint(h.actor, new THREE.Vector3()).equals(h.actor.handR)).toBe(true);
      h.actor.state.action = 'ultimate'; h.actor.state.actionTime = 3.25 / 3.92;
      expect(blackbeardStrikePoint(h.actor, new THREE.Vector3()).equals(h.actor.handL.clone().lerp(h.actor.handR, .5))).toBe(true);
    } finally { h.end(); }
  });

  it('does not mutate simulation state or generate effects from idle awakened state', () => {
    const h = harness(); try {
      h.actor.state.awakened = true; const before = JSON.stringify(h.actor.state); h.fx.update(10, h.fighters, h.flights);
      expect(h.drawn()).toBe(0); expect(JSON.stringify(h.actor.state)).toBe(before);
      Object.assign(h.actor.state, { action: 'awaken', actionTime: .7, actionDuration: .9 }); h.fx.update(10.6, h.fighters, h.flights);
      expect(h.stage.counts.shells).toBe(1); expect(h.scene.children.some(o => o.name === 'stage-sphere' && o.visible && o.scale.x > .1)).toBe(true);
    } finally { h.end(); }
  });

  it('stages both fruits: darkness poured over the floor for Black Hole, the quake\'s bubble for the Gura Hammer', () => {
    const h = harness(); try {
      Object.assign(h.actor.state, { action: 'special', actionDuration: 1.42, actionTime: .5 / 1.42 }); h.fx.update(10.5, h.fighters, h.flights);
      expect(h.discs().length).toBe(1); expect(h.discs()[0][3]).toBeGreaterThan(2.4); expect(h.stage.counts.flames).toBeGreaterThan(3); expect(h.stage.counts.shells).toBe(0);
      Object.assign(h.actor.state, { action: 'heavy', actionDuration: 1, actionTime: .4 }); h.fx.update(10.9, h.fighters, h.flights);
      expect(h.stage.counts.shells).toBe(1); expect(h.stage.counts.discs).toBe(0); expect(h.stage.counts.bolts).toBeGreaterThan(0);
      h.fx.handle(event({ id: 9, kind: 'hit', slot: 'heavy', serverTime: 11.1 }), h.fighters);
      Object.assign(h.actor.state, { actionTime: .95 }); h.fx.update(11.2, h.fighters, h.flights);
      expect(h.stage.counts.bolts).toBeGreaterThan(30); expect(h.stage.counts.discs).toBe(1);
    } finally { h.end(); }
  });

  it('draws only a released authoritative Black Hole and removes it on expiry', () => {
    const h = harness(); try {
      const flight = { fighter: id, slot: 'special', actorId: 'blackbeard', released: false, since: 10, position: new THREE.Vector3(0, 1, 3), heading: new THREE.Vector3(0, 0, 1) } as Flight;
      h.flights.set('arrow', flight); h.fx.update(10, h.fighters, h.flights); expect(h.drawn()).toBe(0);
      flight.released = true; h.fx.update(10.1, h.fighters, h.flights);
      expect(h.discs().length).toBe(1); expect(h.discs()[0][0]).toBeCloseTo(0); expect(h.discs()[0][2]).toBeCloseTo(3); expect(h.stage.counts.flames).toBeGreaterThan(2);
      expect(h.scene.children.some(o => o.name === 'stage-sphere' && o.visible && o.scale.x > .5)).toBe(true);
      h.flights.clear(); h.fx.update(10.2, h.fighters, h.flights); expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('prefers the authoritative impact endpoint while retaining the captured floor', () => {
    const h = harness(); try {
      Object.assign(h.actor.state, { action: 'ultimate', actionTime: 3.4 / 3.92, confirmedAt: 10.52 });
      h.fx.handle(event(), h.fighters);
      h.fx.handle(event({ id: 2, kind: 'hit', contactIndex: 2, serverTime: 13.25, endpoint: { x: 7, y: 1.5, z: 8 } }), h.fighters);
      h.fx.update(13.4, h.fighters, h.flights);
      const rows = h.discs();
      expect(rows.length).toBeGreaterThan(0);
      for (const [x, y, z] of rows) { expect(x).toBeCloseTo(7); expect(z).toBeCloseTo(8); expect(y).toBeCloseTo(.02); }
    } finally { h.end(); }
  });

  it.each(['whiff', 'interrupt', 'new action', 'target removed', 'reset'])('requires confirmed final contact and cancels ultimate presentation on %s', why => {
    const h = harness(); try {
      Object.assign(h.actor.state, { action: 'ultimate', actionTime: 2.4 / 3.92, confirmedAt: 10.52 });
      h.fx.handle(event(), h.fighters); h.fx.update(12.4, h.fighters, h.flights);
      expect(h.discs().length).toBe(1); expect(h.stage.counts.shells).toBe(1); expect(h.stage.counts.flames).toBeGreaterThan(8);
      if (why === 'whiff') h.fx.handle(event({ id: 2, kind: 'whiff' }), h.fighters);
      if (why === 'interrupt') h.actor.state.action = 'hurt';
      if (why === 'new action') h.actor.state.actionSeq = 5;
      if (why === 'target removed') h.fighters.delete('foe');
      if (why === 'reset') h.fx.reset();
      h.fx.update(12.41, h.fighters, h.flights);
      expect(h.drawn()).toBe(0);
      h.fx.handle(event({ id: 3, kind: 'hit', contactIndex: 2, serverTime: 13.25, endpoint: { x: 0, y: 1, z: 2 } }), h.fighters);
      h.fx.update(13.3, h.fighters, h.flights); expect(h.stage.counts.shots).toBe(0); expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('keeps the last blow where it landed while a living target is thrown, and bounds crowded effects', () => {
    const h = harness(); try {
      Object.assign(h.actor.state, { action: 'ultimate', actionTime: 3.2 / 3.92, confirmedAt: 10.52 }); h.fx.handle(event(), h.fighters);
      h.fx.handle(event({ id: 2, kind: 'hit', contactIndex: 2, serverTime: 13.25 }), h.fighters); h.fx.update(13.4, h.fighters, h.flights);
      const before = h.discs().map(d => d.slice(0, 3));
      expect(before.length).toBeGreaterThan(0);
      h.foe.group.position.set(8, 4, 5); h.actor.state.actionTime = 3.45 / 3.92; h.fx.update(13.45, h.fighters, h.flights);
      const after = h.discs().map(d => d.slice(0, 3));
      for (let i = 0; i < before.length; i++) for (let k = 0; k < 3; k++) expect(after[i][k]).toBeCloseTo(before[i][k], 5);
      for (let i = 3; i < 250; i++) h.fx.handle(event({ id: i, kind: 'hit', slot: 'heavy', serverTime: 13.45 }), h.fighters);
      h.fx.update(13.5, h.fighters, h.flights);
      for (const pool of ['flames', 'glows', 'bolts', 'lights', 'discs', 'shells', 'shots'] as const) expect(h.stage.counts[pool], pool).toBeLessThanOrEqual(STAGE_LIMITS[pool]);
      h.stage.release(); h.fx.dispose(); expect(h.scene.children).toHaveLength(0); h.fx.dispose();
    } finally { h.fx.dispose(); }
  });
});
