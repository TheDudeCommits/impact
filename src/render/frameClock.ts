export const WORLD_MAX_STEP = .05;
export function frameSteps(rawDt: number) {
  const real = Number.isFinite(rawDt) && rawDt > 0 ? rawDt : 0;
  return { world: Math.min(WORLD_MAX_STEP, real), camera: real, correction: real };
}

export const FRAME_MS = 1000 / 60;
export class FrameGate {
  private readonly gaps = new Float64Array(15);
  private readonly sorted = new Float64Array(15);
  private count = 0;
  private lastRequest = 0;
  private skipped = 0;
  get interval() {
    if (this.count < this.gaps.length) return FRAME_MS;
    this.sorted.set(this.gaps); this.sorted.sort();
    return this.sorted[this.gaps.length >> 1];
  }
  draw(now: number, previous: number, fps=60) {
    if (this.lastRequest > 0) this.gaps[this.count++ % this.gaps.length] = now - this.lastRequest;
    this.lastRequest = now;
    const target=1000/fps,refresh = this.interval, every = Math.max(1, Math.round(target / refresh - .1));
    if (++this.skipped < every && now - previous < target - refresh * .5) return false;
    this.skipped = 0;
    return true;
  }
}
