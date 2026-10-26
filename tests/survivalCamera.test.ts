import { describe, expect, it } from 'vitest';
import { RiftCamera, type LookInput, type LookScene } from '../src/survival/riftCamera';

const wrapped = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const look = (keys: string[] = [], yaw = 0): LookInput & { keys: Set<string> } => ({ keys: new Set(keys), yaw, pitch: .02, sensitivity: 1 });
const run = (camera: RiftCamera, input: LookInput, seconds: number, scene: LookScene = {}) => { for (let t = 0; t < seconds * 60; t++) camera.steer(1 / 60, input, scene); };
const tap = (camera: RiftCamera, input: LookInput & { keys: Set<string> }, code: string, scene: LookScene = {}) => { input.keys.add(code); camera.steer(1 / 60, input, scene); input.keys.delete(code); camera.steer(1 / 60, input, scene); };

describe('the keyboard view in a run', () => {
  it('turns with O and P (or the arrows), easing up to speed and stopping when let go', () => {
    const camera = new RiftCamera(), input = look(['KeyO']);
    run(camera, input, .1);
    const early = input.yaw;
    run(camera, input, .5);
    expect(input.yaw - early).toBeGreaterThan(1.1); expect(input.yaw - early).toBeLessThan(1.6);
    input.keys.clear();
    const letGo = input.yaw;
    run(camera, input, .3);
    expect(input.yaw).toBe(letGo);
    const right = look(['ArrowRight']);
    run(camera, right, .3);
    expect(right.yaw).toBeLessThan(0);
    const p = look(['BracketLeft']);
    run(camera, p, .3);
    expect(p.yaw).toBeLessThan(0);
  });

  it("tilts with up and down, inside the mouse's limits", () => {
    const camera = new RiftCamera(), input = look(['ArrowDown']);
    run(camera, input, 3);
    expect(input.pitch).toBeCloseTo(.72);
    input.keys.clear(); input.keys.add('ArrowUp');
    run(camera, input, 3);
    expect(input.pitch).toBeCloseTo(-.28);
  });

  it('looks with I at a blow out of sight first, else the boss, else the target, else behind; twice, behind', () => {
    const me = { x: 0, z: 0, yaw: 0 };
    const at = (x: number, z: number) => Math.atan2(x, z);
    const cases: [LookScene, number][] = [
      [{ me, threat: { x: 5, z: 0 }, boss: { x: 0, z: -5 }, target: { x: -5, z: 0 } }, at(5, 0)],
      [{ me, boss: { x: 0, z: -5 }, target: { x: -5, z: 0 } }, at(0, -5)],
      [{ me, target: { x: -5, z: 0 } }, at(-5, 0)],
      [{ me }, Math.PI],
    ];
    for (const [scene, goal] of cases) {
      const camera = new RiftCamera(), input = look([], 0);
      tap(camera, input, 'KeyI', scene);
      run(camera, input, .4, scene);
      expect(Math.abs(wrapped(input.yaw - goal))).toBeLessThan(1e-3);
    }
    const camera = new RiftCamera(), input = look([], .5), scene = { me, boss: { x: 0, z: -5 } };
    tap(camera, input, 'KeyI', scene); tap(camera, input, 'KeyI', scene);
    run(camera, input, .5, scene);
    expect(Math.abs(wrapped(input.yaw - (.5 + Math.PI)))).toBeLessThan(.15);
  });

  it('turns the view round with U, and the turn keys take over a swing at once', () => {
    const camera = new RiftCamera(), input = look([], .3);
    tap(camera, input, 'KeyU');
    run(camera, input, .5);
    expect(Math.abs(wrapped(input.yaw - (.3 + Math.PI)))).toBeLessThan(1e-3);
    const other = new RiftCamera(), view = look([], 0);
    tap(other, view, 'KeyU');
    run(other, view, .05);
    view.keys.add('KeyO');
    const at = view.yaw;
    run(other, view, .1);
    expect(view.yaw).toBeGreaterThan(at); expect(view.yaw).toBeLessThan(at + .5);
  });

  it('switches the lock left and right with the turn keys while locked, a step at a time', () => {
    const camera = new RiftCamera(), input = look(['BracketLeft']), steps: number[] = [];
    camera.onSwitch = dir => steps.push(dir);
    run(camera, input, .5, { locked: true });
    expect(input.yaw).toBe(0);
    expect(steps.length).toBeGreaterThanOrEqual(2); expect(steps.length).toBeLessThanOrEqual(3);
    expect(steps.every(dir => dir === 1)).toBe(true);
  });

  it('keeps the movement on the view a swing began from until the movement keys change', () => {
    const camera = new RiftCamera(), input = look(['KeyW'], 0);
    input.keys.add('KeyU'); camera.steer(1 / 60, input, {}, 0); input.keys.delete('KeyU');
    run(camera, input, .5);
    expect(Math.abs(wrapped(input.yaw - Math.PI))).toBeLessThan(1e-3);
    expect(camera.movementBasis(Math.PI)).toBe(0);
    input.keys.add('KeyA'); camera.steer(1 / 60, input);
    expect(camera.movementBasis(Math.PI)).toBe(Math.PI);
  });
});
