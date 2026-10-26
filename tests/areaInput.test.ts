import { describe, expect, it } from 'vitest';
import { AWAKEN_CHORD, GamepadControls, type PadFrame, type PadState } from '../src/input/gamepad';
import { AreaAim } from '../src/input/areaAim';
import { AREA_DEFAULTS } from '../src/engine/sim/areaMoves';

const L2 = 6, R2 = 7, L1 = 4;
const pad = (down: number[] = []): PadState => ({ index: 0, id: 'DualSense Wireless Controller', mapping: 'standard', connected: true, axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: down.includes(i), value: down.includes(i) ? 1 : 0 })) });
function play(timeline: [number, number[]][], until = 400) {
  const controls = new GamepadControls();
  controls.read(pad(), true, 0);
  const frames: (PadFrame & { t: number })[] = [];
  let held: number[] = [];
  for (let t = 16; t <= until; t += 16) {
    for (const [at, down] of timeline) if (at <= t && at > t - 16) held = down;
    frames.push({ ...controls.read(pad(held), true, t), t });
  }
  return {
    attacks: frames.filter(f => f.attack).map(f => `${f.attack}@${f.t}`),
    awakens: frames.filter(f => f.awaken).length,
    area: frames.filter(f => f.area).map(f => `${f.area}@${f.t}`),
    frames,
  };
}

describe('the pad: L2, R2 and the AWAKEN chord', () => {
  it('awakens on L2 then R2 inside the window, and throws neither the ultimate nor the area', () => {
    const run = play([[16, [L2]], [64, [L2, R2]], [200, []]]);
    expect(run.awakens).toBe(1);
    expect(run.attacks).toEqual([]);
    expect(run.area.filter(a => a.startsWith('release'))).toEqual([]);
  });

  it('awakens on R2 then L2 inside the window: the aim R2 began is put away, never cast', () => {
    const run = play([[16, [R2]], [80, [R2, L2]], [240, []]]);
    expect(run.awakens).toBe(1);
    expect(run.attacks).toEqual([]);
    expect(run.area).toEqual(['press@16', 'cancel@80']);
  });

  it('awakens on both at once', () => {
    const run = play([[32, [L2, R2]], [200, []]]);
    expect(run.awakens).toBe(1);
    expect(run.attacks).toEqual([]);
    expect(run.area).toEqual([]);
  });

  it('throws the ultimate once L2 has been held alone for the window, or as it comes up if sooner', () => {
    const held = play([[16, [L2]], [300, []]]);
    expect(held.attacks).toEqual([`ultimate@${16 + Math.ceil(AWAKEN_CHORD / 16) * 16}`]);
    expect(held.awakens).toBe(0);
    const tapped = play([[16, [L2]], [48, []]]);
    expect(tapped.attacks).toEqual(['ultimate@48']);
  });

  it('aims the area on R2 down and casts it on R2 up; a quick tap casts as the window ends', () => {
    const aimed = play([[16, [R2]], [320, []]]);
    expect(aimed.area).toEqual(['press@16', 'release@320']);
    expect(aimed.attacks).toEqual([]);
    const tap = play([[16, [R2]], [48, []]]);
    expect(tap.area).toEqual(['press@16', `release@${16 + Math.ceil(AWAKEN_CHORD / 16) * 16}`]);
  });

  it('keeps L2 pressed long after R2 an ultimate, not an awakening', () => {
    const run = play([[16, [R2]], [256, [R2, L2]], [400, [R2]]], 500);
    expect(run.awakens).toBe(0);
    expect(run.attacks).toHaveLength(1);
    expect(run.attacks[0]).toMatch(/^ultimate@/);
    expect(run.area).toEqual(['press@16']);
  });

  it('reports L1 as it goes down, which puts an aim away', () => {
    const run = play([[16, [R2]], [96, [R2, L1]], [200, []]]);
    expect(run.frames.find(f => f.t === 96)?.guardPressed).toBe(true);
  });
});

describe('the reticle', () => {
  it('starts on the locked target in range, else ahead; stays in range; casts only when valid', () => {
    const aim = new AreaAim();
    aim.begin('pad');
    aim.follow({ x: 0, z: 0 }, 0, { x: 3, z: 10 }, 14, 4, true);
    expect(aim.view).toMatchObject({ active: true, x: 3, z: 10, range: 14, radius: 4, valid: true });
    aim.nudge(0, 40, 0);
    expect(Math.hypot(aim.view.x, aim.view.z)).toBeCloseTo(14, 5);
    expect(aim.release()).toEqual({ x: aim.view.x, z: aim.view.z });
    expect(aim.active).toBe(false);

    aim.begin('keyboard');
    aim.follow({ x: 0, z: 0 }, 0, { x: 0, z: 30 }, 14, 4, true);
    expect(aim.view.z).toBeCloseTo(AREA_DEFAULTS.aim, 5);
    aim.follow({ x: 0, z: 0 }, 0, undefined, 14, 4, false);
    expect(aim.release()).toBeUndefined();
  });

  it('places a touch drag as a share of the range from the fighter, in the view', () => {
    const aim = new AreaAim();
    aim.begin('touch');
    aim.place(0, .5);
    aim.follow({ x: 2, z: 2 }, 0, undefined, 14, 4, true);
    expect(aim.view).toMatchObject({ x: 2, z: 9 });
    aim.place(3, 4);
    aim.follow({ x: 0, z: 0 }, 0, undefined, 10, 4, true);
    expect(Math.hypot(aim.view.x, aim.view.z)).toBeCloseTo(10, 5);
    aim.cancel();
    expect(aim.release()).toBeUndefined();
  });
});
