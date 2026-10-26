import { afterEach, describe, expect, it, vi } from 'vitest';
import * as T from 'three';
import type { CombatEvent, PlayerState } from '../src/game/types';
import type { Fighter } from '../src/render/Fighter';
import type { Flight } from '../src/render/CombatEffects';
import { setFxDrawn } from '../src/render/vfx/armory/drawn';
import { UsoppPopGreen, USOPP_POP_GREEN_LIMITS, USOPP_POP_GREEN_TEXTURES, usoppMuzzle } from '../src/render/signature/UsoppPopGreen';
import { MoveStage } from '../src/render/signature/MoveStage';

const effects: UsoppPopGreen[] = [];
afterEach(() => { for (const fx of effects.splice(0)) fx.dispose(); setFxDrawn([]); vi.restoreAllMocks(); vi.useRealTimers(); });
function harness(budget = 1) {
  const scene = new T.Scene(), fx = new UsoppPopGreen(scene, { budget }); effects.push(fx);
  const group = new T.Group(), head = new T.Object3D(); head.position.set(0, 1.65, .05); group.add(head); group.updateMatrixWorld(true);
  const fighter = { group, state: { id: 'u', fighter: 'usopp', alive: true, action: 'idle', actionTime: 0, yaw: 0, actionSeq: 3 } as PlayerState,
    drawnJoint: (name: string) => name === 'Head' ? head : undefined,
    strikePoint: (out: T.Vector3) => out.set(.21, 1.35, .62),
  } as unknown as Fighter;
  const fighters = new Map([['u', fighter]]), flights = new Map<string, Flight>();
  const mesh = (name: string) => scene.getObjectByName(`usopp-${name}`) as T.InstancedMesh;
  const update = (time = 10.1) => fx.update(time, fighters, flights);
  const pools = () => scene.children.filter(o => o.name.startsWith('usopp-')) as T.InstancedMesh[];
  const staged = () => { const stage = MoveStage.for(scene, { budget }), c = stage.counts; stage.release(); return c.flames + c.glows + c.bolts + c.discs + c.shells + c.shots; };
  return { scene, fx, fighter, fighters, flights, mesh, update, pools, staged };
}
const hit = (patch: Partial<CombatEvent> = {}): CombatEvent => ({ id: 1, kind: 'hit', actorId: 'u', targetId: 'v', fighter: 'usopp', slot: 'light',
  serverTime: 10, endpoint: { x: 0, y: 1.3, z: 7 }, ...patch });
const flight = (patch: Partial<Flight> = {}): Flight => ({ fighter: 'usopp', slot: 'light', actorId: 'u', position: new T.Vector3(0, 1.3, 4),
  origin: new T.Vector3(0, 1.3, .62), heading: new T.Vector3(0, 0, 1), released: true, since: 9.8, ...patch });
function position(mesh: T.InstancedMesh, index = 0) { const matrix = new T.Matrix4(); mesh.getMatrixAt(index, matrix); return new T.Vector3().setFromMatrixPosition(matrix); }

