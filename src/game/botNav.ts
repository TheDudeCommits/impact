import { stageColliders, type EnvironmentCollider } from './environmentLayout';
import { PLAYER_RADIUS } from './moves';
import { STAGES, type StageId } from './stages';

export const NAV_CELL = 1;
const STEP = .35;
const HEAD = 1.8;
const CLEAR = PLAYER_RADIUS + .05;
const FLOOR_TOL = .3;
const BUDGET = 14000;
const SQRT2 = Math.SQRT2;

export interface Point { x: number; z: number }

export class NavGrid {
  readonly nx: number;
  readonly nz: number;
  readonly x0: number;
  readonly z0: number;
  readonly open: Uint8Array;
  private readonly g: Float32Array;
  private readonly from: Int32Array;
  private readonly seen: Uint32Array;
  private readonly shut: Uint32Array;
  private stamp = 0;
  private heap: number[] = [];
  private heapF: number[] = [];

  private constructor(readonly stage: StageId, nx: number, nz: number, x0: number, z0: number, open: Uint8Array) {
    this.nx = nx; this.nz = nz; this.x0 = x0; this.z0 = z0; this.open = open;
    const n = nx * nz;
    this.g = new Float32Array(n); this.from = new Int32Array(n); this.seen = new Uint32Array(n); this.shut = new Uint32Array(n);
  }

  private static readonly built = new Map<StageId, NavGrid>();
  static for(stage: StageId): NavGrid {
    let grid = NavGrid.built.get(stage);
    if (!grid) { grid = NavGrid.build(stage); NavGrid.built.set(stage, grid); }
    return grid;
  }

