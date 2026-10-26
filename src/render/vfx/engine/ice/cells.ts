import * as THREE from 'three';

/**
 * Sheet-ice plates, baked once into a small tileable texture: the floor's Voronoi read with one filtered tap instead of
 * a three-by-three search per pixel (measured: two nine-metre frozen floors cost the M4 about 1.5 ms a frame with
 * the search in the shader). Channels:
 *  R: the distance to the plate's edge (F2 - F1, 0 on a seam), over 0.5 cell;
 *  G: the plate's own random number (the thaw takes plates in this order);
 *  B: the distance to the plate's heart (F1), over 0.75 cell: a bevel to shade it by;
 *  A: a sparse sparkle, finer than the plates.
 * Eight plates across a tile, wrapped, so it repeats without a seam; mipmapped, so plates far off soften rather than
 * shimmer. Shared by every frozen floor; built on first use (at load, when the kit is made).
 */
export const CELLS_ACROSS = 8;
let shared: THREE.DataTexture | undefined;

export function iceCellTexture() {
  if (shared) return shared;
  const size = 256, n = CELLS_ACROSS, data = new Uint8Array(size * size * 4);
  const hash = (x: number, y: number, s: number) => { let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  // One site per grid cell, jittered; the grid wraps.
  const sx = new Float32Array(n * n), sy = new Float32Array(n * n), id = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const k = j * n + i; sx[k] = i + .12 + .76 * hash(i, j, 1); sy[k] = j + .12 + .76 * hash(i, j, 2); id[k] = hash(i, j, 3); }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const px = (x + .5) / size * n, py = (y + .5) / size * n, gx = Math.floor(px), gy = Math.floor(py);
    let f1 = 9, f2 = 9, nearest = 0;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const cx = gx + ox, cy = gy + oy, wx = ((cx % n) + n) % n, wy = ((cy % n) + n) % n, k = wy * n + wx;
      const dx = sx[k] + (cx - wx) - px, dy = sy[k] + (cy - wy) - py, d = Math.hypot(dx, dy);
      if (d < f1) { f2 = f1; f1 = d; nearest = k; } else if (d < f2) f2 = d;
    }
    const o = (y * size + x) * 4;
    data[o] = Math.round(Math.min(1, (f2 - f1) / .5) * 255);
    data[o + 1] = Math.round(id[nearest] * 255);
    data[o + 2] = Math.round(Math.min(1, f1 / .75) * 255);
    const sparkle = hash(x, y, 7);
    data[o + 3] = sparkle > .985 ? Math.round(155 + (sparkle - .985) / .015 * 100) : Math.round(sparkle * 60);
  }
  shared = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  shared.wrapS = shared.wrapT = THREE.RepeatWrapping;
  shared.magFilter = THREE.LinearFilter; shared.minFilter = THREE.LinearMipmapLinearFilter; shared.generateMipmaps = true;
  shared.colorSpace = THREE.NoColorSpace; shared.needsUpdate = true;
  shared.name = 'ice-cells';
  return shared;
}
