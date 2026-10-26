import type { Settings } from '../config';
import { phone, tablet } from '../input/device';

export type Quality = Settings['quality'];
const ORDER: readonly Quality[] = ['low', 'medium', 'high'];
export const lowerQuality = (q: Quality): Quality => ORDER[Math.max(0, ORDER.indexOf(q) - 1)];
const lowest = (a: Quality, b?: Quality) => !b || ORDER.indexOf(a) <= ORDER.indexOf(b) ? a : b;

export interface TierDevice { phone: boolean; tablet: boolean }
export function gpuTier(name: string, device: TierDevice): Quality {
  const gpu = name.replace(/\s+/g, ' ');
  if (/SwiftShader|llvmpipe|softpipe|Software|Basic Render|Microsoft Basic/i.test(gpu)) return 'low';
  if (device.phone) return 'low';
  const mobile = /Adreno|Mali|PowerVR|Xclipse|Apple GPU|Apple A\d|Immortalis|Tegra|Vivante|VideoCore/i.test(gpu);
  if (mobile) {
    const strong = /Apple GPU|Apple M\d|Xclipse|Immortalis/i.test(gpu) || +(gpu.match(/Adreno[^\d]*(\d{3})/i)?.[1] ?? 0) >= 640 || /Mali-G(7[1-9]|[6-9]\d\d)/i.test(gpu);
    if (device.tablet) return strong ? 'medium' : 'low';
    return /Apple GPU/i.test(gpu) ? 'medium' : 'low';
  }
  if (/Apple M[12]\b(?!\s+(?:Pro|Max|Ultra)\b)/i.test(gpu)) return 'medium';
  if (/Apple M\d/i.test(gpu)) return 'high';
  if (/NVIDIA|GeForce|Quadro|TITAN/i.test(gpu)) {
    if (/\bMX\s?\d/i.test(gpu)) return 'medium';
    if (/RTX|TITAN|GTX 1[6-9]\d\d/i.test(gpu)) return 'high';
    return 'medium';
  }
  if (/Radeon|AMD/i.test(gpu)) return /\bRX\s?\d|Radeon Pro W|Radeon VII/i.test(gpu) && !/Vega \d|Graphics/i.test(gpu) ? 'high' : 'medium';
  if (/Intel/i.test(gpu)) {
    if (/Arc.*A\d{3}/i.test(gpu)) return 'high';
    if (/Iris|Xe\b|Arc/i.test(gpu)) return 'medium';
    return 'low';
  }
  return device.tablet ? 'low' : 'medium';
}

export function gpuName(gl: WebGLRenderingContext | WebGL2RenderingContext | null | undefined) {
  if (!gl) return '';
  try {
    const info = gl.getExtension('WEBGL_debug_renderer_info') as { UNMASKED_RENDERER_WEBGL: number } | null;
    return String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
  } catch { return ''; }
}

export const STEP_KEY = 'rift-quality-auto';
function remembered(gpu: string): Quality | undefined {
  try { const saved = JSON.parse(localStorage.getItem(STEP_KEY) ?? 'null'); return saved?.gpu === gpu && ORDER.includes(saved.quality) ? saved.quality : undefined; } catch { return undefined; }
}
export function rememberStep(gpu: string, quality: Quality) { try { localStorage.setItem(STEP_KEY, JSON.stringify({ gpu, quality })); } catch { } }

let bootGpu = '';
export const machineQuality = (device: TierDevice = { phone: phone(), tablet: tablet() }) => lowest(gpuTier(bootGpu, device), remembered(bootGpu));
export function autoQuality(settings: Settings, gpu: string, device: TierDevice = { phone: phone(), tablet: tablet() }): boolean {
  bootGpu = gpu;
  if (settings.qualityChosen) return false;
  const quality = machineQuality(device);
  if (settings.quality === quality) return false;
  settings.quality = quality; return true;
}

export const LOW_SHARE = .75, LOW_SECONDS = 9, AFTER_STEP_S = 12;
export class QualityWatch {
  private seconds = 0;
  private frames = 0;
  private lowFor = 0;
  private wait = 0;
  frame(dt: number, watching: boolean, atFloor: boolean, target: number): boolean {
    if (!watching) { this.seconds = 0; this.frames = 0; this.lowFor = 0; return false; }
    if (!(dt > 0) || dt >= .25) return false;
    this.seconds += dt; this.frames++;
    if (this.seconds < 1) return false;
    const fps = this.frames / this.seconds;
    this.seconds = 0; this.frames = 0; this.wait = Math.max(0, this.wait - 1);
    this.lowFor = fps < target * LOW_SHARE && atFloor ? this.lowFor + 1 : 0;
    if (this.lowFor < LOW_SECONDS || this.wait > 0) return false;
    this.lowFor = 0; this.wait = AFTER_STEP_S;
    return true;
  }
}

export function stepDown(settings: Settings) {
  settings.quality = lowerQuality(settings.quality);
  rememberStep(bootGpu, settings.quality);
  try { localStorage.setItem('rift-settings', JSON.stringify(settings)); } catch { }
  showQuality(settings.qualityChosen ? settings.quality : 'auto'); qualityToast(settings.quality);
}
export function showQuality(quality: Quality | 'auto') {
  if (typeof document !== 'object') return;
  document.querySelectorAll<HTMLSelectElement>('[data-setting="quality"],[data-home-setting="quality"]').forEach(control => { if (!control.matches(':focus')) control.value = quality; });
}
let toastTimer = 0;
export function qualityToast(quality: Quality) {
  if (typeof document !== 'object') return;
  let toast = document.querySelector<HTMLElement>('.quality-toast');
  if (!toast) { toast = document.createElement('div'); toast.className = 'quality-toast'; toast.setAttribute('role', 'status'); document.body.append(toast); }
  toast.innerHTML = `Graphics set to <b>${quality.toUpperCase()}</b> for smoother play · change it in Options`;
  requestAnimationFrame(() => toast!.classList.add('in'));
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast!.classList.remove('in'), 5200);
}
