import { describe, expect, it, vi } from 'vitest';
import * as T from 'three';
import { creaseConcavity, creaseDepths } from '../src/render/look/crease';
import { applyToonShading, celUniforms, headWeights } from '../src/render/look/toonShading';

function sheet(f: (x: number, y: number) => number, nx = 24, ny = 12) {
  const positions: number[] = [], index: number[] = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) { const x = -1 + 2 * i / nx, y = j / ny; positions.push(x, y, f(x, y)); }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
    index.push(a, b, d, a, d, c);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); g.setIndex(index);
  return g;
}
const marked = (g: T.BufferGeometry) => { const d = creaseDepths(g), p = g.getAttribute('position'), out: [number, number][] = []; for (let i = 0; i < d.length; i++) if (d[i] > 0) out.push([p.getX(i), p.getY(i)]); return out; };

describe('the crease field (look/crease.ts)', () => {
  it('finds a valley fold and only the fold', () => {
    const fold = marked(sheet(x => .9 * Math.abs(x)));
    expect(fold.length).toBeGreaterThan(5);
    for (const [x] of fold) expect(Math.abs(x)).toBeLessThan(.09);
  });
  it('reads nothing on a flat sheet, a ridge or a ball', () => {
    expect(marked(sheet(() => 0))).toHaveLength(0);
    expect(marked(sheet(x => -.9 * Math.abs(x)))).toHaveLength(0);
    expect(creaseDepths(new T.SphereGeometry(1, 24, 16)).some(v => v > 0)).toBe(false);
  });
  it('is the same in any units, and ignores the seams a rip is split along', () => {
    const fold = (s: number) => { const g = sheet(x => .9 * Math.abs(x)); g.scale(s, s, s); return Array.from(creaseDepths(g)); };
    const cm = fold(100), m = fold(1);
    expect(cm.map(v => v > 0)).toEqual(m.map(v => v > 0));
    cm.forEach((v, i) => expect(v).toBeCloseTo(m[i], 4));
    const g = sheet(x => .9 * Math.abs(x)).toNonIndexed();
    const d = creaseDepths(g), p = g.getAttribute('position');
    let on = 0;
    for (let i = 0; i < d.length; i++) if (d[i] > 0) { on++; expect(Math.abs(p.getX(i))).toBeLessThan(.09); }
    expect(on).toBeGreaterThan(5);
  });
  it('never marks a whole triangle, even across a broad hollow', () => {
    const bowl = sheet((x, y) => 3 * (x * x + (y - .5) * (y - .5)), 16, 16);
    expect(Array.from(creaseConcavity(bowl)).filter(v => v > 0).length).toBeGreaterThan(50);
    const d = creaseDepths(bowl), index = bowl.getIndex()!;
    for (let t = 0; t < index.count; t += 3) expect(d[index.getX(t)] > 0 && d[index.getX(t + 1)] > 0 && d[index.getX(t + 2)] > 0).toBe(false);
  });
});

describe('the cel look rides on fighters only', () => {
  const skinned = (bones: number) => {
    const g = sheet(x => .9 * Math.abs(x)), p = g.getAttribute('position'), n = p.count;
    const joints = Array.from({ length: bones }, () => new T.Bone()), skeleton = new T.Skeleton(joints);
    const ids: number[] = [], weights: number[] = [];
    for (let i = 0; i < n; i++) { ids.push(Math.min(bones - 1, Math.floor((p.getX(i) + 1) / 2 * bones)), 0, 0, 0); weights.push(1, 0, 0, 0); }
    g.setAttribute('skinIndex', new T.Uint16BufferAttribute(ids, 4)); g.setAttribute('skinWeight', new T.Float32BufferAttribute(weights, 4));
    return { g, skeleton, head: joints[0] };
  };
  it('headWeights keeps the head weight first and adds the crease and the gate for a body', () => {
    const { g, skeleton, head } = skinned(6);
    const body = headWeights(g, skeleton, head), p = g.getAttribute('position');
    expect(body.itemSize).toBe(3);
    for (let i = 0; i < body.count; i++) { expect(body.getX(i)).toBe(p.getX(i) < -2 / 3 ? 1 : 0); expect(body.getY(i)).toBe(1); }
    expect(Array.from({ length: body.count }, (_, i) => body.getZ(i)).some(v => v === 1)).toBe(true);
    const horde = headWeights(g, skeleton, undefined);
    for (let i = 0; i < horde.count; i++) { expect(horde.getY(i)).toBe(0); expect(horde.getZ(i)).toBe(0); }
  });
  it('a rigid prop (a sword on one hand bone) takes the cel colour but no creases', () => {
    const { g, skeleton, head } = skinned(2);
    const prop = headWeights(g, skeleton, head);
    for (let i = 0; i < prop.count; i++) { expect(prop.getY(i)).toBe(1); expect(prop.getZ(i)).toBe(0); }
  });
  it('the toon patch carries the flattening, the painted ink and the crease ink', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const material = new T.MeshToonMaterial({ map: new T.Texture() });
      applyToonShading(material, 'body');
      const shader = { uniforms: {} as Record<string, T.IUniform>, vertexShader: T.ShaderLib.toon.vertexShader, fragmentShader: T.ShaderLib.toon.fragmentShader, defines: {} } as unknown as T.WebGLProgramParametersWithUniforms;
      material.onBeforeCompile(shader, {} as T.WebGLRenderer);
      expect(shader.vertexShader).toContain('vLookCel = lookHead.yz');
      expect(shader.fragmentShader).toContain('lookTexInk = smoothstep');
      expect(shader.fragmentShader).toContain('max( lookCreaseInk, lookTexInk )');
      for (const k of Object.keys(celUniforms)) expect(shader.uniforms[k], k).toBe((celUniforms as Record<string, T.IUniform>)[k]);
      expect(warn).not.toHaveBeenCalled();
    } finally { warn.mockRestore(); }
  });
});
