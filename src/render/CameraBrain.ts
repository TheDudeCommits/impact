const TAU = Math.PI * 2;
const wrapped = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (x: number, a: number, b: number) => x < a ? a : x > b ? b : x;
const smooth = (x: number, a: number, b: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const blend = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);
const ease = (value: number, goal: number, up: number, down: number, dt: number) => value + (goal - value) * blend(goal > value ? up : down, dt);

export const SPEED = 2.6, CROSS_SPEED = 4, MAX_SPEED = 6, ACCEL = 9, CROSS_ACCEL = 17, JERK = 120, BRAKE = .6, GAIN = 3.2, FOLLOW = 12, STEP = 1 / 120;
export const FF_SHARE = .85, FF_RATE = 8, FF_NEAR = 1.3, FF_FULL = 2.6;
export const FOE_ANGLE = .1, MAX_OFFSET = .8;
export const SIDE_MARGIN = .5, SIDE_HOLD = .12, SIDE_REST = 1.2, SIDE_TIME = .6, SIDE_LIFT = .35;
export const SWING_BIG = 1.1;
export const URGENT_IN = 8, URGENT_OUT = 6;
export const SOFT_NEAR = 14, SOFT_FAR = 22, HARD_NEAR = 34, HARD_FAR = 44, DEAD_ZONE = .45, FULL_ASSIST = .9;
export const W_ATTACK = .9, W_HIT = .75, W_NEAR = .2, HIT_FOR = 3, GROUP_NEAR = 9, GROUP_FAR = 13, THREAT = .5;
export const DELTA_STEP = .07, DELTA_MOST = 1.05, FRAME_SAFE = .8, TARGET_SAFE = .78, TURN_COST = .35, DELTA_SPEED = 1.2, DELTA_ACCEL = 5, DELTA_GAIN = 4;
export const GROUP_BOOM = 1.5, GROUP_LIFT = .7, GROUP_FOV = 5, GROUP_IN = 3, GROUP_OUT = .55;
export const LEAD_TIME = .16, LEAD_MOST = 1.1, AHEAD_PER = .22, AHEAD_MOST = 1.7, LEAD_RATE = 3.5, EXPLORE_BOOM = .3, EXPLORE_LIFT = .3;
export const DYN_BOOM = .5, DYN_LIFT = .1;
export const BASE_FOV = 50, DASH_FOV = 1.5, RUN_FOV = 1, PLUNGE_FOV = 3, FOV_LEAST = 45, FOV_MOST = 60;
export const JUGGLE_LIFT = .3, JUGGLE_BOOM = .35, PLUNGE_LIFT = 1, PLUNGE_BOOM = .9, PLUNGE_FOCUS = -.25, DOWN_BOOM = .45, DOWN_LIFT = .3;
export const YIELD_FROM = .05, YIELD_FULL = .45, YIELD_HOLD = .3, YIELD_BACK = 1, EDGE = .78, EDGE_OUT = 1.08, EDGE_SPEED = 1.2;
export const RETURN_SHARE = .6, RETURN_AFTER = 1.2;
export const SWITCH_SPEED = 1.5, OUT_SWITCH_SPEED = 2.4, SWITCH_PEAK = 2.6, SWITCH_LEAST = .55, SWITCH_MOST = 1.4, SWITCH_TAIL = .25, SWITCH_FOLLOW = 10, SWITCH_FROM = .1,
  SWITCH_BOOM = .4, SWITCH_LIFT = .15, SWITCH_FOV = 2;
export const PENDING_WEIGHT = .9;
export const CALM_INNER = .3, CALM_KEEP = .1, CALM_OUTER = .5, CALM_NEAR = 1.6, CALM_FAR = 2.8, CALM_FF = .03, CALM_GAIN = 2.2, CALM_ACCEL = 5.5, CALM_GROUP = .5;
export const CROSS_LEAD = .22, CROSS_FROM = 5, CROSS_MISS = .7;
export const AIR_FROM = 1.4, AIR_FULL = 5, AIR_BOOM2 = 1.1, AIR_LIFT2 = .35, AIR_FOV2 = 4;
export const PITCH_LEVEL = .02, PITCH_REST = 1.4, PITCH_RAMP = .8, PITCH_RATE = .9;

