import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CameraBrain, across, brainInput, calmInner, calmOuter, framing, subject, SWITCH_PEAK, SWITCH_MOST, SWITCH_BOOM, AIR_BOOM2, MAX_SPEED,
  type BrainInput, type Subject } from '../src/render/CameraBrain';
import { FollowCamera } from '../src/render/FollowCamera';
import { coverStage, installCameraCutaway } from '../src/render/CameraCutaway';
import type { Fighter } from '../src/render/Fighter';
import type { PlayerState } from '../src/game/types';


const DEG = 180 / Math.PI, DT = 1 / 60;
const wrapped = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
class Bench {
  brain = new CameraBrain(); input: BrainInput = brainInput(); subjects: Subject[] = []; heading = 0;
  constructor() { this.input.subjects = this.subjects; }
  add(x: number, z: number, fill: Partial<Subject> = {}) { const s = Object.assign(subject(), { id: `s${this.subjects.length}`, x, z }, fill); this.subjects.push(s); this.input.count = this.subjects.length; return s; }
  step(dt = DT, turn = 0) {
    this.heading += turn;
    Object.assign(this.input, { dt, heading: this.heading, manual: turn, shoulder: 1.05 * this.brain.side });
    this.brain.think(this.input);
    this.heading = this.brain.steer(this.heading, this.brain.goal, dt);
    return this.heading;
  }
}
function trace(b: Bench, frames: number) {
  const h: number[] = [];
  for (let i = 0; i < frames; i++) h.push(b.step());
  const v = h.map((x, i) => i ? (x - h[i - 1]) / DT : 0), a = v.map((x, i) => i > 1 ? (x - v[i - 1]) / DT : 0), j = a.map((x, i) => i > 2 ? (x - a[i - 1]) / DT : 0);
  return { h, v, a, j };
}

