import { afterEach, describe, expect, it, vi } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { Prediction } from '../src/game/prediction';
import { InputQueue } from '../src/server/InputQueue';
import { StepClock } from '../src/server/StepClock';
import { ArenaRoom } from '../src/server/ArenaRoom';
import { catchUp, INPUT_HZ } from '../src/game/catchUp';
import { DRAIN_ENGAGE, DRAIN_GENTLE, DRAIN_MAX, InputClock, QUEUE_TARGET, RATE_SLEW, REPORT_STALE, drainFor } from '../src/game/inputClock';
import type { GameSnapshot, PlayerInput } from '../src/game/types';

const TICK_MS = 1000 / 60;
const random = (seed: number) => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const command = (seq: number, more: Partial<PlayerInput> = {}): PlayerInput => ({ seq, moveX: 1, moveZ: 0, yaw: 0, ...more });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

function serverLoop(period: number, until: number, { hitches = [] as [number, number][], jitter = 0, colyseus = false } = {}) {
  const clock = new StepClock(60), next = random(3);
  let now = 0, steps = 0, acc = 0, previous = 0, most = 0;
  clock.advance(0);
  while (now < until) {
    now += period + (next() - .5) * jitter;
    for (const [start, length] of hitches) if (now > start && now < start + length) now = start + length;
    let ran = 0;
    if (colyseus) {
      acc += now - previous;
      while (acc >= TICK_MS && ran < 5) { acc -= TICK_MS; ran++; }
      if (ran === 5) acc = 0;
    } else {
      clock.advance(now);
      while (ran < StepClock.PER_CALLBACK && clock.take()) ran++;
    }
    previous = now; steps += ran; most = Math.max(most, ran);
  }
  return { steps, most, dropped: clock.dropped, owed: clock.owed };
}

describe('the server steps on real time', () => {
  it.each([0, .02, .05, .1])('steps sixty times a second when its timer fires %f late', slow => {
    const r = serverLoop(TICK_MS * (1 + slow), 60_000, { jitter: 3 });
    expect(r.steps).toBeGreaterThanOrEqual(3598);
    expect(r.steps).toBeLessThanOrEqual(3600);
  });

  it('keeps the steps a stall owes, where the Colyseus accumulator forgot them', () => {
    const hitches = Array.from({ length: 59 }, (_, i): [number, number] => [1000 * (i + 1) + 300, 120]);
    const colyseus = serverLoop(TICK_MS, 60_000, { hitches, colyseus: true });
    const ours = serverLoop(TICK_MS, 60_000, { hitches });
    expect(colyseus.steps / 60, 'Colyseus steps a second').toBeLessThan(57.5);
    expect(ours.steps).toBeGreaterThanOrEqual(3598);
    expect(ours.most, 'one callback never runs more than four').toBeLessThanOrEqual(StepClock.PER_CALLBACK);
    expect(ours.dropped).toBe(0);
  });

  it('writes off an absence rather than fast-forwarding through it', () => {
    const r = serverLoop(TICK_MS, 10_000, { hitches: [[3000, 2000]] });
    expect(r.dropped).toBeCloseTo(90, 0);
    expect(r.steps).toBeGreaterThanOrEqual(600 - 91);
    expect(r.steps).toBeLessThanOrEqual(600 - 89);
  });

  it('runs the room on that clock, each step after the timer callback', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'Date', 'performance'] });
    const room = new ArenaRoom(), ticks: number[] = [];
    let insideTimer = false;
    const setTimestep = room.setTimestep.bind(room);
    vi.spyOn(room, 'setTimestep').mockImplementation((callback, delay) => setTimestep(callback && (dt => { insideTimer = true; callback(dt); insideTimer = false; }), delay));
    room.setFixedTimestep(context => { expect(insideTimer, 'steps run from setImmediate, after the sockets are read').toBe(false); expect(context.dt).toBe(1 / 60); ticks.push(context.tick); });
    vi.advanceTimersByTime(10_000);
    expect(ticks.length).toBeGreaterThanOrEqual(598);
    expect(ticks.length).toBeLessThanOrEqual(600);
    expect(ticks.every((tick, i) => tick === i)).toBe(true);
    room.onDispose();
    const retired = ticks.length;
    vi.advanceTimersByTime(1000);
    expect(ticks.length, 'a disposed room stops stepping').toBe(retired);
    room.setTimestep();
  });
});

