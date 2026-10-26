import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';
import type { Fighter } from '../src/render/Fighter';
import type { Flight } from '../src/render/CombatEffects';
import { EndeavorFlashfire } from '../src/render/signature/EndeavorFlashfire';
import { MoveStage, STAGE_LIMITS } from '../src/render/signature/MoveStage';

const ID = 'endeavor' as FighterId;
function actor(id: string, patch: Partial<PlayerState> = {}): Fighter {
  const group = new THREE.Group();
  return { group, handR: new THREE.Vector3(.3, 1.3, .2), handL: new THREE.Vector3(-.3, 1.3, .2), state: { id, fighter: id === 'endeavor' ? ID : 'goku', alive: true, action: 'idle', actionSeq: 2, actionTime: 0, actionDuration: 3.6, yaw: 0, ...patch } as PlayerState } as unknown as Fighter;
}
const event = (patch: Partial<CombatEvent> = {}): CombatEvent => ({ id: 1, kind: 'confirm', fighter: ID, actorId: 'endeavor', targetId: 'foe', actionSeq: 2, slot: 'ultimate', serverTime: 10.47, ...patch });
function setup(patch: Partial<PlayerState> = {}, budget = 1) {
  const scene = new THREE.Scene(), stage = MoveStage.for(scene, { budget }), fx = new EndeavorFlashfire(scene, { budget }), endeavor = actor('endeavor', patch), foe = actor('foe'); foe.group.position.z = 2;
  const fighters = new Map([['endeavor', endeavor], ['foe', foe]]), flights = new Map<string, Flight>();
  const drawn = () => { const c = stage.counts; return c.flames + c.glows + c.bolts + c.discs; };
  return { scene, stage, fx, endeavor, foe, fighters, flights, drawn, end() { fx.dispose(); stage.release(); } };
}

