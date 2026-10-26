import type { GameSnapshot, PauseView } from './types';

export const PAUSE_RETRY_MS = 1000;

export interface PauseRequest { type: 'pause' | 'resume'; n: number }

export class PauseLink {
  private view?: PauseView;
  private n = 0;
  private asked: PauseRequest['type'] | null = null;
  private sentAt = -Infinity;

  reset() { this.view = undefined; this.n = 0; this.asked = null; this.sentAt = -Infinity; }

  observe(snapshot: Pick<GameSnapshot, 'pause'> | null | undefined) {
    this.view = snapshot?.pause;
    if (this.view && this.view.ack > this.n) this.n = this.view.ack;
  }

  private get heard() { return !!this.view && this.view.ack >= this.n; }

  get holding() {
    const view = this.view;
    if (!view) return false;
    if (!this.heard) return this.asked === 'pause';
    return view.paused || !!view.pausing;
  }

  get state(): 'live' | 'pausing' | 'paused' {
    if (!this.holding) return 'live';
    return this.heard && this.view!.paused ? 'paused' : 'pausing';
  }

  get pausable() { return !!this.view?.pausable; }

  update(want: boolean, now: number): PauseRequest | undefined {
    const view = this.view;
    if (!view) return;
    const holding = this.holding;
    const desired = want && (view.pausable || holding);
    if (desired !== holding) return this.send(desired ? 'pause' : 'resume', now);
    if (!this.heard && this.asked && now - this.sentAt >= PAUSE_RETRY_MS) return this.send(this.asked, now);
    return undefined;
  }

  private send(type: PauseRequest['type'], now: number): PauseRequest {
    this.asked = type; this.sentAt = now;
    return { type, n: ++this.n };
  }
}
