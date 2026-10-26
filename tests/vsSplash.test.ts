import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { vsLayout, vsTimeline, VS_IN, VS_OUT, VS_HOLD_MIN } from '../src/ui/VsSplash';

const splash = vi.hoisted(() => ({ calls: [] as string[], open: false, done: undefined as undefined | (() => void) }));
vi.mock('../src/ui/VsSplash', async original => ({
  ...(await original<typeof import('../src/ui/VsSplash')>()),
  VsSplash: class {
    get open() { return splash.open; }
    play(o: { rights: unknown[]; seconds?: number }) { splash.calls.push(`play ${o.rights.length}`); splash.open = true; return new Promise<void>(resolve => { splash.done = () => { splash.open = false; resolve(); }; }); }
    fight() { splash.calls.push('fight'); return Promise.resolve(); }
    skip() { splash.calls.push('skip'); splash.done?.(); }
  },
}));
const { MatchIntro } = await import('../src/ui/MatchIntro');

describe('the VS splash layout', () => {
  it('splits a wide screen down a leaning seam, and a tall one across it', () => {
    const wide = vsLayout(1, 1600, 900), tall = vsLayout(1, 390, 844);
    expect(wide.tall).toBe(false); expect(wide.crowd).toBe(false);
    expect(wide.x).toBeCloseTo(800); expect(wide.y).toBeCloseTo(450);
    expect(wide.angle).toBeGreaterThan(95); expect(wide.angle).toBeLessThan(115);
    expect(wide.lean).toBeGreaterThan(10);
    expect(tall.tall).toBe(true); expect(Math.abs(tall.angle)).toBeLessThan(25); expect(tall.lean).toBe(0);
  });
  it('gives a crowd a grid: two or three rivals side by side, eleven in rows of four', () => {
    expect(vsLayout(2, 1600, 900)).toMatchObject({ crowd: true, cols: 2, rows: 1 });
    expect(vsLayout(3, 1600, 900)).toMatchObject({ cols: 3, rows: 1 });
    expect(vsLayout(5, 1600, 900)).toMatchObject({ cols: 3, rows: 2 });
    expect(vsLayout(11, 1600, 900)).toMatchObject({ cols: 4, rows: 3 });
    expect(vsLayout(9, 390, 844)).toMatchObject({ tall: true, cols: 3, rows: 3 });
  });
  it('spends its seconds on the panels landing, a hold and the cut, never holding under the least', () => {
    expect(vsTimeline(2.7).whole).toBeCloseTo(2.7);
    expect(vsTimeline(2.7).hold).toBeCloseTo(2.7 - VS_IN - VS_OUT);
    expect(vsTimeline(.4).hold).toBe(VS_HOLD_MIN);
  });
});

class Fake {
  classes = new Set<string>(); text = ''; parts: Record<string, Fake> = {};
  set className(v: string) { this.classes = new Set(v.split(' ').filter(Boolean)); }
  classList = { add: (c: string) => this.classes.add(c), remove: (c: string) => this.classes.delete(c), contains: (c: string) => this.classes.has(c) };
  set innerHTML(_: string) { this.parts = { '.intro-summary': new Fake(), button: new Fake() }; }
  set textContent(v: string) { this.text = v; }
  setAttribute() {} addEventListener() {} append() {}
  contains(e: unknown) { return e === this || Object.values(this.parts).includes(e as Fake); }
  querySelector(s: string) { return this.parts[s] ?? null; }
  focus() { (globalThis as unknown as { document: { activeElement: unknown } }).document.activeElement = this; }
  blur() {}
}
const snap = (status: 'waiting' | 'active', serverTime: number, startsAt: number | null, rivals = 1, roomMode = 'match') => ({
  roomMode, status, serverTime, stage: 'harbor', lobby: { startsAt },
  players: [{ id: 'me', fighter: 'naruto', name: 'Fighter', isBot: false }, ...['sasuke', 'goku', 'luffy'].slice(0, rivals).map((fighter, i) => ({ id: `b${i}`, fighter, name: `Bot ${i}`, isBot: true }))],
}) as unknown as Parameters<InstanceType<typeof MatchIntro>['update']>[0];

describe('the match intro', () => {
  const g = globalThis as unknown as { document?: unknown };
  let saved: unknown;
  beforeEach(() => { saved = g.document; g.document = { createElement: () => new Fake(), activeElement: null, exitPointerLock() {} }; splash.calls.length = 0; splash.open = false; splash.done = undefined; });
  afterEach(() => { g.document = saved; });

  it('plays the match-up over a match countdown, then FIGHT! once when the match starts', async () => {
    const intro = new MatchIntro(new Fake() as unknown as HTMLElement);
    intro.update(snap('waiting', 10, 14, 3), 'me', true);
    expect(intro.open).toBe(true);
    expect(splash.calls).toEqual(['play 3']);
    splash.done!(); await Promise.resolve();
    expect(intro.open).toBe(false);
    intro.update(snap('waiting', 12, 14, 3), 'me', true);
    expect(splash.calls).toEqual(['play 3']);
    intro.update(snap('active', 14.02, null, 3), 'me', true);
    intro.update(snap('active', 14.05, null, 3), 'me', true);
    expect(splash.calls.filter(c => c === 'fight')).toHaveLength(1);
  });

  it('shows nothing outside a match countdown, or while it is held off', () => {
    const intro = new MatchIntro(new Fake() as unknown as HTMLElement);
    intro.update(snap('waiting', 10, 14, 1, 'training'), 'me', true);
    intro.update(snap('waiting', 10, null), 'me', true);
    expect(intro.open).toBe(false);
    intro.update(snap('waiting', 10, 14), 'me', false);
    intro.update(snap('active', 14.1, null), 'me', false);
    expect(splash.calls).toEqual([]);
  });

  it('skips on request and still calls the fight; leaving forgets it', () => {
    const intro = new MatchIntro(new Fake() as unknown as HTMLElement);
    intro.update(snap('waiting', 10, 14), 'me', true);
    expect(intro.skip()).toBe(true);
    expect(intro.open).toBe(false);
    expect(splash.calls).toEqual(['play 1', 'skip']);
    intro.update(snap('active', 14.1, null), 'me', true);
    expect(splash.calls.at(-1)).toBe('fight');
    const left = new MatchIntro(new Fake() as unknown as HTMLElement);
    splash.calls.length = 0;
    left.update(snap('waiting', 20, 24), 'me', true);
    left.reset();
    left.update(snap('active', 24.1, null), 'me', true);
    expect(splash.calls).not.toContain('fight');
  });

  it('gives a countdown first seen too late no page, only its FIGHT card', () => {
    const intro = new MatchIntro(new Fake() as unknown as HTMLElement);
    intro.update(snap('waiting', 13.4, 14), 'me', true);
    expect(intro.open).toBe(false);
    intro.update(snap('active', 14.05, null), 'me', true);
    expect(splash.calls).toEqual(['fight']);
  });
});
