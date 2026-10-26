import * as THREE from 'three';
import type { Rect } from './mask';

export const CLUMP_ROW = 1024;

export function cellHash(i: number, j: number, salt: number) {
  let h = Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(j | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export interface ClumpBand { fadeIn: readonly [number, number]; fadeOut: readonly [number, number] }

export type ClumpWrite = 'grass' | 'fade';

export class ClumpGrid {
  readonly data: Float32Array;
  readonly count: number;
  readonly texture: THREE.DataTexture;
  readonly capacity: number;
  drawn = 0;
  private readonly slots: Float32Array;
  private readonly start: Uint32Array;
  private readonly minY: Float32Array;
  private readonly maxY: Float32Array;
  private readonly cols: number;
  private readonly rows: number;
  private readonly bx0: number;
  private readonly bz0: number;
  private readonly order: number[] = [];
  private readonly orderDistance: number[] = [];
  private readonly box = new THREE.Box3();

  constructor(o: { region: Rect; cell: number; block: number; salt: number; capacity: number; top: number;
    clump: (x: number, z: number, h1: number, h2: number) => number; floor: (x: number, z: number) => number }) {
    const { region, cell, block } = o;
    this.top = o.top;
    this.blockSize = block;
    this.bx0 = Math.floor(region.x0 / block) * block; this.bz0 = Math.floor(region.z0 / block) * block;
    this.cols = Math.max(1, Math.ceil((region.x1 - this.bx0) / block)); this.rows = Math.max(1, Math.ceil((region.z1 - this.bz0) / block));
    const i0 = Math.ceil(region.x0 / cell), i1 = Math.floor(region.x1 / cell) - 1, j0 = Math.ceil(region.z0 / cell), j1 = Math.floor(region.z1 / cell) - 1;
    let tmp = new Float32Array(1 << 16), tmpBlock = new Uint32Array(1 << 14), n = 0;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = (i + cellHash(i, j, o.salt)) * cell, z = (j + cellHash(i, j, o.salt + 1)) * cell;
      const size = o.clump(x, z, cellHash(i, j, o.salt + 2), cellHash(i, j, o.salt + 3));
      if (!(size > 0)) continue;
      if ((n + 1) * 5 > tmp.length) { const grown = new Float32Array(tmp.length * 2); grown.set(tmp); tmp = grown; }
      if (n + 1 > tmpBlock.length) { const grown = new Uint32Array(tmpBlock.length * 2); grown.set(tmpBlock); tmpBlock = grown; }
      const k = n * 5;
      tmp[k] = x; tmp[k + 1] = o.floor(x, z); tmp[k + 2] = z; tmp[k + 3] = size; tmp[k + 4] = cellHash(i, j, o.salt + 4);
      tmpBlock[n] = this.blockOf(x, z);
      n++;
    }
    this.count = n;
    const blocks = this.cols * this.rows;
    this.start = new Uint32Array(blocks + 1);
    for (let c = 0; c < n; c++) this.start[tmpBlock[c] + 1]++;
    for (let b = 0; b < blocks; b++) this.start[b + 1] += this.start[b];
    const cursor = this.start.slice(0, blocks);
    this.data = new Float32Array(n * 5);
    this.minY = new Float32Array(blocks).fill(Infinity); this.maxY = new Float32Array(blocks).fill(-Infinity);
    for (let c = 0; c < n; c++) {
      const b = tmpBlock[c], at = cursor[b]++ * 5;
      for (let k = 0; k < 5; k++) this.data[at + k] = tmp[c * 5 + k];
      const y = tmp[c * 5 + 1];
      if (y < this.minY[b]) this.minY[b] = y;
      if (y > this.maxY[b]) this.maxY[b] = y;
    }
    this.capacity = Math.max(CLUMP_ROW, Math.ceil(o.capacity / CLUMP_ROW) * CLUMP_ROW);
    this.slots = new Float32Array(this.capacity * 4);
    this.texture = new THREE.DataTexture(this.slots, CLUMP_ROW, this.capacity / CLUMP_ROW, THREE.RGBAFormat, THREE.FloatType);
    this.texture.minFilter = this.texture.magFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.name = 'ground clumps';
    this.texture.needsUpdate = true;
  }

  private readonly top: number;
  private readonly blockSize: number;

  private blockOf(x: number, z: number) {
    const c = Math.min(this.cols - 1, Math.max(0, Math.floor((x - this.bx0) / this.blockSize)));
    const r = Math.min(this.rows - 1, Math.max(0, Math.floor((z - this.bz0) / this.blockSize)));
    return r * this.cols + c;
  }

  cull(cx: number, cz: number, frustum: THREE.Frustum, band: ClumpBand, write: ClumpWrite, reach = .8) {
    const [fi0, fi1] = band.fadeIn, [fo0, fo1] = band.fadeOut, size = this.blockSize;
    const order = this.order, distance = this.orderDistance;
    order.length = 0; distance.length = 0;
    const c0 = Math.max(0, Math.floor((cx - fo1 - this.bx0) / size)), c1 = Math.min(this.cols - 1, Math.floor((cx + fo1 - this.bx0) / size));
    const r0 = Math.max(0, Math.floor((cz - fo1 - this.bz0) / size)), r1 = Math.min(this.rows - 1, Math.floor((cz + fo1 - this.bz0) / size));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const b = r * this.cols + c;
      if (this.start[b + 1] === this.start[b]) continue;
      const x0 = this.bx0 + c * size, z0 = this.bz0 + r * size, x1 = x0 + size, z1 = z0 + size;
      const nx = Math.max(x0 - cx, 0, cx - x1), nz = Math.max(z0 - cz, 0, cz - z1);
      const near = Math.sqrt(nx * nx + nz * nz);
      if (near > fo1 + reach) continue;
      const fx = Math.max(Math.abs(x0 - cx), Math.abs(x1 - cx)), fz = Math.max(Math.abs(z0 - cz), Math.abs(z1 - cz));
      if (Math.sqrt(fx * fx + fz * fz) < fi0 - reach) continue;
      this.box.min.set(x0 - reach, this.minY[b] - .1, z0 - reach); this.box.max.set(x1 + reach, this.maxY[b] + this.top + reach, z1 + reach);
      if (!frustum.intersectsBox(this.box)) continue;
      let k = order.length;
      order.push(b); distance.push(near);
      while (k > 0 && distance[k - 1] > near) { order[k] = order[k - 1]; distance[k] = distance[k - 1]; k--; }
      order[k] = b; distance[k] = near;
    }
    const planes = frustum.planes, data = this.data, slots = this.slots;
    const fadeIn = fi1 > fi0, inSpan = Math.max(fi1 - fi0, 1e-3), outSpan = Math.max(fo1 - fo0, 1e-3);
    let n = 0;
    outer: for (const b of order) {
      for (let k = this.start[b] * 5, end = this.start[b + 1] * 5; k < end; k += 5) {
        const x = data[k], y = data[k + 1], z = data[k + 2];
        const dx = x - cx, dz = z - cz, d = Math.sqrt(dx * dx + dz * dz);
        if (d > fo1 || d < fi0) continue;
        const lod = Math.min(fadeIn ? (d - fi0) / inSpan : 1, (fo1 - d) / outSpan);
        let share: number;
        if (write === 'grass') { share = (lod * 1.2 - data[k + 4]) * 5; if (share <= 0) continue; if (share > 1) share = 1; }
        else { share = Math.min(1, lod); if (share <= 0) continue; }
        const cy = y + this.top * .5, radius = this.top * .5 + reach;
        if (planes[0].normal.x * x + planes[0].normal.y * cy + planes[0].normal.z * z + planes[0].constant < -radius) continue;
        if (planes[1].normal.x * x + planes[1].normal.y * cy + planes[1].normal.z * z + planes[1].constant < -radius) continue;
        if (planes[2].normal.x * x + planes[2].normal.y * cy + planes[2].normal.z * z + planes[2].constant < -radius) continue;
        if (planes[3].normal.x * x + planes[3].normal.y * cy + planes[3].normal.z * z + planes[3].constant < -radius) continue;
        const s = n * 4;
        slots[s] = x; slots[s + 1] = y; slots[s + 2] = z;
        slots[s + 3] = data[k + 3] * (write === 'grass' ? .35 + .65 * share : share);
        if (++n >= this.capacity) break outer;
      }
    }
    this.drawn = n;
    if (n > 0) {
      const texture = this.texture;
      for (let row = 0; row * CLUMP_ROW < n; row++) texture.addUpdateRange(row * CLUMP_ROW * 4, Math.min(CLUMP_ROW, n - row * CLUMP_ROW) * 4);
      texture.needsUpdate = true;
    }
    return n;
  }

  dispose() { this.texture.dispose(); }
}

export const CLUMP_FETCH = `
uniform highp sampler2D uClumps;
vec4 groundClump() { return texelFetch( uClumps, ivec2( gl_InstanceID % ${CLUMP_ROW}, gl_InstanceID / ${CLUMP_ROW} ), 0 ); }`;
