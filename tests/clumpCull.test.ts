import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ClumpGrid, type ClumpBand, type ClumpWrite } from '../src/render/ground/clumps';

type Grid = Record<string, any>;
function hypotCull(g: Grid, cx: number, cz: number, frustum: THREE.Frustum, band: ClumpBand, write: ClumpWrite, reach = .8) {
  const [fi0, fi1] = band.fadeIn, [fo0, fo1] = band.fadeOut, size = g.blockSize;
  const order: number[] = [], distance: number[] = [], box = new THREE.Box3();
  const c0 = Math.max(0, Math.floor((cx - fo1 - g.bx0) / size)), c1 = Math.min(g.cols - 1, Math.floor((cx + fo1 - g.bx0) / size));
  const r0 = Math.max(0, Math.floor((cz - fo1 - g.bz0) / size)), r1 = Math.min(g.rows - 1, Math.floor((cz + fo1 - g.bz0) / size));
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const b = r * g.cols + c;
    if (g.start[b + 1] === g.start[b]) continue;
    const x0 = g.bx0 + c * size, z0 = g.bz0 + r * size, x1 = x0 + size, z1 = z0 + size;
    const nx = Math.max(x0 - cx, 0, cx - x1), nz = Math.max(z0 - cz, 0, cz - z1);
    const near = Math.hypot(nx, nz);
    if (near > fo1 + reach) continue;
    const fx = Math.max(Math.abs(x0 - cx), Math.abs(x1 - cx)), fz = Math.max(Math.abs(z0 - cz), Math.abs(z1 - cz));
    if (Math.hypot(fx, fz) < fi0 - reach) continue;
    box.min.set(x0 - reach, g.minY[b] - .1, z0 - reach); box.max.set(x1 + reach, g.maxY[b] + g.top + reach, z1 + reach);
    if (!frustum.intersectsBox(box)) continue;
    let k = order.length;
    order.push(b); distance.push(near);
    while (k > 0 && distance[k - 1] > near) { order[k] = order[k - 1]; distance[k] = distance[k - 1]; k--; }
    order[k] = b; distance[k] = near;
  }
  const planes = frustum.planes, data = g.data, slots = new Float32Array(g.capacity * 4);
  const fadeIn = fi1 > fi0, inSpan = Math.max(fi1 - fi0, 1e-3), outSpan = Math.max(fo1 - fo0, 1e-3);
  let n = 0;
  outer: for (const b of order) {
    for (let k = g.start[b] * 5, end = g.start[b + 1] * 5; k < end; k += 5) {
      const x = data[k], y = data[k + 1], z = data[k + 2];
      const d = Math.hypot(x - cx, z - cz);
      if (d > fo1 || d < fi0) continue;
      const lod = Math.min(fadeIn ? (d - fi0) / inSpan : 1, (fo1 - d) / outSpan);
      let share: number;
      if (write === 'grass') { share = (lod * 1.2 - data[k + 4]) * 5; if (share <= 0) continue; if (share > 1) share = 1; }
      else { share = Math.min(1, lod); if (share <= 0) continue; }
      const cy = y + g.top * .5, radius = g.top * .5 + reach;
      if (planes[0].normal.x * x + planes[0].normal.y * cy + planes[0].normal.z * z + planes[0].constant < -radius) continue;
      if (planes[1].normal.x * x + planes[1].normal.y * cy + planes[1].normal.z * z + planes[1].constant < -radius) continue;
      if (planes[2].normal.x * x + planes[2].normal.y * cy + planes[2].normal.z * z + planes[2].constant < -radius) continue;
      if (planes[3].normal.x * x + planes[3].normal.y * cy + planes[3].normal.z * z + planes[3].constant < -radius) continue;
      const s = n * 4;
      slots[s] = x; slots[s + 1] = y; slots[s + 2] = z;
      slots[s + 3] = data[k + 3] * (write === 'grass' ? .35 + .65 * share : share);
      if (++n >= g.capacity) break outer;
    }
  }
  return { n, slots };
}

describe('the ground clump cull', () => {
  it('writes exactly the clumps the Math.hypot cull wrote', () => {
    let seed = 7;
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const grid = new ClumpGrid({ region: { x0: -60, z0: -60, x1: 60, z1: 60 }, cell: .9, block: 8, salt: 3, capacity: 6000, top: 1.2,
      clump: (x, z, h1) => (Math.sin(x * .3) + Math.cos(z * .2) > -.6 ? .4 + h1 * .6 : 0), floor: (x, z) => Math.sin(x * .05) * .4 + Math.cos(z * .07) * .3 });
    const camera = new THREE.PerspectiveCamera(55, 16 / 9, .1, 300), frustum = new THREE.Frustum(), m = new THREE.Matrix4();
    const bands: ClumpBand[] = [{ fadeIn: [0, 0], fadeOut: [18, 26] }, { fadeIn: [4, 7], fadeOut: [30, 44] }, { fadeIn: [0, 0], fadeOut: [9, 12] }];
    let compared = 0, written = 0;
    for (let i = 0; i < 240; i++) {
      const cx = (random() - .5) * 140, cz = (random() - .5) * 140;
      camera.position.set(cx, 1 + random() * 6, cz); camera.lookAt(cx + Math.sin(random() * 7) * 10, random() * 2, cz + Math.cos(random() * 7) * 10); camera.updateMatrixWorld(true);
      frustum.setFromProjectionMatrix(m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      for (const band of bands) for (const write of ['grass', 'fade'] as const) {
        const n = grid.cull(cx, cz, frustum, band, write), expected = hypotCull(grid as unknown as Grid, cx, cz, frustum, band, write);
        expect(n).toBe(expected.n);
        expect(Array.from(grid.texture.image.data as Float32Array).slice(0, n * 4)).toEqual(Array.from(expected.slots.slice(0, n * 4)));
        compared++; written += n;
      }
    }
    expect(compared).toBe(1440);
    expect(written).toBeGreaterThan(100000);
  });
});
