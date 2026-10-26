import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';
import { AKAME_MOVES } from '../src/game/fighters/akame';
import type { Fighter } from '../src/render/Fighter';
import type { Flight } from '../src/render/CombatEffects';
import { AkameMurasame, AKAME_VFX_LIMITS, AKAME_BLADE, akameBlade } from '../src/render/signature/AkameMurasame';
import { MoveStage, STAGE_LIMITS } from '../src/render/signature/MoveStage';
import { STAGED_BY_MODULE } from '../src/render/signature/StagedMoves';

const ID = 'akame' as FighterId, ULT = AKAME_MOVES.ultimate, LAST = ULT.contacts.length - 1;
function body(id: string, patch: Partial<PlayerState> = {}) {
  const group = new THREE.Group(), sword = new THREE.Bone(); sword.position.set(.3, 1.1, .3); group.add(sword); group.updateMatrixWorld(true);
  const fighter = { group, bones: new Map([['sword', sword]]), handR: new THREE.Vector3(.3, 1.1, .3), handL: new THREE.Vector3(-.3, 1.1, .3), strikePoint: (out: THREE.Vector3) => out.set(.3, 1.1, .9),
    state: { id, fighter: id === 'akame' ? ID : 'goku', alive: true, action: 'idle', actionSeq: 4, actionTime: 0, actionDuration: ULT.duration, yaw: 0, ...patch } as PlayerState } as unknown as Fighter;
  return { fighter, sword };
}
const event = (patch: Partial<CombatEvent> = {}): CombatEvent => ({ id: 1, kind: 'confirm', fighter: ID, actorId: 'akame', targetId: 'foe', actionSeq: 4, slot: 'ultimate', serverTime: 10 + ULT.contacts[0], ...patch });
function setup(patch: Partial<PlayerState> = {}, budget = 1) {
  const scene = new THREE.Scene(), stage = MoveStage.for(scene, { budget }), fx = new AkameMurasame(scene, { budget }), akame = body('akame', patch), foe = body('foe').fighter; foe.group.position.z = 2.4;
  const fighters = new Map([['akame', akame.fighter], ['foe', foe]]), flights = new Map<string, Flight>();
  const ink = () => (scene.getObjectByName('akame-curse-ink') as THREE.InstancedMesh).count;
  const drawn = () => { const c = stage.counts; return c.flames + c.glows + c.bolts + c.discs + c.shots + ink(); };
  return { scene, stage, fx, akame: akame.fighter, sword: akame.sword, foe, fighters, flights, ink, drawn, end() { fx.dispose(); stage.release(); } };
}