export interface Subject {
  id: string; x: number; y: number; z: number;
  high: number; radius: number;
  target: boolean;
  attacking: boolean;
  hitAgo: number;
  airborne: boolean; lying: boolean; launched: boolean;
  weight: number;
}
export const subject = (): Subject => ({ id: '', x: 0, y: 0, z: 0, high: 1.95, radius: .3, target: false, attacking: false, hitAgo: Infinity, airborne: false, lying: false, launched: false, weight: 0 });

export interface BrainInput {
  dt: number;
  x: number; y: number; z: number; vx: number; vz: number;
  grounded: boolean; dashing: boolean; plunging: boolean; reacting: boolean;
  basisHeld: boolean;
  heading: number; back: number; shoulder: number; tanH: number;
  lensBack: number; lensShoulder: number;
  manual: number; tilted: boolean;
  locked: boolean;
  engage: number; foe: number;
  subjects: readonly Subject[]; count: number;
  pending: string; pendingShare: number; floor: number;
  form: number;
}
export const brainInput = (): BrainInput => ({ dt: 0, x: 0, y: 0, z: 0, vx: 0, vz: 0, grounded: true, dashing: false, plunging: false, reacting: false, basisHeld: false,
  heading: 0, back: 3.1, shoulder: 1.05, lensBack: NaN, lensShoulder: NaN, tanH: Math.tan(25 * Math.PI / 180) * 16 / 9, manual: 0, tilted: false, locked: false, engage: 0, foe: FOE_ANGLE, subjects: [], count: 0,
  pending: '', pendingShare: 0, floor: 0, form: 0 });

export type BrainMode = 'idle' | 'explore' | 'duel' | 'group';

export function calmInner(distance: number, own: number) { return clamp(own - CALM_KEEP, 0, CALM_INNER * (1 - smooth(distance, CALM_NEAR, CALM_FAR))); }
export function calmOuter(distance: number) { return CALM_OUTER * (1 - smooth(distance, CALM_NEAR, CALM_FAR)); }

export function framing(bearing: number, distance: number, shoulder: number, back: number, most = MAX_OFFSET, foe = FOE_ANGLE) {
  const side = shoulder < 0 ? -1 : 1, s = Math.abs(shoulder);
  const reach = s * Math.cos(foe) + back * Math.sin(foe);
  return bearing + side * (foe + Math.asin(Math.min(reach / Math.max(distance, 1e-3), Math.sin(most - foe))));
}
export function across(x: number, z: number, px: number, pz: number, heading: number, back: number, shoulder: number, tanH: number) {
  const sh = Math.sin(heading), ch = Math.cos(heading);
  const ex = px - sh * back - ch * shoulder, ez = pz - ch * back + sh * shoulder;
  const dx = x - ex, dz = z - ez, depth = dx * sh + dz * ch;
  return depth > .5 ? (dz * sh - dx * ch) / (depth * tanH) : NaN;
}

export type PlayKind = 'launch' | 'knockdown' | 'splat' | 'smash';
export const SHOT_GAP = 2.5;
export const PLAY_LENGTH: Record<PlayKind, number> = { launch: .7, knockdown: .62, splat: .45, smash: .75 };
const PLAY_SHAPE: Record<PlayKind, { back: number; up: number; tilt: number; fov: number; trauma: number; rise: number; hold: number; turn: number }> = {
  launch: { back: .25, up: -.15, tilt: -.065, fov: 2.5, trauma: 0, rise: .16, hold: .22, turn: 0 },
  knockdown: { back: -.15, up: .05, tilt: .015, fov: -2, trauma: .06, rise: .08, hold: .12, turn: 0 },
  splat: { back: -.15, up: .025, tilt: 0, fov: -2, trauma: .08, rise: .08, hold: .12, turn: 0 },
  smash: { back: .55, up: .3, tilt: .02, fov: 2, trauma: .2, rise: .12, hold: .15, turn: 0 },
};
const shape = { w: 0, back: 0, up: 0, tilt: 0, fov: 0, trauma: 0, turn: 0 };
export function playShape(kind: PlayKind, t: number) {
  const s = PLAY_SHAPE[kind], length = PLAY_LENGTH[kind];
  const w = t < 0 || t >= length ? 0 : t < s.rise ? smooth(t, 0, s.rise) : t < s.rise + s.hold ? 1 : 1 - smooth(t, s.rise + s.hold, length);
  const follow = t < 0 || t >= length ? 0 : smooth(t, s.rise * .5, s.rise + s.hold + .1) * (1 - smooth(t, length - .22, length));
  shape.w = w; shape.back = s.back * w; shape.up = s.up * w; shape.tilt = s.tilt * w; shape.fov = s.fov * w; shape.trauma = s.trauma; shape.turn = s.turn * follow;
  return shape;
}
export class ShotGate {
  last = -Infinity;
  allow(now: number, stringing: boolean, ender: boolean, authored: boolean) {
    if (authored || now - this.last < SHOT_GAP || (stringing && !ender)) return false;
    this.last = now; return true;
  }
  reset() { this.last = -Infinity; }
}

