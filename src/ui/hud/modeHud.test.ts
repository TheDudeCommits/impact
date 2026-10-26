import { describe, expect, it, vi } from 'vitest';
import { EventCursor, HUD_ZONES, hudPhaseOf, type HudZone, type ModeHud, type ModeHudFrame } from './modeHud';
import { ModeHudHost, type ZoneLayer } from './host';
import { MODE_HUDS } from './registry';
import { MODE_ORDER } from '../modes/catalogue';
import type { CombatEvent, GameSnapshot, PlayerState } from '../../game/types';

const snap = (extra: Record<string, unknown> = {}) => ({ players: [], events: [], serverTime: 10, roomMode: 'match', status: 'active', winnerId: null, ...extra }) as unknown as GameSnapshot;
const ev = (id: number) => ({ id, kind: 'hit', serverTime: 0, actorId: 'a' }) as CombatEvent;
const self = { id: 'me', alive: true } as PlayerState;

function rig() {
  const log: string[] = [];
  const zones = new Map<HudZone, { children: string[] }>(HUD_ZONES.map(z => [z, { children: [] }]));
  const layer: ZoneLayer = { combat: {} as HTMLElement, zone: id => zones.get(id) as unknown as HTMLElement, clear: () => { log.push('clear'); for (const z of zones.values()) z.children.length = 0; } };
  const frames: ModeHudFrame[] = [];
  const module = (name: string): ModeHud => ({
    mount: m => { log.push(`mount ${name}`); (m.zone('2') as unknown as { children: string[] }).children.push(name); },
    update: f => { frames.push(f); },
    event: e => log.push(`event ${name} ${e.id}`),
    unmount: () => log.push(`unmount ${name}`),
  });
  const registry = Object.fromEntries(MODE_ORDER.map(id => [id, () => module(id)])) as typeof MODE_HUDS;
  const root = { dataset: {} as Record<string, string> } as unknown as HTMLElement;
  let survival = false, cinema = false;
  const host = new ModeHudHost(root, () => survival, registry, () => layer, () => cinema);
  return { host, root, log, frames, zones, setSurvival: (v: boolean) => { survival = v; }, setCinema: (v: boolean) => { cinema = v; } };
}

describe('the mode HUD contract', () => {
  it('registers a module for every mode, each one quiet until its package lands', () => {
    for (const id of MODE_ORDER) {
      const module = MODE_HUDS[id]();
      expect(typeof module.mount).toBe('function'); expect(typeof module.update).toBe('function'); expect(typeof module.unmount).toBe('function');
    }
  });
  it('reads the phase from the match, the operation or the run', () => {
    expect(hudPhaseOf(snap({ status: 'waiting' }))).toBe('waiting');
    expect(hudPhaseOf(snap())).toBe('active');
    expect(hudPhaseOf(snap({ status: 'finished' }))).toBe('over');
    expect(hudPhaseOf(snap(), { phase: 'countdown' } as never)).toBe('waiting');
    expect(hudPhaseOf(snap(), { phase: 'over' } as never)).toBe('over');
    expect(hudPhaseOf(snap(), undefined, { phase: 'lobby' } as never)).toBe('waiting');
    expect(hudPhaseOf(snap(), undefined, { phase: 'draft' } as never)).toBe('active');
    expect(hudPhaseOf(snap(), undefined, { phase: 'over' } as never)).toBe('over');
  });
  it('hands each event over once, and starts again with a new room', () => {
    const cursor = new EventCursor();
    expect(cursor.take(snap({ events: [ev(1), ev(2)] })).map(e => e.id)).toEqual([1, 2]);
    expect(cursor.take(snap({ events: [ev(2), ev(3)], serverTime: 10.1 })).map(e => e.id)).toEqual([3]);
    expect(cursor.take(snap({ events: [ev(1)], serverTime: 0.5 })).map(e => e.id)).toEqual([1]);
  });
  it('mounts the layout the match needs, and switches cleanly', () => {
    const { host, root, log, zones } = rig();
    host.update(snap({ roomMode: 'training' }), self, undefined);
    expect(root.dataset.hud).toBe('training'); expect(root.dataset.hudPhase).toBe('active');
    expect(zones.get('2')!.children).toEqual(['training']);
    host.update(snap({ roomMode: 'training' }), self, undefined);
    expect(log.filter(l => l.startsWith('mount'))).toEqual(['mount training']);
    host.update(snap({ lobby: { duel: true }, status: 'waiting' }), self, undefined);
    expect(log.slice(-3)).toEqual(['unmount training', 'clear', 'mount duel']);
    expect(root.dataset.hud).toBe('duel'); expect(root.dataset.hudPhase).toBe('waiting');
    host.clear();
    expect(root.dataset.hud).toBeUndefined(); expect(root.dataset.hudPhase).toBeUndefined(); expect(log.at(-2)).toBe('unmount duel');
  });
  it('gives the module the frame: phase, device, objective and the run', () => {
    const { host, root, frames, setSurvival } = rig();
    root.dataset.input = 'controller'; root.dataset.pad = 'playstation';
    const run = { phase: 'fight' };
    host.runView = () => run as never;
    setSurvival(true);
    host.update(snap(), self, undefined);
    expect(root.dataset.hud).toBe('arcade');
    expect(frames.at(-1)).toMatchObject({ phase: 'active', input: 'controller', family: 'playstation', run, self });
    setSurvival(false);
    host.update(snap({ objective: { kind: 'bad-blood', phase: 'active' } }), self, undefined);
    expect(frames.at(-1)!.objective).toMatchObject({ kind: 'bad-blood' }); expect(frames.at(-1)!.run).toBeUndefined();
  });
  it('sends the mounted module each new event once', () => {
    const { host, log } = rig();
    host.update(snap(), self, undefined);
    host.snapshot(snap({ events: [ev(5), ev(6)] }));
    host.snapshot(snap({ events: [ev(6), ev(7)], serverTime: 10.03 }));
    expect(log.filter(l => l.startsWith('event'))).toEqual(['event royale 5', 'event royale 6', 'event royale 7']);
  });
  it('marks cinema while a cut-in plays, so prompts and banners wait', () => {
    const { host, root, setCinema } = rig();
    setCinema(true); host.update(snap(), self, undefined); expect('cinema' in root.dataset).toBe(true);
    setCinema(false); host.update(snap(), self, undefined); expect('cinema' in root.dataset).toBe(false);
  });
  it("keeps the fight's HUD up when a module throws", () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const root = { dataset: {} as Record<string, string> } as unknown as HTMLElement;
    const broken = (): ModeHud => ({ mount() { throw new Error('mount'); }, update() { throw new Error('update'); }, event() { throw new Error('event'); }, unmount() {} });
    const registry = Object.fromEntries(MODE_ORDER.map(id => [id, broken])) as typeof MODE_HUDS;
    const host = new ModeHudHost(root, () => false, registry, () => ({ combat: {} as HTMLElement, zone: () => ({}) as HTMLElement, clear() {} }), () => false);
    expect(() => { host.update(snap(), self, undefined); host.snapshot(snap({ events: [ev(1)] })); host.clear(); }).not.toThrow();
    expect(errors).toHaveBeenCalled(); errors.mockRestore();
  });
});
