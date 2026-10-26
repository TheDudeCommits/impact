import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { StageEnvironment } from '../src/render/StageEnvironment';

it('compiles against the destination lights, restoring live visibility before an async warm-up yields', async () => {
  const scene = new THREE.Scene(), stages = new StageEnvironment(scene);
  const harbor = new THREE.Group(), village = new THREE.Group();
  const oldLight = new THREE.PointLight(), streetA = new THREE.PointLight(), streetB = new THREE.PointLight();
  harbor.add(oldLight); village.add(streetA, streetB); village.visible = false;
  scene.add(harbor, village);
  const build = vi.spyOn(stages as unknown as { build: (id: string) => Promise<unknown> }, 'build');
  build.mockImplementation(async id => ({ root: id === 'harbor' ? harbor : village, occluders: [] }));
  await stages.preload('harbor'); await stages.preload('hidden-leaf');
  const visibleLights = () => { const lights: THREE.Object3D[] = []; scene.traverseVisible(o => { if (o instanceof THREE.Light) lights.push(o); }); return lights; };
  expect(visibleLights()).toEqual([oldLight]);
  const pending = stages.withStageLighting('hidden-leaf', () => {
    expect(visibleLights()).toEqual([streetA, streetB]);
    return Promise.resolve().then(() => expect(visibleLights()).toEqual([oldLight]));
  });
  expect(visibleLights()).toEqual([oldLight]); await pending;
  expect(() => stages.withStageLighting('hidden-leaf', () => { throw new Error('compiler failed'); })).toThrow('compiler failed');
  expect(visibleLights()).toEqual([oldLight]);
  expect(stages.current).toBeNull();
  build.mockRestore();
});
