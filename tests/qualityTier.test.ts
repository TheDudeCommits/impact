import { afterEach, describe, expect, it, vi } from 'vitest';
import { AFTER_STEP_S, autoQuality, gpuTier, LOW_SECONDS, lowerQuality, QualityWatch, STEP_KEY } from '../src/render/qualityTier';
import { chooseQuality, loadSettings, QUALITY_OPTIONS, qualityChoice } from '../src/config';
import { powerBudget } from '../src/render/powerBudget';

const desktop = { phone: false, tablet: false }, phone = { phone: true, tablet: false }, tablet = { phone: false, tablet: true };
describe('the preset a GPU starts on (render/qualityTier.ts)', () => {
  it('low: software renderers and Intel UHD/HD', () => {
    for (const name of ['ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)', 'llvmpipe (LLVM 15.0.7, 256 bits)',
      'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)', 'Intel(R) HD Graphics 630', 'Mesa Intel(R) UHD Graphics 620 (KBL GT2)', 'ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0, D3D11)'])
      expect(gpuTier(name, desktop), name).toBe('low');
  });
  it('low: every phone, whatever its GPU', () => {
    for (const name of ['Apple GPU', 'Adreno (TM) 740', 'Mali-G78 MP14', 'PowerVR Rogue GE8320', 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)'])
      expect(gpuTier(name, phone), name).toBe('low');
  });
  it('medium: Iris Xe, AMD APUs, older dedicated cards, unknown desktops', () => {
    for (const name of ['ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)', 'Intel(R) Iris(TM) Plus Graphics 655', 'Intel(R) Arc(TM) Graphics',
      'ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)', 'AMD Radeon 780M', 'AMD Radeon RX Vega 11 Graphics', 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 6GB Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'NVIDIA GeForce MX450', 'NVIDIA GeForce GTX 970', 'Radeon R9 200 Series', 'WebKit WebGL', '',
      'Apple GPU'])
      expect(gpuTier(name, desktop), name).toBe('medium');
  });
  it('medium: base M1/M2 starts conservatively for long crowd battles', () => {
    for (const name of ['Apple M1', 'Apple M2', 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)'])
      expect(gpuTier(name, desktop), name).toBe('medium');
  });
  it('high: newer or Pro/Max/Ultra Apple GPUs, RTX, GTX 16 and up, Radeon RX, Intel Arc cards', () => {
    for (const name of ['Apple M1 Pro', 'Apple M1 Max', 'Apple M2 Ultra', 'Apple M3', 'Apple M4', 'ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Pro, Unspecified Version)',
      'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)', 'NVIDIA GeForce GTX 1650', 'NVIDIA GeForce RTX 3050 Laptop GPU',
      'ANGLE (AMD, AMD Radeon RX 6800 XT Direct3D11 vs_5_0 ps_5_0, D3D11)', 'AMD Radeon RX 6600M', 'Intel(R) Arc(TM) A770 Graphics'])
      expect(gpuTier(name, desktop), name).toBe('high');
  });
  it('tablets: medium with a strong mobile GPU, low with a weaker one', () => {
    for (const name of ['Apple GPU', 'Adreno (TM) 650', 'Adreno (TM) 740', 'Mali-G78 MP14', 'Mali-G710 MC10', 'Samsung Xclipse 920']) expect(gpuTier(name, tablet), name).toBe('medium');
    for (const name of ['Adreno (TM) 610', 'Mali-G52 MC2', 'PowerVR Rogue GE8320', 'Mali-G57', 'something unknown']) expect(gpuTier(name, tablet), name).toBe('low');
    expect(gpuTier('ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)', tablet)).toBe('medium');
  });
  it('steps down one preset at a time and stops at low', () => {
    expect(lowerQuality('high')).toBe('medium'); expect(lowerQuality('medium')).toBe('low'); expect(lowerQuality('low')).toBe('low');
  });
  it('a phone on low draws a smaller shadow; every other device keeps its own', () => {
    expect(powerBudget({ quality: 'low', powerMode: 'auto' }, false, false, true).shadowSize).toBe(512);
    expect(powerBudget({ quality: 'low', powerMode: 'auto' }, false, false, false).shadowSize).toBe(1024);
    expect(powerBudget({ quality: 'high', powerMode: 'auto' }, false, false, true).shadowSize).toBe(2048);
    expect(powerBudget({ quality: 'low', powerMode: 'auto' }, false, false, true).samples).toBe(0);
  });
});

describe('the watch: one step down after sustained low frame rate at the resolution floor', () => {
  const run = (watch: QualityWatch, seconds: number, fps: number, atFloor = true, watching = true) => { let stepped = 0; for (let i = 0; i < seconds * fps; i++) if (watch.frame(1 / fps, watching, atFloor, 60)) stepped++; return stepped; };
  it('steps after LOW_SECONDS under 45 fps at the floor, and not before', () => {
    const watch = new QualityWatch();
    expect(run(watch, LOW_SECONDS - 1.5, 30)).toBe(0);
    expect(run(watch, 2, 30)).toBe(1);
  });
  it('never steps while the governor still has resolution to give, or at a good frame rate', () => {
    expect(run(new QualityWatch(), 30, 30, false)).toBe(0);
    expect(run(new QualityWatch(), 30, 55)).toBe(0);
  });
  it('a good second starts the count again', () => {
    const watch = new QualityWatch();
    run(watch, LOW_SECONDS - 2, 30); run(watch, 1.2, 60);
    expect(run(watch, LOW_SECONDS - 2, 30)).toBe(0);
  });
  it('waits AFTER_STEP_S before judging another step, and ignores what it is not watching', () => {
    const watch = new QualityWatch();
    expect(run(watch, LOW_SECONDS + .5, 30)).toBe(1);
    expect(run(watch, AFTER_STEP_S - 1, 30)).toBe(0);
    expect(run(watch, LOW_SECONDS + 1, 30)).toBe(1);
    expect(run(new QualityWatch(), 60, 20, true, false)).toBe(0);
  });
  it('judges against the rate aimed at (the 30 fps cool mode is not slow)', () => {
    const watch = new QualityWatch(); let stepped = 0;
    for (let i = 0; i < 30 * 30; i++) if (watch.frame(1 / 30, true, true, 30)) stepped++;
    expect(stepped).toBe(0);
  });
});

function storage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  vi.stubGlobal('localStorage', { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), removeItem: (k: string) => void map.delete(k) });
  return map;
}
afterEach(() => vi.unstubAllGlobals());
describe('the explicit-choice flag (config.ts)', () => {
  it('a save holding the old default high is not a choice', () => {
    storage({ 'rift-settings': JSON.stringify({ quality: 'high', volume: .5 }) });
    const settings = loadSettings();
    expect(settings.quality).toBe('high'); expect(settings.qualityChosen).toBe(false);
    expect(qualityChoice(settings)).toBe('auto');
  });
  it('a save with the flag keeps the player\'s choice, and auto never changes it', () => {
    storage({ 'rift-settings': JSON.stringify({ quality: 'high', qualityChosen: true }) });
    const settings = loadSettings();
    expect(settings.qualityChosen).toBe(true);
    expect(autoQuality(settings, 'Intel(R) HD Graphics 630', desktop)).toBe(false);
    expect(autoQuality(settings, 'Apple M2', desktop)).toBe(false);
    expect(settings.quality).toBe('high');
    expect(qualityChoice(settings)).toBe('high');
  });
  it('without a choice, the machine\'s preset applies, lowered where a fight here stepped it down', () => {
    storage();
    const settings = loadSettings();
    expect(autoQuality(settings, 'Intel(R) HD Graphics 630', desktop)).toBe(true);
    expect(settings.quality).toBe('low');
    storage({ [STEP_KEY]: JSON.stringify({ gpu: 'Apple M2', quality: 'medium' }) });
    const again = loadSettings();
    autoQuality(again, 'Apple M2', desktop);
    expect(again.quality).toBe('medium');
    const other = loadSettings(); autoQuality(other, 'NVIDIA GeForce RTX 4090', desktop);
    expect(other.quality).toBe('high');
  });
  it('choosing a preset sets the flag; AUTO clears it and hands the quality back to the machine', () => {
    storage();
    const settings = loadSettings();
    chooseQuality(settings, 'medium');
    expect(settings.quality).toBe('medium'); expect(settings.qualityChosen).toBe(true);
    chooseQuality(settings, 'auto', 'low');
    expect(settings.qualityChosen).toBe(false); expect(settings.quality).toBe('low');
    chooseQuality(settings, 'ultra');
    expect(settings.quality).toBe('low');
    expect(QUALITY_OPTIONS.map(([value]) => value)).toEqual(['auto', 'high', 'medium', 'low']);
  });
});