describe('the input queue reports its standing depth', () => {
  it('reads the warm buffer when fed one command a tick', () => {
    const queue = new InputQueue();
    for (let seq = 0; seq < 90; seq++) { queue.push(command(seq)); queue.take(); }
    expect(queue.low).toBe(InputQueue.BUFFER_TICKS);
    expect(QUEUE_TARGET).toBe(InputQueue.BUFFER_TICKS);
  });

  it('holds a starved tick for half a second, and a burst only once it has stood that long', () => {
    const queue = new InputQueue();
    let seq = 0;
    for (let t = 0; t < 60; t++) { queue.push(command(seq++)); queue.take(); }
    for (let t = 0; t < 12; t++) queue.take();
    expect(queue.low).toBe(0);
    for (let t = 0; t < 12; t++) queue.push(command(seq++));
    for (let t = 0; t < InputQueue.LOW_WINDOW - 1; t++) { queue.push(command(seq++)); queue.take(); expect(queue.low).toBe(0); }
    for (let t = 0; t < InputQueue.LOW_WINDOW; t++) { queue.push(command(seq++)); queue.take(); }
    expect(queue.low, 'the burst is standing delay now').toBe(queue.length + 1);
    expect(queue.low).toBeGreaterThanOrEqual(12);
    queue.clear();
    expect(queue.low).toBe(0);
  });
});

describe('the input clock drains without ever running ahead of real time', () => {
  it('asks for nothing within the hysteresis band, and 5-20% above it', () => {
    expect(drainFor(QUEUE_TARGET + DRAIN_ENGAGE - 1, false)).toBe(0);
    expect(drainFor(QUEUE_TARGET + DRAIN_ENGAGE, false)).toBeGreaterThan(DRAIN_GENTLE);
    expect(drainFor(QUEUE_TARGET + 1, true)).toBe(DRAIN_GENTLE);
    expect(drainFor(QUEUE_TARGET, true)).toBe(0);
    expect(drainFor(QUEUE_TARGET + 7, false)).toBe(DRAIN_MAX);
    expect(drainFor(59, true)).toBe(DRAIN_MAX);
    for (const junk of [NaN, -1, 0]) expect(drainFor(junk, true)).toBe(0);
  });

  it.each([60, 30, 20, 10, 5])('without a report it is catch-up at %i fps, tick for tick', fps => {
    const clock = new InputClock();
    let backlog = 0, expected = 0, got = 0;
    expect(clock.advance(1000)).toBe(1);
    for (let frame = 1; frame <= fps * 3; frame++) {
      const due = catchUp(backlog, 1 / fps); backlog = due.backlog; expected += due.steps;
      got += clock.advance(1000 + frame * 1000 / fps);
    }
    expect(Math.abs(got - expected)).toBeLessThanOrEqual(1);
    expect(got).toBeGreaterThanOrEqual(INPUT_HZ * 3 - 1);
  });

  it('never sends faster than real time, whatever the server reports', () => {
    const clock = new InputClock(), next = random(9);
    let sent = 0, now = 1000;
    for (let i = 0; i < 60 * 120; i++) {
      if (i % 2 === 0) clock.report([NaN, -3, 0, 2, 3, 4, 5, 9, 30, 60][Math.floor(next() * 10)]);
      now += TICK_MS * (.5 + next());
      sent += clock.advance(now);
      expect(clock.rate).toBeLessThanOrEqual(1);
      expect(clock.rate).toBeGreaterThanOrEqual(1 - DRAIN_MAX);
    }
    expect(sent).toBeLessThanOrEqual(Math.ceil((now - 1000) / TICK_MS) + 1);
  });

  it('eases into a fifth slower and back out, never stepping the rate', () => {
    const clock = new InputClock();
    let now = 1000, sent = 0, previous = 1, steepest = 0;
    const second = (report: number) => {
      let count = 0;
      for (let i = 0; i < 60; i++) {
        if (i % 2 === 0) clock.report(report);
        now += TICK_MS; count += clock.advance(now);
        steepest = Math.max(steepest, Math.abs(clock.rate - previous)); previous = clock.rate;
      }
      return count;
    };
    sent = second(QUEUE_TARGET + 20);
    expect(clock.rate).toBeCloseTo(1 - DRAIN_MAX, 6);
    expect(second(QUEUE_TARGET + 20)).toBeGreaterThanOrEqual(47);
    expect(sent).toBeGreaterThan(48);
    expect(second(QUEUE_TARGET)).toBeGreaterThan(55);
    expect(clock.rate).toBe(1);
    expect(steepest).toBeLessThanOrEqual(RATE_SLEW / INPUT_HZ + 1e-9);
  });

  it('stops withholding once the reports stop', () => {
    const clock = new InputClock();
    let now = 1000;
    for (let i = 0; i < 60; i++) { if (i % 2 === 0) clock.report(QUEUE_TARGET + 20); now += TICK_MS; clock.advance(now); }
    expect(clock.rate).toBeLessThan(1 - DRAIN_MAX / 2);
    for (let i = 0; i < 60 * (REPORT_STALE + 1 / RATE_SLEW / 2); i++) { now += TICK_MS; clock.advance(now); }
    expect(clock.rate).toBe(1);
  });

  it.each([60, 144])('draws a withheld tick stretched, not frozen, at %iHz', fps => {
    const server = new ArenaSimulation({ trainingBot: false }), prediction = new Prediction(), clock = new InputClock();
    server.addPlayer('me', 'naruto', 'Me', false, { x: 0, y: 0, z: 0 });
    prediction.start('me', server.snapshot(false, true));
    let seq = 0, previous: number | undefined, worst = 0, slowest = Infinity;
    try {
      for (let frame = 0; frame < fps * 4; frame++) {
        const now = 1000 + frame * 1000 / fps;
        if (frame % Math.round(fps / 30) === 0) clock.report(frame > fps && frame < fps * 3 ? QUEUE_TARGET + 10 : QUEUE_TARGET);
        const due = clock.advance(now);
        for (let i = 0; i < due; i++) prediction.submit(command(seq++));
        const shown = prediction.sample(1 / fps, server.getPlayer('me')!, clock.alpha(now))!;
        if (previous !== undefined && frame > fps / 2) {
          const step = shown.x - previous, expected = 7.5 / fps * clock.rate;
          worst = Math.max(worst, Math.abs(step - expected)); slowest = Math.min(slowest, step);
        }
        previous = shown.x;
      }
      expect(worst, 'drawn step against the dilated speed').toBeLessThan(1e-4);
      expect(slowest, 'no planted frame').toBeGreaterThan(7.5 / fps * (1 - DRAIN_MAX) * .99);
    } finally { prediction.stop(); server.dispose(); }
  });
});

