import { afterEach, describe, expect, it, vi } from 'vitest';
import * as T from 'three';
import type { CombatEvent, CoreSlot, PlayerState } from '../src/game/types';
import type { Fighter } from '../src/render/Fighter';
import type { Flight } from '../src/render/CombatEffects';
import { TOJI_MOVES } from '../src/game/fighters/toji';
import { TojiHeavenlyRestriction, TOJI_RESTRICTION_LIMITS } from '../src/render/signature/TojiHeavenlyRestriction';
import { MoveStage, STAGE_LIMITS } from '../src/render/signature/MoveStage';
import { SIGNATURE } from '../src/render/signature/context';
import { setFxDrawn } from '../src/render/vfx/armory/drawn';
import { setActiveKit } from '../src/engine/client/forgeLive';
import { HOUSE_KITS } from '../src/engine/sim/houseKits';
import { ownKit } from '../src/engine/sim/forge';

const effects: TojiHeavenlyRestriction[] = [], stages: MoveStage[] = [];
afterEach(() => {
  for (const effect of effects.splice(0)) effect.dispose();
  for (const stage of stages.splice(0)) stage.release();
  setFxDrawn([]); delete SIGNATURE.screen; delete SIGNATURE.localId; vi.restoreAllMocks();
});
function harness(budget = 1) {
  const scene = new T.Scene(), effect = new TojiHeavenlyRestriction(scene, { budget }); effects.push(effect);
  const stage = MoveStage.for(scene, { budget }); stages.push(stage);
  const group = new T.Group(); group.position.set(2, .04, -3);
  const hand = new T.Vector3(2.2, 1.25, -2.6), tip = new T.Vector3(2.2, 1.1, -1.9);
  const strikePoint = vi.fn((out: T.Vector3) => out.copy(tip));
  const fighter = { group, handR: hand, strikePoint, state: {
    id: 't', fighter: 'toji', alive: true, action: 'idle', actionTime: 0, actionDuration: 0,
    actionSeq: 7, yaw: .35, hp: 1500, stamina: 100, ultimate: 100,
  } as unknown as PlayerState } as unknown as Fighter;
  const fighters = new Map([['t', fighter]]), flights = new Map<string, Flight>();
  const mesh = (name: 'steel-cuts' | 'contact-chips' | 'step-pressure') => scene.getObjectByName(`toji-${name}`) as T.InstancedMesh;
  let clock = 10.08;
  const update = (time = (clock += 1e-4)) => effect.update(time, fighters, flights);
  const attack = (slot: CoreSlot, elapsed: number) => Object.assign(fighter.state, {
    action: slot, actionDuration: TOJI_MOVES[slot].duration, actionTime: elapsed / TOJI_MOVES[slot].duration,
  });
  return { scene, stage, effect, fighter, fighters, flights, mesh, update, attack, strikePoint, tip, hand };
}
const hit = (patch: Partial<CombatEvent> = {}): CombatEvent => ({
  id: 1, kind: 'hit', actorId: 't', targetId: 'v', fighter: 'toji' as CombatEvent['fighter'], slot: 'light',
  serverTime: 10, endpoint: { x: 3, y: 1.3, z: 4 }, ...patch,
});
function position(mesh: T.InstancedMesh, index = 0) {
  const matrix = new T.Matrix4(); mesh.getMatrixAt(index, matrix); return new T.Vector3().setFromMatrixPosition(matrix);
}
const own = (scene: T.Scene) => scene.children.filter(o => o.name.startsWith('toji-')) as T.InstancedMesh[];
const STAGE_POOLS = ['flames', 'glows', 'bolts', 'lights', 'discs', 'shells'] as const;
function empty(scene: T.Scene) {
  expect(own(scene).every(o => o.count === 0)).toBe(true);
  const stage = MoveStage.for(scene, { budget: 1 }); try { for (const pool of STAGE_POOLS) expect(stage.counts[pool], pool).toBe(0); } finally { stage.release(); }
}