  static build(stage: StageId): NavGrid {
    const { halfX, halfZ } = STAGES[stage];
    const nx = Math.ceil(2 * halfX / NAV_CELL), nz = Math.ceil(2 * halfZ / NAV_CELL);
    const x0 = -halfX, z0 = -halfZ;
    const floor = new Uint8Array(nx * nz), blocked = new Uint8Array(nx * nz);
    const { floor: floors, walls, landmarks } = stageColliders(stage);
    const span = (lo: number, hi: number, origin: number, count: number): [number, number] =>
      [Math.max(0, Math.ceil((lo - origin) / NAV_CELL - .5)), Math.min(count - 1, Math.floor((hi - origin) / NAV_CELL - .5))];
    const paint = (b: EnvironmentCollider, pad: number, into: Uint8Array) => {
      const [i0, i1] = span(b.x - b.halfX - pad, b.x + b.halfX + pad, x0, nx);
      const [j0, j1] = span(b.z - b.halfZ - pad, b.z + b.halfZ + pad, z0, nz);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        if (pad > 0) {
          const cx = x0 + (i + .5) * NAV_CELL, cz = z0 + (j + .5) * NAV_CELL;
          const dx = Math.max(0, Math.abs(cx - b.x) - b.halfX), dz = Math.max(0, Math.abs(cz - b.z) - b.halfZ);
          if (dx * dx + dz * dz > pad * pad) continue;
        }
        into[j * nx + i] = 1;
      }
    };
    for (const b of floors) if (Math.abs(b.y + b.halfY) <= FLOOR_TOL) paint(b, 0, floor);
    for (const b of [...walls, ...landmarks]) {
      const bottom = b.y - b.halfY, top = b.y + b.halfY;
      if (top <= STEP && top >= -FLOOR_TOL - .05) paint(b, 0, floor);
      else if (bottom < HEAD && top > STEP) paint(b, CLEAR, blocked);
    }
    const open = new Uint8Array(nx * nz);
    for (let k = 0; k < open.length; k++) open[k] = floor[k] && !blocked[k] ? 1 : 0;
    return new NavGrid(stage, nx, nz, x0, z0, open);
  }

  cellOf(x: number, z: number): number {
    const i = Math.floor((x - this.x0) / NAV_CELL), j = Math.floor((z - this.z0) / NAV_CELL);
    return i < 0 || j < 0 || i >= this.nx || j >= this.nz ? -1 : j * this.nx + i;
  }
  centreX(cell: number) { return this.x0 + (cell % this.nx + .5) * NAV_CELL; }
  centreZ(cell: number) { return this.z0 + (Math.floor(cell / this.nx) + .5) * NAV_CELL; }
  walkable(x: number, z: number) { const c = this.cellOf(x, z); return c >= 0 && this.open[c] === 1; }

  nearestOpen(cell: number, radius = 3): number {
    if (cell < 0) return -1;
    if (this.open[cell]) return cell;
    const ci = cell % this.nx, cj = Math.floor(cell / this.nx);
    for (let r = 1; r <= radius; r++) {
      let best = -1, bestD = Infinity;
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const i = ci + di, j = cj + dj;
        if (i < 0 || j < 0 || i >= this.nx || j >= this.nz || !this.open[j * this.nx + i]) continue;
        const d = di * di + dj * dj;
        if (d < bestD) { bestD = d; best = j * this.nx + i; }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  clear(ax: number, az: number, bx: number, bz: number): boolean {
    const length = Math.hypot(bx - ax, bz - az), steps = Math.max(1, Math.ceil(length / (NAV_CELL * .5)));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps, c = this.cellOf(ax + (bx - ax) * t, az + (bz - az) * t);
      if (c < 0 || !this.open[c]) return false;
    }
    return true;
  }

  path(fromX: number, fromZ: number, toX: number, toZ: number): number[] | null {
    const start = this.nearestOpen(this.cellOf(fromX, fromZ), 3), goal = this.nearestOpen(this.cellOf(toX, toZ), 2);
    if (start < 0 || goal < 0) return null;
    if (start === goal) return [goal];
    const { nx, nz, open, g, from, seen, shut } = this;
    const stamp = ++this.stamp;
    const gi = goal % nx, gj = Math.floor(goal / nx);
    const h = (c: number) => { const di = Math.abs(c % nx - gi), dj = Math.abs(Math.floor(c / nx) - gj); return Math.max(di, dj) + (SQRT2 - 1) * Math.min(di, dj); };
    this.heap.length = 0; this.heapF.length = 0;
    g[start] = 0; from[start] = -1; seen[start] = stamp;
    this.push(start, h(start));
    let expanded = 0;
    while (this.heap.length) {
      const c = this.pop();
      if (shut[c] === stamp) continue;
      shut[c] = stamp;
      if (c === goal) break;
      if (++expanded > BUDGET) return null;
      const ci = c % nx, cj = Math.floor(c / nx);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const i = ci + di, j = cj + dj;
        if (i < 0 || j < 0 || i >= nx || j >= nz) continue;
        const n = j * nx + i;
        if (!open[n] || shut[n] === stamp) continue;
        if (di && dj && (!open[cj * nx + i] || !open[j * nx + ci])) continue;
        const cost = g[c] + (di && dj ? SQRT2 : 1);
        if (seen[n] === stamp && cost >= g[n]) continue;
        seen[n] = stamp; g[n] = cost; from[n] = c;
        this.push(n, cost + h(n));
      }
    }
    if (shut[goal] !== stamp) return null;
    const route: number[] = [];
    for (let c = goal; c !== -1; c = from[c]) route.push(c);
    return route.reverse();
  }

  length(route: readonly number[]): number {
    let total = 0;
    for (let k = 1; k < route.length; k++) total += Math.hypot(this.centreX(route[k]) - this.centreX(route[k - 1]), this.centreZ(route[k]) - this.centreZ(route[k - 1]));
    return total;
  }

  steer(route: readonly number[], x: number, z: number, look = 10): { x: number; z: number; index: number } {
    let at = 0, near = Infinity;
    for (let k = 0; k < route.length; k++) {
      const d = Math.hypot(this.centreX(route[k]) - x, this.centreZ(route[k]) - z);
      if (d < near) { near = d; at = k; }
    }
    let pick = Math.min(route.length - 1, at + 1);
    for (let k = Math.min(route.length - 1, at + look); k > at; k--) {
      if (this.clear(x, z, this.centreX(route[k]), this.centreZ(route[k]))) { pick = k; break; }
    }
    return { x: this.centreX(route[pick]), z: this.centreZ(route[pick]), index: pick };
  }

  private push(cell: number, f: number) {
    const heap = this.heap, fs = this.heapF;
    heap.push(cell); fs.push(f);
    let k = heap.length - 1;
    while (k > 0) {
      const parent = (k - 1) >> 1;
      if (fs[parent] < fs[k] || fs[parent] === fs[k] && heap[parent] <= heap[k]) break;
      [heap[parent], heap[k]] = [heap[k], heap[parent]]; [fs[parent], fs[k]] = [fs[k], fs[parent]];
      k = parent;
    }
  }
  private pop(): number {
    const heap = this.heap, fs = this.heapF, top = heap[0];
    const lastC = heap.pop()!, lastF = fs.pop()!;
    if (heap.length) {
      heap[0] = lastC; fs[0] = lastF;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1, r = l + 1;
        let m = k;
        const less = (a: number, b: number) => fs[a] < fs[b] || fs[a] === fs[b] && heap[a] < heap[b];
        if (l < heap.length && less(l, m)) m = l;
        if (r < heap.length && less(r, m)) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]]; [fs[m], fs[k]] = [fs[k], fs[m]];
        k = m;
      }
    }
    return top;
  }
}