interface Pattern {
  seconds: number;
  slow: number;
  keepsTime: boolean;
  stalls: number[]; stallMs: number;
  batchMs: number;
  jitterMs: number;
  hitches: number[]; hitchMs: number;
  latencyMs: number;
  fps: number;
}

function drive(p: Pattern) {
  const make = () => { const s = new ArenaSimulation({ trainingBot: false }); s.addPlayer('me', 'naruto', 'Me', false, { x: 0, y: 0, z: 0 }); return s; };
  const server = make(), ideal = make(), prediction = new Prediction(), queue = new InputQueue(), clock = new InputClock(), steps = new StepClock(60), next = random(5);
  prediction.start('me', server.snapshot(false, true));
  const up: { at: number; input: PlayerInput }[] = [], down: { at: number; s: GameSnapshot }[] = [];
  const lows: { at: number; low: number }[] = [];
  let seq = 0, rejected = 0, maxCorrection = 0, drawn = 0, idealPath = 0, lastUp = 0, lastDown = 0, stepped = 0;
  let shown: { x: number; z: number } | undefined;
  const walk = (n: number): PlayerInput => ({ seq: n, moveX: Math.cos(n * .01), moveZ: Math.sin(n * .01), yaw: 0 });
  const upload = (now: number) => {
    let at = now + p.latencyMs + next() * p.jitterMs;
    for (const start of p.stalls) if (at >= start && at < start + p.stallMs) at = start + p.stallMs;
    if (p.batchMs) at = Math.ceil(at / p.batchMs) * p.batchMs;
    return lastUp = Math.max(lastUp, at);
  };
  const client = (now: number, frame: boolean) => {
    while (down.length && down[0].at <= now) {
      const snapshot = down.shift()!.s;
      clock.report(snapshot.queued);
      const before = prediction.diagnostics.position!;
      prediction.reconcile(snapshot);
      const after = prediction.diagnostics.position!;
      maxCorrection = Math.max(maxCorrection, Math.hypot(before.x - after.x, before.y - after.y, before.z - after.z));
    }
    const due = clock.advance(now);
    for (let i = 0; i < due; i++) {
      const input = walk(seq++);
      prediction.submit(input);
      const was = ideal.getPlayer('me')!; const from = { x: was.x, z: was.z };
      ideal.submitInput('me', input); ideal.step();
      const is = ideal.getPlayer('me')!; if (seq > 60) idealPath += Math.hypot(is.x - from.x, is.z - from.z);
      up.push({ at: upload(now), input });
    }
    if (!frame) return;
    const body = prediction.sample(1 / p.fps, server.getPlayer('me')!, clock.alpha(now))!;
    if (shown && now > 1000) drawn += Math.hypot(body.x - shown.x, body.z - shown.z);
    shown = { x: body.x, z: body.z };
  };
  const step = (now: number) => {
    while (up.length && up[0].at <= now) if (!queue.push(up.shift()!.input)) rejected++;
    const input = queue.take();
    if (input) server.submitInput('me', input);
    server.step(1 / 60, new Set(input ? [] : ['me']));
    stepped++;
    lows.push({ at: now, low: queue.low });
    if (server.tick % 2 === 0) down.push({ at: lastDown = Math.max(lastDown, now + p.latencyMs + next() * p.jitterMs), s: { ...server.snapshot(false, true), queued: queue.low } });
  };
  const end = p.seconds * 1000;
  let timer = 0, frameAt = 0, serverAt = TICK_MS;
  steps.advance(0);
  try {
    for (let now = 0; now <= end; now += .25) {
      if (now >= timer) { client(now, false); timer += TICK_MS + (next() - .5) * 2; }
      if (now >= frameAt) { client(now, true); frameAt += 1000 / p.fps; }
      const blocked = p.hitches.some(start => now >= start && now < start + p.hitchMs);
      if (now >= serverAt && !blocked) {
        steps.advance(now);
        if (p.keepsTime) for (let k = 0; k < StepClock.PER_CALLBACK && steps.take(); k++) step(now);
        else step(now);
        serverAt = now + TICK_MS * (1 + p.slow);
      }
    }
    const fullSpeed = idealPath / (seq - 60) * 60;
    return { rejected, maxCorrection, lows, stepsPerSecond: stepped / p.seconds, speed: drawn / (p.seconds - 1) / fullSpeed, sent: seq };
  } finally { prediction.stop(); server.dispose(); ideal.dispose(); }
}

