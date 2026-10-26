import { STAGES, type StageId } from '../../game/stages';
import { PLAYER_RADIUS } from '../../game/moves';

export interface Rect { x0: number; z0: number; x1: number; z1: number }

export const DENSITY = 0, HEIGHT = 1, FLOWERS = 2, SPARE = 3;
export type Channel = typeof DENSITY | typeof HEIGHT | typeof FLOWERS | typeof SPARE;

export type Op = 'set' | 'max' | 'min' | 'mul';

export interface Shape { sd(x: number, z: number): number; bounds: Rect }

export const circle = (x: number, z: number, r: number): Shape => ({
  sd: (px, pz) => Math.hypot(px - x, pz - z) - r,
  bounds: { x0: x - r, z0: z - r, x1: x + r, z1: z + r },
});

export const box = (x: number, z: number, halfX: number, halfZ: number, rot = 0): Shape => {
  const c = Math.cos(rot), s = Math.sin(rot), reach = Math.hypot(halfX, halfZ);
  return {
    sd: (px, pz) => {
      const dx = px - x, dz = pz - z;
      const lx = Math.abs(dx * c - dz * s) - halfX, lz = Math.abs(dx * s + dz * c) - halfZ;
      return Math.hypot(Math.max(lx, 0), Math.max(lz, 0)) + Math.min(Math.max(lx, lz), 0);
    },
    bounds: { x0: x - reach, z0: z - reach, x1: x + reach, z1: z + reach },
  };
};

export const path = (points: readonly (readonly [number, number])[], width: number): Shape => {
  const half = width / 2;
  const xs = points.map(p => p[0]), zs = points.map(p => p[1]);
  return {
    sd: (px, pz) => {
      let best = Infinity;
      for (let i = 0; i + 1 < points.length; i++) {
        const [ax, az] = points[i], [bx, bz] = points[i + 1];
        const vx = bx - ax, vz = bz - az, wx = px - ax, wz = pz - az;
        const t = Math.max(0, Math.min(1, (wx * vx + wz * vz) / Math.max(vx * vx + vz * vz, 1e-9)));
        best = Math.min(best, Math.hypot(wx - vx * t, wz - vz * t));
      }
      return best - half;
    },
    bounds: { x0: Math.min(...xs) - half, z0: Math.min(...zs) - half, x1: Math.max(...xs) + half, z1: Math.max(...zs) + half },
  };
};

export const triangle = (a: readonly [number, number], b: readonly [number, number], c: readonly [number, number]): Shape => ({
  sd: (px, pz) => triangleDistance(px, pz, a, b, c),
  bounds: { x0: Math.min(a[0], b[0], c[0]), z0: Math.min(a[1], b[1], c[1]), x1: Math.max(a[0], b[0], c[0]), z1: Math.max(a[1], b[1], c[1]) },
});

function triangleDistance(px: number, pz: number, p0: readonly [number, number], p1: readonly [number, number], p2: readonly [number, number]) {
  const e0x = p1[0] - p0[0], e0z = p1[1] - p0[1], e1x = p2[0] - p1[0], e1z = p2[1] - p1[1], e2x = p0[0] - p2[0], e2z = p0[1] - p2[1];
  const v0x = px - p0[0], v0z = pz - p0[1], v1x = px - p1[0], v1z = pz - p1[1], v2x = px - p2[0], v2z = pz - p2[1];
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const t0 = clamp((v0x * e0x + v0z * e0z) / (e0x * e0x + e0z * e0z || 1)), t1 = clamp((v1x * e1x + v1z * e1z) / (e1x * e1x + e1z * e1z || 1)), t2 = clamp((v2x * e2x + v2z * e2z) / (e2x * e2x + e2z * e2z || 1));
  const q0x = v0x - e0x * t0, q0z = v0z - e0z * t0, q1x = v1x - e1x * t1, q1z = v1z - e1z * t1, q2x = v2x - e2x * t2, q2z = v2z - e2z * t2;
  const s = Math.sign(e0x * e2z - e0z * e2x);
  const d0 = q0x * q0x + q0z * q0z, d1 = q1x * q1x + q1z * q1z, d2 = q2x * q2x + q2z * q2z;
  const c0 = s * (v0x * e0z - v0z * e0x), c1 = s * (v1x * e1z - v1z * e1x), c2 = s * (v2x * e2z - v2z * e2x);
  return -Math.sqrt(Math.min(d0, d1, d2)) * Math.sign(Math.min(c0, c1, c2));
}