describe('Endeavor bounded manual presentation', () => {
  it('draws nothing while idle, fire on the fists in the awakening, and never writes a state', () => {
    const h = setup();
    try {
      const before = JSON.stringify(h.endeavor.state);
      h.fx.update(10, h.fighters, h.flights);
      expect(h.drawn()).toBe(0); expect(JSON.stringify(h.endeavor.state)).toBe(before);
      Object.assign(h.endeavor.state, { action: 'awaken', actionDuration: .9, actionTime: .7 });
      const awakening = JSON.stringify(h.endeavor.state);
      h.fx.update(10.63, h.fighters, h.flights);
      expect(h.stage.counts.flames).toBeGreaterThan(0); expect(h.stage.counts.bolts).toBe(0);
      expect(JSON.stringify(h.endeavor.state)).toBe(awakening);
    } finally { h.end(); }
  });

  it('stages a special: the charge through the wind-up, light on the room, nothing once it is thrown', () => {
    const h = setup({ action: 'special', actionDuration: 1.14, actionTime: .4 / 1.14 });
    try {
      h.fx.update(10.4, h.fighters, h.flights);
      const c = h.stage.counts;
      expect(c.glows).toBeGreaterThan(5); expect(c.bolts).toBeGreaterThan(5); expect(c.lights).toBeGreaterThan(0);
      h.endeavor.state.actionTime = .9 / 1.14;
      h.fx.update(10.9, h.fighters, h.flights);
      expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('requires a confirmed hit before Prominence Burn gathers', () => {
    const h = setup({ action: 'ultimate', actionTime: 2.2 / 3.6 });
    try {
      h.fx.update(12.2, h.fighters, h.flights);
      expect(h.drawn()).toBe(0);
      h.fx.handle(event(), h.fighters);
      h.fx.update(12.2, h.fighters, h.flights);
      expect(h.stage.counts.flames).toBeGreaterThan(4); expect(h.stage.counts.discs).toBe(1); expect(h.stage.counts.bolts).toBeGreaterThan(0); expect(h.stage.counts.lights).toBeGreaterThan(1);
    } finally { h.end(); }
  });

  it.each(['interrupted', 'new action', 'whiff', 'target death', 'reset'])('cancels a confirmed gather on %s', reason => {
    const h = setup({ action: 'ultimate', actionTime: 2.2 / 3.6 });
    try {
      h.fx.handle(event(), h.fighters); h.fx.update(12.2, h.fighters, h.flights);
      expect(h.drawn()).toBeGreaterThan(0);
      if (reason === 'interrupted') h.endeavor.state.action = 'hurt';
      if (reason === 'new action') h.endeavor.state.actionSeq = 3;
      if (reason === 'whiff') h.fx.handle(event({ id: 2, kind: 'whiff' }), h.fighters);
      if (reason === 'target death') h.foe.state.alive = false;
      if (reason === 'reset') h.fx.reset();
      h.fx.update(12.21, h.fighters, h.flights);
      expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('lets the last blow\'s blast outlive its victim, and end', () => {
    const h = setup({ action: 'ultimate', actionTime: 2.9 / 3.6 });
    try {
      h.fx.handle(event(), h.fighters);
      h.fx.handle(event({ id: 2, kind: 'hit', contactIndex: 2, serverTime: 12.81 }), h.fighters);
      h.foe.state.alive = false; h.fighters.delete('foe');
      h.fx.update(12.95, h.fighters, h.flights);
      expect(h.stage.counts.shots).toBeGreaterThan(5); expect(h.stage.counts.flames).toBeGreaterThan(10);
      Object.assign(h.endeavor.state, { action: 'idle', actionTime: 0 });
      h.fx.update(13.6, h.fighters, h.flights);
      expect(h.stage.counts.shots).toBeGreaterThan(0);
      h.fx.update(18, h.fighters, h.flights);
      expect(h.stage.counts.shots).toBe(0); expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('draws five threads only from a released authoritative flight, and lets them go a moment after it', () => {
    const h = setup({}, .3);
    const f = { fighter: ID, slot: 'special', actorId: 'endeavor', released: false, position: new THREE.Vector3(1, 2, 6), heading: new THREE.Vector3(0, 0, 1), origin: new THREE.Vector3(1, 2, 0) } as Flight;
    try {
      h.flights.set('shot', f);
      h.fx.update(10, h.fighters, h.flights);
      expect(h.stage.counts.bolts).toBe(0);
      f.released = true;
      h.fx.update(10.2, h.fighters, h.flights);
      expect(h.stage.counts.bolts).toBe(20);
      h.flights.clear();
      h.fx.update(10.3, h.fighters, h.flights);
      expect(h.stage.counts.bolts).toBe(20);
      h.fx.update(10.6, h.fighters, h.flights);
      expect(h.stage.counts.bolts).toBe(0);
    } finally { h.end(); }
  });

  it('deduplicates a hit handled twice', () => {
    const h = setup();
    try {
      const e = event({ id: 2, kind: 'hit', slot: 'special', actionSeq: 1, serverTime: 12 });
      h.fx.handle(e, h.fighters);
      h.fx.update(12.03, h.fighters, h.flights);
      const once = h.stage.counts.shots;
      expect(once).toBeGreaterThan(0);
      h.fx.handle(e, h.fighters);
      h.fx.update(12.04, h.fighters, h.flights);
      expect(h.stage.counts.shots).toBe(once);
    } finally { h.end(); }
  });

  it('caps sustained crowded scenes and frees every GPU resource it held', () => {
    const scene = new THREE.Scene(), fx = new EndeavorFlashfire(scene, { budget: 1 }), stage = MoveStage.for(scene, { budget: 1 });
    const fighters = new Map<string, Fighter>();
    for (let i = 0; i < 300; i++) { const f = actor(`many${i}`, { fighter: ID, action: 'awaken', actionDuration: .9, actionTime: .7 }); fighters.set(f.state.id, f); }
    fx.update(10, fighters, new Map());
    for (const pool of ['flames', 'glows', 'bolts', 'lights', 'discs'] as const) expect(stage.counts[pool], pool).toBeLessThanOrEqual(STAGE_LIMITS[pool]);
    stage.release(); fx.dispose(); fx.dispose();
    expect(scene.children.length).toBe(0);
  });
});