export class CameraBrain {
  goal = NaN; gain = 0; speed = SPEED; accel = ACCEL; ff = 0; side = 1;
  rate = GAIN;
  boom = DYN_BOOM; lift = DYN_LIFT; focus = 0; ahead = 0; leadX = 0; leadZ = 0; fov = BASE_FOV; pitchGoal = NaN; pitchRate = 0;
  slackLo = 0; slackHi = 0;
  mode: BrainMode = 'idle';
  duel = 0; group = 0; explore = 0; yieldTo = 0;
  velocity = 0; acceleration = 0; traced = 0;
  private clock = 0;
  private sideGoal = 1; private sideFrom = 1; private sideAt = -Infinity; private sideWant = 0;
  private steerAt = -Infinity; private steerPeak = 0; private pitchAt = -Infinity;
  private delta = 0; private deltaVelocity = 0; private deltaGoal = 0;
  private urgent = 0; private juggle = 0; private plunge = 0; private down = 0; private dash = 0;
  private bearing = NaN; private bearingRate = 0; private targetId = '';
  private leadVX = 0; private leadVZ = 0; private aheadV = 0;
  private steered = false;
  private swingWay = 0;
  switching = 0; switchShare = 0;
  foresaw = false;
  private swAt = -Infinity; private swDur = 0; private swSize = 0; private swGoal = 0; private swWay = 0;
  private airIn = 0;
  private tvx = 0; private tvz = 0; private tlx = NaN; private tlz = NaN;

  reset() {
    this.goal = NaN; this.gain = 0; this.speed = SPEED; this.accel = ACCEL; this.ff = 0; this.side = 1; this.rate = GAIN;
    this.boom = DYN_BOOM; this.lift = DYN_LIFT; this.focus = 0; this.ahead = 0; this.leadX = this.leadZ = 0; this.fov = BASE_FOV; this.pitchGoal = NaN; this.pitchRate = 0;
    this.mode = 'idle'; this.duel = this.group = this.explore = this.yieldTo = 0; this.velocity = this.acceleration = 0;
    this.clock = 0; this.sideGoal = this.sideFrom = 1; this.sideAt = -Infinity; this.sideWant = 0;
    this.steerAt = -Infinity; this.steerPeak = 0; this.pitchAt = -Infinity; this.slackLo = this.slackHi = 0;
    this.delta = this.deltaVelocity = this.deltaGoal = 0; this.urgent = this.juggle = this.plunge = this.down = this.dash = 0;
    this.bearing = NaN; this.bearingRate = 0; this.targetId = ''; this.leadVX = this.leadVZ = this.aheadV = 0; this.steered = false; this.swingWay = 0;
    this.switching = this.switchShare = 0; this.swAt = -Infinity; this.swDur = this.swSize = this.swGoal = 0;
    this.airIn = 0; this.tvx = this.tvz = 0; this.tlx = this.tlz = NaN;
  }
  get switchActive() { return this.swAt > -Infinity; }
  exact(brisk = false) { this.slackLo = this.slackHi = 0; if (brisk) { this.rate = Math.max(this.rate, GAIN); this.accel = Math.max(this.accel, ACCEL); } }
  settle() { if (this.swAt > -Infinity && this.clock - this.swAt >= this.swDur) this.swAt = -Infinity; }
  past(error: number) { return error - clamp(error, this.slackLo, this.slackHi); }

