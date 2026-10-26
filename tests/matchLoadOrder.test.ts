import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { aheadLoader } from '../src/loading/modelFiles';
import { isMissingAsset } from '../src/loading/staleBuild';
import { THIN_LINE_MBPS, thinLine } from '../src/loading/backgroundPolicy';

const g = globalThis as unknown as Record<string, unknown>;
const saved = { fetch: g.fetch, AudioContext: g.AudioContext, performance: g.performance, navigator: g.navigator };
afterEach(() => { g.fetch = saved.fetch; g.AudioContext = saved.AudioContext; vi.restoreAllMocks(); });

function heldLoader() {
  const asked: string[] = [], waiting = new Map<string, { ok: (value: { url: string }) => void; no: (error: Error) => void }>();
  const loader = { loadAsync: (url: string) => new Promise((ok, no) => { asked.push(url); waiting.set(url, { ok, no }); }) } as unknown as GLTFLoader;
  return { loader, asked, answer: (url: string) => waiting.get(url)!.ok({ url }), fail: (url: string, error: Error) => waiting.get(url)!.no(error) };
}
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe("a fighter's files", () => {
  it('are all asked for at once, through the loader itself, and handed back in the order its caller asks for them', async () => {
    const net = heldLoader(), bound: string[] = [];
    const files = ['/assets/fighters/goku-sz1.glb', '/assets/fighters/goku-rush1.glb', undefined, '/assets/fighters/goku-fanim1.glb'];
    const ahead = aheadLoader(net.loader, files);
    expect(net.asked).toEqual(files.filter(Boolean));
    net.answer('/assets/fighters/goku-fanim1.glb'); net.answer('/assets/fighters/goku-rush1.glb');
    const body = ahead.loadAsync('/assets/fighters/goku-sz1.glb').then(g => { bound.push((g as unknown as { url: string }).url); return g; });
    await flush();
    expect(bound).toEqual([]);
    net.answer('/assets/fighters/goku-sz1.glb'); await body;
    for (const url of ['/assets/fighters/goku-rush1.glb', '/assets/fighters/goku-fanim1.glb']) bound.push(((await ahead.loadAsync(url)) as unknown as { url: string }).url);
    expect(bound).toEqual(files.filter(Boolean));
    const extra = ahead.loadAsync('/assets/fighters/goku-extra.glb'); await flush();
    expect(net.asked.at(-1)).toBe('/assets/fighters/goku-extra.glb');
    net.answer('/assets/fighters/goku-extra.glb'); await extra;
  });

  it("fail where they are asked for, with the loader's own error (a file a new build removed still reloads the tab)", async () => {
    const net = heldLoader();
    const ahead = aheadLoader(net.loader, ['/assets/fighters/gone.glb']);
    const missing = Object.assign(new Error('fetch for "https://site/assets/fighters/gone.glb" responded with 404: Not Found'), { response: { status: 404, url: 'https://site/assets/fighters/gone.glb' } });
    net.fail('/assets/fighters/gone.glb', missing); await flush();
    const error = await ahead.loadAsync('/assets/fighters/gone.glb').catch(e => e);
    expect(error).toBe(missing);
    expect(isMissingAsset(error)).toBe(true);
  });
});

describe('the sound bank on a thin line', () => {
  it('waits while held, its manifest excepted, and asks for every file once let go', async () => {
    const asked: string[] = [];
    g.fetch = async (url: string) => { asked.push(String(url)); return { ok: true, status: 200, headers: { get: () => String(url).endsWith('.json') ? 'application/json' : 'audio/mp4' }, json: async () => ({ files: {} }), arrayBuffer: async () => new ArrayBuffer(8) }; };
    class Node { gain = { value: 1, setTargetAtTime() {} }; pan = { value: 0 }; connect() { return this; } disconnect() {} }
    g.AudioContext = class { currentTime = 0; state = 'running'; destination = new Node(); createGain() { return new Node(); } createStereoPanner() { return new Node(); } createDynamicsCompressor() { return Object.assign(new Node(), { threshold: {}, knee: {}, ratio: {}, attack: {}, release: {} }); }
      resume() { return Promise.resolve(); } close() { return Promise.resolve(); } decodeAudioData() { return Promise.resolve({ duration: 1 }); } };
    const { CombatAudio } = await import('../src/audio/CombatAudio');
    const audio = new CombatAudio({ byRoom: true });
    let open!: () => void;
    audio.holdFetches(new Promise<void>(resolve => { open = resolve; }), 60_000);
    const unlocked = audio.unlock();
    await new Promise(resolve => setTimeout(resolve, 60));
    expect(asked.filter(url => !url.endsWith('packed.json'))).toEqual([]);
    open(); await unlocked;
    expect(asked.filter(url => url.includes('/assets/audio/v2/')).length).toBeGreaterThan(50);
    audio.dispose();
  });

  it('is held where the page measured a slow line or saves data, not on a fast one or before it has measured', () => {
    const line = (mbps: number | undefined, connection?: object) => {
      vi.spyOn(performance, 'getEntriesByType').mockReturnValue((mbps === undefined ? [] : [{ encodedBodySize: 1_500_000, transferSize: 1_500_000, responseStart: 0, responseEnd: 1_500_000 * 8 / 1e6 / mbps * 1000 }]) as unknown as PerformanceEntryList);
      vi.stubGlobal('navigator', { ...saved.navigator as object, connection });
      try { return thinLine(); } finally { vi.unstubAllGlobals(); vi.restoreAllMocks(); }
    };
    expect(THIN_LINE_MBPS).toBe(150);
    expect(line(27.6)).toBe(true);
    expect(line(525)).toBe(false);
    expect(line(undefined)).toBe(false);
    expect(line(525, { saveData: true })).toBe(true);
    expect(line(525, { type: 'cellular' })).toBe(true);
  });
});
