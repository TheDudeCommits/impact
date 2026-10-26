import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';
import { SHINJI_MOVES, SHINJI_AWAKENING, shinjiStrikeJoint } from '../src/game/fighters/shinji';
import type { Fighter } from '../src/render/Fighter';
import type { Flight } from '../src/render/CombatEffects';
import { ShinjiATField, SHINJI_AT_LIMITS } from '../src/render/signature/ShinjiATField';
import { MoveStage, STAGE_LIMITS } from '../src/render/signature/MoveStage';
import { STAGED_BY_MODULE } from '../src/render/signature/StagedMoves';

const ID = 'shinji' as FighterId, ULT = SHINJI_MOVES.ultimate, LAST = ULT.contacts.length - 1;
function body(id: string, patch: Partial<PlayerState> = {}): Fighter {
  const group = new THREE.Group();
  return { group, handR: new THREE.Vector3(.5, 1.7, .4), handL: new THREE.Vector3(-.5, 1.7, .4), strikePoint: (out: THREE.Vector3) => out.set(-.5, 1.7, .4),
    state: { id, fighter: id === 'shinji' ? ID : 'goku', alive: true, action: 'idle', actionSeq: 1, actionTime: 0, actionDuration: ULT.duration, yaw: 0, ...patch } as PlayerState } as unknown as Fighter;
}
const event = (patch: Partial<CombatEvent> = {}): CombatEvent => ({ id: 1, kind: 'confirm', fighter: ID, actorId: 'shinji', targetId: 'foe', actionSeq: 1, slot: 'ultimate', serverTime: 10 + ULT.contacts[0], ...patch });
function setup(patch: Partial<PlayerState> = {}, budget = 1) {
  const scene = new THREE.Scene(), stage = MoveStage.for(scene, { budget }), fx = new ShinjiATField(scene, { budget }), shinji = body('shinji', patch), foe = body('foe'); foe.group.position.z = 2;
  const fighters = new Map([['shinji', shinji], ['foe', foe]]), flights = new Map<string, Flight>();
  const drawn = () => { const c = stage.counts; return c.flames + c.glows + c.bolts + c.discs + c.shells + c.shots; };
  const starts = () => { const p = (scene.getObjectByName('stage-bolts') as THREE.Mesh).geometry.getAttribute('aA'); return Array.from({ length: stage.counts.bolts }, (_, i) => new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i))); };
  return { scene, stage, fx, shinji, foe, fighters, flights, drawn, starts, end() { fx.dispose(); stage.release(); } };
}