export function valueNoise(seed: number) {
  const hash = (x: number, z: number) => {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  return (x: number, z: number) => {
    const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
    const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
    const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
    return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
  };
}

export class GroundField {
  readonly width: number;
  readonly height: number;
  readonly data: Float32Array;
  constructor(readonly rect: Rect, readonly texel: number) {
    this.width = Math.max(2, Math.ceil((rect.x1 - rect.x0) / texel));
    this.height = Math.max(2, Math.ceil((rect.z1 - rect.z0) / texel));
    this.data = new Float32Array(this.width * this.height * 4);
  }

  centre(i: number, j: number): [number, number] {
    return [this.rect.x0 + (i + .5) * (this.rect.x1 - this.rect.x0) / this.width, this.rect.z0 + (j + .5) * (this.rect.z1 - this.rect.z0) / this.height];
  }

  fill(channel: Channel, value: number) {
    for (let k = channel; k < this.data.length; k += 4) this.data[k] = value;
    return this;
  }

  paint(channel: Channel, shape: Shape, value: number, op: Op = 'set', soft = .5) {
    const { x0, z0, x1, z1 } = shape.bounds, half = soft / 2;
    const sx = (this.rect.x1 - this.rect.x0) / this.width, sz = (this.rect.z1 - this.rect.z0) / this.height;
    const i0 = Math.max(0, Math.floor((x0 - half - this.rect.x0) / sx)), i1 = Math.min(this.width - 1, Math.ceil((x1 + half - this.rect.x0) / sx));
    const j0 = Math.max(0, Math.floor((z0 - half - this.rect.z0) / sz)), j1 = Math.min(this.height - 1, Math.ceil((z1 + half - this.rect.z0) / sz));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const [x, z] = this.centre(i, j);
      const d = shape.sd(x, z);
      const cover = half > 0 ? 1 - smooth(-half, half, d) : d <= 0 ? 1 : 0;
      if (cover <= 0) continue;
      const k = (j * this.width + i) * 4 + channel, v = this.data[k];
      this.data[k] = op === 'set' ? v + (value - v) * cover
        : op === 'max' ? Math.max(v, value * cover)
        : op === 'min' ? v + (Math.min(v, value) - v) * cover
        : v * (1 + (value - 1) * cover);
    }
    return this;
  }

  map(channel: Channel, f: (value: number, x: number, z: number) => number) {
    for (let j = 0; j < this.height; j++) for (let i = 0; i < this.width; i++) {
      const k = (j * this.width + i) * 4 + channel, [x, z] = this.centre(i, j);
      this.data[k] = f(this.data[k], x, z);
    }
    return this;
  }

  sample(channel: Channel, x: number, z: number) {
    const u = (x - this.rect.x0) / (this.rect.x1 - this.rect.x0) * this.width - .5, v = (z - this.rect.z0) / (this.rect.z1 - this.rect.z0) * this.height - .5;
    if (u < -.5 || v < -.5 || u > this.width - .5 || v > this.height - .5) return 0;
    const i = Math.max(0, Math.min(this.width - 2, Math.floor(u))), j = Math.max(0, Math.min(this.height - 2, Math.floor(v)));
    const fu = Math.max(0, Math.min(1, u - i)), fv = Math.max(0, Math.min(1, v - j));
    const at = (a: number, b: number) => this.data[(b * this.width + a) * 4 + channel];
    return (at(i, j) * (1 - fu) + at(i + 1, j) * fu) * (1 - fv) + (at(i, j + 1) * (1 - fu) + at(i + 1, j + 1) * fu) * fv;
  }

  share(channel: Channel, above = .5) {
    let n = 0;
    for (let k = channel; k < this.data.length; k += 4) if (this.data[k] >= above) n++;
    return n / (this.width * this.height);
  }

  bytes() {
    const out = new Uint8Array(this.data.length);
    for (let k = 0; k < this.data.length; k++) out[k] = Math.round(Math.max(0, Math.min(1, this.data[k])) * 255);
    return out;
  }
}

function smooth(a: number, b: number, x: number) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

export function paintTriangles(field: GroundField, channel: Channel, triangles: Iterable<readonly [number, number, number, number, number, number, number, number, number]>, value = 1) {
  const r = field.rect, sx = (r.x1 - r.x0) / field.width, sz = (r.z1 - r.z0) / field.height;
  for (const [ax, , az, bx, , bz, cx, , cz] of triangles) {
    const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(d) < 1e-12) continue;
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - r.x0) / sx)), i1 = Math.min(field.width - 1, Math.floor((Math.max(ax, bx, cx) - r.x0) / sx));
    const j0 = Math.max(0, Math.floor((Math.min(az, bz, cz) - r.z0) / sz)), j1 = Math.min(field.height - 1, Math.floor((Math.max(az, bz, cz) - r.z0) / sz));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = r.x0 + (i + .5) * sx, z = r.z0 + (j + .5) * sz;
      const w0 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, w1 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d;
      if (w0 < -1e-6 || w1 < -1e-6 || 1 - w0 - w1 < -1e-6) continue;
      field.data[(j * field.width + i) * 4 + channel] = value;
    }
  }
  return field;
}

