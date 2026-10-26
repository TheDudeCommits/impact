import type { Client } from 'colyseus';
import type { PauseView } from '../game/types';

export const PAUSE_REARM_TICKS = 45;
export const PAUSE_FENCE_TICKS = 30;
export const PAUSE_LIMIT_MS = 15 * 60 * 1000;
export const PAUSE_BEAT_MS = 250;

export interface PauseRoom {
  solo(): string | undefined;
  open(): boolean;
  queued(id: string): number;
  frozen(): void;
  thawed(ms: number): void;
  beat(): void;
}

const serial = (raw: unknown) => {
  const n = typeof raw === 'object' && raw !== null ? (raw as { n?: unknown }).n : raw;
  return typeof n === 'number' && Number.isSafeInteger(n) && n > 0 ? n : undefined;
};

export class SoloPause {
  frozen = false;
  private pending = false;
  private ack = 0;
  private waited = 0;
  private live = Infinity;
  private since = 0;
  private beatAt = 0;
  frozenMs = 0;
  constructor(private readonly room: PauseRoom) {}

  get pausable() { return this.room.solo() !== undefined && this.room.open(); }

  request(client: Pick<Client, 'sessionId'>, raw: unknown, pause: boolean, now = Date.now()) {
    const n = serial(raw);
    if (n === undefined || n <= this.ack || client.sessionId !== this.room.solo()) return;
    this.ack = n;
    if (!pause) { this.release(now); return; }
    if (this.frozen || this.pending || !this.room.open()) return;
    this.pending = true; this.waited = 0;
  }

  hold(now = Date.now()): boolean {
    if ((this.frozen || this.pending) && !this.pausable) this.release(now);
    if (this.pending) {
      const id = this.room.solo()!;
      if (this.live < PAUSE_REARM_TICKS || (this.room.queued(id) > 0 && this.waited < PAUSE_FENCE_TICKS)) {
        this.waited++; this.live++;
        return false;
      }
      this.freeze(now);
      return true;
    }
    if (this.frozen) {
      if (now - this.since >= PAUSE_LIMIT_MS) { this.release(now); this.live++; return false; }
      if (now - this.beatAt >= PAUSE_BEAT_MS) { this.beatAt = now; this.room.beat(); }
      return true;
    }
    if (this.live !== Infinity) this.live++;
    return false;
  }

  drop(id: string, now = Date.now()) {
    if (!this.frozen && id === this.room.solo() && this.room.open()) this.freeze(now);
  }

  view(): PauseView {
    return { paused: this.frozen, ...(this.pending ? { pausing: true } : {}), pausable: this.pausable, ack: this.ack };
  }

  private freeze(now: number) {
    this.frozen = true; this.pending = false; this.since = this.beatAt = now;
    this.room.frozen();
  }

  private release(now: number) {
    this.pending = false;
    if (!this.frozen) return;
    this.frozen = false; this.live = 0;
    const ms = Math.max(0, now - this.since);
    this.frozenMs += ms;
    this.room.thawed(ms);
  }
}