describe('Usopp manual Pop Green presentation', () => {
  it('keeps six room-owned pools idle with no repeated GPU uploads or awakened passive attacks', () => {
    const h = harness(); h.fighter.state.awakened = true; const before = JSON.stringify(h.fighter.state);
    for (let i = 0; i < 60; i++) h.update(i / 60);
    expect(h.pools()).toHaveLength(6); expect(h.staged()).toBe(0);
    for (const mesh of h.pools()) {
      expect(mesh.count).toBe(0); expect(mesh.instanceMatrix.version).toBe(0);
      expect((mesh.geometry.getAttribute('effectTint') as T.InstancedBufferAttribute).version).toBe(0);
    }
    expect(JSON.stringify(h.fighter.state)).toBe(before);
  });
  it.each(['light', 'heavy', 'special'] as const)('shows the authoritative released %s flight even after the actor returns idle', slot => {
    const h = harness(), f = flight({ slot, released: false }); h.flights.set('a', f);
    h.update(); expect(h.mesh('seeds').count).toBe(0);
    f.released = true; h.update(); expect(h.mesh('seeds').count).toBeGreaterThan(0);
    expect(position(h.mesh('seeds')).distanceTo(f.position)).toBeLessThan(1e-6);
    expect(h.mesh('leaves').count).toBeGreaterThan(0);
    h.flights.clear(); h.update(); expect(h.mesh('seeds').count).toBe(0); expect(h.mesh('leaves').count).toBe(0);
  });
  it.each(['lh', 'llh', 'lllh', 'llls', 'airHeavy'] as const)('preserves the manual %s projectile', branch => {
    const h = harness(); h.flights.set('branch', flight({ slot: 'heavy', branch })); h.update();
    expect(h.mesh('seeds').count).toBeGreaterThan(0); expect(h.mesh('leaves').count).toBe(2);
  });
  it('never draws a seed wake behind its release origin', () => {
    const h = harness(), f = flight({ position: new T.Vector3(0, 1.3, .63) }); h.flights.set('near', f); h.update();
    expect(h.mesh('seeds').count).toBe(1); expect(position(h.mesh('seeds')).z).toBeGreaterThanOrEqual(f.origin!.z);
  });
  it('uses the actual delegated seed pouch for a brief ultimate tracer and never renders the simulation beam', () => {
    const h = harness(); h.flights.set('beam', flight({ slot: 'ultimate' })); h.update(); expect(h.mesh('seeds').count).toBe(0);
    const origin = new T.Vector3(); expect(usoppMuzzle(h.fighter, origin)).toBe(true); expect(origin.toArray()).toEqual([.21, 1.35, .62]);
    h.fx.handle(hit({ kind: 'cast', slot: 'ultimate' }), h.fighters); h.update(); expect(h.mesh('seeds').count).toBe(0);
    h.fx.handle(hit({ kind: 'release', slot: 'ultimate', origin: { x: 100, y: 100, z: 100 } }), h.fighters); h.update(10.05);
    const expected = origin.clone().lerp(new T.Vector3(0, 1.3, 7), .05 / .13);
    expect(position(h.mesh('seeds')).distanceTo(expected)).toBeLessThan(1e-6); expect(h.mesh('seeds').count).toBe(3);
    h.update(10.21); expect(h.mesh('seeds').count).toBe(0);
  });
  it('requires actual contacts for blooms, deduplicates delivery, and reserves the larger bloom for the final hit', () => {
    const h = harness();
    h.fx.handle(hit({ kind: 'confirm', slot: 'ultimate', contactIndex: 2 }), h.fighters); h.update(); expect(h.mesh('leaves').count).toBe(0);
    const e = hit({ slot: 'ultimate', contactIndex: 2 }); h.fx.handle(e, h.fighters); h.fx.handle(e, h.fighters); h.update();
    expect(h.mesh('leaves').count).toBe(18); expect(h.mesh('impact-rings').count).toBe(2);
    h.update(10.63); expect(h.mesh('leaves').count).toBe(0); expect(h.mesh('impact-rings').count).toBe(0);
    h.fx.handle(hit({ id: 2, kind: 'blocked', slot: 'ultimate', contactIndex: 2, serverTime: 11 }), h.fighters); h.update(11.1);
    expect(h.mesh('leaves').count).toBe(8); expect(h.mesh('impact-rings').count).toBe(1);
  });
  it.each(['eliminated', 'respawn', 'projectile-clash'] as const)('clears retained effects and stale flights on %s, permitting a later manual shot', kind => {
    const h = harness(); h.flights.set('old', flight());
    h.fx.handle(hit({ slot: 'ultimate', contactIndex: 2 }), h.fighters); h.update(); expect(h.mesh('seeds').count).toBeGreaterThan(0);
    h.fx.handle(hit({ id: 2, kind, serverTime: 10.12 }), h.fighters); h.update(10.14);
    expect(h.pools().every(o => o.count === 0)).toBe(true);
    h.fx.handle(hit({ slot: 'ultimate', contactIndex: 2 }), h.fighters); h.update(10.15); expect(h.mesh('leaves').count).toBe(0);
    h.flights.set('new', flight({ since: 10.2 })); h.update(10.3); expect(h.mesh('seeds').count).toBeGreaterThan(0);
  });
  it.each(['whiff', 'rejected'] as const)('cancels an unconfirmed ultimate on %s without erasing an older manual projectile', kind => {
    const h = harness(); h.fx.handle(hit({ kind: 'release', slot: 'ultimate' }), h.fighters); h.update(10.05);
    expect(h.mesh('seeds').count).toBe(3);
    h.fx.handle(hit({ id: 2, kind, slot: 'ultimate', serverTime: 10.06 }), h.fighters); h.update(10.07);
    expect(h.mesh('seeds').count).toBe(0); expect(h.mesh('leaves').count).toBe(0);
    h.flights.set('older', flight()); h.fx.handle(hit({ id: 3, kind, slot: 'area', serverTime: 10.08 }), h.fighters); h.update(10.1);
    expect(h.mesh('seeds').count).toBeGreaterThan(0);
  });
  it('leaves Forge overrides and G to their own renderer without suppressing authored branch shots', () => {
    const h = harness(); setFxDrawn(['light','heavy','special','ultimate'].map(slot => ({ player: 'u', key: `usopp:${slot}` })));
    for (const slot of ['light','heavy','special','ultimate','area'] as const) {
      h.flights.set(slot, flight({ slot })); h.fx.handle(hit({ id: h.flights.size, slot }), h.fighters);
    }
    h.update(); expect(h.pools().every(o => o.count === 0)).toBe(true); expect(h.staged()).toBe(0);
    h.flights.set('branch', flight({ slot: 'heavy', branch: 'airHeavy' })); h.update(); expect(h.mesh('seeds').count).toBeGreaterThan(0);
  });
  it('stages what each shot is: the wolf grown out of its seed, the firebird burning, the Skull Bomb Grass and its skull', () => {
    const load = vi.spyOn(T.TextureLoader.prototype, 'load').mockImplementation((_url, ready) => { const t = new T.Texture<HTMLImageElement>({ width: 100, height: 100 } as HTMLImageElement); ready?.(t); return t; });
    const h = harness(); void h.fx.load(['usopp']); expect(load).toHaveBeenCalledTimes(2);
    const size = (mesh: T.InstancedMesh) => { const m = new T.Matrix4(); mesh.getMatrixAt(0, m); return new T.Vector3().setFromMatrixScale(m).x; };
    h.flights.set('wolf', flight({ slot: 'heavy', position: new T.Vector3(0, 1.3, 4) })); h.update();
    expect(size(h.mesh('impact-wolf'))).toBeGreaterThan(2.2); expect(h.staged()).toBeGreaterThan(0);
    h.flights.clear(); h.flights.set('bird', flight({ slot: 'special', position: new T.Vector3(0, 1.3, 4) })); h.update();
    expect(size(h.mesh('firebird'))).toBeGreaterThan(3);
    h.flights.clear(); h.fx.handle(hit({ id: 5, slot: 'special', serverTime: 10.2 }), h.fighters); h.update(10.25);
    expect(h.staged()).toBeGreaterThan(10); expect(h.mesh('skull').count).toBe(0);
    h.fx.handle(hit({ id: 6, slot: 'ultimate', contactIndex: 2, serverTime: 10.3 }), h.fighters); h.update(10.5);
    expect(h.mesh('skull').count).toBe(1); expect(size(h.mesh('skull'))).toBeGreaterThan(2.4);
    h.update(11.6); expect(h.mesh('skull').count).toBe(0);
  });
  it('anchors Observation focus to the actual Head and clears it when entry ends', () => {
    const h = harness(); Object.assign(h.fighter.state, { action: 'awaken', actionTime: .5 }); h.update();
    expect(h.mesh('impact-rings').count).toBe(3); expect(position(h.mesh('impact-rings')).y).toBeCloseTo(1.65);
    h.fighter.state.action = 'idle'; h.update(); expect(h.mesh('impact-rings').count).toBe(0);
  });
  it('bounds simultaneous impacts and uploads across idle→active→idle→active', () => {
    const h = harness(.3); h.update();
    for (let i = 0; i < 100; i++) { h.flights.set(String(i), flight()); h.fx.handle(hit({ id: i + 1, slot: 'ultimate', contactIndex: 2 }), h.fighters); }
    h.update(); expect(h.mesh('seeds').count).toBeLessThanOrEqual(USOPP_POP_GREEN_LIMITS.seeds); expect(h.mesh('leaves').count).toBeLessThanOrEqual(USOPP_POP_GREEN_LIMITS.leaves);
    expect(h.mesh('impact-rings').count).toBeLessThanOrEqual(USOPP_POP_GREEN_LIMITS.rings);
    const version = h.mesh('seeds').instanceMatrix.version; h.flights.clear(); h.fx.reset(); h.update();
    expect(h.mesh('seeds').count).toBe(0); expect(h.mesh('seeds').instanceMatrix.version).toBe(version);
    h.flights.set('next', flight({ since: 11 })); h.update(11.1);
    expect(h.mesh('seeds').instanceMatrix.updateRanges).toEqual([{ start: 0, count: h.mesh('seeds').count * 16 }]);
    h.fx.dispose(); h.fx.dispose(); expect(h.scene.children).toHaveLength(0);
  });
  it('loads only the selected two cutouts once, preserving the seed at their authoritative flight positions', async () => {
    const load = vi.spyOn(T.TextureLoader.prototype, 'load').mockImplementation((_url, ready) => { const t = new T.Texture<HTMLImageElement>({ width: 200, height: 100 } as HTMLImageElement); ready?.(t); return t; });
    const h = harness(); await h.fx.load(['goku']); expect(load).not.toHaveBeenCalled();
    const pending = h.fx.load(['usopp']); expect(h.fx.load(['usopp'])).toBe(pending); await pending;
    expect(load.mock.calls.map(c => c[0])).toEqual([USOPP_POP_GREEN_TEXTURES.wolf, USOPP_POP_GREEN_TEXTURES.bird]);
    h.flights.set('wolf', flight({ slot: 'heavy' })); h.flights.set('bird', flight({ slot: 'special', position: new T.Vector3(2, 1.3, 6) })); h.update();
    expect(h.mesh('impact-wolf').count).toBe(1); expect(h.mesh('firebird').count).toBe(1);
    expect(position(h.mesh('firebird')).toArray()).toEqual([2, 1.2999999523162842, 6]);
    const matrix = new T.Matrix4(); h.mesh('firebird').getMatrixAt(0, matrix);
    const size = new T.Vector3().setFromMatrixScale(matrix); expect(size.x / size.y).toBeCloseTo(2);
  });
  it('resolves failed and bounded slow loads, disposes late completions, and retains procedural projectiles', async () => {
    vi.useFakeTimers(); const completions: (((t: T.Texture<HTMLImageElement>) => void) | undefined)[] = [];
    vi.spyOn(T.TextureLoader.prototype, 'load').mockImplementation((_url, ready) => { completions.push(ready); return new T.Texture<HTMLImageElement>(); });
    const h = harness(), pending = h.fx.load(['usopp']); await vi.advanceTimersByTimeAsync(USOPP_POP_GREEN_LIMITS.loadTimeoutMs); await pending;
    for (const ready of completions) { const t = new T.Texture<HTMLImageElement>(), dispose = vi.spyOn(t, 'dispose'); ready!(t); expect(dispose).toHaveBeenCalledOnce(); }
    h.flights.set('bird', flight({ slot: 'special' })); h.update(); expect(h.mesh('firebird').count).toBe(0); expect(h.mesh('leaves').count).toBe(7);
  });
  it('disposes texture requests in progress without keeping room loading pending', async () => {
    const completions: (((t: T.Texture<HTMLImageElement>) => void) | undefined)[] = [];
    vi.spyOn(T.TextureLoader.prototype, 'load').mockImplementation((_url, ready) => { completions.push(ready); return new T.Texture<HTMLImageElement>(); });
    const h = harness(), pending = h.fx.load(['usopp']); h.fx.dispose(); await pending;
    for (const ready of completions) { const t = new T.Texture<HTMLImageElement>(), dispose = vi.spyOn(t, 'dispose'); ready!(t); expect(dispose).toHaveBeenCalledOnce(); }
    expect(h.scene.children).toHaveLength(0);
  });
});