  think(i: BrainInput) {
    const dt = clamp(Number.isFinite(i.dt) ? i.dt : 0, 0, .25);
    this.clock += dt;
    const now = this.clock, H = i.heading;
    const rate = dt > 0 ? Math.abs(i.manual) / dt : 0, y = smooth(rate, YIELD_FROM, YIELD_FULL);
    const held = this.steerPeak * (1 - smooth(now - this.steerAt, YIELD_HOLD, YIELD_HOLD + YIELD_BACK));
    if (y > .02 && y >= held - 1e-9) { this.steerPeak = y; this.steerAt = now; }
    this.steered = y > .02;
    this.yieldTo = Math.max(y, held);
    if (i.tilted) this.pitchAt = now;
    let target: Subject | undefined, threatSum = 0, threats = 0;
    for (let k = 0; k < i.count; k++) {
      const s = i.subjects[k], d = Math.hypot(s.x - i.x, s.z - i.z);
      if (s.target) {
        const range = i.locked ? 1 - smooth(d, HARD_NEAR, HARD_FAR) : 1 - smooth(d, SOFT_NEAR, SOFT_FAR);
        s.weight = range; if (range > 0) target = s;
        continue;
      }
      let w = s.attacking ? W_ATTACK : s.hitAgo < HIT_FOR ? W_HIT * (1 - smooth(s.hitAgo, HIT_FOR - 1, HIT_FOR)) : W_NEAR * (1 - smooth(d, 5, 9));
      if (i.pending && s.id === i.pending) w = Math.max(w, PENDING_WEIGHT * clamp(i.pendingShare, 0, 1));
      s.weight = w * (1 - smooth(d, GROUP_NEAR, GROUP_FAR));
      if (s.weight >= THREAT) { threats++; threatSum += s.weight; }
    }
    const targetW = target ? target.weight : 0;
    const speed = Math.hypot(i.vx, i.vz);
    this.duel = ease(this.duel, targetW, 4, 3, dt);
    this.explore = ease(this.explore, !target && threats === 0 ? smooth(speed, 1, 4) : 0, 1.5, 4, dt);
    this.dash = ease(this.dash, i.dashing ? 1 : 0, 10, 2.5, dt);
    this.plunge = ease(this.plunge, i.plunging ? 1 : 0, 6, 1.2, dt);
    this.juggle = ease(this.juggle, target && target.launched && target.airborne ? 1 : 0, 5, 1.5, dt);
    this.down = ease(this.down, target && target.lying ? 1 : 0, 4, 1, dt);
    let goal = NaN, gain = 0, speedCap = SPEED, accel = ACCEL, ff = 0, settle = GAIN;
    let groupWant = 0;
    this.slackLo = this.slackHi = 0;
    if (target) {
      const dx = target.x - i.x, dz = target.z - i.z, d = Math.hypot(dx, dz), bearing = Math.atan2(dx, dz);
      const switched = this.targetId !== '' && target.id !== this.targetId;
      if (target.id === this.targetId && Number.isFinite(this.tlx) && dt > 0) {
        const vx = (target.x - this.tlx) / dt, vz = (target.z - this.tlz) / dt;
        if (Math.hypot(vx, vz) < 40) { const k = blend(10, dt); this.tvx += (vx - this.tvx) * k; this.tvz += (vz - this.tvz) * k; } else this.tvx = this.tvz = 0;
      } else this.tvx = this.tvz = 0;
      this.tlx = target.x; this.tlz = target.z;
      const jump = Number.isFinite(this.bearing) ? wrapped(bearing - this.bearing) : 0;
      if (target.id === this.targetId && Number.isFinite(this.bearing) && dt > 0 && Math.abs(jump) < .6)
        this.bearingRate += (clamp(jump / dt, -MAX_SPEED, MAX_SPEED) - this.bearingRate) * blend(FF_RATE, dt);
      else this.bearingRate = 0;
      this.bearing = bearing; this.targetId = target.id;
      const most = MAX_OFFSET + .2 * i.engage, s = Math.abs(i.shoulder) || 1e-3;
      const right = framing(bearing, d, s, i.back, most, i.foe), left = framing(bearing, d, -s, i.back, most, i.foe);
      let eR = wrapped(right - H), eL = wrapped(left - H);
      const x = across(target.x, target.z, i.x, i.z, H, Number.isFinite(i.lensBack) ? i.lensBack : i.back, Number.isFinite(i.lensShoulder) ? i.lensShoulder : i.shoulder, i.tanH);
      let foreseen = false, seen = bearing;
      const rvx = this.tvx - i.vx, rvz = this.tvz - i.vz;
      if (!switched && Math.hypot(rvx, rvz) > CROSS_FROM && Math.abs(x) <= 1) {
        const px = dx + rvx * CROSS_LEAD, pz = dz + rvz * CROSS_LEAD, pd = Math.hypot(px, pz);
        const speedR = Math.hypot(rvx, rvz), miss = Math.abs(dx * rvz - dz * rvx) / speedR;
        if (pd >= 1 && d >= DEAD_ZONE && dx * px + dz * pz < 0 && miss >= CROSS_MISS) {
          const pb = Math.atan2(px, pz), pR = wrapped(framing(pb, pd, s, i.back, most, i.foe) - H), pL = wrapped(framing(pb, pd, -s, i.back, most, i.foe) - H);
          const xp = across(i.x + px, i.z + pz, i.x, i.z, H, i.back, i.shoulder, i.tanH);
          if (!(Math.abs(xp) <= 1) || Math.min(Math.abs(pR), Math.abs(pL)) > SWING_BIG) { eR = pR; eL = pL; foreseen = true; seen = pb; }
        }
      }
      let turn: number, judged = this.sideGoal;
      const swinging = (!(Math.abs(x) <= 1) || foreseen || Math.min(Math.abs(eR), Math.abs(eL)) > SWING_BIG) && d >= DEAD_ZONE;
      if (swinging) {
        const rel = wrapped(seen - H);
        const way = switched ? Math.sign(rel) || 1 : this.swAt > -Infinity && this.swWay ? this.swWay : Math.abs(this.velocity) > .15 ? Math.sign(this.velocity) : this.swingWay !== 0 && Math.abs(rel) > 2.6 ? this.swingWay : Math.sign(rel) || 1;
        this.swingWay = way;
        const turnR = way * eR >= 0 ? eR : eR + way * TAU, turnL = way * eL >= 0 ? eL : eL + way * TAU;
        const pick = i.form > .5 ? 1 : this.yieldTo >= .5 || foreseen ? this.sideGoal : Math.abs(turnL) < Math.abs(turnR) ? -1 : 1;
        if (pick !== this.sideGoal) { this.sideFrom = this.side; this.sideGoal = pick; this.sideAt = now; }
        this.sideWant = 0; turn = pick > 0 ? turnR : turnL; judged = pick;
        if (Math.sign(this.bearingRate) !== Math.sign(turn)) this.bearingRate = 0;
      } else {
        this.swingWay = 0;
        const want = i.form > .5 ? 1 : Math.abs(eL) + SIDE_MARGIN < Math.abs(eR) ? -1 : Math.abs(eR) + SIDE_MARGIN < Math.abs(eL) ? 1 : this.sideGoal;
        judged = this.sideGoal;
        if (want !== this.sideGoal && this.yieldTo < .5 && this.swAt === -Infinity) {
          this.sideWant += dt; judged = want;
          if (this.sideWant >= SIDE_HOLD && now - this.sideAt >= SIDE_REST) { this.sideFrom = this.side; this.sideGoal = want; this.sideAt = now; this.sideWant = 0; }
        } else this.sideWant = 0;
        turn = judged > 0 ? eR : eL;
      }
      const duelGoal = H + turn;
      if (d >= DEAD_ZONE) {
        const own = Math.abs(wrapped((judged > 0 ? right : left) - bearing));
        const share = threats === 0 ? 1 : Math.abs(this.deltaGoal) > 1e-3 || Math.abs(this.delta) > .02 ? 0 : CALM_GROUP;
        const inner = calmInner(d, own) * share, outer = calmOuter(d) * share;
        this.slackLo = -(judged > 0 ? outer : inner); this.slackHi = judged > 0 ? inner : outer;
      }
      let need = 0;
      for (let k = 0; k < i.count; k++) {
        const o = i.subjects[k]; if (o.target || o.weight < THREAT) continue;
        const off = Math.abs(wrapped(Math.atan2(o.x - i.x, o.z - i.z) - duelGoal));
        need = Math.max(need, o.weight * smooth(off, .45, 1.4));
      }
      groupWant = clamp(need + .25 * smooth(threatSum, .5, 1.5), 0, 1);
      this.deltaGoal = threats > 0 ? this.bestDelta(i, duelGoal, target) : 0;
      this.foresaw = foreseen;
      this.urgent = ease(this.urgent, !(Math.abs(x) <= 1) ? 1 : foreseen ? .5 : 0, URGENT_IN, URGENT_OUT, dt);
      goal = duelGoal + this.delta;
      const toWindow = this.past(goal - H);
      if (switched && dt > 0 && this.yieldTo < .5 && Math.abs(toWindow) >= SWITCH_FROM) {
        this.swAt = now; this.swSize = Math.abs(toWindow); this.swGoal = H + toWindow; this.swWay = Math.sign(toWindow);
        this.swDur = clamp(1.875 * this.swSize / (!(Math.abs(x) <= 1) ? OUT_SWITCH_SPEED : SWITCH_SPEED), SWITCH_LEAST, SWITCH_MOST);
      }
      gain = targetW * smooth(d, DEAD_ZONE, FULL_ASSIST);
      const back = RETURN_SHARE + (1 - RETURN_SHARE) * smooth(now - this.steerAt, YIELD_HOLD, YIELD_HOLD + YIELD_BACK + RETURN_AFTER);
      speedCap = SPEED * (back + (1 - back) * this.urgent) + (CROSS_SPEED - SPEED) * this.urgent;
      const near = toWindow * judged > 0, wide = 1 - smooth(d, CALM_NEAR, CALM_FAR), calmAccel = near ? ACCEL : ACCEL + (CALM_ACCEL - ACCEL) * wide, calmGain = near ? GAIN : GAIN + (CALM_GAIN - GAIN) * wide;
      accel = calmAccel + (CROSS_ACCEL - calmAccel) * this.urgent; settle = calmGain + (GAIN - calmGain) * this.urgent;
      ff = FF_SHARE * this.bearingRate * smooth(d, FF_NEAR, FF_FULL) * targetW;
      if (this.yieldTo > 0) {
        const angle = Math.atan(Math.abs(x) * i.tanH), half = Math.atan(i.tanH);
        const edge = Number.isFinite(x) && angle > EDGE * half && angle < EDGE_OUT * half ? Math.sign(x) * (angle - EDGE * half) : 0;
        const frameErr = toWindow, edgeErr = -edge;
        const err = (1 - this.yieldTo) * frameErr + this.yieldTo * edgeErr;
        this.slackLo = this.slackHi = 0;
        goal = H + err; gain = Math.max((1 - this.yieldTo) * gain, edge !== 0 ? this.yieldTo * targetW : 0);
        speedCap += (EDGE_SPEED - speedCap) * this.yieldTo; ff *= 1 - this.yieldTo;
      }
      this.mode = threats > 0 ? 'group' : 'duel';
    } else {
      this.bearing = NaN; this.bearingRate = 0; this.targetId = ''; this.urgent = ease(this.urgent, 0, URGENT_IN, URGENT_OUT, dt); this.sideWant = 0;
      this.swAt = -Infinity; this.tvx = this.tvz = 0; this.tlx = this.tlz = NaN;
      this.deltaGoal = 0;
      if (threats > 0) {
        let best: Subject | undefined;
        for (let k = 0; k < i.count; k++) { const o = i.subjects[k]; if (!o.target && (!best || o.weight > best.weight)) best = o; }
        if (best) {
          const d = Math.hypot(best.x - i.x, best.z - i.z);
          goal = H + wrapped(framing(Math.atan2(best.x - i.x, best.z - i.z), d, this.sideGoal * (Math.abs(i.shoulder) || 1e-3), i.back, MAX_OFFSET, i.foe) - H);
          gain = best.weight * smooth(d, DEAD_ZONE, FULL_ASSIST) * (1 - this.yieldTo);
          groupWant = clamp(.25 * smooth(threatSum, .5, 1.5) + (threats > 1 ? .5 : 0), 0, 1);
        }
        this.mode = 'group';
      } else {
        this.mode = speed > 1 ? 'explore' : 'idle';
      }
      if (this.sideGoal !== 1 && now - this.sideAt >= SIDE_REST) { this.sideFrom = this.side; this.sideGoal = 1; this.sideAt = now; }
    }
    this.followDelta(dt);
    this.group = ease(this.group, groupWant, GROUP_IN, GROUP_OUT, dt);
    const u = smooth(now - this.sideAt, 0, SIDE_TIME);
    this.side = this.sideFrom + (this.sideGoal - this.sideFrom) * u;
    const lead = this.explore * (1 - this.yieldTo), sh = Math.sin(H), ch = Math.cos(H);
    const along = i.vx * sh + i.vz * ch, sideways = i.vz * sh - i.vx * ch;
    const lx = clamp(sideways * LEAD_TIME, -LEAD_MOST, LEAD_MOST) * lead, aheadGoal = clamp(along * AHEAD_PER, 0, AHEAD_MOST) * lead;
    this.leadX = this.spring(this.leadX, -ch * lx, 'leadVX', dt); this.leadZ = this.spring(this.leadZ, sh * lx, 'leadVZ', dt);
    this.ahead = this.spring(this.ahead, aheadGoal, 'aheadV', dt);
    const crossing = 1 - Math.abs(this.side);
    if (this.swAt > -Infinity && (this.steered || !Number.isFinite(goal))) this.swAt = -Infinity;
    const through = this.swAt > -Infinity ? clamp((now - this.swAt) / Math.max(1e-3, this.swDur), 0, 1) : 0;
    this.switchShare = through;
    this.switching = this.swAt > -Infinity ? Math.sin(Math.PI * through) ** 2 * smooth(this.swSize, .25, 1) : 0;
    const high = Math.max(i.y - i.floor, target ? target.y - i.floor : 0);
    this.airIn = ease(this.airIn, smooth(high, AIR_FROM, AIR_FULL), 4, 1.2, dt);
    this.boom = DYN_BOOM + this.group * GROUP_BOOM + this.explore * EXPLORE_BOOM + this.juggle * JUGGLE_BOOM + this.plunge * PLUNGE_BOOM + this.down * DOWN_BOOM
      + this.switching * SWITCH_BOOM + this.airIn * AIR_BOOM2;
    this.lift = DYN_LIFT + this.group * GROUP_LIFT + this.explore * EXPLORE_LIFT + this.juggle * JUGGLE_LIFT + this.plunge * PLUNGE_LIFT + this.down * DOWN_LIFT + crossing * SIDE_LIFT
      + this.switching * SWITCH_LIFT + this.airIn * AIR_LIFT2;
    this.focus = this.plunge * PLUNGE_FOCUS;
    this.fov = clamp(BASE_FOV + this.dash * DASH_FOV + this.explore * smooth(speed, 4, 7.5) * RUN_FOV + this.group * GROUP_FOV + this.plunge * PLUNGE_FOV
      + this.switching * SWITCH_FOV + this.airIn * AIR_FOV2, FOV_LEAST, FOV_MOST);
    const level = smooth(now - this.pitchAt, PITCH_REST, PITCH_REST + PITCH_RAMP);
    this.pitchGoal = level > 0 ? PITCH_LEVEL : NaN; this.pitchRate = PITCH_RATE * level;
    this.goal = goal; this.gain = clamp(gain, 0, 1); this.speed = Math.min(speedCap, MAX_SPEED); this.accel = accel; this.rate = settle; this.ff = clamp(ff, -MAX_SPEED, MAX_SPEED);
    if (!Number.isFinite(goal)) this.slackLo = this.slackHi = 0;
  }

