import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { showCasters } from '../src/render/textureWarmup';
import { StageEnvironment } from '../src/render/StageEnvironment';
import { CrowFlock } from '../src/render/shop/CrowFlock';
import { EmperorEffects } from '../src/render/EmperorEffects';

afterEach(() => vi.restoreAllMocks());

describe('the warm draw draws the whole of a body or a place', () => {
  it('uncuts every mesh under a whole root, caster or not, shows only what a caster hangs from, and puts it all back', () => {
    const scene = new THREE.Scene(), place = new THREE.Group(), body = new THREE.Group(), form = new THREE.Group();
    scene.add(place, body); body.add(form); form.visible = false;
    const floor = new THREE.Mesh(); place.add(floor);
    const prop = new THREE.Mesh(); prop.castShadow = true; place.add(prop);
    const hidden = new THREE.Mesh(); hidden.visible = false; place.add(hidden);
    const limb = new THREE.Mesh(); limb.castShadow = true; limb.frustumCulled = false; body.add(limb);
    const formLimb = new THREE.Mesh(); formLimb.castShadow = true; formLimb.frustumCulled = false; form.add(formLimb);
    const warm = showCasters([], scene, [place, body]);
    expect(warm.casters).toBe(3);
    expect(form.visible).toBe(true); expect(warm.shown).toEqual([form]);
    expect([floor.frustumCulled, prop.frustumCulled, hidden.frustumCulled]).toEqual([false, false, false]);
    expect(hidden.visible).toBe(false);
    warm.restore();
    expect(form.visible).toBe(false);
    expect([floor.frustumCulled, prop.frustumCulled, hidden.frustumCulled, limb.frustumCulled, formLimb.frustumCulled]).toEqual([true, true, true, false, false]);
  });
  it('counts no caster where there is none, so a draw with nothing to link is not made', () => {
    const scene = new THREE.Scene(), root = new THREE.Group(); scene.add(root); root.add(new THREE.Mesh());
    const warm = showCasters([root], scene);
    expect(warm.casters).toBe(0); expect(warm.unculled).toEqual([]); warm.restore();
  });
});

describe('a place carries the camera cutaway on every material before the room compiles', () => {
  it('gives it to what the place loaded without it (the dressing, the ground), and hands its root over', async () => {
    const scene = new THREE.Scene(), stages = new StageEnvironment(scene), root = new THREE.Group();
    const decals = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshStandardMaterial({ name: 'Wear decals' }));
    const shader = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.ShaderMaterial({ name: 'sky' }));
    root.add(decals, shader); scene.add(root);
    const build = vi.spyOn(stages as unknown as { build: (id: string) => Promise<unknown> }, 'build');
    build.mockImplementation(async () => ({ root, occluders: [] }));
    await stages.preload('martial-arts-tournament');
    expect(decals.material.customProgramCacheKey()).toMatch(/-player-cutaway-v3$/);
    expect((shader.material as THREE.ShaderMaterial).customProgramCacheKey()).not.toMatch(/cutaway/);
    expect(stages.root('martial-arts-tournament')).toBe(root);
    expect(stages.root('shiganshina')).toBeUndefined();
  });
});

describe('effects first made at their first use are made with the room', () => {
  it("Itachi's crows are hidden while there is no bird to draw, shown while there are, hidden again after", () => {
    const scene = new THREE.Scene(), flock = new CrowFlock(scene, new THREE.Color(3, .2, .2));
    const meshes = ['itachi-crows', 'itachi-crow-wings', 'itachi-crow-eyes', 'itachi-crow-feathers'].map(name => scene.getObjectByName(name) as THREE.InstancedMesh);
    expect(meshes.every(m => m && !m.visible && m.count === 0)).toBe(true);
    flock.update(0, 1 / 60);
    expect(meshes.every(m => !m.visible)).toBe(true);
    flock.burstFrom([new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1.5, 0)], new THREE.Vector3(0, 1.2, 0), 0, 2);
    flock.update(.05, 1 / 60);
    expect(meshes[0].visible && meshes[0].count > 0).toBe(true);
    for (let t = .1; t < 4; t += 1 / 30) flock.update(t, 1 / 30);
    expect(meshes.every(m => !m.visible && m.count === 0)).toBe(true);
    flock.burstFrom([new THREE.Vector3()], new THREE.Vector3(), 4, 1); flock.update(4.05, 1 / 60); flock.reset();
    expect(meshes.every(m => !m.visible && m.count === 0)).toBe(true);
    flock.dispose();
  });
  it('a room with an Itachi has his crows and an illusion\'s shards in the scene before its compile, hidden; Aizen the shards, Levi a whirl', () => {
    const named = (scene: THREE.Scene, name: string) => { const found: THREE.Object3D[] = []; scene.traverse(o => { if (o.name === name) found.push(o); }); return found; };
    const scene = new THREE.Scene(), fx = new EmperorEffects(scene);
    expect(named(scene, 'itachi-crows')).toEqual([]); expect(named(scene, 'kyoka-suigetsu-shards')).toEqual([]);
    fx.load(['goku', 'naruto']);
    expect(named(scene, 'itachi-crows')).toEqual([]); expect(named(scene, 'kyoka-suigetsu-shards')).toEqual([]);
    fx.load(['aizen']);
    expect(named(scene, 'itachi-crows')).toEqual([]); expect(named(scene, 'kyoka-suigetsu-shards').length).toBe(1);
    fx.load(['itachi', 'aizen']); fx.load(['itachi']);
    expect(named(scene, 'itachi-crows').length).toBe(1); expect(named(scene, 'kyoka-suigetsu-shards').length).toBe(1);
    expect([...named(scene, 'itachi-crows'), ...named(scene, 'kyoka-suigetsu-shards')].every(o => !o.visible)).toBe(true);
    fx.load(['levi']);
    expect(named(scene, 'levi-blade-trail').length).toBe(2); expect(named(scene, 'levi-blade-trail').every(o => !o.visible)).toBe(true);
    fx.reset();
    expect(named(scene, 'itachi-crows').length).toBe(1);
    fx.dispose();
    expect(named(scene, 'itachi-crows')).toEqual([]); expect(named(scene, 'kyoka-suigetsu-shards')).toEqual([]); expect(named(scene, 'levi-blade-trail')).toEqual([]);
  });
});
