import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

const g = globalThis as unknown as Record<string, unknown>;
afterEach(() => { vi.resetModules(); for (const k of ['addEventListener', 'innerWidth', 'innerHeight', 'document', 'getComputedStyle', 'visualViewport']) delete g[k]; });

describe('the viewport, read once per resize', () => {
  it('reads the window once, and again only after a resize', async () => {
    const win = new EventTarget(); let reads = 0, width = 1600;
    g.addEventListener = win.addEventListener.bind(win);
    Object.defineProperty(g, 'innerWidth', { configurable: true, get: () => { reads++; return width; } }); g.innerHeight = 900;
    const { viewWidth, viewHeight } = await import('../src/ui/viewport');
    for (let i = 0; i < 50; i++) { expect(viewWidth()).toBe(1600); expect(viewHeight()).toBe(900); }
    expect(reads).toBe(1);
    width = 844; win.dispatchEvent(new Event('resize'));
    expect(viewWidth()).toBe(844); expect(viewWidth()).toBe(844); expect(reads).toBe(2);
  });
  it('the page box is the root element\'s, as of the last resize (a phone turned)', async () => {
    const win = new EventTarget(); const root = { clientWidth: 839, clientHeight: 412 };
    g.addEventListener = win.addEventListener.bind(win); g.innerWidth = 915; g.innerHeight = 412; g.document = { documentElement: root };
    const { pageWidth, pageHeight } = await import('../src/ui/viewport');
    expect([pageWidth(), pageHeight()]).toEqual([839, 412]);
    root.clientWidth = 412; root.clientHeight = 839; expect(pageWidth(), 'not read again before the window says it changed').toBe(839);
    win.dispatchEvent(new Event('orientationchange')); expect([pageWidth(), pageHeight()]).toEqual([412, 839]);
  });
  it('without a window to listen to (tests), reads afresh every time', async () => {
    g.innerWidth = 1600; g.innerHeight = 900;
    const { viewWidth } = await import('../src/ui/viewport');
    expect(viewWidth()).toBe(1600); g.innerWidth = 1280; expect(viewWidth()).toBe(1280);
  });
});

describe('a one-shot animation restarted without a layout', () => {
  function element(on: string[] = []) {
    const classes = new Set(on), log: string[] = [];
    const el = { classList: { contains: (c: string) => classes.has(c), add: (c: string) => { classes.add(c); log.push(`+${c}`); }, remove: (c: string) => { classes.delete(c); log.push(`-${c}`); } },
      get offsetWidth() { throw new Error('offsetWidth read: a synchronous layout'); } };
    return { el: el as unknown as Element, classes, log };
  }
  it('a class not on is put on at once, with no read at all', async () => {
    let styles = 0; g.getComputedStyle = () => { styles++; return { animationName: 'x' }; };
    const { pulseClass } = await import('../src/ui/pulse');
    const { el, classes } = element(); pulseClass(el, 'hd-hit');
    expect(classes.has('hd-hit')).toBe(true); await Promise.resolve(); expect(styles).toBe(0);
  });
  it('a class still on comes off now and back after one style read for the batch, never offsetWidth', async () => {
    const seen: boolean[] = []; let a!: ReturnType<typeof element>, b!: ReturnType<typeof element>;
    g.getComputedStyle = (el: Element) => { seen.push(el === a.el ? a.classes.has('hd-hit') : b.classes.has('hd-crit')); return { animationName: 'x' }; };
    const { pulseClass } = await import('../src/ui/pulse');
    a = element(['hd-hit']); b = element(['hd-crit']);
    pulseClass(a.el, 'hd-hit'); pulseClass(b.el, 'hd-crit'); pulseClass(a.el, 'hd-hit');
    expect(a.classes.has('hd-hit'), 'off until the frame\'s work is over').toBe(false);
    await Promise.resolve();
    expect(seen, 'styled while off').toEqual([false, false]);
    expect(a.log, 'a second pulse in the same frame is the same restart').toEqual(['-hd-hit', '+hd-hit']);
    expect(b.classes.has('hd-crit')).toBe(true);
  });
});

describe('the royale path reads neither', () => {
  const read = (p: string) => readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
  it('no innerWidth / innerHeight in its per-frame modules', () => {
    for (const p of ['src/ui/DamageNumbers.ts', 'src/ui/MangaImpact.ts', 'src/ui/LockOnView.ts', 'src/ui/hud/edge.ts', 'src/ui/hud/RoyaleHud.ts'])
      expect(read(p), p).not.toMatch(/(?<![.\w])inner(Width|Height)\b/);
  });
  it('no offsetWidth restarts in its pulses', () => {
    for (const p of ['src/ui/hud/protos/proto.ts', 'src/ui/hud/RoyaleHud.ts', 'src/ui/hud/royaleField.ts']) expect(read(p), p).not.toContain('offsetWidth');
    expect(read('src/ui/Hud.ts')).toContain(`pulseClass(meter,'hit')`);
  });
});
