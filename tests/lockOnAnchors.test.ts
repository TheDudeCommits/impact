import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { lockFrame, measureLock, type LockBody } from '../src/render/lockAnchors';


const W = 1600, H = 900;
function lens(z = 6) {
  const camera = new THREE.PerspectiveCamera(50, W / H, .1, 200);
  camera.position.set(0, 1.2, z); camera.lookAt(0, 1.2, 0); camera.updateMatrixWorld(true);
  return camera;
}
function fighter(x = 0, z = 0, opts: { hidden?: boolean; lying?: boolean; noJoints?: boolean; form?: LockBody } = {}) {
  const group = new THREE.Group(); group.position.set(x, 0, z);
  const joints = new Map<string, THREE.Object3D>();
  const at: Record<string, [number, number, number]> = opts.lying
    ? { Hips: [0, .2, 0], Head: [-.75, .15, 0], LeftFoot: [.85, .1, .1], RightFoot: [.85, .1, -.1], LeftToeBase: [.95, .08, .1], RightToeBase: [.95, .08, -.1], LeftShoulder: [-.5, .25, .15], RightShoulder: [-.5, .25, -.15], LeftArm: [-.45, .25, .2], RightArm: [-.45, .25, -.2] }
    : { Hips: [0, .95, 0], Head: [0, 1.55, 0], LeftFoot: [.1, .08, 0], RightFoot: [-.1, .08, 0], LeftToeBase: [.1, .02, .12], RightToeBase: [-.1, .02, .12], LeftShoulder: [.08, 1.4, 0], RightShoulder: [-.08, 1.4, 0], LeftArm: [.2, 1.38, 0], RightArm: [-.2, 1.38, 0] };
  if (!opts.noJoints) for (const [name, p] of Object.entries(at)) { const bone = new THREE.Object3D(); bone.position.set(...p); group.add(bone); joints.set(name, bone); }
  group.updateMatrixWorld(true);
  const body: LockBody = { group, model: { visible: !opts.hidden }, joints, state: { fighter: 'goku', alive: true }, shownBody: opts.form };
  return body;
}
const project = (camera: THREE.Camera, x: number, y: number, z: number) => { const v = new THREE.Vector3(x, y, z).project(camera); return { x: (v.x * .5 + .5) * W, y: (-v.y * .5 + .5) * H }; };

describe('measuring the target', () => {
  it('spans the crown (head + pad) to the soles, shoulder to shoulder, anchored on the hips', () => {
    const camera = lens(), f = measureLock(lockFrame(), fighter(), undefined, 1, camera, W, H);
    expect(f.ok).toBe(true); expect(f.inFront).toBe(true);
    const crown = project(camera, 0, 1.55 + .24, 0), sole = project(camera, 0, .02 - .06, .12), hips = project(camera, 0, .95, 0);
    expect(f.t).toBeCloseTo(crown.y, 0); expect(f.b).toBeCloseTo(sole.y, 0);
    expect(f.cx).toBeCloseTo(crown.x, 0); expect(f.cy).toBeCloseTo(crown.y, 0);
    expect(f.ax).toBeCloseTo(hips.x, 0); expect(f.ay).toBeCloseTo(hips.y, 0);
    expect(f.r - f.l).toBeGreaterThan(project(camera, .2, 1.38, 0).x - project(camera, -.2, 1.38, 0).x - 1);
    expect(f.r).toBeLessThan(project(camera, .5, 1.3, 0).x);
  });
  it('reads a form standing in for the fighter (its joints, not the hidden body)', () => {
    const camera = lens(), form = fighter(1, 0), own = fighter(0, 0, { hidden: true, form });
    const f = measureLock(lockFrame(), own, undefined, 1, camera, W, H);
    expect(f.ax).toBeCloseTo(project(camera, 1, .95, 0).x, 0);
  });
  it('falls back to root and crown height for a hidden model or missing joints', () => {
    const camera = lens();
    for (const body of [fighter(0, 0, { hidden: true }), fighter(0, 0, { noJoints: true })]) {
      const f = measureLock(lockFrame(), body, undefined, 1, camera, W, H);
      expect(f.ok).toBe(true);
      expect(f.b).toBeCloseTo(project(camera, 0, 0, 0).y, 0);
      expect(f.t).toBeCloseTo(project(camera, 0, 1.95, 0).y, 0);
    }
  });
  it('frames an enemy without joints from its centre and size, ~1.8 m a unit', () => {
    const camera = lens(), centre = new THREE.Vector3(0, 1.8 * .55 * 1.5, 0);
    const f = measureLock(lockFrame(), undefined, centre, 1.5, camera, W, H);
    expect(f.ok).toBe(true);
    expect(f.b).toBeCloseTo(project(camera, 0, 0, 0).y, 0);
    expect(f.t).toBeCloseTo(project(camera, 0, 2.7, 0).y, 0);
  });
  it('a body lying down measures wide and short', () => {
    const camera = lens(), f = measureLock(lockFrame(), fighter(0, 0, { lying: true }), undefined, 1, camera, W, H);
    expect(f.r - f.l).toBeGreaterThan(2 * (f.b - f.t));
  });
  it('behind the lens: not in front, and the bearing points the true way', () => {
    const camera = lens();
    const f = measureLock(lockFrame(), fighter(3, 10), undefined, 1, camera, W, H);
    expect(f.inFront).toBe(false); expect(f.ok).toBe(false);
    expect(f.dx).toBeGreaterThan(0);
    const g = measureLock(lockFrame(), fighter(-1.5, 0), undefined, 1, camera, W, H);
    expect(g.inFront).toBe(true); expect(g.ax).toBeLessThan(W / 2); expect(g.dx).toBeLessThan(0);
  });
  it('allocates nothing per frame: the same frame object, rewritten', () => {
    const camera = lens(), out = lockFrame(), body = fighter();
    expect(measureLock(out, body, undefined, 1, camera, W, H)).toBe(out);
    const first = { ...out };
    measureLock(out, body, undefined, 1, camera, W, H);
    expect(out).toEqual(first);
  });
});
