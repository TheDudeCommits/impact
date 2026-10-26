import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DamageNumbers } from '../src/ui/DamageNumbers';
import { brushStroke, inkSplats } from '../src/ui/inkSplat';

type Stub = { style: Record<string, string>; textContent: string; innerHTML?: string; className?: string };
function stubbed<T>(run: (made: Stub[]) => T) {
  const made: Stub[] = [];
  const g = globalThis as unknown as { document?: unknown; innerWidth?: number; innerHeight?: number };
  const saved = { document: g.document, w: g.innerWidth, h: g.innerHeight };
  g.document = { createElement: () => { const e: Stub = { style: {}, textContent: '' }; made.push(e); return e; } };
  g.innerWidth = 1600; g.innerHeight = 900;
  try { return run(made); } finally { g.document = saved.document; g.innerWidth = saved.w; g.innerHeight = saved.h; }
}
const red = (rgb: string) => Number(/rgb\((\d+)/.exec(rgb)?.[1]);
const numbers = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

describe('ink damage counts', () => {
  it('prints chip damage on a small dark splat and a 200-point count on a big crimson one', () => {
    stubbed(made => {
      const counts = new DamageNumbers({ append() {} } as unknown as HTMLElement);
      counts.show(9, new THREE.Vector3(-2, 1, 0), false, undefined, 'chip');
      for (const damage of [60, 70, 80]) counts.show(damage, new THREE.Vector3(2, 1, 0), true, undefined, 'big');
      const shown = made.filter(e => e.style.display === 'block');
      expect(shown).toHaveLength(2);
      const [chip, big] = [...shown].sort((a, b) => parseFloat(a.style.fontSize) - parseFloat(b.style.fontSize));
      expect(parseFloat(big.style.fontSize)).toBeGreaterThan(parseFloat(chip.style.fontSize));
      expect(red(big.style.color), 'crimson against oxblood').toBeGreaterThan(red(chip.style.color) + 60);
    });
  });

  it('sizes a fractional damage total for the digits players see, including repeated modified hits', () => {
    stubbed(() => {
      const counts = new DamageNumbers({ append() {} } as unknown as HTMLElement);
      counts.show(9.360000000000001, new THREE.Vector3(), false, undefined, 'ward');
      const pool = (counts as unknown as {pool:{id?:string;across:number;total:number;size:number}[]}).pool;
      const ward = pool.find(n=>n.id==='ward')!;
      expect(ward.across, 'a nine-point chip must not cover the tower').toBeLessThan(100);
      for(let i=0;i<3;i++)counts.show(9.360000000000001,new THREE.Vector3(),false,undefined,'ward');
      expect(Math.round(ward.total)).toBe(37);
      expect(ward.across, 'fractional arithmetic never adds invisible digit columns').toBeLessThan(110);
      counts.show(200,new THREE.Vector3(),true,undefined,'heavy');
      expect(pool.find(n=>n.id==='heavy')!.across).toBeGreaterThan(ward.across);
    });
  });

  it('builds its sixteen counts once: no element is made per blow or per frame', () => {
    stubbed(made => {
      const counts = new DamageNumbers({ append() {} } as unknown as HTMLElement);
      expect(made).toHaveLength(16);
      const camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 100); camera.position.set(0, 1.5, -5); camera.lookAt(0, 1, 0); camera.updateMatrixWorld(true);
      for (let i = 0; i < 60; i++) { counts.show(10 + i, new THREE.Vector3(i % 5, 1, 0), i % 3 === 0, undefined, `v${i % 20}`); counts.update(camera); }
      expect(made).toHaveLength(16);
    });
  });
});

describe('the ink shapes', () => {
  it('draws several distinct splats, the same each time, inside their 100-unit box', () => {
    const shapes = inkSplats();
    expect(shapes.length).toBeGreaterThanOrEqual(4);
    expect(new Set(shapes).size).toBe(shapes.length);
    expect(inkSplats()).toBe(shapes);
    for (const d of shapes) {
      expect(d.startsWith('M')).toBe(true);
      for (const v of numbers(d)) expect(Math.abs(v)).toBeLessThanOrEqual(50);
    }
  });

  it('draws a brush stroke inside its 1000 by 200 box, the same for the same seed', () => {
    const d = brushStroke(3, .62), xy = numbers(d);
    expect(brushStroke(3, .62)).toBe(d);
    expect(brushStroke(4, .62)).not.toBe(d);
    for (let i = 0; i < xy.length; i += 2) { expect(xy[i]).toBeGreaterThanOrEqual(0); expect(xy[i]).toBeLessThanOrEqual(1000); expect(xy[i + 1]).toBeGreaterThanOrEqual(0); expect(xy[i + 1]).toBeLessThanOrEqual(200); }
  });
});