export class TerrainField {
  readonly width: number;
  readonly height: number;
  readonly data: Float32Array;
  readonly laid: Uint8Array;
  constructor(readonly rect: Rect, readonly texel: number, fallback = 0) {
    this.width = Math.max(2, Math.ceil((rect.x1 - rect.x0) / texel));
    this.height = Math.max(2, Math.ceil((rect.z1 - rect.z0) / texel));
    this.data = new Float32Array(this.width * this.height).fill(fallback);
    this.laid = new Uint8Array(this.width * this.height);
  }

  lay(triangles: Iterable<readonly [number, number, number, number, number, number, number, number, number]>, up = .35, ceiling = Infinity) {
    const seen = new Uint8Array(this.width * this.height);
    const sx = (this.rect.x1 - this.rect.x0) / this.width, sz = (this.rect.z1 - this.rect.z0) / this.height;
    let laid = 0;
    for (const [ax, ay, az, bx, by, bz, cx, cy, cz] of triangles) {
      const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, len = Math.hypot(nx, ny, nz);
      if (len < 1e-9 || Math.abs(ny) / len < up) continue;
      const i0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - this.rect.x0) / sx)), i1 = Math.min(this.width - 1, Math.floor((Math.max(ax, bx, cx) - this.rect.x0) / sx));
      const j0 = Math.max(0, Math.floor((Math.min(az, bz, cz) - this.rect.z0) / sz)), j1 = Math.min(this.height - 1, Math.floor((Math.max(az, bz, cz) - this.rect.z0) / sz));
      const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(d) < 1e-12) continue;
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = this.rect.x0 + (i + .5) * sx, z = this.rect.z0 + (j + .5) * sz;
        const w0 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, w1 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d, w2 = 1 - w0 - w1;
        if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
        const y = w0 * ay + w1 * by + w2 * cy, k = j * this.width + i;
        if (y > ceiling) continue;
        if (!seen[k] || y > this.data[k]) { this.data[k] = y; if (!seen[k]) laid++; seen[k] = 1; this.laid[k] = 1; }
      }
    }
    return laid;
  }

  sample(x: number, z: number) {
    const u = (x - this.rect.x0) / (this.rect.x1 - this.rect.x0) * this.width - .5, v = (z - this.rect.z0) / (this.rect.z1 - this.rect.z0) * this.height - .5;
    const i = Math.max(0, Math.min(this.width - 2, Math.floor(u))), j = Math.max(0, Math.min(this.height - 2, Math.floor(v)));
    const fu = Math.max(0, Math.min(1, u - i)), fv = Math.max(0, Math.min(1, v - j));
    const at = (a: number, b: number) => this.data[b * this.width + a];
    return (at(i, j) * (1 - fu) + at(i + 1, j) * fu) * (1 - fv) + (at(i, j + 1) * (1 - fu) + at(i + 1, j + 1) * fu) * fv;
  }
}

export function spawnSeats(stage: StageId, count = 12): [number, number][] {
  const { halfX, halfZ, spawnRadius } = STAGES[stage];
  const radius = PLAYER_RADIUS * 2;
  const rx = Math.min(spawnRadius, halfX - radius), rz = Math.min(spawnRadius * halfZ / halfX, halfZ - radius);
  const seats: [number, number][] = [];
  const N = 96, arc = [0];
  for (let i = 1; i <= N; i++) { const a = (i - .5) / N * Math.PI * 2; arc.push(arc[i - 1] + Math.hypot(rx * Math.cos(a), rz * Math.sin(a)) * Math.PI * 2 / N); }
  for (let s = 0; s < count; s++) {
    let angle = s / count * Math.PI * 2;
    if (Math.abs(rx - rz) > 1e-6) {
      const want = s / count * arc[N];
      let i = 1; while (i < N && arc[i] < want) i++;
      angle = (i - 1 + (want - arc[i - 1]) / Math.max(arc[i] - arc[i - 1], 1e-9)) / N * Math.PI * 2;
    }
    seats.push([Math.sin(angle) * rx, Math.cos(angle) * rz]);
  }
  return seats;
}
