import { describe, expect, it } from 'vitest';
import * as T from 'three';
import type { CombatEvent, PlayerState } from '../src/game/types';
import type { Fighter } from '../src/render/Fighter';
import type { Flight } from '../src/render/CombatEffects';
import { CrocodileDesert } from '../src/render/signature/CrocodileDesert';

function setup(budget = 1) {
  const scene = new T.Scene(), effect = new CrocodileDesert(scene, { budget });
  const fighter = { group: new T.Group(), handR: new T.Vector3(.2, 1.2, .1), state: { id: 'c', fighter: 'crocodile', alive: true, action: 'idle', actionTime: 0, actionDuration: 1, yaw: 0 } as PlayerState, strikePoint: (p: T.Vector3) => p.set(.3, 1.2, .7) } as unknown as Fighter;
  const fighters = new Map([['c', fighter]]), flights = new Map<string, Flight>();
  const own = () => scene.children.filter(mesh => mesh.name.startsWith('crocodile-')) as T.InstancedMesh[];
  const count = () => own().reduce((sum, mesh) => sum + mesh.count, 0);
  return { scene, effect, fighter, fighters, flights, count, own };
}
const hit = (patch: Partial<CombatEvent> = {}): CombatEvent => ({ id: 1, kind: 'hit', fighter: 'crocodile', actorId: 'c', targetId: 'foe', serverTime: 10, slot: 'ultimate', contactIndex: 2, endpoint: { x: 2, y: 1, z: 3 }, ...patch });
describe('Crocodile bounded, manual sand presentation', () => {
  it('leaves awakened idle empty without GPU uploads or combat mutation', () => {
    const h = setup(); h.fighter.state.awakened = true; const state = JSON.stringify(h.fighter.state);
    for (let i = 0; i < 60; i++) h.effect.update(i / 60, h.fighters, h.flights);
    expect(h.count()).toBe(0); expect(JSON.stringify(h.fighter.state)).toBe(state);
    for (const mesh of h.own()) expect(mesh.instanceMatrix.version).toBe(0);
    h.effect.dispose();
  });
  it('follows only released flights and retires them when the simulation removes them', () => {
    const h = setup(), flight = { fighter: 'crocodile', slot: 'special', released: false, position: new T.Vector3(5, 1, 7), heading: new T.Vector3(0, 0, 1), since: 10 } as Flight;
    h.flights.set('sables', flight); h.effect.update(10, h.fighters, h.flights); expect(h.count()).toBe(0);
    flight.released = true; h.effect.update(10.1, h.fighters, h.flights); expect(h.count()).toBeGreaterThan(0);
    const matrix = new T.Matrix4(), mesh = h.scene.getObjectByName('crocodile-sand-ribbons') as T.InstancedMesh;
    mesh.getMatrixAt(0, matrix); const center = new T.Vector3().setFromMatrixPosition(matrix);
    expect(center.distanceTo(flight.position)).toBeLessThan(1);
    h.flights.clear(); h.effect.update(10.2, h.fighters, h.flights); expect(h.count()).toBe(0); h.effect.dispose();
  });
  it('requires a real hit for Ground Death and deduplicates replayed contacts', () => {
    const h = setup(); h.effect.handle(hit({ kind: 'confirm' }), h.fighters); h.effect.update(10.1, h.fighters, h.flights); expect(h.count()).toBe(0);
    h.effect.handle(hit(), h.fighters); h.effect.update(10.1, h.fighters, h.flights); const count = h.count(); expect(count).toBeGreaterThan(0);
    h.effect.handle(hit(), h.fighters); h.effect.update(10.1, h.fighters, h.flights); expect(h.count()).toBe(count);
    h.effect.update(11, h.fighters, h.flights); expect(h.count()).toBe(0); h.effect.dispose();
  });
  it('keeps Ground Death on the impact floor when its victim is launched', () => {
    const h = setup(); h.fighter.group.position.y = 3;
    const foe = { ...h.fighter, group: new T.Group(), state: { ...h.fighter.state, id: 'foe', grounded: false } } as Fighter;
    foe.group.position.y = 5; h.fighters.set('foe', foe);
    h.effect.handle(hit(), h.fighters);
    foe.group.position.y = 8; h.fighter.group.position.y = 4;
    h.effect.update(10.1, h.fighters, h.flights);
    const mesh = h.scene.getObjectByName('crocodile-ground-fracture') as T.InstancedMesh, matrix = new T.Matrix4();
    mesh.getMatrixAt(0, matrix);
    expect(new T.Vector3().setFromMatrixPosition(matrix).y).toBeCloseTo(3.035);
    h.effect.dispose();
  });
  it.each(['whiff', 'rejected', 'respawn', 'eliminated'] as const)('clears retained impacts on %s', kind => {
    const h = setup(); h.effect.handle(hit(), h.fighters); h.effect.handle(hit({ id: 2, kind }), h.fighters);
    h.effect.update(10.1, h.fighters, h.flights); expect(h.count()).toBe(0); h.effect.dispose();
  });
  it('leaves G to the area system and bounds crowd draw counts', () => {
    const h = setup(.3); h.effect.handle(hit({ slot: 'area' }), h.fighters); h.effect.update(10.1, h.fighters, h.flights); expect(h.count()).toBe(0);
    for (let i = 0; i < 200; i++) h.effect.handle(hit({ id: i + 10 }), h.fighters);
    h.effect.update(10.1, h.fighters, h.flights);
    for (const mesh of h.own()) expect(mesh.count).toBeLessThanOrEqual(mesh.instanceMatrix.count);
    h.effect.reset(); expect(h.count()).toBe(0); h.effect.dispose(); h.effect.dispose(); expect(h.scene.children).toHaveLength(0);
  });
});
