import { afterEach, describe, expect, it, vi } from 'vitest';
import * as T from 'three';
import type { CombatEvent, PlayerState } from '../src/game/types';
import type { Fighter } from '../src/render/Fighter';
import { ArenaSimulation } from '../src/game/simulation';
import { RENGOKU_TIGER_ASSET, RENGOKU_TIGER_LIMITS, RengokuFlameTiger, rengokuFlameTigerReady } from '../src/render/signature/RengokuFlameTiger';

const live: RengokuFlameTiger[] = [];
afterEach(() => { for (const fx of live) fx.dispose(); live.length = 0; vi.restoreAllMocks(); vi.useRealTimers(); expect(rengokuFlameTigerReady()).toBe(false); });
function harness(budget = 1) {
  const scene = new T.Scene(), fx = new RengokuFlameTiger(scene, { budget }); live.push(fx);
  const fighter = { state: { id: 'r', fighter: 'rengoku', alive: true, yaw: .4, action: 'idle', actionSeq: 9 } as PlayerState } as Fighter;
  const fighters = new Map([['r', fighter]]);
  const tiger = scene.getObjectByName('rengoku-flame-tiger') as T.InstancedMesh;
  const crescents = scene.getObjectByName('rengoku-tiger-crescents') as T.InstancedMesh;
  return { scene, fx, fighter, fighters, tiger, crescents };
}
function readyTexture() {
  const texture = new T.Texture<HTMLImageElement>();
  const load = vi.spyOn(T.TextureLoader.prototype, 'load').mockImplementation((_url, ready) => { ready?.(texture); return texture; });
  return { texture, load };
}
const impact = (patch: Partial<CombatEvent> = {}): CombatEvent => ({ id: 21, kind: 'impact', actorId: 'r', fighter: 'rengoku', slot: 'area',
  serverTime: 10, endpoint: { x: 3, y: .25, z: -2 }, radius: 3.5, contactIndex: 0, ...patch });

