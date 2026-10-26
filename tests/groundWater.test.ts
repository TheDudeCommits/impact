import fs from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LIQUID_FLOORS } from '../src/game/footing';
import { VfxKit } from '../src/render/vfx/VfxKit';
import { splashImpulse, subscribeSplashes } from '../src/render/ground/splashes';
import { waveConstants } from '../src/render/ground/waves';
import { waterGeometry, wallsFromModel, WaterSurface } from '../src/render/ground/water';
import { GroundFrame } from '../src/render/ground/frame';
import { shaderPatchKeys } from '../src/render/look/shaderPatch';
import { DENSITY, GroundField } from '../src/render/ground/mask';
import { VALLEY_WATER } from '../src/render/ground/places/valleyOfTheEnd';
import { SHRINE_WATER } from '../src/render/ground/places/malevolentShrine';
import { WaveField } from '../src/render/ground/waves';
import { STAGES } from '../src/game/stages';
import { GROUND_TIERS } from '../src/render/ground/quality';

describe('a splash', () => {
  it('reaches the ground\'s listeners from VfxKit.splash, and a listener that throws cannot break the spray', () => {
    const scene = new THREE.Scene(), kit = VfxKit.for(scene), heard: number[][] = [];
    const bad = () => { throw new Error('a broken listener'); };
    VfxKit.splashed.add(bad);
    const stop = subscribeSplashes((x, z, size, dx, dz) => heard.push([x, z, size, dx, dz]));
    try {
      kit.splash(1, 2, .5, 0);
      expect(heard).toHaveLength(0);
      VfxKit.setLiquid(scene, LIQUID_FLOORS['valley-of-the-end']);
      expect(() => kit.splash(1, 2, .5, 0, 1, 0)).not.toThrow();
      expect(heard).toEqual([[1, 2, .5, 1, 0]]);
      kit.groundImpact(3, 0, 4, 0, 1, 0, 3, 1);
      expect(heard.length).toBeGreaterThanOrEqual(2);
      expect(heard.at(-1)!.slice(0, 2)).toEqual([3, 4]);
    } finally {
      stop(); VfxKit.splashed.delete(bad);
      VfxKit.setLiquid(scene, undefined); kit.release();
    }
    const after = heard.length;
    VfxKit.splashed.forEach(l => expect(l).not.toBe(bad));
    expect(after).toBeGreaterThan(0);
  });

  it('is an additive hook in VfxKit, guarded against its listeners', () => {
    const source = fs.readFileSync('src/render/vfx/VfxKit.ts', 'utf8');
    expect(source).toContain('static readonly splashed');
    expect(source).toMatch(/for \(const listener of VfxKit\.splashed\) try \{/);
  });
});

describe('the wave field', () => {
  it('holds the explicit scheme stable at every tier (Courant under 1/sqrt 2) and loses its motion over time', () => {
    for (const q of ['high', 'medium'] as const) {
      const w = GROUND_TIERS[q].water;
      const k = waveConstants({ speed: VALLEY_WATER.speed!, damping: VALLEY_WATER.damping!, cell: w.cell, rate: w.rate });
      expect(k.courant, q).toBeLessThan(Math.SQRT1_2);
      expect(k.keep).toBeLessThan(1); expect(k.keep).toBeGreaterThan(.98);
      expect(Math.pow(k.keep, w.rate)).toBeCloseTo(1 - VALLEY_WATER.damping!, 2);
    }
    expect(waveConstants({ speed: 400, damping: .4, cell: .2, rate: 60 }).courant).toBeLessThan(Math.SQRT1_2);
  });

  it('kicks the water as hard at any step rate (a push is a change of speed: its depth over the step)', () => {
    const at = (rate: number) => waveConstants({ speed: 7, damping: .5, cell: .3, rate });
    const slow = at(60), fast = at(120);
    expect(fast.push).toBe(1);
    expect(slow.push).toBe(2);
    expect(slow.push / slow.dt).toBeCloseTo(fast.push / fast.dt, 6);
  });

  it('turns splashes into pushes that grow with them, thrown along their heading', () => {
    const step = splashImpulse(0, 0, .3), smash = splashImpulse(0, 0, 1.6), dash = splashImpulse(0, 0, .5, 1, 0);
    expect(smash.depth).toBeGreaterThan(step.depth * 4);
    expect(smash.radius).toBeGreaterThan(step.radius);
    expect(dash.x).toBeGreaterThan(0); expect(dash.z).toBe(0);
    expect(smash.depth).toBeLessThanOrEqual(.09);
  });

  it('meets the banks as walls: everything standing above the water, seen from above', () => {
    const field = new GroundField({ x0: -10, z0: -10, x1: 10, z1: 10 }, .5);
    wallsFromModel(field, [[5, 0, -10, 10, 3, -10, 5, 0, 10], [10, 3, -10, 10, 3, 10, 5, 0, 10], [-10, -1, -10, 10, -1, -10, -10, -1, 10]], 0, .15);
    expect(field.sample(DENSITY, 9, 0)).toBeGreaterThan(.5);
    expect(field.sample(DENSITY, 0, 0)).toBe(0);
    expect(field.sample(DENSITY, -8, 0)).toBe(0);
  });

  it('draws the waves on a place\'s own water surface: one more edit of its material, no new draw', () => {
    const material = new THREE.MeshStandardMaterial({ name: 'Material.010' });
    const river = new THREE.Mesh(new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2), material);
    const water = new WaterSurface(new GroundFrame(), { name: 'test river', level: 0, sim: { x0: -5, z0: -5, x1: 5, z1: 5 }, walls: () => {}, look: { crest: 0xffffff, foam: 0xffffff }, source: river });
    expect(water.mesh).toBe(river);
    expect(river.visible).toBe(true);
    expect(shaderPatchKeys(material)).toContain('ground-water-waves-v1');
    const shader = { uniforms: {} as Record<string, { value: unknown }>, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader, defines: {} };
    material.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);
    expect(shader.fragmentShader).toMatch(/float waterInside = step\( 0\., waterRel\.x \)/);
    expect(shader.fragmentShader).toContain('totalEmissiveRadiance = waterTone(');
    expect(shader.vertexShader + shader.fragmentShader).not.toContain('varying float vWaterInside');
    water.dispose();
  });

  it('draws a surface of its own dense over the simulated stretch and coarse beyond it', () => {
    const rect = { x0: -40, z0: -90, x1: 45, z1: 150 }, sim = VALLEY_WATER.sim;
    const g = waterGeometry(rect, sim, 0, .3);
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    let inside = 0;
    for (let i = 0; i < p.count; i++) if (p.getX(i) > sim.x0 && p.getX(i) < sim.x1 && p.getZ(i) > sim.z0 && p.getZ(i) < sim.z1) inside++;
    const area = (r: { x0: number; z0: number; x1: number; z1: number }) => (r.x1 - r.x0) * (r.z1 - r.z0);
    const dense = inside / area(sim), sparse = (p.count - inside) / (area(rect) - area(sim));
    expect(dense).toBeGreaterThan(sparse * 4);
    expect(dense).toBeCloseTo(1 / .3 ** 2, -1);
    g.computeBoundingBox();
    expect(g.boundingBox!.min.x).toBeCloseTo(rect.x0, 5); expect(g.boundingBox!.max.z).toBeCloseTo(rect.z1, 5);
    expect(VALLEY_WATER.sim.x0).toBeLessThan(-18); expect(VALLEY_WATER.sim.x1).toBeGreaterThan(18);
    expect(VALLEY_WATER.sim.z0).toBeLessThan(-45); expect(VALLEY_WATER.sim.z1).toBeGreaterThan(45);
  });
});