describe('Akame manual Murasame presentation', () => {
  it('stages her own moves, so the baseline stands aside', () => { expect(STAGED_BY_MODULE.has(ID)).toBe(true); });

  it('draws nothing while idle or in an unconfirmed ultimate past its opener, and never writes a state', () => {
    const h = setup();
    try {
      const before = JSON.stringify(h.akame.state);
      h.fx.update(10, h.fighters, h.flights);
      expect(h.drawn()).toBe(0); expect(JSON.stringify(h.akame.state)).toBe(before);
      Object.assign(h.akame.state, { action: 'ultimate', actionTime: 2 / ULT.duration });
      h.fx.update(12, h.fighters, h.flights);
      expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('lights the edge of the sword that is shown, from its guard to its point', () => {
    const move = AKAME_MOVES.heavy, h = setup({ action: 'heavy', actionDuration: move.duration, actionTime: .3 / move.duration });
    try {
      h.sword.position.set(3, 2, 1); h.akame.group.updateMatrixWorld(true);
      const root = new THREE.Vector3(), tip = new THREE.Vector3();
      expect(akameBlade(h.akame, root, tip)).toBe(true);
      expect(tip.distanceTo(new THREE.Vector3(3, 2, 1).add(new THREE.Vector3(...AKAME_BLADE.tip)))).toBeLessThan(1e-6);
      h.fx.update(10.3, h.fighters, h.flights);
      const glow = (h.scene.getObjectByName('stage-glow') as THREE.Mesh).geometry.getAttribute('aP');
      expect(new THREE.Vector3(glow.getX(0), glow.getY(0), glow.getZ(0)).distanceTo(tip)).toBeLessThan(1e-4);
      expect(h.stage.counts.bolts).toBeGreaterThan(2); expect(h.stage.counts.lights).toBe(2); expect(h.ink()).toBe(0);
      h.akame.state.actionTime = (move.contacts[0] + .08) / move.duration;
      h.fx.update(10.64, h.fighters, h.flights);
      expect(h.stage.counts.bolts).toBe(26);
    } finally { h.end(); }
  });

  it('lands Night Raid Pierce once: the lines on the blow, then the curse\'s marks in ink out of the wound', () => {
    const move = AKAME_MOVES.special, h = setup({ action: 'special', actionDuration: move.duration, actionTime: move.contacts[0] / move.duration });
    try {
      const hit = event({ id: 7, kind: 'hit', slot: 'special', contactIndex: 0, serverTime: 10.66 });
      h.fx.handle(hit, h.fighters); h.fx.handle(hit, h.fighters);
      h.fx.update(10.68, h.fighters, h.flights);
      expect(h.stage.counts.shots).toBe(4); expect(h.stage.counts.bolts).toBe(2); expect(h.ink()).toBe(0);
      h.fx.update(11.1, h.fighters, h.flights);
      const marks = h.ink();
      expect(marks).toBeGreaterThan(20); expect(marks).toBeLessThanOrEqual(AKAME_VFX_LIMITS.ink);
      expect(h.stage.counts.bolts).toBeGreaterThanOrEqual(marks);
      h.fx.update(14, h.fighters, h.flights);
      expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('requires a confirmed hit before Burial of the Empire gathers', () => {
    const h = setup({ action: 'ultimate', actionTime: 1.2 / ULT.duration });
    try {
      h.fx.update(11.2, h.fighters, h.flights);
      expect(h.drawn()).toBe(0);
      h.fx.handle(event(), h.fighters);
      h.fx.update(11.2, h.fighters, h.flights);
      expect(h.stage.counts.discs).toBe(1); expect(h.stage.counts.flames).toBeGreaterThan(8); expect(h.stage.counts.bolts).toBeGreaterThan(6);
      expect(h.stage.counts.lights).toBeLessThanOrEqual(STAGE_LIMITS.lights / 2);
    } finally { h.end(); }
  });

  it.each(['interrupted', 'new action', 'whiff', 'target death', 'reset'])('cancels a confirmed gather on %s', reason => {
    const h = setup({ action: 'ultimate', actionTime: 2.2 / ULT.duration });
    try {
      h.fx.handle(event(), h.fighters); h.fx.update(12.2, h.fighters, h.flights);
      expect(h.drawn()).toBeGreaterThan(0);
      if (reason === 'interrupted') h.akame.state.action = 'hurt';
      if (reason === 'new action') h.akame.state.actionSeq = 5;
      if (reason === 'whiff') h.fx.handle(event({ id: 2, kind: 'whiff' }), h.fighters);
      if (reason === 'target death') h.foe.state.alive = false;
      if (reason === 'reset') h.fx.reset();
      h.fx.update(12.21, h.fighters, h.flights);
      expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('gives the last cut nothing without its confirm; with it, the one cut and the curse outlive the victim, and end', () => {
    const h = setup({ action: 'ultimate', actionTime: ULT.contacts[LAST] / ULT.duration });
    try {
      const last = event({ id: 9, kind: 'hit', contactIndex: LAST, serverTime: 10 + ULT.contacts[LAST] });
      h.fx.handle(last, h.fighters);
      h.fx.update(10 + ULT.contacts[LAST] + .02, h.fighters, h.flights);
      expect(h.drawn()).toBe(0);
      h.fx.handle(event(), h.fighters); h.fx.handle({ ...last, id: 10 }, h.fighters);
      h.foe.state.alive = false;
      h.fx.update(10 + ULT.contacts[LAST] + .4, h.fighters, h.flights);
      expect(h.stage.counts.shots).toBe(5); expect(h.ink()).toBeGreaterThan(20);
      Object.assign(h.akame.state, { action: 'idle', actionTime: 0 });
      h.fx.update(10 + ULT.contacts[LAST] + 4, h.fighters, h.flights);
      expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('keeps its ink and its records bounded under a crowd, and draws less on a low budget', () => {
    const full = setup({ action: 'idle' }), low = setup({ action: 'idle' }, .5);
    try {
      for (const h of [full, low]) { for (let i = 0; i < 500; i++) h.fx.handle(event({ id: 100 + i, kind: 'hit', slot: 'heavy', serverTime: 12 }), h.fighters); h.fx.update(12.6, h.fighters, h.flights); }
      expect(full.ink()).toBe(AKAME_VFX_LIMITS.ink); expect(low.ink()).toBeLessThan(full.ink());
      expect(full.stage.counts.bolts).toBeLessThanOrEqual(STAGE_LIMITS.bolts);
      full.fx.dispose(); full.fx.dispose();
      expect(full.scene.getObjectByName('akame-curse-ink')).toBeUndefined();
    } finally { full.end(); low.end(); }
  });
});
