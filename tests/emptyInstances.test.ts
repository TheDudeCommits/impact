import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { WebGLBufferRenderer } from 'three/src/renderers/webgl/WebGLBufferRenderer.js';
import { WebGLIndexedBufferRenderer } from 'three/src/renderers/webgl/WebGLIndexedBufferRenderer.js';
import { EmptyInstances, isEmpty, sceneShown } from '../src/render/emptyInstances';


const pool = (count: number, capacity = 8) => { const m = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), capacity); m.count = count; return m; };
const instancedGeometryMesh = (instanceCount: number) => { const g = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry() as unknown as THREE.InstancedBufferGeometry); g.instanceCount = instanceCount; return new THREE.Mesh(g, new THREE.MeshBasicMaterial()); };
const camera = new THREE.PerspectiveCamera();

describe('the empty instanced meshes are left out of the frame\'s draw', () => {
  it('takes out of the lists exactly the shown, empty instanced meshes without draw callbacks, and gives every mask back', () => {
    const scene = new THREE.Scene();
    const empty = pool(0), full = pool(3), hidden = pool(0), group = new THREE.Group(), nested = pool(0), geometryEmpty = instancedGeometryMesh(0), geometryFull = instancedGeometryMesh(2);
    const marked = pool(0); marked.onAfterRender = () => {};
    const primed = pool(0); primed.onBeforeRender = () => {};
    const layered = pool(0); layered.layers.set(5);
    const plainMesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    hidden.visible = false; group.add(nested);
    scene.add(empty, full, hidden, group, geometryEmpty, geometryFull, marked, primed, layered, plainMesh);
    const masks = () => [empty, full, hidden, nested, geometryEmpty, geometryFull, marked, primed, layered, plainMesh].map(o => o.layers.mask);
    const before = masks();
    const gate = new EmptyInstances(scene);
    expect(gate.hold()).toBe(0); gate.release();
    expect(masks()).toEqual(before);
    expect(gate.hold()).toBe(4);
    for (const o of [empty, nested, geometryEmpty, layered]) { expect(o.layers.mask).toBe(0); expect(o.layers.test(camera.layers)).toBe(false); }
    for (const o of [full, hidden, geometryFull, marked, primed, plainMesh]) expect(o.layers.test(camera.layers) || !o.visible).toBe(true);
    gate.release();
    expect(masks()).toEqual(before);
    expect(layered.layers.mask).toBe(1 << 5);
  });

  it('walks again on the frame after a part of the scene is shown (an effect space for a cast), not a second later', () => {
    const scene = new THREE.Scene(), space = new THREE.Group(), empty = pool(0);
    space.visible = false; space.add(empty); scene.add(space);
    const gate = new EmptyInstances(scene, 60);
    expect(gate.hold()).toBe(0); gate.release();
    space.visible = true;
    expect(gate.hold()).toBe(0); gate.release();
    sceneShown();
    expect(gate.hold()).toBe(0); gate.release();
    expect(gate.hold()).toBe(1); expect(empty.layers.mask).toBe(0); gate.release();
    expect(empty.layers.mask).toBe(1);
  });

  it('decides every frame from the counts as they are then, and finds new meshes at the next walk', () => {
    const scene = new THREE.Scene(), a = pool(0);
    scene.add(a);
    const gate = new EmptyInstances(scene, 3);
    expect(gate.hold()).toBe(0); gate.release();
    a.count = 2;
    expect(gate.hold()).toBe(0); gate.release();
    const b = pool(0); scene.add(b);
    a.count = 0;
    expect(gate.hold()).toBe(1); gate.release();
    expect(gate.hold()).toBe(1); gate.release();
    expect(gate.hold()).toBe(2); gate.release();
    b.visible = false; expect(gate.hold()).toBe(1); gate.release();
    b.visible = true; expect(gate.hold()).toBe(2); gate.release();
    expect([a.layers.mask, b.layers.mask]).toEqual([1, 1]);
  });

  it('walks only what is shown, past the bones: a mesh it has not found is drawn as three draws it', () => {
    const scene = new THREE.Scene(), parent = new THREE.Group(), c = pool(0), bone = new THREE.Bone(), d = pool(0);
    parent.add(c); bone.add(d); scene.add(parent, bone); parent.visible = false;
    const gate = new EmptyInstances(scene, 3), step = () => { const n = gate.hold(); gate.release(); return n; };
    expect([step(), step(), step()]).toEqual([0, 0, 0]);
    parent.visible = true;
    expect(step()).toBe(0);
    expect(step()).toBe(1);
    const e = pool(0), group = new THREE.Group(); group.add(e); scene.add(group);
    expect(step()).toBe(1);
    expect(step()).toBe(1);
    expect(step()).toBe(2);
    const f = pool(1), later = new THREE.Group(); later.add(f); scene.add(later);
    expect(step()).toBe(2);
    expect(step()).toBe(2);
    later.visible = false; f.count = 0;
    expect(step()).toBe(2);
    later.visible = true;
    expect(step()).toBe(2);
    expect(step()).toBe(3);
    expect(d.layers.mask).toBe(1);
  });

  it('reads emptiness as three draws: an InstancedMesh by its count, a mesh by its instanced geometry\'s', () => {
    expect(isEmpty(pool(0))).toBe(true);
    expect(isEmpty(pool(1))).toBe(false);
    expect(isEmpty(instancedGeometryMesh(0))).toBe(true);
    expect(isEmpty(instancedGeometryMesh(Infinity))).toBe(false);
  });

  it('rests on three issuing no draw for an instanced mesh with no instances (r186)', () => {
    const calls: string[] = [];
    const gl = new Proxy({}, { get: (_t, key) => (...args: unknown[]) => { calls.push(String(key)); return args; } }) as unknown as WebGLRenderingContext;
    const info = { update: () => calls.push('info') } as unknown as THREE.WebGLInfo;
    const arrays = new (WebGLBufferRenderer as unknown as new (gl: unknown, ext: unknown, info: unknown) => { setMode(m: number): void; renderInstances(s: number, c: number, p: number): void })(gl, {}, info);
    const indexed = new (WebGLIndexedBufferRenderer as unknown as new (gl: unknown, ext: unknown, info: unknown) => { setMode(m: number): void; setIndex(v: unknown): void; renderInstances(s: number, c: number, p: number): void })(gl, {}, info);
    arrays.setMode(4); indexed.setMode(4); indexed.setIndex({ type: 5123, bytesPerElement: 2 });
    arrays.renderInstances(0, 36, 0); indexed.renderInstances(0, 36, 0);
    expect(calls).toEqual([]);
    arrays.renderInstances(0, 36, 2); indexed.renderInstances(0, 36, 2);
    expect(calls).toEqual(['drawArraysInstanced', 'info', 'drawElementsInstanced', 'info']);
  });

  it('is in the frame\'s draw: GameRenderer holds before the composer and gives back after it, whatever happens', () => {
    const source = fs.readFileSync(new URL('../src/render/GameRenderer.ts', import.meta.url), 'utf8');
    expect(source).toMatch(/this\.emptyInstances\.hold\(\);\s*try\{if\(this\.probePose\)this\.renderProbe\(dt\);else this\.composer\.render\(dt\);\}\s*finally\{this\.emptyInstances\.release\(\);\}/);
    expect(source).toMatch(/warmDraw\([^]*?this\.renderer\.render\(this\.scene,this\.camera\)/);
  });
});
