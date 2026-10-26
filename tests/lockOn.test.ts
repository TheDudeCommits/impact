import { describe, expect, it } from 'vitest';
import { bracketArm, bracketFade, box, FADE_FROM, FADE_TO, lockFrame, MIN_ASPECT, MIN_BOX, PAD_END, PAD_SIDE, padBox, pinWidth, type LockFrame } from '../src/render/lockAnchors';
import {
  BOOST_HOLD, BOOST_OUT, defaultPanels, easeOutBack, edgePlacement, flashAt, FLASH_HOLD, FLASH_OUT, LockOnModel, quietNotice, RELEASE, RELEASE_SCALE,
  safeArea, setPanel, smoothDamp, SNAP, snapScale, STAMP, topLimit, TRAVEL, SETTLE, type LockInput, type SafeArea,
} from '../src/ui/LockOnView';


const W = 1600, H = 900;
function frame(l: number, t: number, r: number, b: number, extra: Partial<LockFrame> = {}): LockFrame {
  const f = lockFrame();
  Object.assign(f, { ok: true, inFront: true, l, t, r, b, ax: (l + r) / 2, ay: t + (b - t) * .45, cx: (l + r) / 2, cy: t, dx: (l + r) / 2 - W / 2, dy: t + (b - t) * .45 - H / 2 }, extra);
  return f;
}
const area = () => defaultPanels(safeArea(), W, H);
function input(id: string | null, locked: boolean, f: LockFrame | null, more: Partial<LockInput> = {}): LockInput {
  return { visible: true, locked, id, name: id ? `Name ${id}` : '', distance: 7, frame: f, w: W, h: H, area: area(), effects: 1, reduced: false, ...more };
}
function run(model: LockOnModel, inp: LockInput, seconds: number) { let plan = model.plan; for (let t = 0; t < seconds - 1e-9; t += 1 / 60) plan = model.step(inp, 1 / 60); return plan; }
const centreOf = (p: { l: number; r: number; t: number; b: number }) => [(p.l + p.r) / 2, (p.t + p.b) / 2];

describe('the body box', () => {
  it('pads the joints out past the silhouette, sides more than ends', () => {
    const out = padBox(700, 300, 760, 500, box());
    expect(out.r - out.l).toBeCloseTo(Math.max(60 + 2 * PAD_SIDE * 200, MIN_ASPECT * (200 + 2 * PAD_END * 200)));
    expect(out.b - out.t).toBeCloseTo(200 + 2 * PAD_END * 200);
    expect((out.l + out.r) / 2).toBeCloseTo(730); expect((out.t + out.b) / 2).toBeCloseTo(400);
    expect(out.l).toBeLessThan(700); expect(out.r).toBeGreaterThan(760); expect(out.t).toBeLessThan(300); expect(out.b).toBeGreaterThan(500);
  });
  it('is never narrower than half its height', () => {
    const post = padBox(800, 100, 802, 700, box());
    expect((post.r - post.l) / (post.b - post.t)).toBeGreaterThanOrEqual(MIN_ASPECT - 1e-9);
  });
  it('frames a body lying down wide and short', () => {
    const lying = padBox(600, 500, 900, 560, box());
    expect(lying.r - lying.l).toBeGreaterThan(2.5 * (lying.b - lying.t));
    expect(lying.b - lying.t).toBeLessThan(120);
  });
  it('keeps a fighter across the arena readable', () => {
    const far = padBox(800, 400, 803, 410, box());
    expect(far.b - far.t).toBeGreaterThanOrEqual(MIN_BOX); expect(far.r - far.l).toBeGreaterThanOrEqual(MIN_BOX);
  });
});

