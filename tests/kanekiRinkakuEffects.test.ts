import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';
import { KANEKI_MOVES } from '../src/game/fighters/kaneki';
import type { Fighter } from '../src/render/Fighter';
import type { Flight } from '../src/render/CombatEffects';
import { KanekiRinkaku, KANEKI_RINKAKU_LIMITS, kanekiAuthoredJabStep } from '../src/render/signature/KanekiRinkaku';
import { MoveStage, STAGE_LIMITS } from '../src/render/signature/MoveStage';
import { STAGED_BY_MODULE } from '../src/render/signature/StagedMoves';

const ID = 'ken-kaneki' as FighterId, ULT = KANEKI_MOVES.ultimate, LAST = ULT.contacts.length - 1;
function body(id: string, patch: Partial<PlayerState> = {}): Fighter {
  const group = new THREE.Group(), head = new THREE.Object3D(); head.position.set(0, 1.6, 0); group.add(head);
  return { group, handR: new THREE.Vector3(.3, 1.3, .2), handL: new THREE.Vector3(-.3, 1.3, .2), strikePoint: (out: THREE.Vector3) => out.set(.3, 1.3, .7), drawnJoint: (name: string) => name === 'Head' ? head : undefined,
    state: { id, fighter: id === 'kaneki' ? ID : 'goku', alive: true, action: 'idle', actionSeq: 2, actionTime: 0, actionDuration: ULT.duration, yaw: 0, ...patch } as PlayerState } as unknown as Fighter;
}
const event = (patch: Partial<CombatEvent> = {}): CombatEvent => ({ id: 1, kind: 'confirm', fighter: ID, actorId: 'kaneki', targetId: 'foe', actionSeq: 2, slot: 'ultimate', serverTime: 10 + ULT.contacts[0], ...patch });
function setup(patch: Partial<PlayerState> = {}, budget = 1) {
  const scene = new THREE.Scene(), stage = MoveStage.for(scene, { budget }), fx = new KanekiRinkaku(scene, { budget }), kaneki = body('kaneki', patch), foe = body('foe'); foe.group.position.z = 2.4;
  const fighters = new Map([['kaneki', kaneki], ['foe', foe]]), flights = new Map<string, Flight>();
  const drawn = () => { const c = stage.counts; return c.flames + c.glows + c.bolts + c.discs + c.shots; };
  return { scene, stage, fx, kaneki, foe, fighters, flights, drawn, end() { fx.dispose(); stage.release(); } };
}

