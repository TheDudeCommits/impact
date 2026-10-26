import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { mirrorBright } from './mirror';
import type { DressContext } from './dressing';

describe('a polished floor\'s reflections', () => {
  const context = () => ({ root: new THREE.Group(), ambient: { time: { value: 0 } } }) as unknown as DressContext;
  const screen = () => {
    const map = new THREE.Texture();
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(4, 2), new THREE.MeshBasicMaterial({ name: 'Screen_background', map }));
    mesh.position.set(3, 6, -20);
    return mesh;
  };

  it('draws after the floor and before the rest, through the floor only', () => {
    const c = context(), floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshStandardMaterial());
    const [mirrored] = mirrorBright(c, [{ mesh: screen() }], { floor: [floor], strength: 1, fade: 10 });
    expect(floor.renderOrder).toBe(-2);
    expect(mirrored.renderOrder).toBe(-1);
    const material = mirrored.material as THREE.ShaderMaterial;
    expect(material.depthFunc).toBe(THREE.GreaterDepth);
    expect(material.depthWrite).toBe(false);
    expect(material.transparent).toBe(false);
    expect(material.blending).toBe(THREE.AdditiveBlending);
    expect(c.root.children).toContain(mirrored);
  });

  it('lies where the source\'s mirror image does, in the plane it is given', () => {
    const c = context(), source = screen();
    const [mirrored] = mirrorBright(c, [{ mesh: source }], { floor: [], y: -1.5, strength: 1, fade: 10 });
    mirrored.updateMatrixWorld(true);
    const p = new THREE.Vector3(1, 1, 0).applyMatrix4(source.matrixWorld);
    const q = new THREE.Vector3(1, 1, 0).applyMatrix4(mirrored.matrixWorld);
    expect(q.x).toBeCloseTo(p.x);
    expect(q.z).toBeCloseTo(p.z);
    expect(q.y).toBeCloseTo(2 * -1.5 - p.y);
    expect(mirrored.matrixWorld.determinant()).toBeLessThan(0);
  });

  it('skips a source with no picture', () => {
    const c = context(), blank = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial());
    expect(mirrorBright(c, [{ mesh: blank }], { floor: [], strength: 1, fade: 10 })).toHaveLength(0);
  });
});
