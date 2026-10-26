import { describe, expect, it } from 'vitest';
import { paintSplats } from '../src/render/horde/Gore';

function hypotSplats() {
  const size = 256, half = size / 2;
  const data = new Uint8Array(size * size * 4);
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let cell = 0; cell < 4; cell++) {
    const ox = (cell % 2) * half, oy = Math.floor(cell / 2) * half;
    const lobes = Array.from({ length: 7 }, () => ({ a: rnd() * Math.PI * 2, r: .18 + rnd() * .16, w: .3 + rnd() * .5 }));
    const drops = Array.from({ length: 14 }, () => { const a = rnd() * Math.PI * 2, r = .3 + rnd() * .16; return { x: Math.cos(a) * r, y: Math.sin(a) * r, s: .015 + rnd() * .035 }; });
    for (let y = 0; y < half; y++) for (let x = 0; x < half; x++) {
      const u = (x + .5) / half * 2 - 1, v = (y + .5) / half * 2 - 1, r = Math.hypot(u, v), a = Math.atan2(v, u);
      let edge = .32;
      for (const lobe of lobes) edge += lobe.r * Math.pow(Math.max(0, Math.cos(a - lobe.a)), 8 / lobe.w) * .6;
      let value = Math.max(0, 1 - r / edge) * 1.3;
      for (const d of drops) value = Math.max(value, 1 - Math.hypot(u - d.x, v - d.y) / d.s);
      const i = ((oy + y) * size + ox + x) * 4, c = Math.round(Math.max(0, Math.min(1, value)) * 255);
      data[i] = data[i + 1] = data[i + 2] = c; data[i + 3] = 255;
    }
  }
  return data;
}

describe('the gore splats', () => {
  it('are painted byte for byte as they were', () => {
    const now = new Uint8Array(256 * 256 * 4); paintSplats(now);
    const before = hypotSplats();
    let differ = 0; for (let i = 0; i < now.length; i++) if (now[i] !== before[i]) differ++;
    expect(differ).toBe(0);
    expect(now.some(v => v > 0 && v < 255)).toBe(true);
  });
});