  steer(heading: number, goal: number, dt: number, frozen = false, trace?: Float64Array) {
    dt = clamp(Number.isFinite(dt) ? dt : 0, 0, .25);
    this.traced = 0;
    if (!(dt > 0)) return heading;
    if (this.steered) { this.velocity *= Math.exp(-20 * dt); this.acceleration = 0; }
    let error = Number.isFinite(goal) ? goal - heading : 0;
    if (Math.abs(error) > TAU) error = wrapped(error);
    if (Math.abs(error) > 2.6 && Math.abs(this.velocity) > .2 && Math.sign(error) !== Math.sign(this.velocity) && this.swAt === -Infinity) error += Math.sign(this.velocity) * TAU;
    const windowed = this.slackLo !== 0 || this.slackHi !== 0;
    if (windowed) error = this.past(error);
    if (this.swAt > -Infinity && frozen) this.swAt += dt;
    else if (this.swAt > -Infinity && !this.steered && Number.isFinite(goal)) {
      let spent = 0;
      const goalNow = heading + error;
      for (let left = dt; left > 1e-9; left -= STEP) {
        const h = Math.min(STEP, left), elapsed = this.clock - dt + spent - this.swAt;
        this.swGoal += (goalNow - this.swGoal) * (1 - Math.exp(-SWITCH_FOLLOW * h));
        const X = this.swGoal - heading;
        const slow = 1.875 * Math.abs(X) / SWITCH_PEAK;
        if (this.swDur - elapsed < slow) this.swDur = elapsed + slow;
        const R = Math.max(this.swDur - elapsed, SWITCH_TAIL);
        const v0 = this.velocity, a0 = this.acceleration, tau = h / R;
        const c3 = 10 * X - 6 * v0 * R - 1.5 * a0 * R * R, c4 = -15 * X + 8 * v0 * R + 1.5 * a0 * R * R, c5 = 6 * X - 3 * v0 * R - .5 * a0 * R * R;
        const t2 = tau * tau, t3 = t2 * tau, t4 = t3 * tau;
        const step = v0 * R * tau + .5 * a0 * R * R * t2 + c3 * t3 + c4 * t4 + c5 * t4 * tau;
        this.velocity = clamp((v0 * R + a0 * R * R * tau + 3 * c3 * t2 + 4 * c4 * t3 + 5 * c5 * t4) / R, -MAX_SPEED, MAX_SPEED);
        this.acceleration = (a0 * R * R + 6 * c3 * tau + 12 * c4 * t2 + 20 * c5 * t3) / (R * R);
        if (trace && this.traced < trace.length) trace[this.traced++] = Math.abs(this.acceleration);
        heading += step; spent += h;
      }
      if (this.clock - this.swAt >= this.swDur - 1e-9) this.swAt = -Infinity;
      return heading;
    }
    const gain = frozen || !Number.isFinite(goal) ? 0 : this.gain, ff = frozen ? 0 : this.ff, speed = this.speed, accel = this.accel, rate = this.rate;
    for (let left = dt; left > 1e-9; left -= STEP) {
      const h = Math.min(STEP, left), size = Math.abs(error);
      const lead = !windowed ? ff : ff * error > 0 ? ff * smooth(size, 0, CALM_FF) : 0;
      const want = gain * clamp(Math.sign(error) * Math.min(speed, Math.sqrt(2 * BRAKE * accel * size), rate * size) + lead, -speed, speed);
      const push = clamp((want - this.velocity) * FOLLOW, -accel, accel);
      this.acceleration += clamp(push - this.acceleration, -JERK * h, JERK * h);
      this.velocity = clamp(this.velocity + this.acceleration * h, -MAX_SPEED, MAX_SPEED);
      if (trace && this.traced < trace.length) trace[this.traced++] = Math.abs(this.acceleration);
      const step = this.velocity * h; heading += step;
      if (windowed && error !== 0 && (error - step) * error <= 0) error = 0; else if (!windowed || error !== 0) error -= step;
    }
    if (Math.abs(this.velocity) < 1e-5 && Math.abs(this.acceleration) < 1e-4 && gain === 0) this.velocity = this.acceleration = 0;
    return heading;
  }

