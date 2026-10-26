import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';
import { HIEI_MOVES } from '../src/game/fighters/hiei';
import type { Fighter } from '../src/render/Fighter';
import type { Flight } from '../src/render/CombatEffects';
import { HieiDarknessFlame, HIEI_DARKNESS_LIMITS } from '../src/render/signature/HieiDarknessFlame';
import { MoveStage, STAGE_LIMITS } from '../src/render/signature/MoveStage';
import { STAGED_BY_MODULE } from '../src/render/signature/StagedMoves';

const ID = 'hiei' as FighterId, ULT = HIEI_MOVES.ultimate, LAST = ULT.contacts.length - 1;
function body(id: string, patch: Partial<PlayerState> = {}) {
  const group = new THREE.Group(), sword = new THREE.Object3D(), head = new THREE.Object3D();
  sword.position.set(.3, 1.1, .3); head.position.set(0, 1.4, 0); group.add(sword, head); group.updateMatrixWorld(true);
  const joints: Record<string, THREE.Object3D> = { Sword: sword, Head: head };
  const fighter = { group, handR: new THREE.Vector3(.3, 1.1, .3), handL: new THREE.Vector3(-.3, 1.1, .3), strikePoint: (out: THREE.Vector3) => out.set(.3, 1.1, .7), drawnJoint: (name: string) => joints[name],
    state: { id, fighter: id === 'hiei' ? ID : 'goku', alive: true, action: 'idle', actionSeq: 7, actionTime: 0, actionDuration: ULT.duration, yaw: 0, ...patch } as PlayerState } as unknown as Fighter;
  return { fighter, joints };
}
const event = (patch: Partial<CombatEvent> = {}): CombatEvent => ({ id: 1, kind: 'confirm', fighter: ID, actorId: 'hiei', targetId: 'foe', actionSeq: 7, slot: 'ultimate', serverTime: 10 + ULT.contacts[0], ...patch });
function setup(patch: Partial<PlayerState> = {}, budget = 1) {
  const scene = new THREE.Scene(), stage = MoveStage.for(scene, { budget }), fx = new HieiDarknessFlame(scene, { budget }), hiei = body('hiei', patch), foe = body('foe').fighter; foe.group.position.z = 2.4;
  const fighters = new Map([['hiei', hiei.fighter], ['foe', foe]]), flights = new Map<string, Flight>();
  const heads = () => (scene.getObjectByName('hiei-dragon-heads') as THREE.InstancedMesh).count;
  const drawn = () => { const c = stage.counts; return c.flames + c.glows + c.bolts + c.discs + c.shots + heads(); };
  return { scene, stage, fx, hiei: hiei.fighter, joints: hiei.joints, foe, fighters, flights, heads, drawn, end() { fx.dispose(); stage.release(); } };
}