describe('Rengoku manual Flame Tiger area impact', () => {
  it('loads only for Rengoku and shares one bounded request', async () => {
    const { load } = readyTexture(), h = harness();
    await h.fx.load(['goku']); expect(load).not.toHaveBeenCalled(); expect(rengokuFlameTigerReady()).toBe(false);
    const first = h.fx.load(['rengoku']); expect(h.fx.load(['rengoku'])).toBe(first); await first;
    expect(load).toHaveBeenCalledTimes(1); expect(load.mock.calls[0][0]).toBe(RENGOKU_TIGER_ASSET); expect(rengokuFlameTigerReady()).toBe(true);
  });
  it('never draws during aim, cast, release, animation or one hit event per target', async () => {
    readyTexture(); const h = harness(); await h.fx.load(['rengoku']);
    for (const kind of ['cast','release','hit','confirm','blocked'] as const) h.fx.handle(impact({ kind }), h.fighters);
    h.fx.handle(impact({ slot: 'special' }), h.fighters); h.fx.handle(impact({ fighter: 'ace' }), h.fighters);
    const before = JSON.stringify(h.fighter.state); h.fx.update(10.1, h.fighters);
    expect(h.tiger.count).toBe(0); expect(h.crescents.count).toBe(0); expect(JSON.stringify(h.fighter.state)).toBe(before);
  });
  it('draws one finite tiger at the real area endpoint despite ended cast/actionSeq', async () => {
    readyTexture(); const h = harness(); await h.fx.load(['rengoku']);
    const e = impact({ actionSeq: 2 }), before = JSON.stringify(e); h.fx.handle(e, h.fighters);
    h.fx.update(9.99, h.fighters); expect(h.tiger.count).toBe(0);
    h.fx.update(10.15, h.fighters); expect(h.tiger.count).toBe(1); expect(h.crescents.count).toBe(2);
    const matrix = new T.Matrix4(); h.tiger.getMatrixAt(0, matrix);
    const p = new T.Vector3().setFromMatrixPosition(matrix), scale = new T.Vector3().setFromMatrixScale(matrix);
    expect(p.x).toBe(3); expect(p.z).toBe(-2); expect(p.y).toBeCloseTo(.25 + .06 + scale.y / 2, 6);
    expect(scale.x).toBeLessThanOrEqual(3.5); expect(scale.y).toBeCloseTo(scale.x / 1.5, 6); expect(JSON.stringify(e)).toBe(before);
    h.fighter.state.actionSeq = 20; h.fx.update(10.3, h.fighters); expect(h.tiger.count).toBe(1);
    h.fx.update(10.651, h.fighters); expect(h.tiger.count).toBe(0); expect(h.crescents.count).toBe(0);
  });
  it('deduplicates exact id/time while permitting a later valid event with reused id', async () => {
    readyTexture(); const h = harness(); await h.fx.load(['rengoku']);
    h.fx.handle(impact(), h.fighters); h.fx.handle(impact(), h.fighters); h.fx.update(10.1, h.fighters); expect(h.tiger.count).toBe(1);
    h.fx.handle(impact({ serverTime: 10.01 }), h.fighters); h.fx.update(10.1, h.fighters); expect(h.tiger.count).toBe(2);
  });
  it.each(['eliminated','respawn','rejected','whiff','winner'] as const)('cancels on %s without replaying an old event', async kind => {
    readyTexture(); const h = harness(); await h.fx.load(['rengoku']); h.fx.handle(impact(), h.fighters);
    h.fx.handle(impact({ id: 22, kind }), h.fighters); h.fx.update(10.1, h.fighters); expect(h.tiger.count).toBe(0);
    if (kind !== 'winner') { h.fx.handle(impact(), h.fighters); h.fx.update(10.2, h.fighters); expect(h.tiger.count).toBe(0); }
  });
  it('clears removed/dead owners and keeps global readiness valid for other live instances', async () => {
    readyTexture(); const a = harness(), b = harness(); await a.fx.load(['rengoku']); await b.fx.load(['rengoku']);
    a.fx.handle(impact(), a.fighters); a.fighters.clear(); a.fx.update(10.1, a.fighters); expect(a.tiger.count).toBe(0);
    a.fx.dispose(); expect(rengokuFlameTigerReady()).toBe(true);
    b.fx.handle(impact(), b.fighters); b.fighter.state.alive = false; b.fx.update(10.1, b.fighters); expect(b.tiger.count).toBe(0);
    b.fx.dispose(); expect(rengokuFlameTigerReady()).toBe(false);
  });
  it('caps six simultaneous crests and twelve crescents, with one crescent per low-budget impact', async () => {
    readyTexture(); const h = harness(.3); await h.fx.load(['rengoku']);
    for (let i = 0; i < 100; i++) h.fx.handle(impact({ id: i + 100, radius: 400 }), h.fighters);
    h.fx.update(10.15, h.fighters); expect(h.scene.children).toHaveLength(2); expect(h.tiger.count).toBe(6); expect(h.crescents.count).toBe(6);
    const matrix = new T.Matrix4(); h.tiger.getMatrixAt(0, matrix); expect(new T.Vector3().setFromMatrixScale(matrix).x).toBeLessThanOrEqual(3.5);
  });
  it('preserves warmup and bounded uploads across idle→active→idle→active', async () => {
    readyTexture(); const h = harness(); await h.fx.load(['rengoku']);
    for (let i = 0; i < 60; i++) h.fx.update(i / 60, h.fighters);
    expect(h.tiger.instanceMatrix.version).toBe(0); expect(h.tiger.visible).toBe(true);
    h.tiger.onAfterRender(null!, null!, null!, null!, null!, null!);
    h.fx.update(2, h.fighters); expect(h.tiger.visible).toBe(false);
    h.fx.handle(impact(), h.fighters); h.fx.update(10.1, h.fighters);
    expect(h.tiger.visible).toBe(true); expect(h.tiger.instanceMatrix.updateRanges).toEqual([{ start: 0, count: 16 }]);
    const tint = h.tiger.geometry.getAttribute('tigerTint') as T.InstancedBufferAttribute;
    expect(tint.updateRanges).toEqual([{ start: 0, count: 4 }]);
    const version = h.tiger.instanceMatrix.version; h.fx.reset(); h.fx.update(11, h.fighters);
    expect(h.tiger.count).toBe(0); expect(h.tiger.instanceMatrix.version).toBe(version);
    h.fx.handle(impact({ serverTime: 12 }), h.fighters); h.fx.update(12.1, h.fighters); expect(h.tiger.count).toBe(1);
  });
  it('falls back on failed/slow loads, disposes late textures, and does not hang fighter loading', async () => {
    vi.useFakeTimers(); let complete: ((texture: T.Texture<HTMLImageElement>) => void) | undefined;
    vi.spyOn(T.TextureLoader.prototype, 'load').mockImplementation((_url, ready) => { complete = ready; return new T.Texture<HTMLImageElement>(); });
    const h = harness(), pending = h.fx.load(['rengoku']);
    await vi.advanceTimersByTimeAsync(RENGOKU_TIGER_LIMITS.loadTimeoutMs); await pending;
    expect(rengokuFlameTigerReady()).toBe(false); const late = new T.Texture<HTMLImageElement>(), dispose = vi.spyOn(late, 'dispose'); complete!(late);
    expect(dispose).toHaveBeenCalledOnce(); h.fx.handle(impact(), h.fighters); h.fx.update(10.1, h.fighters); expect(h.tiger.count).toBe(0);
  });
  it('resolves an immediate load error and disposes pending/completed loads safely', async () => {
    const fail = vi.spyOn(T.TextureLoader.prototype, 'load').mockImplementation((_url, _ready, _progress, error) => { error?.(new Error('missing')); return new T.Texture<HTMLImageElement>(); });
    const h = harness(); await h.fx.load(['rengoku']); expect(rengokuFlameTigerReady()).toBe(false); fail.mockRestore();
    let complete: ((texture: T.Texture<HTMLImageElement>) => void) | undefined;
    vi.spyOn(T.TextureLoader.prototype, 'load').mockImplementation((_url, ready) => { complete = ready; return new T.Texture<HTMLImageElement>(); });
    const pending = harness(), promise = pending.fx.load(['rengoku']); pending.fx.dispose(); await promise;
    const late = new T.Texture<HTMLImageElement>(), dispose = vi.spyOn(late, 'dispose'); complete!(late); expect(dispose).toHaveBeenCalledOnce();
    pending.fx.dispose(); expect(pending.scene.children).toHaveLength(0);
  });
  it('waits for the real manual G simulation impact: .72 release +1.85 telegraph, one204 damage', async () => {
    readyTexture(); const h = harness(); await h.fx.load(['rengoku']);
    const sim = new ArenaSimulation({ trainingBot: false, seed: 5 });
    sim.addPlayer('r', 'rengoku', 'R', false, { x: 0, y: 0, z: 0 }); sim.addPlayer('v', 'jiren', 'V', false, { x: 0, y: 0, z: 8 });
    const events: CombatEvent[] = []; let seenImpact = false, peakCount = 0;
    for (let i = 0; i < 240; i++) {
      sim.submitInput('r', { seq: i + 1, moveX: 0, moveZ: 0, yaw: 0, ...(i === 0 ? { attack: 'area' as const, aim: { x: 0, z: 8 } } : {}) });
      sim.submitInput('v', { seq: i + 1, moveX: 0, moveZ: 0, yaw: Math.PI }); sim.step(1 / 60);
      const snapshot = sim.snapshot(true); h.fighter.state = snapshot.players.find(p => p.id === 'r')!;
      for (const e of snapshot.events) { events.push(e); h.fx.handle(e, h.fighters); if (e.kind === 'impact') seenImpact = true; }
      h.fx.update(snapshot.serverTime + .02, h.fighters); peakCount = Math.max(peakCount, h.tiger.count); if (!seenImpact) expect(h.tiger.count).toBe(0);
    }
    const releases = events.filter(e => e.kind === 'release' && e.slot === 'area');
    const impacts = events.filter(e => e.kind === 'impact' && e.slot === 'area');
    expect(releases).toHaveLength(1); expect(impacts).toHaveLength(1);
    const cast = events.find(e => e.kind === 'cast' && e.slot === 'area')!;
    expect(releases[0].serverTime - cast.serverTime).toBeGreaterThanOrEqual(.72);
    expect(releases[0].serverTime - cast.serverTime).toBeLessThanOrEqual(.72 + 1 / 60);
    expect(releases[0].due! - releases[0].serverTime).toBeCloseTo(1.85, 4);
    expect(impacts[0].serverTime).toBeGreaterThanOrEqual(releases[0].due!);
    expect(impacts[0].serverTime).toBeLessThanOrEqual(releases[0].due! + 1 / 60);
    expect(peakCount).toBe(1);
    expect(events.filter(e => e.kind === 'hit' && e.slot === 'area').map(e => e.damage)).toEqual([204]);
    expect(h.tiger.count).toBe(0);
  });
});