describe('the clamps', () => {
  it('sizes the bracket arms at a fifth of the short side, 10 to 36 px', () => {
    expect(bracketArm(100, 200)).toBeCloseTo(20);
    expect(bracketArm(300, 600)).toBe(36);
    expect(bracketArm(30, 60)).toBe(10);
    expect(bracketArm(400, 90)).toBeCloseTo(18);
  });
  it('scales the pin gently with the body, 16 to 28 px wide', () => {
    expect(pinWidth(185)).toBeCloseTo(24);
    expect(pinWidth(20)).toBe(16); expect(pinWidth(2000)).toBe(28);
    expect(pinWidth(300)).toBeGreaterThan(pinWidth(150));
    expect(pinWidth(260) / pinWidth(130)).toBeLessThan(1.45);
  });
  it('keeps the pin under the meters at the sides and the banner in the middle', () => {
    const a = area();
    expect(topLimit(200, 12, a, H)).toBeCloseTo(.19 * H + 6);
    expect(topLimit(800, 12, a, H)).toBeCloseTo(.1 * H + 6);
    expect(topLimit(1400, 12, a, H)).toBeCloseTo(.19 * H + 6);
    const bottomOnly = safeArea(); setPanel(bottomOnly, 0, 900, 650, 1600, 900); bottomOnly.count = 1;
    expect(topLimit(1200, 12, bottomOnly, H)).toBe(6);
  });
});

describe('fading the brackets on a body that fills the view', () => {
  it('holds them below ~52% of the view height and drops them by ~64%, keeping the pin', () => {
    expect(bracketFade(.3 * H, H)).toBe(1);
    expect(bracketFade(FADE_FROM * H, H)).toBe(1);
    expect(bracketFade(FADE_TO * H, H)).toBe(0);
    expect(bracketFade(.8 * H, H)).toBe(0);
    const mid = bracketFade((FADE_FROM + FADE_TO) / 2 * H, H);
    expect(mid).toBeGreaterThan(.3); expect(mid).toBeLessThan(.7);
    let last = 1; for (let k = .4; k < .8; k += .01) { const v = bracketFade(k * H, H); expect(v).toBeLessThanOrEqual(last + 1e-12); last = v; }
    const model = new LockOnModel(), huge = frame(500, 60, 1100, 860);
    const plan = run(model, input('a', true, huge), .5);
    expect(plan.bracket).toBe(false); expect(plan.pin).toBe(true);
  });
});

describe('the motion curves', () => {
  it('snaps in from 1.5x through a small overshoot', () => {
    expect(snapScale(0)).toBeCloseTo(1.5); expect(snapScale(SNAP)).toBeCloseTo(1);
    let least = 2; for (let t = 0; t <= SNAP; t += .002) least = Math.min(least, snapScale(t));
    expect(least).toBeLessThan(.99); expect(least).toBeGreaterThan(.9);
    expect(easeOutBack(0)).toBeCloseTo(0); expect(easeOutBack(1)).toBeCloseTo(1);
  });
  it('flashes paper-white, then lets go to red', () => {
    expect(flashAt(0)).toBe(1); expect(flashAt(FLASH_HOLD - .01)).toBe(1);
    expect(flashAt(FLASH_HOLD + FLASH_OUT)).toBe(0);
  });
  it('smooths critically damped: no overshoot, much the same at 30 and 60 fps', () => {
    const at = (dt: number) => { const s = new Float64Array([0, 0]); let peak = 0; for (let t = 0; t < .3; t += dt) { smoothDamp(s, 0, 100, .075, dt); peak = Math.max(peak, s[0]); } return { value: s[0], peak }; };
    const a = at(1 / 60), b = at(1 / 30);
    expect(a.peak).toBeLessThanOrEqual(100 + 1e-6); expect(b.peak).toBeLessThanOrEqual(100 + 1e-6);
    expect(a.value).toBeGreaterThan(95); expect(Math.abs(a.value - b.value)).toBeLessThan(2);
    const s = new Float64Array([0, 0]); smoothDamp(s, 0, 100, .075, 1 / 60);
    expect(s[0]).toBeGreaterThan(1); expect(s[0]).toBeLessThan(25);
  });
});

