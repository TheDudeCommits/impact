import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SmartRig, TURN_SPEED, URGENT_SPEED, YIELD_AFTER, DOLLY_BASE, DOLLY_MOST, RUN_SOFT, PAN_URGENT, VIEW_TILT, ELEVATION, ELEVATION_NEAR, PULL_FROM, PULL_TO, type SmartInput, type SmartThreat } from '../src/render/SmartCamera';
import { FollowCamera } from '../src/render/FollowCamera';
import { CAMERA_MODES } from '../src/config';
import { STAGES } from '../src/game/stages';
import type { Fighter } from '../src/render/Fighter';

const DT = 1 / 60, wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a)), DEG = 180 / Math.PI;
type Body = { x: number; y: number; z: number; vx?: number; vz?: number; high?: number; lying?: boolean };
function input(me: Body, foe?: Body & { id?: string }, extra: Partial<SmartInput> = {}): SmartInput {
  return {
    dt: DT, placed: false, sole: true, threats: [], threatCount: 0, manual: 0, manualTilt: 0, aspect: 16 / 9, frozen: false,
    me: { x: me.x, y: me.y, z: me.z, vx: me.vx ?? 0, vz: me.vz ?? 0, high: me.high ?? 1.95, lying: !!me.lying, airborne: me.y > .05, floor: 0, scale: (me.high ?? 1.95) / 1.95 },
    foe: foe ? { id: foe.id ?? 'foe', x: foe.x, y: foe.y, z: foe.z, vx: foe.vx ?? 0, vz: foe.vz ?? 0, high: foe.high ?? 1.95, lying: !!foe.lying, airborne: foe.y > .05 } : undefined,
    ...extra,
  };
}
function seen(rig: SmartRig, x: number, y: number, z: number) {
  const cam = new THREE.PerspectiveCamera(rig.fov, 16 / 9, .1, 500);
  cam.position.set(rig.lensX, rig.lensY, rig.lensZ); cam.lookAt(rig.lookX, rig.lookY, rig.lookZ); cam.updateMatrixWorld(true);
  return new THREE.Vector3(x, y, z).project(cam);
}
const inside = (p: THREE.Vector3, margin = 1) => p.z < 1 && Math.abs(p.x) <= margin && Math.abs(p.y) <= margin;
const whole = (rig: SmartRig, b: Body) => inside(seen(rig, b.x, b.y + (b.high ?? 1.95), b.z)) && inside(seen(rig, b.x, b.y + .03, b.z));