describe('a change of opponent is a planned move', () => {
  it('turns to the new one on a minimum-jerk path: no overshoot, under SWITCH_PEAK, done in SWITCH_MOST and a beat', () => {
    const b = new Bench();
    const a = b.add(0, 4, { target: true }), c = b.add(-4, 1);
    for (let i = 0; i < 240; i++) b.step();
    a.target = false; c.target = true;
    const { h, v, a: acc, j } = trace(b, 150);
    const d = Math.hypot(4, 1), goal = framing(Math.atan2(-4, 1), d, 1.05 * b.brain.side, b.input.back) + 0;
    const end = h[h.length - 1], way = Math.sign(end - h[0]);
    const own = Math.abs(wrapped(goal - Math.atan2(-4, 1)));
    expect(Math.abs(wrapped(end - goal)), 'arrives').toBeLessThan(Math.max(calmInner(d, own), calmOuter(d)) + .03);
    expect(Math.abs(end - h[0]), 'a real pan').toBeGreaterThan(.8);
    const over = Math.max(...h.map(x => way * (x - end)));
    expect(over * DEG, 'no overshoot').toBeLessThan(1);
    const peak = Math.max(...v.map(Math.abs));
    expect(peak).toBeLessThanOrEqual(SWITCH_PEAK + .05); expect(peak).toBeLessThan(MAX_SPEED);
    let stop = v.length - 1; while (stop > 0 && Math.abs(v[stop]) * DEG < 10) stop--;
    expect(stop * DT).toBeLessThan(SWITCH_MOST + .35);
    expect(Math.max(...acc.slice(3).map(Math.abs)), 'accel rad/s2').toBeLessThan(25);
    expect(Math.max(...j.slice(4).map(Math.abs)), 'jerk rad/s3').toBeLessThan(400);
  });
  it('starts from the motion the lens already has: no snap when it was turning the other way', () => {
    const b = new Bench();
    const a = b.add(4, 0, { target: true }), c = b.add(-3, 2.5);
    for (let i = 0; i < 20; i++) b.step();
    expect(Math.abs(b.brain.velocity)).toBeGreaterThan(.3);
    a.target = false; c.target = true;
    const { v } = trace(b, 120);
    let worst = 0; for (let i = 2; i < v.length; i++) worst = Math.max(worst, Math.abs(v[i] - v[i - 1]) / DT);
    expect(worst, 'the change of speed in one frame, rad/s2').toBeLessThan(25);
  });
  it('breathes out while it pans - back, up, wider - and in again', () => {
    const b = new Bench();
    const a = b.add(0, 4, { target: true }), c = b.add(-4, -1);
    for (let i = 0; i < 240; i++) b.step();
    const rest = { boom: b.brain.boom, fov: b.brain.fov };
    a.target = false; c.target = true;
    let most = 0, wide = 0;
    for (let i = 0; i < 40; i++) { b.step(); most = Math.max(most, b.brain.boom - rest.boom); wide = Math.max(wide, b.brain.fov - rest.fov); }
    expect(most).toBeGreaterThan(SWITCH_BOOM * .5); expect(wide).toBeGreaterThan(1);
    for (let i = 0; i < 120; i++) b.step();
    expect(b.brain.switching).toBe(0);
  });
  it('the player\'s own turning takes the lens back mid-switch', () => {
    const b = new Bench();
    const a = b.add(0, 4, { target: true }), c = b.add(-4, -1);
    for (let i = 0; i < 120; i++) b.step();
    a.target = false; c.target = true;
    for (let i = 0; i < 10; i++) b.step();
    expect(b.brain.switchActive).toBe(true);
    b.step(DT, .05);
    expect(b.brain.switchActive).toBe(false);
  });
  it('does not pan at all to a new opponent already standing in the window', () => {
    const b = new Bench();
    const a = b.add(.2, 1.3, { target: true }), c = b.add(-.2, 1.35);
    for (let i = 0; i < 240; i++) b.step();
    const rest = b.heading;
    a.target = false; c.target = true;
    let moved = 0;
    for (let i = 0; i < 120; i++) { b.step(); moved = Math.max(moved, Math.abs(b.heading - rest)); expect(b.brain.switchActive).toBe(false); }
    expect(moved * DEG).toBeLessThan(.5); expect(b.brain.switching).toBe(0);
  });
  it('holds the challenger the focus is weighing in the frame before the change', () => {
    const b = new Bench();
    b.add(0, 4, { target: true }); const c = b.add(4.6, -.5);
    for (let i = 0; i < 120; i++) b.step();
    expect(c.weight).toBeLessThan(.5);
    const x = () => across(c.x, c.z, 0, 0, b.heading, b.input.back, 1.05 * b.brain.side, b.input.tanH);
    expect(Math.abs(x()), 'out of the frame to begin with').toBeGreaterThan(1);
    b.input.pending = c.id; b.input.pendingShare = .9;
    for (let i = 0; i < 90; i++) b.step();
    expect(c.weight).toBeGreaterThan(.5);
    expect(Math.abs(x()), 'brought into the frame').toBeLessThan(.95);
    expect(b.brain.group, 'the lens stands back for it').toBeGreaterThan(.1);
  });
});