describe('the state machine', () => {
  const A = frame(700, 300, 760, 520), B = frame(1000, 340, 1040, 500);
  it('a fresh lock snaps the brackets in, flashes, drops the pin, bursts and stamps the name', () => {
    const model = new LockOnModel();
    run(model, input('a', false, A), .3);
    expect(model.plan.bracket).toBe(false); expect(model.plan.pin).toBe(true); expect(model.plan.solid).toBe(false);
    const first = model.step(input('a', true, A), 1 / 60);
    expect(first.burst).toBe(true); expect(first.burstPeak).toBeLessThanOrEqual(.55); expect(first.burstPeak).toBeGreaterThan(.45);
    expect(first.bracket).toBe(true); expect(first.solid).toBe(true); expect(first.flash).toBe(1);
    expect(first.r - first.l).toBeGreaterThan(1.35 * (padBox(A.l, A.t, A.r, A.b, box()).r - padBox(A.l, A.t, A.r, A.b, box()).l));
    expect(first.stamp).toBe(true); expect(first.stampText).toBe('Name a');
    const dropFrom = first.py;
    const settled = run(model, input('a', true, A), .4), padded = padBox(A.l, A.t, A.r, A.b, box());
    expect(settled.py - dropFrom).toBeGreaterThan(15);
    expect(settled.burst).toBe(false); expect(settled.flash).toBe(0);
    expect(settled.l).toBeCloseTo(padded.l, 1); expect(settled.r).toBeCloseTo(padded.r, 1); expect(settled.t).toBeCloseTo(padded.t, 1); expect(settled.b).toBeCloseTo(padded.b, 1);
    expect(settled.py).toBeLessThan(A.t);
    run(model, input('a', true, A), STAMP);
    expect(model.plan.stamp).toBe(false);
  });
  it('the concentration lines follow the effects setting and stay off under reduced motion', () => {
    const lite = new LockOnModel(); run(lite, input('a', false, A), .2);
    expect(lite.step(input('a', true, A, { effects: .5 }), 1 / 60).burstPeak).toBeCloseTo(.275);
    const none = new LockOnModel(); run(none, input('a', false, A), .2);
    expect(none.step(input('a', true, A, { effects: 0 }), 1 / 60).burst).toBe(false);
    const still = new LockOnModel(); run(still, input('a', false, A), .2);
    const plan = still.step(input('a', true, A, { reduced: true }), 1 / 60);
    expect(plan.burst).toBe(false); expect(plan.bracket).toBe(true);
    expect(plan.r - plan.l).toBeCloseTo(padBox(A.l, A.t, A.r, A.b, box()).r - padBox(A.l, A.t, A.r, A.b, box()).l, 0);
  });
  it('a switch slides the brackets from one box to the next, with no burst', () => {
    const model = new LockOnModel();
    run(model, input('a', true, A), .6);
    const from = { ...model.plan }, to = padBox(B.l, B.t, B.r, B.b, box());
    const start = model.step(input('b', true, B), 1 / 60);
    expect(start.burst).toBe(false); expect(start.stamp).toBe(true); expect(start.stampText).toBe('Name b');
    const [fx] = centreOf(from), [tx] = centreOf(to);
    expect(centreOf(start)[0]).toBeLessThan(fx + .35 * (tx - fx));
    run(model, input('b', true, B), TRAVEL / 2 - 1 / 60);
    const mid = centreOf(model.plan)[0];
    expect(mid).toBeGreaterThan(fx + .2 * (tx - fx)); expect(mid).toBeLessThan(fx + .95 * (tx - fx));
    run(model, input('b', true, B), TRAVEL / 2 + SETTLE);
    const end = model.plan;
    expect(centreOf(end)[0]).toBeCloseTo(tx, 0); expect(end.r - end.l).toBeCloseTo(to.r - to.l, 0);
    expect(end.px).toBeCloseTo(B.cx, 0);
  });
  it('a release flies the brackets out and fades them; the pin goes hollow on the nominee', () => {
    const model = new LockOnModel();
    run(model, input('a', true, A), .6);
    const held = { ...model.plan };
    const r1 = model.step(input('a', false, A), 1 / 60);
    expect(r1.bracket).toBe(true); expect(r1.solid).toBe(false); expect(r1.burst).toBe(false);
    run(model, input('a', false, A), RELEASE * .6);
    const mid = model.plan;
    expect(mid.r - mid.l).toBeGreaterThan(held.r - held.l); expect(mid.r - mid.l).toBeLessThan(RELEASE_SCALE * (held.r - held.l) + 1);
    expect(mid.bOpacity).toBeLessThan(.9); expect(mid.bOpacity).toBeGreaterThan(0);
    run(model, input('a', false, A), RELEASE);
    expect(model.plan.bracket).toBe(false); expect(model.plan.pin).toBe(true); expect(model.plan.solid).toBe(false);
  });
  it('the name stamp belongs to its lock: a release or a new nominee takes it away', () => {
    const model = new LockOnModel();
    run(model, input('a', false, A), .2);
    expect(model.step(input('a', true, A), 1 / 60).stamp).toBe(true);
    expect(model.step(input('a', false, A), 1 / 60).stamp).toBe(false);
    model.step(input('a', true, A), 1 / 60);
    const next = model.step(input('b', false, B), 1 / 60);
    expect(next.stamp).toBe(false);
  });
  it('a release with the target gone plays out where the brackets were', () => {
    const model = new LockOnModel();
    run(model, input('a', true, A), .6);
    const plan = model.step(input(null, false, null), 1 / 60);
    expect(plan.bracket).toBe(true); expect(plan.pin).toBe(false);
    run(model, input(null, false, null), RELEASE + .05);
    expect(model.plan.show).toBe(false); expect(model.idle).toBe(true);
  });
  it('hides the nominee pin under main.ts rule and lets a lock change show through a hit-freeze fade', () => {
    const model = new LockOnModel();
    run(model, input('a', false, A, { visible: false }), .3);
    expect(model.plan.pin).toBe(false);
    const lock = model.step(input('a', true, A), 1 / 60);
    expect(lock.boost).toBe(1);
    run(model, input('a', true, A), BOOST_HOLD + BOOST_OUT + .05);
    expect(model.plan.boost).toBe(0);
  });
  it('smooths a limb swinging out of the box without lagging the body', () => {
    const model = new LockOnModel();
    run(model, input('a', true, A), .6);
    const before = { ...model.plan };
    const moved = frame(A.l + 30, A.t, A.r + 30, A.b);
    const shifted = model.step(input('a', true, moved), 1 / 60);
    expect(centreOf(shifted)[0] - centreOf(before)[0]).toBeCloseTo(30, 0);
    run(model, input('a', true, moved), .5);
    const swing = frame(moved.l, moved.t, moved.r + 60, moved.b, { ax: moved.ax, ay: moved.ay, cx: moved.cx, cy: moved.cy });
    const settledRight = model.plan.r;
    const one = model.step(input('a', true, swing), 1 / 60);
    expect(one.r - settledRight).toBeGreaterThan(0); expect(one.r - settledRight).toBeLessThan(.3 * 60 * (1 + 2 * .13));
  });
  it('off screen, shows the edge arrow with the distance instead of brackets', () => {
    const model = new LockOnModel();
    run(model, input('a', true, A), .6);
    const behind = lockFrame(); Object.assign(behind, { ok: false, inFront: false, dx: 300, dy: 400 });
    const plan = run(model, input('a', true, behind, { distance: 23.4 }), .3);
    expect(plan.edge).toBe(true); expect(plan.edgeLocked).toBe(true); expect(plan.distance).toBe(23);
    expect(plan.bracket).toBe(false); expect(plan.pin).toBe(false);
    const nominee = new LockOnModel();
    const soft = run(nominee, input('a', false, behind), .3);
    expect(soft.edge).toBe(true); expect(soft.edgeLocked).toBe(false); expect(soft.eScale).toBeLessThan(plan.eScale);
    run(model, input('a', true, A), .4);
    expect(model.plan.edge).toBe(false); expect(model.plan.bracket).toBe(true);
  });
});

