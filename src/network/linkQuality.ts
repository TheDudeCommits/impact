export const STALL_MS = 250;
export const LAG_SHOW_MS = 350;
export const LAG_HIDE_MS = 300;
export const STALL_NOTE_MS = 500;
export const STALL_NOTE_AGE_MS = 10_000;
const STALL_KEEP_MS = 30_000;

export class LinkQuality {
  rtt = NaN;
  jitter = 0;
  best = Infinity;
  pings = 0;
  pongs = 0;
  private lastHeard = 0;
  private stalls: { at: number; ms: number }[] = [];
  private lagging = false;

  reset() { this.rtt = NaN; this.jitter = 0; this.best = Infinity; this.pings = this.pongs = 0; this.lastHeard = 0; this.stalls.length = 0; this.lagging = false; }

  ping(now: number) { this.pings++; return now; }

  pong(clientTime: unknown, now: number) {
    if (typeof clientTime !== 'number' || !Number.isFinite(clientTime)) return;
    const sample = now - clientTime;
    if (!(sample >= 0 && sample < 60_000)) return;
    this.pongs++;
    this.best = Math.min(this.best, sample);
    if (!Number.isFinite(this.rtt)) this.rtt = sample;
    else { this.jitter += (Math.abs(sample - this.rtt) - this.jitter) * .25; this.rtt += (sample - this.rtt) * .25; }
  }

  heard(now: number) {
    if (this.lastHeard && now - this.lastHeard >= STALL_MS) {
      this.stalls.push({ at: now, ms: now - this.lastHeard });
      while (this.stalls.length && now - this.stalls[0].at > STALL_KEEP_MS) this.stalls.shift();
    }
    this.lastHeard = now;
  }

  stalled(now: number, within = STALL_KEEP_MS) {
    let longest = 0;
    for (const s of this.stalls) if (now - s.at <= within && s.ms > longest) longest = s.ms;
    return longest;
  }

  note(now: number) {
    const stall = this.stalled(now, STALL_NOTE_AGE_MS);
    if (stall >= STALL_NOTE_MS) return `UNSTABLE CONNECTION · ${(stall / 1000).toFixed(1)} S STALL`;
    if (Number.isFinite(this.rtt)) {
      if (this.lagging ? this.rtt < LAG_HIDE_MS : this.rtt >= LAG_SHOW_MS) this.lagging = !this.lagging;
      if (this.lagging) return `LAG · ${Math.round(this.rtt)} MS`;
    }
    return undefined;
  }

  summary(now: number) {
    const v = this.view(now);
    if (v.rtt === null) return '';
    return ` · ping ${v.rtt} ms (best ${v.best}, jitter ${v.jitter})${v.stalls ? ` · ${v.stalls} stall${v.stalls === 1 ? '' : 's'} in 30 s, longest ${v.longestStall} ms` : ''}`;
  }

  view(now: number) {
    return { rtt: Number.isFinite(this.rtt) ? Math.round(this.rtt) : null, jitter: Math.round(this.jitter), best: Number.isFinite(this.best) ? Math.round(this.best) : null,
      pings: this.pings, pongs: this.pongs, stalls: this.stalls.filter(s => now - s.at <= STALL_KEEP_MS).length, longestStall: Math.round(this.stalled(now)) };
  }
}