describe('the Smart camera', () => {
  it('is a camera mode a save can hold, and nobody is moved to it', () => {
    expect(CAMERA_MODES).toContain('smart');
  });
  it('opens a duel with both fighters whole in the frame, the player off the middle', () => {
    const rig = new SmartRig(), me = { x: 0, y: 0, z: 0 }, foe = { x: 0, y: 0, z: 9 };
    rig.update(input(me, foe, { placed: true }));
    for (let k = 0; k < 30; k++) rig.update(input(me, foe));
    expect(whole(rig, me)).toBe(true); expect(whole(rig, foe)).toBe(true);
    expect(Math.abs(seen(rig, me.x, 1, me.z).x)).toBeGreaterThan(.08);
  });
  it('rests while the opponent moves about inside the window: the picture does not turn for every step', () => {
    const rig = new SmartRig(), me = { x: 0, y: 0, z: 0 }, foe = { x: 1.2, y: 0, z: 4 };
    rig.update(input(me, foe, { placed: true }));
    for (let k = 0; k < 90; k++) rig.update(input(me, foe));
    const before = rig.heading;
    for (let k = 0; k < 120; k++) { const t = k * DT; foe.x = 1.2 + Math.sin(t * Math.PI * 2) * .9; rig.update(input(me, foe)); }
    expect(Math.abs(wrap(rig.heading - before)) * DEG).toBeLessThan(6);
  });
  it('lets a cross-up at arm\'s length mirror the pair rather than swing the lens round', () => {
    const rig = new SmartRig(), me = { x: 0, y: 0, z: 0 }, foe = { x: .9, y: 0, z: 1.1 };
    rig.update(input(me, foe, { placed: true }));
    for (let k = 0; k < 90; k++) rig.update(input(me, foe));
    const before = rig.heading;
    for (let k = 0; k < 12; k++) { foe.x = .9 - 1.8 * (k + 1) / 12; rig.update(input(me, foe)); }
    for (let k = 0; k < 60; k++) rig.update(input(me, foe));
    expect(whole(rig, me)).toBe(true); expect(inside(seen(rig, foe.x, 1, foe.z))).toBe(true);
    expect(Math.abs(wrap(rig.heading - before)) * DEG).toBeLessThan(60);
  });
  it('never turns by itself faster than its limits', () => {
    const rig = new SmartRig(), me = { x: 0, y: 0, z: 0 }, foe = { x: 0, y: 0, z: 5 };
    rig.update(input(me, foe, { placed: true }));
    let most = 0, last = rig.heading;
    foe.z = -5;
    for (let k = 0; k < 240; k++) { rig.update(input(me, foe)); most = Math.max(most, Math.abs(wrap(rig.heading - last)) / DT); last = rig.heading; }
    expect(most).toBeLessThanOrEqual(URGENT_SPEED * 1.001);
    expect(inside(seen(rig, foe.x, 1, foe.z))).toBe(true);
  });
  it('turns calmly (under its ordinary speed) for an opponent who walks round the player at range', () => {
    const rig = new SmartRig(), me = { x: 0, y: 0, z: 0 }, foe = { x: 0, y: 0, z: 8 };
    rig.update(input(me, foe, { placed: true }));
    let most = 0, last = rig.heading;
    for (let k = 0; k < 300; k++) { const a = k * DT * .5; foe.x = Math.sin(a) * 8; foe.z = Math.cos(a) * 8; rig.update(input(me, foe)); if (k > 5) most = Math.max(most, Math.abs(wrap(rig.heading - last)) / DT); last = rig.heading; }
    expect(most).toBeLessThanOrEqual(TURN_SPEED * 1.001);
    expect(inside(seen(rig, foe.x, 1, foe.z))).toBe(true);
  });
  it('gives the player\'s own turn of the view 1:1 at once, and holds off for a beat before composing again', () => {
    const rig = new SmartRig(), me = { x: 0, y: 0, z: 0 }, foe = { x: 0, y: 0, z: 6 };
    rig.update(input(me, foe, { placed: true }));
    for (let k = 0; k < 60; k++) rig.update(input(me, foe));
    const before = rig.heading;
    rig.update(input(me, foe, { manual: .6 }));
    expect(wrap(rig.heading - before)).toBeCloseTo(.6, 3);
    const looked = rig.heading;
    for (let k = 0; k < Math.floor(YIELD_AFTER / DT) - 2; k++) rig.update(input(me, foe));
    expect(Math.abs(wrap(rig.heading - looked))).toBeLessThan(.02);
    for (let k = 0; k < 360; k++) rig.update(input(me, foe));
    expect(Math.abs(rig.away)).toBeLessThan(.05);
  });
  it('never loses the player: thrown fourteen metres up over an opponent on the floor, the player stays in the frame', () => {
    const rig = new SmartRig(), me = { x: 0, y: 0, z: 0, high: 1.95 * 1.5 }, foe = { x: 0, y: 0, z: 3 };
    rig.update(input(me, foe, { placed: true }));
    for (let k = 0; k < 240; k++) { me.y = Math.min(14, k * DT * 12); rig.update(input(me, foe)); if (k > 40) expect(inside(seen(rig, me.x, me.y + 1.4, me.z), 1.02)).toBe(true); }
  });
  it('keeps the lens inside what a small floor allows, the player whole, with the back to a wall', () => {
    const rig = new SmartRig(), me = { x: 0, y: 0, z: 6 }, foe = { x: 0, y: 0, z: 2 }, bound = { halfX: 6.5, halfZ: 7, out: 1.4 };
    rig.update(input(me, foe, { placed: true, bound }));
    for (let k = 0; k < 240; k++) {
      rig.update(input(me, foe, { bound }));
      expect(Math.abs(rig.lensX)).toBeLessThanOrEqual(bound.halfX + bound.out + 1e-6); expect(Math.abs(rig.lensZ)).toBeLessThanOrEqual(bound.halfZ + bound.out + 1e-6);
    }
    expect(inside(seen(rig, me.x, 1, me.z))).toBe(true);
  });
  it('in a royale, pulls back - no further than its limit - to hold those pressing the player, and widens past it', () => {
    const rig = new SmartRig(), me = { x: 0, y: 0, z: 0 }, foe = { x: 0, y: 0, z: 3 };
    const threats: SmartThreat[] = [{ id: 'a', x: -4, y: 0, z: 1, high: 1.95, lying: false, airborne: false, weight: .8 }, { id: 'b', x: 4.5, y: 0, z: .5, high: 1.95, lying: false, airborne: false, weight: .8 }];
    rig.update(input(me, foe, { placed: true, sole: false }));
    for (let k = 0; k < 60; k++) rig.update(input(me, foe, { sole: false }));
    const alone = rig.state.dolly;
    for (let k = 0; k < 240; k++) rig.update(input(me, foe, { sole: false, threats, threatCount: 2 }));
    expect(rig.state.dolly).toBeGreaterThan(alone + .2);
    expect(rig.state.dolly).toBeLessThanOrEqual(DOLLY_BASE * DOLLY_MOST + 1e-6);
    for (const t of threats) expect(inside(seen(rig, t.x, 1, t.z), 1.05)).toBe(true);
  });
  it('lets a pair trading places swap sides of the picture: the player strafing across the line at a run, the heading holds', () => {
    const rig = new SmartRig(), me: Body = { x: 0, y: 0, z: 0 }, foe = { x: 0, y: 0, z: 3 };
    rig.update(input(me, foe, { placed: true }));
    for (let k = 0; k < 90; k++) rig.update(input(me, foe));
    const before = rig.heading, from = seen(rig, foe.x, 1, foe.z).x;
    const way = -Math.sign(wrap(rig.heading - Math.atan2(foe.x - me.x, foe.z - me.z))) || 1;
    for (let k = 0; k < 36; k++) { me.vx = 7 * way; me.x += 7 * way * DT; rig.update(input(me, foe)); }
    me.vx = 0;
    for (let k = 0; k < 60; k++) rig.update(input(me, foe));
    expect(Math.abs(wrap(rig.heading - before)) * DEG).toBeLessThan(10);
    expect(Math.sign(seen(rig, foe.x, 1, foe.z).x)).toBe(-Math.sign(from));
    expect(whole(rig, me)).toBe(true); expect(inside(seen(rig, foe.x, 1, foe.z))).toBe(true);
  });
  it('follows a key run past the opponent slowly while they are well inside the frame; a stick\'s run as it always was', () => {
    const peak = (latched: boolean) => {
      const rig = new SmartRig(), me: Body = { x: 0, y: 0, z: 3 }, foe = { x: 0, y: 0, z: 0 };
      rig.update(input(me, foe, { placed: true, latched }));
      for (let k = 0; k < 90; k++) rig.update(input(me, foe, { latched }));
      const fx = Math.sin(rig.heading), fz = Math.cos(rig.heading);
      let most = 0, last = rig.heading;
      for (let k = 0; k < 72; k++) {
        me.vx = fx * 7; me.vz = fz * 7; me.x += fx * 7 * DT; me.z += fz * 7 * DT; rig.update(input(me, foe, { latched }));
        const p = seen(rig, foe.x, 1, foe.z), rate = Math.abs(wrap(rig.heading - last)) / DT; last = rig.heading;
        if (k > 10 && p.z < 1 && Math.abs(p.x) < .4) most = Math.max(most, rate);
      }
      return most;
    };
    expect(peak(true)).toBeLessThanOrEqual(RUN_SOFT * 1.25);
    expect(peak(false)).toBeGreaterThan(RUN_SOFT * 2);
  });
  it('pans to a new opponent behind the player no faster than PAN_URGENT', () => {
    const rig = new SmartRig(), me = { x: 0, y: 0, z: 0 }, a = { id: 'a', x: 0, y: 0, z: 5 }, b = { id: 'b', x: 1, y: 0, z: -5 };
    rig.update(input(me, a, { placed: true, sole: false }));
    for (let k = 0; k < 60; k++) rig.update(input(me, a, { sole: false }));
    let most = 0, last = rig.heading;
    for (let k = 0; k < 30; k++) { rig.update(input(me, b, { sole: false })); most = Math.max(most, Math.abs(wrap(rig.heading - last)) / DT); last = rig.heading; }
    expect(most).toBeLessThanOrEqual(PAN_URGENT * 1.001);
    for (let k = 0; k < 240; k++) rig.update(input(me, b, { sole: false }));
    expect(inside(seen(rig, b.x, 1, b.z))).toBe(true);
  });
  it('eases the hard limit in: a jump with the lens squeezed against a wall does not yank the look', () => {
    const rig = new SmartRig(), me: Body = { x: 0, y: 0, z: 6 }, foe = { x: 0, y: 0, z: 2 }, bound = { halfX: 6.5, halfZ: 7, out: 1.4 };
    const pitch = () => Math.atan2(rig.lookY - rig.lensY, Math.hypot(rig.lookX - rig.lensX, rig.lookZ - rig.lensZ));
    rig.update(input(me, foe, { placed: true, bound }));
    for (let k = 0; k < 120; k++) rig.update(input(me, foe, { bound }));
    let most = 0, last = pitch();
    for (let k = 0; k < 90; k++) { me.y = Math.min(4.3, k * 26 * DT); rig.update(input(me, foe, { bound })); most = Math.max(most, Math.abs(pitch() - last) / DT); last = pitch(); }
    expect(most * DEG).toBeLessThan(300);
    expect(whole(rig, me)).toBe(true);
  });
  it('pitches the view VIEW_TILT up from the lens\'s line to the fight, the lens where it stood, through the fight\'s own steps', () => {
    const rig = new SmartRig(), me = { x: 0, y: 0, z: 0 }, foe = { x: 0, y: 0, z: 9 };
    const pitch = () => Math.atan2(rig.lookY - rig.lensY, Math.hypot(rig.lookX - rig.lensX, rig.lookZ - rig.lensZ));
    const sm = (x: number) => { const t = Math.min(1, Math.max(0, (x - PULL_FROM) / (PULL_TO - PULL_FROM))); return t * t * (3 - 2 * t); };
    rig.update(input(me, foe, { placed: true }));
    for (let k = 0; k < 90; k++) rig.update(input(me, foe));
    expect(VIEW_TILT * DEG).toBeGreaterThan(1.5); expect(VIEW_TILT * DEG).toBeLessThan(5);
    for (let k = 0; k < 120; k++) {
      foe.x = Math.sin(k * DT * Math.PI) * 1.5; rig.update(input(me, foe));
      const gd = Math.hypot(foe.x, foe.z), elevation = ELEVATION + (ELEVATION_NEAR - ELEVATION) * (1 - sm(gd));
      if (rig.state.hard < 1e-6 && rig.state.bounded < 1e-6) expect(pitch()).toBeCloseTo(-elevation + VIEW_TILT, 2);
    }
    expect(whole(rig, me)).toBe(true); expect(whole(rig, foe)).toBe(true);
  });
  it('eases a fall to the floor while the hard limit draws the look: no snap of the aim', () => {
    const rig = new SmartRig(), me: Body = { x: 0, y: 0, z: 5.5, high: 3.9 }, foe = { x: 0, y: 0, z: 2 }, bound = { halfX: 6.5, halfZ: 7, out: 1.4 };
    const pitch = () => Math.atan2(rig.lookY - rig.lensY, Math.hypot(rig.lookX - rig.lensX, rig.lookZ - rig.lensZ));
    rig.update(input(me, foe, { placed: true, bound }));
    for (let k = 0; k < 180; k++) { me.y = Math.min(1, k * DT * 12); rig.update(input(me, foe, { bound })); }
    expect(rig.state.hard).toBeGreaterThan(.2);
    let most = 0, last = pitch(); me.lying = true;
    for (let k = 0; k < 60; k++) { rig.update(input(me, foe, { bound })); most = Math.max(most, Math.abs(pitch() - last) / DT); last = pitch(); }
    expect(most * DEG).toBeLessThan(150);
    expect(inside(seen(rig, me.x, me.y + .3, me.z))).toBe(true);
  });
  it('holds still through a hit freeze', () => {
    const rig = new SmartRig(), me = { x: 0, y: 0, z: 0 }, foe = { x: 0, y: 0, z: 4 };
    rig.update(input(me, foe, { placed: true }));
    for (let k = 0; k < 60; k++) rig.update(input(me, foe));
    foe.x = -3;
    const before = rig.heading;
    for (let k = 0; k < 6; k++) rig.update(input(me, foe, { frozen: true }));
    expect(Math.abs(wrap(rig.heading - before)) * DEG).toBeLessThan(1);
  });
});