describe('Toji physical Heavenly Restriction presentation', () => {
  it('allocates only three fixed pools, loads no assets, and leaves awakened idle and carried inventory quiet', async () => {
    const load = vi.spyOn(T.TextureLoader.prototype, 'load'), h = harness();
    h.fighter.state.awakened = true; const before = JSON.stringify(h.fighter.state);
    await h.effect.load(['toji']); await h.effect.load(['toji']);
    for (let i = 0; i < 60; i++) h.update(i / 60);
    expect(load).not.toHaveBeenCalled(); expect(own(h.scene)).toHaveLength(3); empty(h.scene);
    for (const mesh of own(h.scene)) {
      expect(mesh.instanceMatrix.version).toBe(0);
      expect((mesh.geometry.getAttribute('effectTint') as T.InstancedBufferAttribute).version).toBe(0);
      const material = mesh.material as T.ShaderMaterial;
      expect(material.forceSinglePass).toBe(true); expect(material.depthWrite).toBe(false);
    }
    expect(h.strikePoint).not.toHaveBeenCalled(); expect(JSON.stringify(h.fighter.state)).toBe(before);
  });
  it.each(['light', 'heavy', 'special'] as const)('uses the native measured weapon endpoint during manual %s, then stops at the real move duration', slot => {
    const h = harness(), move = TOJI_MOVES[slot];
    h.attack(slot, move.contacts[0]); const before = JSON.stringify(h.fighter.state); h.update();
    expect(h.strikePoint).toHaveBeenCalledOnce(); expect(h.mesh('steel-cuts').count).toBe(slot === 'heavy' ? 4 : 2);
    expect(position(h.mesh('steel-cuts')).distanceTo(h.hand.clone().lerp(h.tip, .7))).toBeLessThan(1e-6);
    expect(JSON.stringify(h.fighter.state)).toBe(before);
    h.attack(slot, move.duration); h.update(); empty(h.scene);
    h.fighter.state.action = 'idle'; h.update(); empty(h.scene);
  });
  it('holds the retimed .47/1/1.20/3.27 durations and gates later ultimate trails on a real confirm', () => {
    expect(['light', 'heavy', 'special', 'ultimate'].map(slot => TOJI_MOVES[slot as CoreSlot].duration)).toEqual([.47, 1, 1.2, 3.27]);
    const h = harness(); h.attack('ultimate', .55); h.update(); expect(h.mesh('steel-cuts').count).toBe(2);
    h.attack('ultimate', .63); h.update(); empty(h.scene);
    h.fighter.state.confirmedAt = 10; h.attack('ultimate', 1.85); h.update(); expect(h.mesh('steel-cuts').count).toBe(2);
    h.fighter.state.whiffedAt = 10.01; h.update(); empty(h.scene);
  });
  it('never turns cast, release, confirm, blocked or arbitrary projectile state into a damaging hit flourish', () => {
    const h = harness();
    for (const [index, kind] of ['cast', 'release', 'confirm', 'blocked', 'guard-break', 'impact'].entries()) {
      h.effect.handle(hit({ id: index + 1, kind: kind as CombatEvent['kind'], slot: 'ultimate', contactIndex: 4 }), h.fighters);
    }
    h.flights.set('unused', { fighter: 'toji', slot: 'ultimate', actorId: 't', released: true, since: 10,
      position: new T.Vector3(3, 1, 4), heading: new T.Vector3(0, 0, 1) } as Flight);
    h.update(); empty(h.scene); expect(h.strikePoint).not.toHaveBeenCalled();
  });
  it('places a confirmed hit at the authoritative endpoint, deduplicates by id and time, and accepts a reused id at a later time', () => {
    const h = harness(), e = hit(); h.effect.handle(e, h.fighters); h.effect.handle(e, h.fighters); h.update();
    expect(h.mesh('steel-cuts').count).toBe(2); expect(h.mesh('contact-chips').count).toBe(7);
    expect(position(h.mesh('steel-cuts')).distanceTo(new T.Vector3(3, 1.3, 4))).toBeLessThan(1e-6);
    h.update(10.23); empty(h.scene);
    h.effect.handle(hit({ serverTime: 11, endpoint: { x: -1, y: .4, z: -2 } }), h.fighters); h.update(11.08);
    expect(position(h.mesh('steel-cuts')).distanceTo(new T.Vector3(-1, .4, -2))).toBeLessThan(1e-6);
  });
  it.each([{ index: 0, count: 2 + 4, cuts: .36, all: .56 }, { index: 3, count: 2 + 4, cuts: .36, all: .62 }, { index: 4, count: 6 + 10, cuts: .7, all: .75 }])(
    'expires ultimate contact $index at its bounded impact lifetime', ({ index, count, cuts, all }) => {
      const h = harness(); h.effect.handle(hit({ slot: 'ultimate', contactIndex: index }), h.fighters);
      h.update(9.99); empty(h.scene); h.update(10.05); expect(h.mesh('steel-cuts').count).toBe(count);
      expect(h.stage.counts.glows).toBeGreaterThan(0); expect(h.stage.counts.lights).toBeGreaterThan(0);
      h.update(10 + cuts + .001); expect(own(h.scene).every(o => o.count === 0)).toBe(true);
      h.update(10 + all); empty(h.scene);
    });
  it('opens the fang on a landed special and breaks the floor only through the kit it is given', () => {
    const h = harness(); h.effect.handle(hit({ slot: 'special' }), h.fighters);
    h.update(10.12); expect(h.mesh('steel-cuts').count).toBe(2 + 8);
    expect(h.stage.counts.bolts).toBe(4); expect(h.stage.counts.discs).toBe(1); expect(h.stage.counts.shots).toBe(2);
    h.update(10.5 + .001); expect(own(h.scene).every(o => o.count === 0)).toBe(true); h.update(10.7); empty(h.scene);
  });
  it('whips the chain round a confirmed Sorcerer Killer until its last blow, and drops it on a whiff, a death or a new action', () => {
    const h = harness(), victim = { group: new T.Group(), state: { id: 'v', fighter: 'goku', alive: true } } as unknown as Fighter;
    victim.group.position.set(2, .04, -.5); h.fighters.set('v', victim);
    const confirm = hit({ id: 9, kind: 'confirm', slot: 'ultimate', contactIndex: 0, actionSeq: 7 });
    h.effect.handle(confirm, h.fighters); h.effect.handle(confirm, h.fighters);
    Object.assign(h.fighter.state, { confirmedAt: 10 }); h.attack('ultimate', 1.3); h.update(10.75);
    const links = h.stage.counts.bolts; expect(links).toBeGreaterThan(20); expect(links).toBeLessThan(STAGE_LIMITS.bolts / 8);
    expect(h.stage.counts.glows).toBe(2); expect(h.stage.counts.lights).toBe(2);
    h.attack('ultimate', 2.6); h.update(12.05); expect(h.stage.counts.bolts).toBe(0);
    h.attack('ultimate', 1.3); h.update(10.75); expect(h.stage.counts.bolts).toBe(links);
    victim.state.alive = false; h.update(10.76); expect(h.stage.counts.bolts).toBe(0);
    victim.state.alive = true; h.update(10.77); expect(h.stage.counts.bolts).toBe(0);
    h.effect.handle({ ...confirm, id: 10, serverTime: 10.8 }, h.fighters); h.update(10.81); expect(h.stage.counts.bolts).toBe(links);
    h.effect.handle(hit({ id: 11, kind: 'whiff', fighter: undefined }), h.fighters); h.update(10.82); expect(h.stage.counts.bolts).toBe(0);
  });
  it('applies a single local screen accent only to confirmed final contact index 4, excluding remote fights and branches', () => {
    const h = harness(), impactFrame = vi.fn(); SIGNATURE.screen = { impactFrame }; SIGNATURE.localId = 'spectator';
    h.effect.handle(hit({ slot: 'ultimate', contactIndex: 4 }), h.fighters); expect(impactFrame).not.toHaveBeenCalled();
    SIGNATURE.localId = 'v';
    const e = hit({ id: 2, slot: 'ultimate', contactIndex: 4 }); h.effect.handle(e, h.fighters); h.effect.handle(e, h.fighters);
    expect(impactFrame).toHaveBeenCalledTimes(1); expect(impactFrame.mock.calls[0][0]).toBe(.34);
    h.effect.handle(hit({ id: 3, slot: 'ultimate', contactIndex: 4, branch: 'lllh' }), h.fighters);
    h.effect.handle(hit({ id: 4, slot: 'ultimate', contactIndex: 3 }), h.fighters);
    expect(impactFrame).toHaveBeenCalledTimes(1);
  });
  it.each(['whiff', 'rejected', 'eliminated', 'respawn'] as const)('clears retained actor hits on %s without affecting another owner', kind => {
    const h = harness();
    const other = { ...h.fighter, state: { ...h.fighter.state, id: 'other' } } as Fighter; h.fighters.set('other', other);
    h.effect.handle(hit(), h.fighters); h.effect.handle(hit({ id: 2, actorId: 'other', targetId: 'other-v' }), h.fighters);
    h.effect.handle(hit({ id: 3, kind, fighter: undefined, serverTime: 10.04 }), h.fighters); h.update();
    expect(h.mesh('steel-cuts').count).toBe(2); expect(h.mesh('contact-chips').count).toBe(7);
  });
  it.each(['eliminated', 'respawn'] as const)('clears retained hits when the receiver has a foreign-fighter %s event', kind => {
    const h = harness(); h.effect.handle(hit(), h.fighters);
    h.effect.handle(hit({ id: 2, actorId: 'v', fighter: 'goku', kind, serverTime: 10.02 }), h.fighters); h.update(); empty(h.scene);
  });
  it.each(['absent', 'dead'] as const)('drops old hit pools for an $0 actor even without a lifecycle packet', state => {
    const h = harness(); h.effect.handle(hit(), h.fighters);
    if (state === 'absent') h.fighters.delete('t'); else h.fighter.state.alive = false;
    h.update(); empty(h.scene);
  });
  it('keeps unrelated fighters, area G and Forge-owned plain slots out while retaining authored branch attacks', () => {
    const h = harness();
    h.effect.handle(hit({ fighter: 'goku' }), h.fighters); h.effect.handle(hit({ id: 2, slot: 'area' }), h.fighters);
    h.update(); empty(h.scene);
    setFxDrawn([{ player: 't', key: 'toji:special' }]); h.attack('special', .6);
    h.effect.handle(hit({ id: 3, slot: 'special' }), h.fighters); h.update(); empty(h.scene);
    h.fighter.state.branch = 'llls'; h.effect.handle(hit({ id: 4, slot: 'special', branch: 'llls' }), h.fighters); h.update();
    expect(h.mesh('steel-cuts').count).toBe(4 + 6); expect(h.mesh('contact-chips').count).toBeGreaterThan(0);
  });
  it('keeps awakening as a short ground pressure/dust interval with no aura, weapon strike or idle continuation', () => {
    const h = harness(); Object.assign(h.fighter.state, { action: 'awaken', actionTime: .39 }); h.update(); empty(h.scene);
    h.fighter.state.actionTime = .57; const before = JSON.stringify(h.fighter.state); h.update();
    expect(h.mesh('step-pressure').count).toBe(1); expect(h.mesh('contact-chips').count).toBe(8); expect(h.mesh('steel-cuts').count).toBe(0);
    expect(position(h.mesh('step-pressure')).y).toBeCloseTo(h.fighter.group.position.y + .025);
    expect(h.strikePoint).not.toHaveBeenCalled(); expect(JSON.stringify(h.fighter.state)).toBe(before);
    h.fighter.state.actionTime = .76; h.update(); empty(h.scene);
    Object.assign(h.fighter.state, { action: 'idle', awakened: true }); h.update(); empty(h.scene);
  });
  it.each([.3, 1])('bounds crowded manual hits and all pool counts at budget %s', budget => {
    const h = harness(budget);
    for (let i = 0; i < 100; i++) {
      h.effect.handle(hit({ id: i + 1, slot: 'ultimate', contactIndex: 4 }), h.fighters);
      h.fighters.set(`focus-${i}`, { ...h.fighter, state: { ...h.fighter.state, id: `focus-${i}`, action: 'awaken', actionTime: .57 } } as Fighter);
    }
    h.update(); expect(own(h.scene)).toHaveLength(3);
    for (const pool of STAGE_POOLS) expect(h.stage.counts[pool], pool).toBeLessThanOrEqual(STAGE_LIMITS[pool]);
    expect(h.mesh('steel-cuts').count).toBeLessThanOrEqual(TOJI_RESTRICTION_LIMITS.cuts);
    expect(h.mesh('contact-chips').count).toBeLessThanOrEqual(TOJI_RESTRICTION_LIMITS.chips);
    expect(h.mesh('step-pressure').count).toBeLessThanOrEqual(TOJI_RESTRICTION_LIMITS.pressure);
    expect(h.mesh('steel-cuts').count).toBeGreaterThan(0);
  });
  it('leaves the shipped, aimed G to its house look: no native sweep and no foot dust', () => {
    const h = harness();
    Object.assign(h.fighter.state, { action: 'area', actionTime: .54, actionDuration: .62 });
    h.effect.handle(hit({ slot: 'area', kind: 'cast' }), h.fighters); h.effect.handle(hit({ slot: 'area', kind: 'release', id: 2 }), h.fighters); h.update();
    h.effect.handle(hit({ slot: 'area', kind: 'impact', id: 3, endpoint: { x: 2, y: .04, z: 6 } }), h.fighters); h.update();
    empty(h.scene);
  });
  it('draws a bounded native area weapon sweep, and only actual area impact emits foot dust', () => {
    const house = HOUSE_KITS.toji!.slots!, look = house.area!; delete house.area; setActiveKit(ownKit('toji'), 'toji');
    try { sweepAndDust(); } finally { house.area = look; setActiveKit(undefined, 'toji'); }
  });
  function sweepAndDust() {
    const h = harness(), base = new T.Object3D(); base.name = 'TojiBladeBase'; base.position.set(.3, 1.05, .7);
    h.fighter.group.add(base); h.fighter.group.updateMatrixWorld(true);
    Object.assign(h.fighter.state, { action: 'area', actionTime: .54, actionDuration: 1.3 });
    h.effect.handle(hit({ slot: 'area', kind: 'cast' }), h.fighters);
    h.effect.handle(hit({ slot: 'area', kind: 'release', id: 2 }), h.fighters);
    h.update(); expect(h.mesh('steel-cuts').count).toBe(2); expect(h.mesh('contact-chips').count).toBe(0);
    const expected = base.getWorldPosition(new T.Vector3()).lerp(h.tip, .7);
    expect(position(h.mesh('steel-cuts')).distanceTo(expected)).toBeLessThan(1e-6);
    const impact = hit({ slot: 'area', kind: 'impact', id: 3, endpoint: { x: 99, y: 20, z: 99 } });
    h.effect.handle(impact, h.fighters); h.effect.handle(impact, h.fighters); h.update();
    expect(h.mesh('contact-chips').count).toBe(10);
    for (let i = 0; i < h.mesh('contact-chips').count; i++) {
      const point = position(h.mesh('contact-chips'), i);
      expect(point.distanceTo(h.fighter.group.position)).toBeLessThan(1);
      expect(point.y - h.fighter.group.position.y).toBeLessThan(.16);
    }
    h.fighter.state.actionTime = .95; h.update(10.29); empty(h.scene);
    h.fighter.state.action = 'idle'; const idleState = JSON.stringify(h.fighter.state);
    for (let i = 0; i < 30; i++) h.update(11 + i / 60);
    empty(h.scene); expect(JSON.stringify(h.fighter.state)).toBe(idleState);
    h.fighter.state.action = 'area';
    setFxDrawn([{ player: 't', key: 'toji:area' }]); h.fighter.state.actionTime = .54;
    h.effect.handle({ ...impact, id: 4, serverTime: 11 }, h.fighters); h.update(11.05); empty(h.scene);
  }
  it('uploads only active ranges across idle→active→idle→active, clears dedupe on reset, and disposes idempotently', () => {
    const h = harness(), cuts = h.mesh('steel-cuts'); h.update();
    expect(cuts.instanceMatrix.version).toBe(0);
    h.effect.handle(hit(), h.fighters); h.update();
    expect(cuts.instanceMatrix.updateRanges).toEqual([{ start: 0, count: 2 * 16 }]);
    expect((cuts.geometry.getAttribute('effectTint') as T.InstancedBufferAttribute).updateRanges).toEqual([{ start: 0, count: 2 * 4 }]);
    const version = cuts.instanceMatrix.version; h.effect.reset(); h.update(); empty(h.scene);
    expect(cuts.instanceMatrix.version).toBe(version);
    h.effect.handle(hit(), h.fighters); h.update(); expect(cuts.count).toBe(2);
    const disposes = own(h.scene).map(mesh => [vi.spyOn(mesh.geometry, 'dispose'), vi.spyOn(mesh.material as T.Material, 'dispose')]);
    stages.splice(0).forEach(stage => stage.release());
    h.effect.dispose(); h.effect.dispose(); h.effect.handle(hit({ id: 7 }), h.fighters); h.update();
    expect(h.scene.children).toHaveLength(0); for (const pair of disposes) for (const spy of pair) expect(spy).toHaveBeenCalledTimes(1);
  });
});