describe('the Malevolent Shrine\'s lake', () => {
  it('simulates the fight\'s whole square and its margins, open water on every side, in the domain\'s reds', () => {
    const { halfX, halfZ } = STAGES['malevolent-shrine'];
    const sim = SHRINE_WATER.sim;
    expect(sim.x0).toBeLessThan(-halfX); expect(sim.x1).toBeGreaterThan(halfX);
    expect(sim.z0).toBeLessThan(-halfZ); expect(sim.z1).toBeGreaterThan(halfZ);
    expect(SHRINE_WATER.open).toEqual([true, true, true, true]);
    expect(SHRINE_WATER.slope!).toBeLessThan(6);
    for (const q of ['high', 'medium'] as const) {
      const w = GROUND_TIERS[q].water;
      expect(waveConstants({ speed: SHRINE_WATER.speed!, damping: SHRINE_WATER.damping!, cell: w.cell, rate: w.rate }).courant).toBeLessThan(Math.SQRT1_2);
    }
  });

  it('soaks waves up at every open side of a field (a lake), not only a river\'s ends', () => {
    const walls = new THREE.DataTexture(new Uint8Array(4), 1, 1);
    const lake = new WaveField({ x0: -10, z0: -10, x1: 10, z1: 10 }, walls, { cell: .5, rate: 60, speed: 5, damping: .5, open: [true, true, true, true] });
    const river = new WaveField({ x0: -10, z0: -10, x1: 10, z1: 10 }, walls, { cell: .5, rate: 60, speed: 5, damping: .5, open: [true, true] });
    const open = (f: WaveField) => (f as unknown as { material: THREE.ShaderMaterial }).material.uniforms;
    expect(open(lake).uOpenX.value.toArray()).toEqual([1, 1]);
    expect(open(river).uOpenX.value.toArray()).toEqual([0, 0]);
    expect(open(river).uOpen.value.z).toBe(1); expect(open(river).uOpen.value.w).toBe(1);
    lake.dispose(); river.dispose(); walls.dispose();
  });
});