describe('the shot at rest, and in the air', () => {
  it('a calm duel holds still: no drift of the heading, no breath of the lens', () => {
    const b = new Bench(); b.add(0, 4, { target: true });
    for (let i = 0; i < 300; i++) b.step();
    const h: number[] = [], boom: number[] = [], lift: number[] = [], fov: number[] = [];
    for (let i = 0; i < 60 * 11; i++) { h.push(b.step()); boom.push(b.brain.boom); lift.push(b.brain.lift); fov.push(b.brain.fov); }
    const span = (v: number[]) => Math.max(...v) - Math.min(...v);
    expect(span(h) * DEG).toBeLessThan(.01); expect(span(boom)).toBeLessThan(1e-6); expect(span(lift)).toBeLessThan(1e-6); expect(span(fov)).toBeLessThan(1e-6);
  });
  it('an opponent stepping about at arm\'s length does not move the lens in or out (the string\'s dolly is gone)', () => {
    const b = new Bench(); const foe = b.add(0, 2.5, { target: true });
    for (let i = 0; i < 240; i++) b.step();
    const rest = { boom: b.brain.boom, fov: b.brain.fov };
    expect('strung' in b.input).toBe(false);
    let boom = 0, fov = 0;
    for (let i = 0; i < 240; i++) { foe.x = .3 * Math.sin(i / 9); b.step(); boom = Math.max(boom, Math.abs(b.brain.boom - rest.boom)); fov = Math.max(fov, Math.abs(b.brain.fov - rest.fov)); }
    expect(boom).toBeLessThan(1e-6); expect(fov).toBeLessThan(1e-6);
  });
  it('stands back and widens for tall air', () => {
    const b = new Bench(); const foe = b.add(0, 3, { target: true });
    for (let i = 0; i < 120; i++) b.step();
    const rest = { boom: b.brain.boom, fov: b.brain.fov };
    foe.y = 5; foe.airborne = true;
    for (let i = 0; i < 60; i++) b.step();
    expect(b.brain.boom - rest.boom).toBeGreaterThan(AIR_BOOM2 * .6); expect(b.brain.fov).toBeGreaterThan(rest.fov + 2);
  });
  it('sees a cross-up coming - a body passing the player - but not a head-on approach', () => {
    for (const name of ['pass', 'head-on'] as const) {
      const b = new Bench(); const foe = b.add(1.2, 3, { target: true });
      for (let i = 0; i < 120; i++) b.step();
      if (name === 'head-on') { const d = Math.hypot(foe.x, foe.z); b.input.vx = foe.x / d * 20; b.input.vz = foe.z / d * 20; }
      else { b.input.vx = Math.sin(b.heading) * 20; b.input.vz = Math.cos(b.heading) * 20; }
      const urgent = (b.brain as unknown as { urgent: number });
      let most = 0, saw = false;
      for (let i = 0; i < 9; i++) { b.step(); most = Math.max(most, urgent.urgent); saw ||= b.brain.foresaw; }
      if (name === 'pass') { expect(saw, name).toBe(true); expect(most, name).toBeGreaterThan(.1); } else { expect(saw, name).toBe(false); expect(most, name).toBeLessThan(.05); }
    }
  });
  it('a form with a rig of its own keeps the right shoulder', () => {
    const b = new Bench(); b.add(-2.5, 3, { target: true });
    b.input.form = 1;
    for (let i = 0; i < 300; i++) b.step();
    expect(b.brain.side).toBe(1);
  });
});

const state = (id: string, x = 0, z = 0): PlayerState => ({ id, name: id, fighter: 'zoro', x, y: 0, z, yaw: 0, hp: 1000, maxHp: 1000, stamina: 100, ultimate: 0,
  action: 'idle', actionStarted: 0, actionDuration: 0, actionTime: 0, target: null, alive: true, isBot: false, grounded: true, guarding: false,
  cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } } as PlayerState);
const actor = (id: string, x = 0, z = 0) => { const group = new THREE.Group(); group.position.set(x, 0, z); return { state: state(id, x, z), group, velocity: new THREE.Vector3() } as unknown as Fighter; };