  private bestDelta(i: BrainInput, duel: number, target: Subject) {
    let best = 0, bestScore = -Infinity;
    const steps = Math.round(DELTA_MOST / DELTA_STEP);
    for (let k = -steps; k <= steps; k++) {
      const delta = k * DELTA_STEP, h = duel + delta;
      const tx = across(target.x, target.z, i.x, i.z, h, i.back, i.shoulder, i.tanH);
      if (!(Math.abs(tx) <= TARGET_SAFE)) continue;
      let score = 1 - TURN_COST * Math.abs(delta) + (Math.abs(delta - this.deltaGoal) < DELTA_STEP * .75 ? .08 : 0);
      for (let n = 0; n < i.count; n++) {
        const o = i.subjects[n]; if (o.target || o.weight <= .05) continue;
        const x = across(o.x, o.z, i.x, i.z, h, i.back, i.shoulder, i.tanH);
        if (Math.abs(x) <= FRAME_SAFE) score += o.weight * (1 + .15 * (1 - Math.abs(x)));
      }
      if (score > bestScore + 1e-9) { bestScore = score; best = delta; }
    }
    return best;
  }
  private followDelta(dt: number) {
    for (let left = dt; left > 1e-9; left -= STEP) {
      const h = Math.min(STEP, left), error = this.deltaGoal - this.delta, size = Math.abs(error);
      const want = Math.sign(error) * Math.min(DELTA_SPEED, Math.sqrt(1.8 * DELTA_ACCEL * size), DELTA_GAIN * size);
      this.deltaVelocity += clamp(want - this.deltaVelocity, -DELTA_ACCEL * h, DELTA_ACCEL * h);
      this.delta += this.deltaVelocity * h;
    }
    if (this.deltaGoal === 0 && Math.abs(this.delta) < 1e-5 && Math.abs(this.deltaVelocity) < 1e-4) this.delta = this.deltaVelocity = 0;
  }
  private spring(value: number, goal: number, velocity: 'leadVX' | 'leadVZ' | 'aheadV', dt: number) {
    if (!(dt > 0)) return value;
    const w = LEAD_RATE, decay = Math.exp(-w * dt), offset = value - goal, drive = this[velocity] + w * offset;
    this[velocity] = (this[velocity] - w * drive * dt) * decay;
    const next = goal + (offset + drive * dt) * decay;
    return Math.abs(next) < 1e-6 && goal === 0 && Math.abs(this[velocity]) < 1e-6 ? (this[velocity] = 0) : next;
  }
}
