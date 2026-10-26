import { monitorEventLoopDelay } from 'node:perf_hooks';
import { ARENAS_FULL_MESSAGE } from '../game/arenasFull';

export interface CapacityOptions {
  roomCap?: number;
  shed?: boolean;
  lagMs?: number;
  behindSeconds?: number;
  clearSeconds?: number;
}

export function capacityFromEnv(env: Record<string, string | undefined> = process.env, warn: (line: string) => void = line => console.warn(line)): Required<CapacityOptions> {
  const whole = (name: string, fallback: number) => {
    const raw = env[name];
    if (raw === undefined || raw === '') return fallback;
    const n = Number(raw);
    if (Number.isInteger(n) && n > 0) return n;
    warn(`[capacity] ${name}="${raw}" is not a whole number above zero: ignored${fallback ? ` (using ${fallback})` : ' (off)'}`);
    return fallback;
  };
  const rawShed = env.LOAD_SHED?.trim().toLowerCase();
  if (rawShed && !/^(1|true|on|yes|0|false|off|no)$/.test(rawShed)) warn(`[capacity] LOAD_SHED="${env.LOAD_SHED}" is not 1/true/on or 0/false/off: load shedding stays off`);
  return {
    roomCap: whole('ROOM_CAP', 0),
    shed: /^(1|true|on|yes)$/.test(rawShed ?? ''),
    lagMs: whole('LOAD_SHED_LAG_MS', 200),
    behindSeconds: whole('LOAD_SHED_SECONDS', 10),
    clearSeconds: whole('LOAD_SHED_CLEAR_SECONDS', 5),
  };
}

export class ArenasFullError extends Error {
  constructor(readonly why: 'cap' | 'load') { super(ARENAS_FULL_MESSAGE); this.name = 'ArenasFullError'; }
}

export class LoadGauge {
  behind = 0; calm = 0;
  shedding = false;
  constructor(readonly lagMs = 200, readonly behindSeconds = 10, readonly clearSeconds = 5) {}
  sample(writtenOff: number, stallMs: number): boolean {
    const behind = writtenOff > 0 || stallMs > this.lagMs;
    if (behind) { this.behind++; this.calm = 0; } else { this.calm++; this.behind = 0; }
    const was = this.shedding;
    if (!this.shedding && this.behind >= this.behindSeconds) this.shedding = true;
    else if (this.shedding && this.calm >= this.clearSeconds) this.shedding = false;
    return was !== this.shedding;
  }
}

export class Capacity {
  roomCap: number;
  readonly shed: boolean;
  readonly gauge: LoadGauge;
  private readonly live = new Set<object>();
  refusedCap = 0; refusedLoad = 0; refusedTotal = 0;
  private lastWrittenOff = 0;
  private timer?: ReturnType<typeof setInterval>;
  private loop?: ReturnType<typeof monitorEventLoopDelay>;
  private lastRefusalLog = -Infinity;

  constructor(options: CapacityOptions = {}, private readonly log: (line: string) => void = line => console.log(line), private readonly clock: () => number = () => performance.now()) {
    this.roomCap = options.roomCap ?? 0;
    this.shed = options.shed === true;
    this.gauge = new LoadGauge(options.lagMs, options.behindSeconds, options.clearSeconds);
  }

  get armed() { return this.roomCap > 0 || this.shed; }
  get rooms() { return this.live.size; }
  get shedding() { return this.shed && this.gauge.shedding; }

  why(): 'cap' | 'load' | undefined {
    if (this.roomCap > 0 && this.live.size >= this.roomCap) return 'cap';
    if (this.shedding) return 'load';
    return undefined;
  }

  admit(room: object): void {
    if (this.live.has(room)) return;
    const why = this.why();
    if (why) {
      if (why === 'cap') this.refusedCap++; else this.refusedLoad++;
      this.refusedTotal++;
      const now = this.clock();
      if (now - this.lastRefusalLog >= 10_000) {
        this.lastRefusalLog = now;
        this.log(`[capacity] a new room was refused (${why === 'cap' ? `ROOM_CAP ${this.roomCap} reached, ${this.live.size} live` : `the server has been behind for ${this.gauge.behind} s, ${this.live.size} live`}); refused so far: ${this.refusedTotal}`);
      }
      throw new ArenasFullError(why);
    }
    this.live.add(room);
  }

  release(room: object): void { this.live.delete(room); }

  tickSecond(writtenOffTotal: number, stallMs: number): void {
    const wrote = Math.max(0, writtenOffTotal - this.lastWrittenOff);
    this.lastWrittenOff = writtenOffTotal;
    if (!this.gauge.sample(wrote, stallMs)) return;
    this.log(this.gauge.shedding
      ? `[capacity] LOAD SHEDDING ON: the server has been behind for ${this.gauge.behind} s in a row (steps written off ${wrote}, event loop stalled ${stallMs.toFixed(0)} ms); new rooms are refused until it has been calm for ${this.gauge.clearSeconds} s. Running matches are untouched. ${this.live.size} live`
      : `[capacity] load shedding off: calm for ${this.gauge.clearSeconds} s; new rooms are accepted again. ${this.live.size} live`);
  }

  start(writtenOff: () => number): void {
    if (!this.shed || this.timer) return;
    this.loop = monitorEventLoopDelay({ resolution: 10 });
    this.loop.enable();
    this.lastWrittenOff = writtenOff();
    this.timer = setInterval(() => {
      const stall = this.loop!.max / 1e6;
      this.loop!.reset();
      this.tickSecond(writtenOff(), Number.isFinite(stall) ? stall : 0);
    }, 1000);
    this.timer.unref();
  }
  stop(): void { clearInterval(this.timer); this.timer = undefined; this.loop?.disable(); this.loop = undefined; }

  report(): string {
    if (!this.armed) return '';
    const parts = [
      this.roomCap > 0 ? `cap ${this.rooms}/${this.roomCap}` : `rooms ${this.rooms}`,
      this.shed ? (this.shedding ? `SHEDDING (behind ${this.gauge.behind} s)` : 'shed idle') : 'shed off',
      `refused ${this.refusedCap + this.refusedLoad}${this.refusedCap + this.refusedLoad ? ` (cap ${this.refusedCap}, load ${this.refusedLoad})` : ''}`,
    ];
    this.refusedCap = this.refusedLoad = 0;
    return ` · valve ${parts.join(', ')}`;
  }
}

export const capacity = new Capacity(capacityFromEnv());