const WAN: Pattern = { seconds: 30, slow: 0, keepsTime: true, stalls: [2000, 5000], stallMs: 200, batchMs: 50, jitterMs: 12,
  hitches: [3500, 9000, 16000, 23000], hitchMs: 100, latencyMs: 30, fps: 60 };

describe('ordered input drains through bursts, stalls and a slow server loop', () => {
  it.each([.02, .05, .1])('settles within target+2 after 200 ms stalls with the server timer %f slow', slow => {
    const r = drive({ ...WAN, slow });
    const settled = r.lows.filter(s => s.at >= 5200 + 3500);
    expect(r.rejected, 'the 60-command cap is never reached').toBe(0);
    expect(Math.max(...settled.map(s => s.low)), 'standing depth after the last stall').toBeLessThanOrEqual(QUEUE_TARGET + 2);
    expect(r.maxCorrection, 'prediction corrections').toBeLessThan(.001);
    expect(r.stepsPerSecond).toBeGreaterThan(59.9);
    expect(r.speed, 'average drawn speed over the walk').toBeGreaterThan(.98);
    expect(r.speed).toBeLessThanOrEqual(1.001);
  });

  it('comes back within target+2 after every stall, at 144 Hz', () => {
    const stalls = [2000, 6000, 10000, 14000, 18000];
    const r = drive({ ...WAN, seconds: 22, fps: 144, slow: .05, stalls });
    expect(r.rejected).toBe(0);
    expect(r.maxCorrection).toBeLessThan(.001);
    for (const stall of stalls) {
      const after = r.lows.filter(s => s.at >= stall + 200 + 3000 && s.at < stall + 4000);
      expect(Math.max(...after.map(s => s.low)), `standing depth 3 s after the stall at ${stall} ms`).toBeLessThanOrEqual(QUEUE_TARGET + 2);
    }
  });

  it('without the drain, the same stalls would have stood for good', () => {
    const pinned = InputClock.prototype.report;
    vi.spyOn(InputClock.prototype, 'report').mockImplementation(function (this: InputClock) { pinned.call(this, undefined); });
    const r = drive({ ...WAN, slow: .05 });
    const settled = r.lows.filter(s => s.at >= 5200 + 3500);
    expect(Math.min(...settled.map(s => s.low))).toBeGreaterThan(QUEUE_TARGET + 6);
  });

  it('follows a server that cannot keep real time, instead of filling the queue to its cap', () => {
    const r = drive({ ...WAN, keepsTime: false, slow: .05, hitches: [] });
    const settled = r.lows.filter(s => s.at >= 10_000);
    expect(r.rejected).toBe(0);
    expect(r.maxCorrection).toBeLessThan(.001);
    expect(Math.max(...settled.map(s => s.low))).toBeLessThanOrEqual(QUEUE_TARGET + 4);
    expect(r.stepsPerSecond).toBeLessThan(57.5);
    expect(r.sent / 30).toBeLessThan(58);
  });
});
