import { monitorEventLoopDelay } from 'node:perf_hooks';

const BUCKETS = [.5, 1, 2, 4, 8, 16.7, 33, 66, 132, 264, Infinity];

class Histogram {
  private counts = new Array<number>(BUCKETS.length).fill(0);
  n = 0; sum = 0; max = 0;
  add(ms: number) {
    this.n++; this.sum += ms; if (ms > this.max) this.max = ms;
    let i = 0; while (ms > BUCKETS[i]) i++;
    this.counts[i]++;
  }
  quantile(q: number) {
    if (!this.n) return 0;
    const want = Math.ceil(this.n * q);
    let seen = 0;
    for (let i = 0; i < BUCKETS.length; i++) { seen += this.counts[i]; if (seen >= want) return Number.isFinite(BUCKETS[i]) ? Math.min(BUCKETS[i], this.max) : this.max; }
    return this.max;
  }
  reset() { this.counts.fill(0); this.n = 0; this.sum = 0; this.max = 0; }
}

export class NetStats {
  readonly tick = new Histogram();
  readonly snapshots = new Histogram();
  late = 0; writtenOff = 0; rejected = 0; faults = 0;
  writtenOffTotal = 0;
  tickMsTotal = 0;
  extra: () => string = () => '';
  private loop = monitorEventLoopDelay({ resolution: 10 });
  private timer?: ReturnType<typeof setInterval>;
  private busy = false;
  census: () => { rooms: number; players: number } = () => ({ rooms: 0, players: 0 });

  onTick(ms: number) { this.tick.add(ms); this.tickMsTotal += ms; this.busy = true; }
  onSnapshots(ms: number) { this.snapshots.add(ms); }
  onOwed(steps: number) { if (steps > 2) this.late++; }
  onWrittenOff(steps: number) { if (steps > 0) { this.writtenOff += steps; this.writtenOffTotal += steps; } }

  start(seconds = Number(process.env.NET_LOG_SECONDS ?? 60), print: (line: string) => void = line => console.log(line)) {
    if (!(seconds > 0) || this.timer) return;
    this.loop.enable();
    this.timer = setInterval(() => {
      const line = this.line(seconds);
      if (line) print(line);
    }, seconds * 1000);
    this.timer.unref();
  }
  stop() { clearInterval(this.timer); this.timer = undefined; this.loop.disable(); }

  line(seconds = 60) {
    const { rooms, players } = this.census();
    const active = this.busy || players > 0;
    const loop = { p99: this.loop.percentile(99) / 1e6, max: this.loop.max / 1e6 };
    const f = (n: number, d = 1) => n.toFixed(d);
    const mem = process.memoryUsage();
    const out = active
      ? `[net] ${seconds} s · ${rooms} room${rooms === 1 ? '' : 's'} ${players} player${players === 1 ? '' : 's'}`
        + ` · tick avg ${f(this.tick.n ? this.tick.sum / this.tick.n : 0)} p99 ${f(this.tick.quantile(.99))} max ${f(this.tick.max)} ms (${this.tick.n})`
        + ` · busy ${f(100 * this.tick.sum / (seconds * 1000), 0)} %`
        + ` · snapshots avg ${f(this.snapshots.n ? this.snapshots.sum / this.snapshots.n : 0)} p99 ${f(this.snapshots.quantile(.99))} max ${f(this.snapshots.max)} ms`
        + ` · event loop p99 ${f(loop.p99)} max ${f(loop.max)} ms`
        + ` · late steps ${this.late}, written off ${f(this.writtenOff, 0)}`
        + ` · rss ${f(mem.rss / 1048576, 0)} MB heap ${f(mem.heapUsed / 1048576, 0)} MB`
        + this.extra()
      : undefined;
    this.tick.reset(); this.snapshots.reset(); this.late = this.writtenOff = this.rejected = this.faults = 0;
    this.loop.reset(); this.busy = false;
    return out;
  }
}

export const netStats = new NetStats();
