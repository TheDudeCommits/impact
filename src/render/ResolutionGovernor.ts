export const MIN_SCALE = .6, STEP = .05;
export const BUDGET_MS = 12.5, ROOM = .7;
export const STRONG_BUDGET_MS = 15, STRONG_QUANTILE = .95;

export function strongGpu(name: string) {
  if (/Apple M\d+ (Pro|Max|Ultra)/i.test(name)) return true;
  const apple = name.match(/Apple M(\d+)/i);
  if (apple) return +apple[1] >= 4;
  if (/NVIDIA|GeForce|Quadro/i.test(name)) return /RTX|GTX 1[6-9]\d\d|TITAN/i.test(name) && !/\bMX\s?\d/i.test(name);
  if (/Radeon/i.test(name)) return /\bRX\s?\d|Pro W\d|Radeon VII/i.test(name) && !/Vega \d|Graphics/i.test(name);
  return false;
}
export const SLOW_FRAME_MS = 20, FAST_FRAME_MS = 18;
export const WINDOW_S = 1, UP_AFTER_DOWN_S = 4, MIN_SAMPLES = 20;

export interface GovernorJudgement {
  scale: number;
  strong?: boolean;
  floor?: number;
  sinceDown: number;
  samples: readonly number[];
  timed: boolean;
  budgetMs?:number;
  frameMs?:number;
}

const quantile = (sorted: readonly number[], q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];

export function nextScale({scale, floor = MIN_SCALE, strong = false, sinceDown, samples, timed,budgetMs,frameMs=1000/60}: GovernorJudgement): number {
  if (samples.length < MIN_SAMPLES) return scale;
  const sorted = [...samples].sort((a, b) => a - b), p75 = quantile(sorted, .75), p90 = quantile(sorted, .9);
  const budget = budgetMs??(strong ? STRONG_BUDGET_MS : BUDGET_MS), held = strong ? quantile(sorted, STRONG_QUANTILE) : p75, room = strong ? held : p90;
  const over = timed ? held / budget : p75 / Math.max(SLOW_FRAME_MS,frameMs*1.2);
  let next = scale;
  if (over > 1) next = scale - (over > 1.4 ? 2 : 1) * STEP;
  else if (sinceDown >= UP_AFTER_DOWN_S && (timed ? room < budget * ROOM : p90 < Math.max(FAST_FRAME_MS,frameMs*1.08))) next = scale + STEP;
  const least = Math.min(1, Math.max(MIN_SCALE, floor));
  return Math.min(1, Math.max(least, Math.round(next / STEP) * STEP));
}

export class ResolutionGovernor {
  scale = 1;
  floor = MIN_SCALE;
  strong = false;
  plugged = true;
  budgetMs?:number;
  frameMs=1000/60;
  get relaxed() { return this.strong && this.plugged; }
  private readonly gl: WebGL2RenderingContext;
  private ext: {TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number} | null;
  private readonly pending: WebGLQuery[] = [];
  private readonly samples: number[] = [];
  private open = false;
  private judgedAt = 0;
  private downAt = -1e9;
  private lastFrame = 0;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') as {TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number} | null;
    const info = gl.getExtension('WEBGL_debug_renderer_info') as {UNMASKED_RENDERER_WEBGL: number} | null;
    this.strong = strongGpu(String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? ''));
    const nav = (typeof navigator === 'undefined' ? undefined : navigator) as (Navigator & {getBattery?: () => Promise<{charging: boolean; addEventListener(type: string, listener: () => void): void}>}) | undefined;
    nav?.getBattery?.().then(battery => {
      const read = () => { this.plugged = battery.charging; };
      read(); battery.addEventListener('chargingchange', read);
    }).catch(() => {});
  }

  get timed() { return !!this.ext; }

  begin() {
    if (!this.ext || this.open || this.pending.length > 6) return;
    const query = this.gl.createQuery();
    if (!query) return;
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, query);
    this.pending.push(query);
    this.open = true;
  }

  end() {
    if (!this.ext || !this.open) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.open = false;
  }

  update(now: number, hold = false): boolean {
    const {gl, ext} = this;
    if (ext) {
      while (this.pending.length && gl.getQueryParameter(this.pending[0], gl.QUERY_RESULT_AVAILABLE)) {
        const query = this.pending.shift()!;
        this.samples.push(gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6);
        gl.deleteQuery(query);
      }
    } else if (this.lastFrame) {
      const gap = now - this.lastFrame;
      if (gap < 250) this.samples.push(gap);
    }
    this.lastFrame = now;
    if (now - this.judgedAt < WINDOW_S * 1000) return false;
    this.judgedAt = now;
    let samples = this.samples.splice(0);
    if (ext && gl.getParameter(ext.GPU_DISJOINT_EXT)) samples = [];
    if (hold) return false;
    const next = nextScale({scale: this.scale, floor: this.floor, strong: this.relaxed, sinceDown: (now - this.downAt) / 1000, samples, timed: !!ext,budgetMs:this.budgetMs,frameMs:this.frameMs});
    if (Math.abs(next - this.scale) < 1e-6) return false;
    if (next < this.scale) this.downAt = now;
    this.scale = next;
    return true;
  }

  restored() { this.pending.length = 0; this.open = false; this.samples.length = 0; this.ext = this.gl.getExtension('EXT_disjoint_timer_query_webgl2') as {TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number} | null; }
  reset() { this.scale = 1; this.samples.length = 0; this.downAt = -1e9; }
}