describe('Shinji manually commanded A.T. fields', () => {
  it('stages his own moves, so the baseline stands aside', () => { expect(STAGED_BY_MODULE.has(ID)).toBe(true); });

  it('does not create idle or unconfirmed ultimate fields', () => {
    const h = setup();
    try {
      const before = JSON.stringify(h.shinji.state);
      h.fx.update(10, h.fighters, h.flights); expect(h.drawn()).toBe(0); expect(JSON.stringify(h.shinji.state)).toBe(before);
      Object.assign(h.shinji.state, { action: 'ultimate', actionTime: 2 / ULT.duration });
      h.fx.handle(event({ kind: 'cast' }), h.fighters);
      h.fx.update(12, h.fighters, h.flights); expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('requires confirmation, deduplicates and clears interrupted field rupture', () => {
    const h = setup({ action: 'ultimate', actionTime: 2 / ULT.duration });
    try {
      h.fx.handle(event(), h.fighters); h.fx.handle(event(), h.fighters);
      h.fx.update(12, h.fighters, h.flights);
      const torn = h.stage.counts.bolts;
      expect(torn).toBeGreaterThanOrEqual(48 + 2 + 10); expect(h.stage.counts.lights).toBeLessThanOrEqual(STAGE_LIMITS.lights / 2);
      const spread = () => { const xs = h.starts().slice(0, 48).map(p => p.x); return Math.max(...xs) - Math.min(...xs); };
      const early = spread(); h.shinji.state.actionTime = 2.9 / ULT.duration; h.fx.update(12.9, h.fighters, h.flights);
      expect(spread()).toBeGreaterThan(early);
      h.shinji.state.action = 'hurt';
      h.fx.update(12.92, h.fighters, h.flights); expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it.each(['new action', 'whiff', 'target death', 'reset'])('cancels a confirmed rupture on %s', reason => {
    const h = setup({ action: 'ultimate', actionTime: 2.2 / ULT.duration });
    try {
      h.fx.handle(event(), h.fighters); h.fx.update(12.2, h.fighters, h.flights);
      expect(h.drawn()).toBeGreaterThan(0);
      if (reason === 'new action') h.shinji.state.actionSeq = 2;
      if (reason === 'whiff') h.fx.handle(event({ id: 2, kind: 'whiff' }), h.fighters);
      if (reason === 'target death') h.foe.state.alive = false;
      if (reason === 'reset') h.fx.reset();
      h.fx.update(12.21, h.fighters, h.flights); expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('charges the palm that strikes, then dresses only actual released flights', () => {
    const move = SHINJI_MOVES.special, h = setup({ action: 'special', actionDuration: move.duration, actionTime: .4 / move.duration });
    try {
      h.fx.update(10.4, h.fighters, h.flights);
      const glow = (h.scene.getObjectByName('stage-glow') as THREE.Mesh).geometry.getAttribute('aP');
      expect(new THREE.Vector3(glow.getX(0), glow.getY(0), glow.getZ(0)).distanceTo(new THREE.Vector3(-.5, 1.7, .4))).toBeLessThan(1e-6);
      expect(h.stage.counts.bolts).toBeGreaterThan(16);
      h.shinji.state.action = 'idle';
      const flight = { fighter: ID, slot: 'special', released: false, actorId: 'shinji', position: new THREE.Vector3(0, 1.5, 4), heading: new THREE.Vector3(0, 0, 1) } as unknown as Flight;
      h.flights.set('f', flight);
      h.fx.update(10.8, h.fighters, h.flights); expect(h.drawn()).toBe(0);
      flight.released = true;
      h.fx.update(10.82, h.fighters, h.flights);
      expect(h.stage.counts.bolts).toBe(40 + 16 + 16); expect(h.stage.counts.lights).toBe(1);
      for (const p of h.starts().slice(0, 40)) expect(p.z).toBeCloseTo(4, 5);
    } finally { h.end(); }
  });

  it('keeps the confirmed final rupture at its authoritative endpoint after recoil, once, and lets it end', () => {
    const h = setup({ action: 'ultimate', actionTime: ULT.contacts[LAST] / ULT.duration });
    try {
      const last = event({ id: 9, kind: 'hit', contactIndex: LAST, serverTime: 10 + ULT.contacts[LAST], endpoint: { x: 0, y: 1.4, z: 2 } });
      h.fx.handle(last, h.fighters);
      h.fx.update(10 + ULT.contacts[LAST] + .02, h.fighters, h.flights); expect(h.drawn()).toBe(0);
      h.fx.handle(event(), h.fighters); h.fx.handle({ ...last, id: 10 }, h.fighters); h.fx.handle({ ...last, id: 10 }, h.fighters);
      h.foe.group.position.set(5, 0, 9); h.foe.state.alive = false;
      h.fx.update(10 + ULT.contacts[LAST] + .2, h.fighters, h.flights);
      expect(h.stage.counts.shots).toBe(5);
      const bar = h.starts().at(-1)!; expect(bar.z).toBeCloseTo(2, 5); expect(Math.abs(bar.x)).toBeLessThan(6.1);
      Object.assign(h.shinji.state, { action: 'idle', actionTime: 0 });
      h.fx.update(10 + ULT.contacts[LAST] + 4, h.fighters, h.flights); expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('bounds crowd records and frees every scene resource', () => {
    for (const budget of [.35, 1]) {
      const h = setup({}, budget);
      try {
        for (let i = 0; i < 1000; i++) h.fx.handle(event({ id: 100 + i, kind: 'hit', slot: 'heavy', serverTime: 12 }), h.fighters);
        h.fx.update(12.05, h.fighters, h.flights);
        expect(h.stage.counts.bolts).toBe(SHINJI_AT_LIMITS.marks * 24); expect(h.stage.counts.shots).toBeLessThanOrEqual(STAGE_LIMITS.shots);
        h.fx.reset(); expect(h.drawn()).toBe(0);
      } finally { h.end(); }
      expect(h.scene.children).toHaveLength(0);
    }
  });

  it('maps physical hands and leaves awakening nonautonomous', () => {
    expect(ULT.contacts[0]).toBeLessThanOrEqual(.6); expect(ULT.damage + ULT.finisherDamage!).toBe(290); expect(SHINJI_MOVES.special.aimOnRelease).toBe(true);
    expect(shinjiStrikeJoint('special', 'A.T. Repulsion')).toBe('LeftHand'); expect(shinjiStrikeJoint('special', 'Terminal Descent')).toBe('BothHands'); expect(shinjiStrikeJoint('heavy', 'Armored Hammer')).toBe('BothHands');
    expect(shinjiStrikeJoint('ultimate', 'A.T. Field Rupture', 0)).toBe('LeftHand'); expect(shinjiStrikeJoint('ultimate', 'A.T. Field Rupture', 1)).toBe('RightHand');
    expect(SHINJI_AWAKENING.runtimeDuration).toBe(.9); expect(SHINJI_AWAKENING.manualOnly).toBe(true); expect(SHINJI_AWAKENING.sameBody).toBe(true);
    const h = setup({ action: 'awaken', actionDuration: .9, actionTime: .5 });
    try {
      const before = JSON.stringify(h.shinji.state);
      h.fx.update(10.45, h.fighters, h.flights);
      expect(h.stage.counts.discs).toBe(1); expect(h.stage.counts.bolts).toBe(16 + 8); expect(JSON.stringify(h.shinji.state)).toBe(before);
    } finally { h.end(); }
  });
});
