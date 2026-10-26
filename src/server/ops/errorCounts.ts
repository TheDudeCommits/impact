import { MESSAGE_MAX, scrub } from '../../game/errorReport';

export class Tally {
  private readonly minute = new Float64Array(1440).fill(-1);
  private readonly count = new Float64Array(1440);
  add(at: number, n = 1) {
    const m = Math.floor(at / 60_000), slot = ((m % 1440) + 1440) % 1440;
    if (this.minute[slot] > m) return;
    if (this.minute[slot] !== m) { this.minute[slot] = m; this.count[slot] = 0; }
    this.count[slot] += n;
  }
  since(now: number, minutes: number) {
    const m = Math.floor(now / 60_000); let total = 0;
    for (let slot = 0; slot < 1440; slot++) if (this.minute[slot] > m - minutes && this.minute[slot] <= m) total += this.count[slot];
    return total;
  }
}

export interface ServerErrorEvent { at: number; kind: string; message: string }

export function describeError(error: unknown): string {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : typeof error === 'string' ? error : (() => { try { return JSON.stringify(error) ?? String(error); } catch { return String(error); } })();
  const line = scrub(String(text).split('\n', 1)[0].slice(0, MESSAGE_MAX * 4)).trim();
  return line.length > MESSAGE_MAX ? `${line.slice(0, MESSAGE_MAX - 1)}…` : line || 'unknown';
}

export class ServerErrors {
  static readonly RECENT = 20;
  readonly recent: ServerErrorEvent[] = [];
  private readonly tally = new Tally();
  sink: (event: ServerErrorEvent) => void = event => this.take(event);
  constructor(private readonly now: () => number = Date.now) {}
  record(kind: string, error: unknown) {
    try { this.sink({ at: this.now(), kind: String(kind).slice(0, 40), message: describeError(error) }); } catch { }
  }
  take(event: ServerErrorEvent) {
    if (!event || typeof event.at !== 'number' || !Number.isFinite(event.at)) return;
    this.tally.add(event.at);
    this.recent.push({ at: event.at, kind: String(event.kind).slice(0, 40), message: String(event.message).slice(0, MESSAGE_MAX) });
    if (this.recent.length > ServerErrors.RECENT) this.recent.shift();
  }
  counts(now = this.now()) { return { lastHour: this.tally.since(now, 60), lastDay: this.tally.since(now, 1440) }; }
}

export const serverErrors = new ServerErrors();
export const recordServerError = (kind: string, error: unknown) => serverErrors.record(kind, error);

export interface ClientCounts { lastHour: number; lastDay: number; groupsLastDay: number }
export const clientCounts: { read: (now: number) => ClientCounts } = { read: () => ({ lastHour: 0, lastDay: 0, groupsLastDay: 0 }) };

export function errorCounts(now = Date.now()) {
  return { client: clientCounts.read(now), server: serverErrors.counts(now) };
}
