import { catchUp, INPUT_HZ } from './catchUp';

export const QUEUE_TARGET = 3;
export const DRAIN_ENGAGE = 2;
export const DRAIN_GENTLE = .05;
export const DRAIN_STEP = .025;
export const DRAIN_MAX = .2;
export const RATE_SLEW = .5;
export const REPORT_STALE = .5;

export function drainFor(low: number, draining: boolean) {
  const over = low - QUEUE_TARGET;
  if (!(over >= (draining ? 1 : DRAIN_ENGAGE))) return 0;
  return Math.min(DRAIN_MAX, DRAIN_GENTLE + DRAIN_STEP * (over - 1));
}

export class InputClock {
  backlog = 0;
  last = 0;
  rate = 1;
  private wanted = 0;
  private heard = 0;

  reset() { this.backlog = 0; this.last = 0; this.rate = 1; this.wanted = 0; this.heard = 0; }

  report(queued: number | undefined) {
    if (typeof queued !== 'number' || !Number.isFinite(queued)) return;
    this.wanted = drainFor(queued, this.wanted > 0);
    this.heard = this.last;
  }

  advance(now: number) {
    const elapsed = this.last ? (now - this.last) / 1000 : 1 / INPUT_HZ;
    this.last = now;
    if (this.wanted && (now - this.heard) / 1000 > REPORT_STALE) this.wanted = 0;
    const ease = RATE_SLEW * Math.max(0, Math.min(elapsed, .1)), target = 1 - this.wanted;
    this.rate = target < this.rate ? Math.max(target, this.rate - ease) : Math.min(target, this.rate + ease);
    const due = catchUp(this.backlog, elapsed, this.rate);
    this.backlog = due.backlog;
    return due.steps;
  }

  alpha(now: number) {
    if (!this.last) return 1;
    const since = Math.max(0, now - this.last) / 1000;
    return Math.max(0, Math.min(1, (this.backlog + since * this.rate) * INPUT_HZ));
  }
}
