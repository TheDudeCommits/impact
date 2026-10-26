import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { compileShadowPrograms, introspectPrograms, type IntrospectableProgram } from '../src/render/programWarmup';

const program = (log: string[], name: string, fail = false): IntrospectableProgram => ({
  getUniforms: () => { log.push(`${name}.uniforms`); if (fail) throw new Error('context lost'); return {}; },
  getAttributes: () => { log.push(`${name}.attributes`); return {}; },
});

describe('introspectPrograms', () => {
  it('asks every program for its uniforms and its attributes, and says how many', () => {
    const log: string[] = [];
    expect(introspectPrograms({ info: { programs: [program(log, 'a'), program(log, 'b'), program(log, 'c')] } })).toBe(3);
    expect(log).toEqual(['a.uniforms', 'a.attributes', 'b.uniforms', 'b.attributes', 'c.uniforms', 'c.attributes']);
  });

  it('goes on past a program that cannot be asked, and has nothing to do for a renderer with no program list', () => {
    const log: string[] = [];
    expect(introspectPrograms({ info: { programs: [program(log, 'a'), program(log, 'lost', true), program(log, 'c')] } })).toBe(2);
    expect(log).toContain('c.attributes');
    expect(introspectPrograms({ info: { programs: null } })).toBe(0);
    expect(introspectPrograms({ info: { programs: [] } })).toBe(0);
  });

  it('is what GameRenderer.compileScene does once the compile is in: after the await, with every program the renderer holds', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../src/render/GameRenderer.ts'), 'utf8');
    const body = source.slice(source.indexOf('async compileScene('), source.indexOf('uploadTextures(root'));
    expect(body).toMatch(/await ready;[\s\S]*introspectPrograms\(this\.renderer\);/);
    expect(source).toMatch(/import \{[^}]*\bintrospectPrograms\b[^}]*\} from '\.\/programWarmup';/);
    expect(body).toMatch(/compileAsync\(root,this\.camera,this\.scene\);this\.compileShadows\(root\);\}[\s\S]*await ready;/);
  });
});

describe('compileShadowPrograms', () => {
  const fake = (enabled = true) => {
    const seen: { name: string; material: string; side: THREE.Side; map: boolean; alphaTest: number; skinned: boolean }[] = [];
    let lights: string[] = [], target: unknown;
    const renderer = {
      shadowMap: { enabled, type: THREE.PCFShadowMap }, localClippingEnabled: false,
      compile(scene: { traverse(v: (o: THREE.Object3D) => void): void }, _camera: THREE.Camera, targetScene: { traverseVisible(v: (o: THREE.Object3D) => void): void; isScene?: boolean }) {
        target = targetScene; lights = [];
        targetScene.traverseVisible(o => { if ((o as THREE.Light).isLight) lights.push(o.name); });
        scene.traverse(o => {
          const m = (o as THREE.Mesh).material as THREE.MeshDepthMaterial;
          seen.push({ name: o.name, material: m.type, side: m.side, map: !!m.map, alphaTest: m.alphaTest, skinned: !!(o as THREE.SkinnedMesh).isSkinnedMesh });
        });
      },
    };
    return { renderer: renderer as unknown as THREE.WebGLRenderer, seen, lights: () => lights, target: () => target };
  };
  const mesh = (name: string, material: THREE.Material, cast = true, skinned = false) => {
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
    const o = skinned ? new THREE.SkinnedMesh(geometry, material) : new THREE.Mesh(geometry, material);
    o.name = name; o.castShadow = cast; return o;
  };

  it('gives the keeper what the shadow map gives its own, a caster at a time, and puts each material back', () => {
    const scene = new THREE.Scene(), sun = new THREE.DirectionalLight(); sun.name = 'sun'; sun.castShadow = true; scene.add(sun);
    scene.fog = new THREE.Fog(0, 1, 2);
    const map = new THREE.Texture();
    const front = new THREE.MeshToonMaterial({ map }), double = new THREE.MeshToonMaterial({ map, side: THREE.DoubleSide }), clips = new THREE.MeshBasicMaterial({ map, alphaTest: .5 });
    const body = mesh('body', front, true, true), cloak = mesh('cloak', double, true, true), leaf = mesh('leaf', clips), floor = mesh('floor', new THREE.MeshBasicMaterial(), false);
    const hidden = new THREE.Group(); hidden.visible = false; hidden.add(mesh('form', double, true, true));
    scene.add(body, cloak, leaf, floor, hidden);
    const keeper = new THREE.MeshDepthMaterial(), f = fake();
    const n = compileShadowPrograms(f.renderer, scene, scene, new THREE.PerspectiveCamera(), keeper);
    expect(n).toBe(3);
    expect(f.seen).toEqual([
      { name: 'body', material: 'MeshDepthMaterial', side: THREE.BackSide, map: true, alphaTest: 0, skinned: true },
      { name: 'cloak', material: 'MeshDepthMaterial', side: THREE.DoubleSide, map: true, alphaTest: 0, skinned: true },
      { name: 'leaf', material: 'MeshDepthMaterial', side: THREE.BackSide, map: true, alphaTest: .5, skinned: false },
    ]);
    expect([body.material, cloak.material, leaf.material]).toEqual([front, double, clips]);
    expect(f.lights()).toEqual(['sun']);
    expect((f.target() as { isScene?: boolean }).isScene).toBeUndefined();
  });

  it("compiles a caster's own depth material where it has one, and nothing with shadows off", () => {
    const scene = new THREE.Scene(), own = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), body = mesh('body', new THREE.MeshToonMaterial(), true, true);
    body.customDepthMaterial = own; scene.add(body);
    const f = fake();
    expect(compileShadowPrograms(f.renderer, scene, scene, new THREE.PerspectiveCamera(), new THREE.MeshDepthMaterial())).toBe(1);
    expect(f.seen[0]).toMatchObject({ name: 'body', side: THREE.BackSide });
    expect(own.side).toBe(THREE.BackSide);
    const off = fake(false);
    expect(compileShadowPrograms(off.renderer, scene, scene, new THREE.PerspectiveCamera(), new THREE.MeshDepthMaterial())).toBe(0);
    expect(off.seen).toEqual([]);
  });
});
