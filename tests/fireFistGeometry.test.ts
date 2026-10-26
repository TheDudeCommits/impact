import { BufferGeometry, Float32BufferAttribute, MeshBasicMaterial } from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { describe, expect, it } from 'vitest';
import { fireFistGeometry } from '../src/render/vfx/FireFistGeometry';

function hypotFist() {
  const material = new MeshBasicMaterial();
  const surface = new MarchingCubes(48, material, false, false, 16000);
  surface.isolation = 0;
  const lobes = [[0, -.1, -.2, .68, .47, .78], ...Array.from({ length: 4 }, (_, i) => [(i - 1.5) * .32, .18, .43, .20, .31, .39]), [.59, -.20, .02, .25, .25, .52], [0, -.10, -1.03, .40, .35, .73]];
  const size = 48, extent = 2.2;
  for (let z = 0; z < size; z++) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const px = (x / size * 2 - 1) * extent, py = (y / size * 2 - 1) * extent, pz = (z / size * 2 - 1) * extent;
    let distance = 10;
    for (const [cx, cy, cz, sx, sy, sz] of lobes) {
      const d = (Math.hypot((px - cx) / sx, (py - cy) / sy, (pz - cz) / sz) - 1) * Math.min(sx, sy, sz);
      const blend = Math.max(.08 - Math.abs(distance - d), 0) / .08;
      distance = Math.min(distance, d) - blend * blend * .08 * .25;
    }
    surface.field[x + y * size + z * size * size] = -distance;
  }
  surface.update();
  const geometry = new BufferGeometry();
  for (const name of ['position', 'normal']) {
    const attribute = surface.geometry.getAttribute(name);
    geometry.setAttribute(name, new Float32BufferAttribute(attribute.array.slice(0, surface.count * 3), 3));
  }
  geometry.scale(extent, extent, extent);
  geometry.computeBoundingSphere();
  surface.geometry.dispose(); material.dispose();
  return geometry;
}

describe('the fire fist geometry', () => {
  it('is the shape it always was, float for float', () => {
    const before = hypotFist(), now = fireFistGeometry();
    for (const name of ['position', 'normal']) expect(Array.from(now.getAttribute(name).array)).toEqual(Array.from(before.getAttribute(name).array));
    expect(now.getAttribute('position').count).toBe(8976);
    expect(now.boundingSphere!.center.toArray()).toEqual(before.boundingSphere!.center.toArray());
    expect(now.boundingSphere!.radius).toBe(before.boundingSphere!.radius);
  });

  it('gives every caller a geometry of its own, over its own arrays', () => {
    const a = fireFistGeometry(), b = fireFistGeometry();
    expect(a).not.toBe(b);
    expect(a.getAttribute('position').array).not.toBe(b.getAttribute('position').array);
    expect(a.boundingSphere).not.toBe(b.boundingSphere);
    a.dispose(); (a.getAttribute('position').array as Float32Array).fill(0);
    expect(Array.from(fireFistGeometry().getAttribute('position').array)).toEqual(Array.from(b.getAttribute('position').array));
  });
});