describe('the off-screen arrow keeps to a safe rectangle', () => {
  const inside = (a: SafeArea, x: number, y: number) => {
    for (let i = 0; i < a.count; i++) { const p = a.panels; if (x > p[i * 4] - a.pad + .5 && x < p[i * 4 + 2] + a.pad - .5 && y > p[i * 4 + 1] - a.pad + .5 && y < p[i * 4 + 3] + a.pad - .5) return true; }
    return false;
  };
  it('pins to the edge on the bearing, inside the margin', () => {
    const a = area(), out = { x: 0, y: 0, angle: 0 };
    edgePlacement(500, 0, W, H, a, out);
    expect(out.x).toBeCloseTo(W - a.edge); expect(out.y).toBeCloseTo(H / 2); expect(out.angle).toBeCloseTo(0);
    edgePlacement(-500, 0, W, H, a, out);
    expect(out.x).toBeCloseTo(a.edge); expect(out.angle).toBeCloseTo(Math.PI);
  });
  it('stops short of the move cards, the controls strip and the meters, keeping the bearing', () => {
    const a = area(), out = { x: 0, y: 0, angle: 0 };
    edgePlacement(600, 330, W, H, a, out);
    expect(out.y).toBeLessThan(.715 * H - a.pad + 1);
    expect(Math.atan2(out.y - H / 2, out.x - W / 2)).toBeCloseTo(Math.atan2(330, 600));
    edgePlacement(-600, 420, W, H, a, out);
    expect(inside(a, out.x, out.y)).toBe(false);
    edgePlacement(-500, -400, W, H, a, out);
    expect(out.y).toBeGreaterThan(.19 * H + a.pad - 1);
  });
  it('never lands under a panel or outside the screen, whatever the bearing', () => {
    const a = area(), out = { x: 0, y: 0, angle: 0 };
    for (let k = 0; k < 360; k++) {
      const t = k * Math.PI / 180;
      edgePlacement(Math.cos(t), Math.sin(t), W, H, a, out);
      expect(inside(a, out.x, out.y), `bearing ${k}`).toBe(false);
      expect(out.x).toBeGreaterThanOrEqual(a.edge - 1e-6); expect(out.x).toBeLessThanOrEqual(W - a.edge + 1e-6);
      expect(out.y).toBeGreaterThanOrEqual(a.edge - 1e-6); expect(out.y).toBeLessThanOrEqual(H - a.edge + 1e-6);
    }
  });
  it('fits the measured layout at 1280x720 as well', () => {
    const a = safeArea(), out = { x: 0, y: 0, angle: 0 };
    [[18, 9, 485, 137], [795, 9, 1262, 137], [548, 20, 733, 80], [682, 516, 1267, 665], [0, 645, 582, 697]].forEach((p, i) => setPanel(a, i, p[0], p[1], p[2], p[3]));
    a.count = 5;
    for (let k = 0; k < 360; k += 3) { const t = k * Math.PI / 180; edgePlacement(Math.cos(t), Math.sin(t), 1280, 720, a, out); expect(inside(a, out.x, out.y), `bearing ${k}`).toBe(false); }
  });
});

describe('the lock notices', () => {
  it('stay quiet while the reticle is up, and only those two', () => {
    expect(quietNotice('LOCKED ON', true)).toBe(true);
    expect(quietNotice('LOCK RELEASED', true)).toBe(true);
    expect(quietNotice('PARRY', true)).toBe(false);
    expect(quietNotice('NO BOSS TO LOCK', true)).toBe(false);
  });
  it('are said as ever with no reticle (Arcade Survival)', () => {
    expect(quietNotice('LOCKED ON', false)).toBe(false);
    expect(quietNotice('LOCK RELEASED', false)).toBe(false);
  });
});
