import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reloadIfNotRestored, RESTORE_WAIT } from '../src/boot/pageLife';
import { ResolutionGovernor } from '../src/render/ResolutionGovernor';

function page(hidden = false) {
  const doc = Object.assign(new EventTarget(), { hidden });
  let reloads = 0;
  const p = { document: doc, location: { reload: () => { reloads++; } }, setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms) as unknown as number, clearTimeout: (t: number) => clearTimeout(t) };
  const canvas = new EventTarget();
  reloadIfNotRestored(canvas, p as never);
  return { canvas, doc, reloads: () => reloads, fire: (type: string) => canvas.dispatchEvent(new Event(type)), show: (h: boolean) => { doc.hidden = h; doc.dispatchEvent(new Event('visibilitychange')); } };
}

describe('a lost context that does not come back', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });
  it('reloads the page after the wait', () => {
    const p = page(); p.fire('webglcontextlost'); vi.advanceTimersByTime(RESTORE_WAIT - 1); expect(p.reloads()).toBe(0);
    vi.advanceTimersByTime(2); expect(p.reloads()).toBe(1);
  });
  it('one given back in time is left to the rebuild', () => {
    const p = page(); p.fire('webglcontextlost'); vi.advanceTimersByTime(1500); p.fire('webglcontextrestored'); vi.advanceTimersByTime(RESTORE_WAIT * 3); expect(p.reloads()).toBe(0);
  });
  it('time in the background does not count, and nothing reloads behind the player', () => {
    const p = page(true); p.fire('webglcontextlost'); vi.advanceTimersByTime(RESTORE_WAIT * 4); expect(p.reloads()).toBe(0);
    p.show(false); vi.advanceTimersByTime(RESTORE_WAIT - 10); p.show(true); vi.advanceTimersByTime(RESTORE_WAIT * 2); expect(p.reloads()).toBe(0);
    p.show(false); vi.advanceTimersByTime(RESTORE_WAIT + 1); expect(p.reloads()).toBe(1);
  });
});

describe('the resolution governor after a restore', () => {
  it("drops the lost context's queries, which never answer, and times frames again", () => {
    let asked = 0, made = 0;
    const ext = { TIME_ELAPSED_EXT: 1, GPU_DISJOINT_EXT: 2 };
    const gl = { RENDERER: 3, QUERY_RESULT_AVAILABLE: 4, QUERY_RESULT: 5, getExtension: (name: string) => name === 'EXT_disjoint_timer_query_webgl2' ? (asked++, ext) : null, getParameter: () => '', createQuery: () => ({ n: made++ }), beginQuery() {}, endQuery() {}, getQueryParameter: () => false, deleteQuery() {} };
    const governor = new ResolutionGovernor(gl as unknown as WebGL2RenderingContext);
    for (let i = 0; i < 12; i++) { governor.begin(); governor.end(); governor.update(i * 16); }
    const stuck = made;
    governor.begin(); governor.end();
    expect(made, 'queries that never answer stop the timing').toBe(stuck);
    governor.restored();
    expect(asked, 'the extension is asked for again on the restored context').toBe(2);
    governor.begin(); governor.end();
    expect(made).toBe(stuck + 1);
  });
});

describe('the rebuild is wired', () => {
  it('GameRenderer re-bakes the environment light and resets the governor on restore', () => {
    const src = readFileSync('src/render/GameRenderer.ts', 'utf8');
    expect(src).toMatch(/addEventListener\('webglcontextrestored',\(\)=>\{[^}]*this\.governor\.restored\(\);this\.refreshEnvironment\(\);/);
  });
  it('the Effekseer runtime starts a new context on restore', () => {
    const src = readFileSync('src/render/vfx/armory/effekseer.ts', 'utf8');
    expect(src).toMatch(/addEventListener\('webglcontextrestored', \(\) => this\.restart\(\)\)/);
  });
  it('main.ts reloads a page whose context does not come back', () => {
    expect(readFileSync('src/main.ts', 'utf8')).toContain('reloadIfNotRestored(view.renderer.domElement,window);');
  });
});
