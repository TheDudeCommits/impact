import { HORDE_CAPACITY, type Horde, type HordeEvent, type HordeEventKind } from './Horde';

export class HordeFrame {
  time = -Infinity;
  n = 0;
  readonly serial = new Uint32Array(HORDE_CAPACITY);
  readonly kind = new Uint8Array(HORDE_CAPACITY);
  readonly state = new Uint8Array(HORDE_CAPACITY);
  readonly move = new Uint8Array(HORDE_CAPACITY);
  readonly flags = new Uint16Array(HORDE_CAPACITY);
  readonly death = new Uint8Array(HORDE_CAPACITY);
  readonly gore = new Uint8Array(HORDE_CAPACITY);
  readonly x = new Float32Array(HORDE_CAPACITY);
  readonly y = new Float32Array(HORDE_CAPACITY);
  readonly z = new Float32Array(HORDE_CAPACITY);
  readonly yaw = new Float32Array(HORDE_CAPACITY);
  readonly hp = new Float32Array(HORDE_CAPACITY);
  readonly phase = new Float32Array(HORDE_CAPACITY);
  readonly span = new Float32Array(HORDE_CAPACITY);
  readonly hit = new Float32Array(HORDE_CAPACITY);
  readonly kx = new Float32Array(HORDE_CAPACITY);
  readonly kz = new Float32Array(HORDE_CAPACITY);
  readonly vy = new Float32Array(HORDE_CAPACITY);
  shots: { id: number; type: number; move: number; x: number; y: number; z: number; vx: number; vy: number; vz: number }[] = [];
  private readonly index = new Map<number, number>();

  find(serial: number): number | undefined { return this.index.get(serial); }

  capture(horde: Horde, time: number) {
    this.time = time;
    this.index.clear();
    let n = 0;
    const now = horde.now;
    for (let i = 0; i < horde.capacity; i++) {
      const state = horde.state[i];
      if (state === 0) continue;
      this.serial[n] = horde.serial[i]; this.kind[n] = horde.kind[i]; this.state[n] = state; this.move[n] = horde.move[i];
      this.flags[n] = horde.flags[i]; this.death[n] = horde.death[i]; this.gore[n] = horde.gore[i];
      this.x[n] = horde.x[i]; this.y[n] = horde.y[i]; this.z[n] = horde.z[i]; this.yaw[n] = horde.yaw[i];
      this.hp[n] = horde.maxHp[i] > 0 ? horde.hp[i] / horde.maxHp[i] : 0;
      this.phase[n] = now - horde.stateAt[i]; this.span[n] = horde.stateUntil[i] - horde.stateAt[i];
      this.hit[n] = Math.min(60, now - horde.hitAt[i]);
      this.kx[n] = horde.kx[i]; this.kz[n] = horde.kz[i]; this.vy[n] = horde.vy[i];
      this.index.set(this.serial[n], n);
      n++;
    }
    this.n = n;
    this.shots = [];
    for (const shot of horde.shots) if (shot.active) this.shots.push({ id: shot.id, type: shot.type, move: shot.move, x: shot.x, y: shot.y, z: shot.z, vx: shot.vx, vy: shot.vy, vz: shot.vz });
  }

  static readonly STRIDE = 32;

  pack(events: readonly HordeEvent[]): Uint8Array {
    const shots = Math.min(255, this.shots.length), evs = Math.min(255, events.length);
    const bytes = new Uint8Array(8 + 2 + this.n * HordeFrame.STRIDE + 1 + shots * 22 + 1 + evs * 20);
    const view = new DataView(bytes.buffer);
    view.setFloat64(0, this.time, true);
    view.setUint16(8, this.n, true);
    let o = 10;
    for (let i = 0; i < this.n; i++) {
      view.setUint32(o, this.serial[i], true); view.setUint8(o + 4, this.kind[i]); view.setUint8(o + 5, this.state[i]); view.setUint8(o + 6, this.move[i]);
      view.setUint8(o + 7, this.death[i] | (this.gore[i] << 4)); view.setUint16(o + 8, this.flags[i], true);
      view.setInt16(o + 10, q(this.x[i], 50), true); view.setInt16(o + 12, q(this.z[i], 50), true); view.setInt16(o + 14, q(this.y[i], 100), true);
      view.setUint8(o + 16, Math.round(((this.yaw[i] % TAU) + TAU) % TAU / TAU * 255)); view.setUint8(o + 17, Math.round(this.hp[i] * 255));
      view.setUint16(o + 18, Math.min(65535, Math.round(this.phase[i] * 1000)), true); view.setUint16(o + 20, Math.min(65535, Math.round(this.span[i] * 1000)), true);
      view.setUint16(o + 22, Math.min(65535, Math.round(this.hit[i] * 1000)), true);
      view.setInt16(o + 24, q(this.kx[i], 100), true); view.setInt16(o + 26, q(this.kz[i], 100), true); view.setInt16(o + 28, q(this.vy[i], 100), true);
      o += HordeFrame.STRIDE;
    }
    view.setUint8(o++, shots);
    for (let i = 0; i < shots; i++) {
      const s = this.shots[i];
      view.setUint32(o, s.id, true); view.setUint8(o + 4, s.type); view.setUint8(o + 5, s.move);
      view.setInt16(o + 6, q(s.x, 50), true); view.setInt16(o + 8, q(s.y, 100), true); view.setInt16(o + 10, q(s.z, 50), true);
      view.setInt16(o + 12, q(s.vx, 100), true); view.setInt16(o + 14, q(s.vy, 100), true); view.setInt16(o + 16, q(s.vz, 100), true);
      o += 22;
    }
    view.setUint8(o++, evs);
    for (let i = 0; i < evs; i++) {
      const e = events[i];
      view.setUint32(o, e.id, true); view.setUint8(o + 4, EVENT_KINDS.indexOf(e.kind)); view.setUint8(o + 5, e.type);
      view.setUint32(o + 6, e.serial, true); view.setInt16(o + 10, q(e.x, 50), true); view.setInt16(o + 12, q(e.y, 100), true); view.setInt16(o + 14, q(e.z, 50), true);
      view.setUint8(o + 16, e.value); view.setUint8(o + 17, e.extra & 255); view.setUint16(o + 18, Math.min(65535, Math.round((this.time - e.at) * 1000)), true);
      o += 20;
    }
    return bytes;
  }