describe('the Smart camera in FollowCamera', () => {
  const body = (id: string, x: number, z: number) => { const g = new THREE.Group(); g.position.set(x, 0, z); return { state: { id, fighter: 'goku', alive: true, grounded: true, action: 'idle' }, group: g, velocity: new THREE.Vector3() } as unknown as Fighter; };
  it('reads the keys against the view and the aim against the line to the opponent it holds, and the other modes are untouched by it', () => {
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 300), follow = new FollowCamera(camera), me = body('me', 0, 0), foe = body('foe', 3, 4);
    follow.mode = 'smart'; follow.sole = true; follow.director.crowd = new Map([['me', me], ['foe', foe]]);
    for (let k = 0; k < 90; k++) follow.update(DT, me, follow.inputYaw, follow.inputPitch, [], .5, foe, false);
    const line = Math.atan2(3, 4);
    expect(Math.abs(wrap(follow.aimYaw - line))).toBeLessThan(.02);
    expect(Math.abs(wrap(follow.movementBasis(1) - follow.movementYaw))).toBeLessThan(1e-9);
    expect(Math.abs(wrap(follow.movementYaw - line))).toBeGreaterThan(.05);
    const run = follow.movementBasis(1);
    foe.group.position.set(-5, 0, 2);
    for (let k = 0; k < 120; k++) { follow.update(DT, me, follow.inputYaw, follow.inputPitch, [], .5, foe, false); expect(Math.abs(wrap(follow.movementBasis(1) - run))).toBeLessThan(1e-6); }
    expect(Math.abs(wrap(follow.movementYaw - run))).toBeGreaterThan(.05);
    follow.movementBasis(0);
    expect(Math.abs(wrap(follow.movementBasis(1) - follow.movementYaw))).toBeLessThan(1e-9);
    expect(Math.abs(wrap(follow.movementBasis(0) - follow.movementYaw))).toBeLessThan(1e-9);
    {
      const hall = new FollowCamera(new THREE.PerspectiveCamera(50, 16 / 9, .1, 300)), p = body('p', 0, 5.5), q = body('q', 0, 2);
      hall.mode = 'smart'; hall.sole = true; hall.director.crowd = new Map([['p', p], ['q', q]]); hall.stageBounds = STAGES['chunin-exam-room'];
      for (let k = 0; k < 120; k++) hall.update(DT, p, hall.inputYaw, hall.inputPitch, [], .5, q, false);
      const held = hall.movementBasis(1); let hard = 0;
      for (let k = 0; k < 120; k++) {
        p.group.position.y = Math.min(1.5, k * DT * 6); (p.state as { grounded: boolean }).grounded = p.group.position.y < .01;
        hall.update(DT, p, hall.inputYaw, hall.inputPitch, [], .5, q, false);
        hard = Math.max(hard, hall.smart.state.hard); expect(Math.abs(wrap(hall.movementBasis(1) - held))).toBeLessThan(1e-6);
      }
      expect(hard).toBeGreaterThan(.2);
    }
    follow.mode = 'dynamic';
    for (let k = 0; k < 30; k++) follow.update(DT, me, follow.inputYaw, follow.inputPitch, [], .5, foe, false);
    expect(follow.aimYaw).toBeCloseTo(follow.movementYaw, 9);
  });
});
