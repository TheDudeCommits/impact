import type { Client, Room } from 'colyseus';

export const READY_SECONDS = 3;
export const LATE_HOLD_SECONDS = 2;
export const READY_WAIT_SECONDS = 5;

export class ReadyGate {
  private readonly expected = new Set<string>();
  private readonly shown = new Map<string, number>();
  private waitingSince: number | null = null;
  constructor(room: Pick<Room, 'onMessage'>, private readonly clock: () => number) {
    room.onMessage('ready', (client: Client) => this.mark(client.sessionId));
  }
  add(client: Pick<Client, 'sessionId'>, enabled: unknown) { if (enabled === true) this.expected.add(client.sessionId); }
  remove(id: string) { this.expected.delete(id); this.shown.delete(id); }
  gated(id: string) { return this.expected.has(id); }
  mark(id: string) { if (this.expected.has(id) && !this.shown.has(id)) this.shown.set(id, this.clock()); }
  ready(ids: readonly string[]) {
    if (!ids.some(id => this.expected.has(id) && !this.shown.has(id))) { this.waitingSince = null; return true; }
    const now = this.clock();
    this.waitingSince ??= now;
    if (now - this.waitingSince < READY_WAIT_SECONDS) return false;
    for (const id of ids) if (this.expected.has(id) && !this.shown.has(id)) this.shown.set(id, now);
    this.waitingSince = null;
    return true;
  }
  lastShown(ids: readonly string[]) {
    let at = -Infinity;
    for (const id of ids) { const t = this.shown.get(id); if (t !== undefined && t > at) at = t; }
    return at;
  }
}