describe('Kaneki manually triggered bounded presentation', () => {
  it('stages his own moves, so the baseline stands aside', () => { expect(STAGED_BY_MODULE.has(ID)).toBe(true); });

  it('draws nothing while idle or in an unconfirmed ultimate past its opener, and never writes a state', () => {
    const h = setup();
    try {
      const before = JSON.stringify(h.kaneki.state);
      h.fx.update(10, h.fighters, h.flights);
      expect(h.drawn()).toBe(0); expect(JSON.stringify(h.kaneki.state)).toBe(before);
      Object.assign(h.kaneki.state, { action: 'ultimate', actionTime: 2 / ULT.duration });
      h.fx.update(12, h.fighters, h.flights);
      expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('keeps the awakening\'s ring and eye to its beats', () => {
    const h = setup({ action: 'awaken', actionDuration: .9, actionTime: .6 });
    try {
      h.fx.update(10.54, h.fighters, h.flights);
      expect(h.stage.counts.discs).toBe(1); expect(h.stage.counts.glows).toBe(1);
      h.kaneki.state.actionTime = .96;
      h.fx.update(10.86, h.fighters, h.flights);
      expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('stages Fourfold Pierce: the tails, the dark floor and the charge through the wind-up, then the lances at their own reach', () => {
    const move = KANEKI_MOVES.special, h = setup({ action: 'special', actionDuration: move.duration, actionTime: .4 / move.duration });
    try {
      h.fx.update(10.4, h.fighters, h.flights);
      const wind = { ...h.stage.counts };
      expect(wind.bolts).toBeGreaterThan(72); expect(wind.discs).toBe(1); expect(wind.flames).toBeGreaterThan(3); expect(wind.lights).toBeGreaterThan(1);
      h.kaneki.state.actionTime = (move.contacts[0] + .1) / move.duration;
      h.fx.update(10.72, h.fighters, h.flights);
      expect(h.stage.counts.bolts).toBe(72); expect(h.stage.counts.discs).toBe(0);
      h.kaneki.state.actionTime = (move.contacts[0] + .5) / move.duration;
      h.fx.update(11.12, h.fighters, h.flights);
      expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('lands a special once on the struck body: a blast, black flame, the dark on the floor and the lances through it', () => {
    const move = KANEKI_MOVES.special, h = setup({ action: 'special', actionDuration: move.duration, actionTime: move.contacts[0] / move.duration });
    try {
      const hit = event({ id: 7, kind: 'hit', slot: 'special', contactIndex: 0, serverTime: 10.62, endpoint: { x: 0, y: 1.1, z: 2.4 } });
      h.fx.handle(hit, h.fighters); h.fx.handle(hit, h.fighters);
      h.fx.update(10.66, h.fighters, h.flights);
      expect(h.stage.counts.shots).toBe(4);
      expect(h.stage.counts.bolts).toBe(80);
      h.fx.update(14, h.fighters, h.flights);
      expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('requires a confirmed hit before One-Eyed Requiem gathers, and grows the centipede as it builds', () => {
    const h = setup({ action: 'ultimate', actionTime: 1 / ULT.duration });
    try {
      h.fx.update(11, h.fighters, h.flights);
      expect(h.drawn()).toBe(0);
      h.fx.handle(event(), h.fighters);
      h.fx.update(11, h.fighters, h.flights);
      const early = { ...h.stage.counts };
      expect(early.discs).toBe(1); expect(early.flames).toBeGreaterThan(12); expect(early.bolts).toBeGreaterThan(20); expect(early.lights).toBeGreaterThan(2);
      h.kaneki.state.actionTime = 2.8 / ULT.duration;
      h.fx.update(12.8, h.fighters, h.flights);
      expect(h.stage.counts.lights).toBeLessThanOrEqual(STAGE_LIMITS.lights / 2);
    } finally { h.end(); }
  });

  it.each(['interrupted', 'new action', 'whiff', 'target death', 'reset'])('cancels a confirmed gather on %s', reason => {
    const h = setup({ action: 'ultimate', actionTime: 2.2 / ULT.duration });
    try {
      h.fx.handle(event(), h.fighters); h.fx.update(12.2, h.fighters, h.flights);
      expect(h.drawn()).toBeGreaterThan(0);
      if (reason === 'interrupted') h.kaneki.state.action = 'hurt';
      if (reason === 'new action') h.kaneki.state.actionSeq = 3;
      if (reason === 'whiff') h.fx.handle(event({ id: 2, kind: 'whiff' }), h.fighters);
      if (reason === 'target death') h.foe.state.alive = false;
      if (reason === 'reset') h.fx.reset();
      h.fx.update(12.21, h.fighters, h.flights);
      expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('gives the last blow nothing without its confirm, and lets its blast outlive the victim, and end', () => {
    const h = setup({ action: 'ultimate', actionTime: ULT.contacts[LAST] / ULT.duration });
    try {
      const last = event({ id: 9, kind: 'hit', contactIndex: LAST, serverTime: 10 + ULT.contacts[LAST] });
      h.fx.handle(last, h.fighters);
      h.fx.update(10 + ULT.contacts[LAST] + .02, h.fighters, h.flights);
      expect(h.drawn()).toBe(0);
      h.fx.handle(event(), h.fighters); h.fx.handle({ ...last, id: 10 }, h.fighters);
      h.foe.state.alive = false;
      h.fx.update(10 + ULT.contacts[LAST] + .3, h.fighters, h.flights);
      expect(h.stage.counts.shots).toBeGreaterThan(5); expect(h.stage.counts.bolts).toBeGreaterThan(30);
      Object.assign(h.kaneki.state, { action: 'idle', actionTime: 0 });
      h.fx.update(10 + ULT.contacts[LAST] + 4, h.fighters, h.flights);
      expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('draws less on a low budget, keeps its records bounded, and disposes once', () => {
    const full = setup({ action: 'ultimate', actionTime: 2.2 / ULT.duration }), low = setup({ action: 'ultimate', actionTime: 2.2 / ULT.duration }, .5);
    try {
      for (const h of [full, low]) { h.fx.handle(event(), h.fighters); h.fx.update(12.2, h.fighters, h.flights); }
      expect(low.stage.counts.flames).toBeLessThan(full.stage.counts.flames); expect(low.stage.counts.bolts).toBeLessThan(full.stage.counts.bolts);
      for (let i = 0; i < 300; i++) full.fx.handle(event({ id: 100 + i, kind: 'hit', slot: 'heavy', serverTime: 12.2, endpoint: { x: 0, y: 1.1, z: 2.4 } }), full.fighters);
      full.fx.update(12.25, full.fighters, full.flights);
      expect(full.stage.counts.bolts).toBeLessThanOrEqual(STAGE_LIMITS.bolts); expect(KANEKI_RINKAKU_LIMITS.marks).toBe(12);
      full.fx.dispose(); full.fx.dispose();
    } finally { full.end(); low.end(); }
  });
});

it('limits source root-step allowance to the three authored jab windows', () => {
  for (const clip of ['Ghoul Knuckle', 'Rush 1']) { expect(kanekiAuthoredJabStep(clip, .28)).toBe(true); expect(kanekiAuthoredJabStep(clip, .60)).toBe(false); }
  expect(kanekiAuthoredJabStep('One-Eyed Requiem', .5)).toBe(true); expect(kanekiAuthoredJabStep('One-Eyed Requiem', .8625)).toBe(false);
  for (const clip of ['Rinkaku Reap', 'Fourfold Pierce', 'Rush 2', 'Kakugan Unbound', undefined]) expect(kanekiAuthoredJabStep(clip, .28)).toBe(false);
  expect(kanekiAuthoredJabStep('Ghoul Knuckle', NaN)).toBe(false); expect(kanekiAuthoredJabStep('Ghoul Knuckle', -.1)).toBe(false);
});