describe('Hiei finite manual darkness', () => {
  it('stages his own moves, so the baseline stands aside', () => { expect(STAGED_BY_MODULE.has(ID)).toBe(true); });

  it('is idle without manual action, and never writes a state', () => {
    const h = setup();
    try {
      const before = JSON.stringify(h.hiei.state);
      h.fx.update(10, h.fighters, h.flights);
      expect(h.drawn()).toBe(0); expect(JSON.stringify(h.hiei.state)).toBe(before);
    } finally { h.end(); }
  });

  it('wreathes the blade of the body that is shown through a heavy\'s wind-up, then hangs the rising arc', () => {
    const move = HIEI_MOVES.heavy, h = setup({ action: 'heavy', actionDuration: move.duration, actionTime: .3 / move.duration });
    try {
      h.joints.Sword.position.set(3, 2, 1); h.hiei.group.updateMatrixWorld(true);
      h.fx.update(10.3, h.fighters, h.flights);
      const wind = { ...h.stage.counts };
      expect(wind.flames).toBe(4); expect(wind.bolts).toBeGreaterThan(4); expect(wind.lights).toBe(2);
      const glow = (h.scene.getObjectByName('stage-glow') as THREE.Mesh).geometry.getAttribute('aP');
      expect(glow.getX(0)).toBeCloseTo(3, 4); expect(glow.getY(0)).toBeCloseTo(2.78, 4); expect(glow.getZ(0)).toBeCloseTo(1, 4);
      h.hiei.state.actionTime = (move.contacts[0] + .08) / move.duration;
      h.fx.update(10.62, h.fighters, h.flights);
      expect(h.stage.counts.bolts).toBe(24); expect(h.stage.counts.flames).toBeGreaterThan(6);
      h.hiei.state.actionTime = (move.contacts[0] + .4) / move.duration;
      h.fx.update(10.94, h.fighters, h.flights);
      expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('lands Afterimage Sever once: the line through the body, then the fire', () => {
    const move = HIEI_MOVES.special, h = setup({ action: 'special', actionDuration: move.duration, actionTime: move.contacts[0] / move.duration });
    try {
      const hit = event({ id: 7, kind: 'hit', slot: 'special', contactIndex: 0, serverTime: 10.64 });
      h.fx.handle(hit, h.fighters); h.fx.handle(hit, h.fighters);
      h.fx.update(10.66, h.fighters, h.flights);
      const blow = h.stage.counts.flames;
      expect(h.stage.counts.bolts).toBe(2); expect(h.stage.counts.shots).toBe(4); expect(blow).toBeGreaterThan(0);
      h.fx.update(10.9, h.fighters, h.flights);
      expect(h.stage.counts.flames).toBeGreaterThan(blow);
      h.fx.update(14, h.fighters, h.flights);
      expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('requires the ultimate\'s confirm before the dragon, and draws one head on a body of black fire', () => {
    const h = setup({ action: 'ultimate', actionTime: 1.2 / ULT.duration });
    try {
      h.fx.update(11.2, h.fighters, h.flights);
      expect(h.heads()).toBe(0); expect(h.drawn()).toBe(0);
      h.fx.handle(event(), h.fighters);
      h.fx.update(11.2, h.fighters, h.flights);
      expect(h.heads()).toBe(1); expect(h.stage.counts.flames).toBeGreaterThan(20); expect(h.stage.counts.discs).toBe(1);
      expect(h.stage.counts.lights).toBeLessThanOrEqual(STAGE_LIMITS.lights / 2);
      h.hiei.state.whiffedAt = 11.21;
      h.fx.update(11.22, h.fighters, h.flights);
      expect(h.heads()).toBe(0); expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it.each(['interrupted', 'new action', 'whiff', 'target death', 'reset'])('cancels a confirmed dragon on %s', reason => {
    const h = setup({ action: 'ultimate', actionTime: 2 / ULT.duration });
    try {
      h.fx.handle(event(), h.fighters); h.fx.update(12, h.fighters, h.flights);
      expect(h.heads()).toBe(1);
      if (reason === 'interrupted') h.hiei.state.action = 'hurt';
      if (reason === 'new action') h.hiei.state.actionSeq = 8;
      if (reason === 'whiff') h.fx.handle(event({ id: 2, kind: 'whiff' }), h.fighters);
      if (reason === 'target death') h.foe.state.alive = false;
      if (reason === 'reset') h.fx.reset();
      h.fx.update(12.01, h.fighters, h.flights);
      expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('gives the last blow nothing without its confirm; with it, the pillar and the dragon rising through it, and an end', () => {
    const h = setup({ action: 'ultimate', actionTime: ULT.contacts[LAST] / ULT.duration });
    try {
      const last = event({ id: 9, kind: 'hit', contactIndex: LAST, serverTime: 10 + ULT.contacts[LAST] });
      h.fx.handle(last, h.fighters);
      h.fx.update(10 + ULT.contacts[LAST] + .02, h.fighters, h.flights);
      expect(h.drawn()).toBe(0);
      h.fx.handle(event(), h.fighters); h.fx.handle({ ...last, id: 10 }, h.fighters); h.fx.handle({ ...last, id: 10 }, h.fighters);
      h.foe.state.alive = false;
      h.fx.update(10 + ULT.contacts[LAST] + .3, h.fighters, h.flights);
      expect(h.heads()).toBe(1); expect(h.stage.counts.shots).toBe(8); expect(h.stage.counts.flames).toBeGreaterThan(20);
      Object.assign(h.hiei.state, { action: 'idle', actionTime: 0 });
      h.fx.update(10 + ULT.contacts[LAST] + 4, h.fighters, h.flights);
      expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('keeps the awakening\'s coil, head and eye to its entry', () => {
    const h = setup({ action: 'awaken', actionDuration: .9, actionTime: .5 });
    try {
      h.fx.update(10.45, h.fighters, h.flights);
      expect(h.stage.counts.flames).toBe(7); expect(h.heads()).toBe(1);
      h.hiei.state.actionTime = 1;
      h.fx.update(10.9, h.fighters, h.flights);
      expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('bounds its records, draws less on a low budget, and deduplicates', () => {
    const full = setup({ action: 'ultimate', actionTime: 2 / ULT.duration }), low = setup({ action: 'ultimate', actionTime: 2 / ULT.duration }, .5);
    try {
      for (const h of [full, low]) { h.fx.handle(event(), h.fighters); h.fx.update(12, h.fighters, h.flights); }
      expect(low.stage.counts.flames).toBeLessThan(full.stage.counts.flames);
      for (let i = 0; i < 1000; i++) full.fx.handle(event({ id: 100 + i, kind: 'hit', slot: 'heavy', serverTime: 12 }), full.fighters);
      full.fx.update(12.05, full.fighters, full.flights);
      expect(full.heads()).toBeLessThanOrEqual(HIEI_DARKNESS_LIMITS.heads); expect(full.stage.counts.bolts).toBeLessThanOrEqual(STAGE_LIMITS.bolts);
    } finally { full.end(); low.end(); }
  });

  it('loads only for an active Hiei room and safely retires late textures', async () => {
    const h = setup(), texture = new THREE.Texture<HTMLImageElement>(), release = vi.spyOn(texture, 'dispose');
    let resolve!: (t: THREE.Texture<HTMLImageElement>) => void;
    const mock = vi.spyOn(THREE.TextureLoader.prototype, 'loadAsync').mockImplementation(() => new Promise(r => { resolve = r; }));
    try {
      await h.fx.load(['goku']); expect(mock).not.toHaveBeenCalled();
      const job = h.fx.load(['hiei']); expect(h.fx.load(['hiei'])).toBe(job);
      h.fx.dispose(); resolve(texture); await job;
      expect(release).toHaveBeenCalledOnce(); expect(h.scene.getObjectByName('hiei-dragon-heads')).toBeUndefined();
    } finally { mock.mockRestore(); h.end(); }
  });
});