  unpack(bytes: Uint8Array): HordeEvent[] {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.time = view.getFloat64(0, true);
    this.n = view.getUint16(8, true);
    this.index.clear();
    let o = 10;
    for (let i = 0; i < this.n; i++) {
      this.serial[i] = view.getUint32(o, true); this.kind[i] = view.getUint8(o + 4); this.state[i] = view.getUint8(o + 5); this.move[i] = view.getUint8(o + 6);
      const dg = view.getUint8(o + 7); this.death[i] = dg & 15; this.gore[i] = dg >> 4; this.flags[i] = view.getUint16(o + 8, true);
      this.x[i] = view.getInt16(o + 10, true) / 50; this.z[i] = view.getInt16(o + 12, true) / 50; this.y[i] = view.getInt16(o + 14, true) / 100;
      this.yaw[i] = view.getUint8(o + 16) / 255 * TAU; this.hp[i] = view.getUint8(o + 17) / 255;
      this.phase[i] = view.getUint16(o + 18, true) / 1000; this.span[i] = view.getUint16(o + 20, true) / 1000; this.hit[i] = view.getUint16(o + 22, true) / 1000;
      this.kx[i] = view.getInt16(o + 24, true) / 100; this.kz[i] = view.getInt16(o + 26, true) / 100; this.vy[i] = view.getInt16(o + 28, true) / 100;
      this.index.set(this.serial[i], i);
      o += HordeFrame.STRIDE;
    }
    const shots = view.getUint8(o++);
    this.shots = [];
    for (let i = 0; i < shots; i++) {
      this.shots.push({ id: view.getUint32(o, true), type: view.getUint8(o + 4), move: view.getUint8(o + 5), x: view.getInt16(o + 6, true) / 50, y: view.getInt16(o + 8, true) / 100,
        z: view.getInt16(o + 10, true) / 50, vx: view.getInt16(o + 12, true) / 100, vy: view.getInt16(o + 14, true) / 100, vz: view.getInt16(o + 16, true) / 100 });
      o += 22;
    }
    const count = view.getUint8(o++), events: HordeEvent[] = [];
    for (let i = 0; i < count; i++) {
      events.push({ id: view.getUint32(o, true), kind: EVENT_KINDS[view.getUint8(o + 4)] ?? 'bark', type: view.getUint8(o + 5), serial: view.getUint32(o + 6, true), slot: -1,
        x: view.getInt16(o + 10, true) / 50, y: view.getInt16(o + 12, true) / 100, z: view.getInt16(o + 14, true) / 50, value: view.getUint8(o + 16), extra: view.getUint8(o + 17),
        at: this.time - view.getUint16(o + 18, true) / 1000 });
      o += 20;
    }
    return events;
  }
}

const TAU = Math.PI * 2;
const EVENT_KINDS: HordeEventKind[] = ['spawn', 'death', 'windup', 'shot', 'slam', 'explode', 'bark', 'topple', 'mend', 'summon', 'block', 'guardbreak'];
const q = (value: number, scale: number) => Math.max(-32768, Math.min(32767, Math.round(value * scale)));

export class HordeFrames {
  readonly frames = Array.from({ length: 6 }, () => new HordeFrame());
  private head = 0;
  next(): HordeFrame { const frame = this.frames[this.head]; this.head = (this.head + 1) % this.frames.length; return frame; }
  clear() { for (const frame of this.frames) { frame.time = -Infinity; frame.n = 0; } }
  around(time: number): { a: HordeFrame; b: HordeFrame; alpha: number } | undefined {
    let a: HordeFrame | undefined, b: HordeFrame | undefined;
    for (const frame of this.frames) {
      if (!Number.isFinite(frame.time)) continue;
      if (frame.time <= time && (!a || frame.time > a.time)) a = frame;
      if (frame.time > time && (!b || frame.time < b.time)) b = frame;
    }
    if (!a && !b) return undefined;
    if (!a) return { a: b!, b: b!, alpha: 0 };
    if (!b) return { a, b: a, alpha: 0 };
    return { a, b, alpha: (time - a.time) / Math.max(1e-6, b.time - a.time) };
  }
}