describe('FollowCamera, dynamic (round 4b)', () => {
  it('keeps the lens inside an open stage\'s bounds, along its own line of sight; an enclosed stage keeps the room fade', () => {
    for (const [halfX, extra, inside] of [[18, {}, true], [18, { doubleSided: true }, false], [13, {}, false], [18, { id: 'valley-of-the-end' }, false]] as const) {
      const bounds = { halfX, halfZ: 55, ...extra };
      const camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 200), follow = new FollowCamera(camera);
      follow.mode = 'dynamic'; follow.stageBounds = bounds;
      const me = actor('me', halfX - .6, -54.4), foe = actor('foe', halfX - 3, -50);
      let yaw = 0, worst = 0;
      for (let i = 0; i < 240; i++) {
        follow.update(DT, me, yaw, .02, [], 0, foe, false); yaw = follow.inputYaw; camera.updateMatrixWorld();
        worst = Math.max(worst, Math.abs(camera.position.x) - halfX, Math.abs(camera.position.z) - 55);
        expect(Math.abs(wrapped(follow.movementYaw - follow.inputYaw))).toBeLessThan(.05);
      }
      if (inside) expect(worst, `${halfX} m: inside`).toBeLessThanOrEqual(0);
      else { expect(worst, `${halfX} m: the lens may stand outside`).toBeGreaterThan(0); expect(worst, 'by no more than an enclosed hall allows').toBeLessThanOrEqual(1.4 + 1e-6); }
    }
  });
  it('the run comes round to the view once the camera\'s framing turn has settled, and at once for a player held up', () => {
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 200), follow = new FollowCamera(camera);
    follow.mode = 'dynamic';
    const me = actor('me'), foe = actor('foe', 0, 4);
    let yaw = 0;
    for (let i = 0; i < 60; i++) { follow.update(DT, me, yaw, .02, [], 0, foe, false); yaw = follow.inputYaw; }
    const first = follow.movementBasis(1);
    me.state.action = 'run';
    const run = () => { me.group.position.x += Math.sin(first) * 5 * DT; me.group.position.z += Math.cos(first) * 5 * DT; foe.group.position.x += Math.sin(first) * 5 * DT; foe.group.position.z += Math.cos(first) * 5 * DT; };
    foe.group.position.set(4, 0, 1.5); Object.assign(foe.state, { x: 4, z: 1.5 });
    for (let i = 0; i < 20; i++) { run(); follow.update(DT, me, yaw, .02, [], 0, foe, false); yaw = follow.inputYaw; follow.movementBasis(1); }
    expect(Math.abs(wrapped(follow.movementBasis(1) - first)), 'held while it turns').toBeLessThan(.02);
    for (let i = 0; i < 240; i++) { run(); follow.update(DT, me, yaw, .02, [], 0, foe, false); yaw = follow.inputYaw; follow.movementBasis(1); }
    expect(Math.abs(wrapped(follow.movementBasis(1) - follow.movementYaw)), 'caught up with the view once settled').toBeLessThan(.02);
    const g = new FollowCamera(new THREE.PerspectiveCamera(50, 16 / 9, .1, 200)); g.mode = 'dynamic';
    me.state.action = 'run';
    for (let i = 0; i < 30; i++) { g.update(DT, me, 0, .02, [], 0, undefined, false); g.movementBasis(1); }
    expect(g.blocked).toBe(true);
  });
  it('climbs less than a tall jump does', () => {
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 200), follow = new FollowCamera(camera);
    follow.mode = 'dynamic';
    const me = actor('me'), foe = actor('foe', 0, 4);
    for (let i = 0; i < 60; i++) follow.update(DT, me, 0, .02, [], 0, foe, false);
    const y0 = camera.position.y;
    me.state.grounded = false; me.group.position.y = 5; me.state.y = 5;
    for (let i = 0; i < 90; i++) follow.update(DT, me, follow.inputYaw, .02, [], 0, foe, false);
    expect(camera.position.y - y0).toBeLessThan(5 * .75);
    expect(camera.position.y - y0).toBeGreaterThan(1);
  });
  it('puts the cutaway (and the stage fade) on any prop under the stage that lacks it', () => {
    const scene = new THREE.Scene(), root = new THREE.Group(), proxy = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ visible: false }));
    const prop = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()), done = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    installCameraCutaway(done.material as THREE.Material);
    scene.add(root); root.add(proxy, prop, done);
    expect(coverStage([proxy])).toBe(1);
    expect((prop.material as THREE.Material).customProgramCacheKey()).toContain('player-cutaway');
    expect(coverStage([proxy])).toBe(0);
  });
});
