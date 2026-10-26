const clamp = (x: number, a: number, b: number) => x < a ? a : x > b ? b : x;
const smooth = (x: number, a: number, b: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const wrapped = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const blend = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

export const FOV = 50, ELEVATION = .23, ELEVATION_NEAR = .17, MIDDLE = .47, CHEST_LEAST = .6, LYING_LOOK = .6, DOLLY_BASE = 5.1, DOLLY_NEAR = 4.5, SHOULDER = .72, SHOULDER_NEAR = .5;
export const PULL_NEAR = .28, PULL_FAR = .1, PULL_FROM = 2.5, PULL_TO = 13;
export const WINDOW_LO_NEAR = .28, WINDOW_HI_NEAR = 1.15, WINDOW_LO_FAR = .055, WINDOW_HI_FAR = .45, WINDOW_FROM = 3, WINDOW_TO = 12, WINDOW_SPAN = .4, SEPARATE = .8;
export const SIDE_MARGIN = .12, SIDE_HOLD = .45, SIDE_REST = 1.6, SIDE_TIME = .8, SIDE_FROM = 1.2, SHOULDER_FULL = .3, SHOULDER_RATE = 2.2;
export const CHOOSE_STEP = .07, W_WINDOW = 1, W_HIDDEN = 2.5, W_TURN = .15, W_BOUND = .7, W_THREAT = .8, THREAT_ZONE = .62, W_HIDE = .6, BODY_HALF = .34, CHOOSE_KEEP = .05, CHOOSE_KEEP_WALL = .12, WALL_NEAR = .6;
export const PASS_RATE = 1, PASS_TIME = .55, PASS_CHECK = .1, PASS_COMMIT = .6;
export const RUN_FROM = 3, RUN_FULL = 5, RUN_IN = 6, RUN_OUT = 2.5, RUN_URGENT_AFTER = .7, RUN_ZONE = .7, RUN_SOFT = .7;
export const REST_SHARE = .25;
export const TURN_GAIN = 3, TURN_SPEED = 1.9, TURN_ACCEL = 6, TURN_JERK = 50, URGENT_SPEED = 2.5, URGENT_ACCEL = 14, RATE_EASE = 8, RATE_SHARE = .6, URGENT_AFTER = .2, PAN_FOR = 1, PAN_SPEED = 1.3, PAN_URGENT = 2.2, LEAD = .18, STEP = 1 / 120;
export const YIELD_AFTER = 1.2, YIELD_OVER = .6, AWAY_BACK = 1.6, IDLE = .05;
export const PITCH_AFTER = 1.5, PITCH_BACK = .7;
export const FRAME_TOP = .6, FRAME_BOTTOM = .66, FRAME_SIDE = .84, FIT_WHOLE = 9, DOLLY_MOST = 1.4, DOLLY_OUT = 2.6, DOLLY_IN = .7, DOLLY_HOLD = 1.2, DOLLY_SLACK = .25;
export const PIVOT_RATE = 12, PIVOT_RISE = 5, PIVOT_LAG = .9, PIVOT_ZONE = .3, PIVOT_ZONE_UP = .22, OFFSET_RATE = 2.6, OFFSET_RISE = 2;
export const AIR_TILT = .12, AIR_FROM = .5, AIR_MOST = .32, AIR_RATE = 6, AIR_LIFT = .55, GROUND_CLEAR = .55;
export const FOV_BIG = 4, FOV_BIG_MOST = 6, FOV_CROWD = 4, FOV_RATE = 1.5, CROWD_RISE = .06, CROWD_RISE_MOST = .12;
export const ENGAGE_NEAR = 16, ENGAGE_FAR = 24, ENGAGE_IN = 4, ENGAGE_OUT = 1.5, EXPLORE_LEAD = 1, RECENTRE_SPEED = 3, RECENTRE_AFTER = 1.5, RECENTRE_RATE = .6;
export const THREAT_MOST = .8, THREAT_IN = 2.5, THREAT_OUT = .8, THREAT_SEEN = .22, THREAT_FIT = .5;
export const BOUND_RISE = .35, MIN_BEHIND = 2.4;
export const SQUEEZE_MOST = .7, SQUEEZE_IN = 22, SQUEEZE_OUT = 2.9, SQUEEZE_TILT = .1, SQUEEZE_FOV = 5, SQUEEZE_LOOK = .8;
export const HARD_TOP = .74, HARD_BOTTOM = .8, HARD_SIDE = .88, HARD_STEPS = 16, HARD_IN = 12, HARD_OUT = 6;
export const LYING_EASE = 8;
export const OFFSET_MOST = 2.4, OFFSET_UP_MOST = 1.4;
export const VIEW_TILT = .0436;

export interface SmartBody {
  x: number; y: number; z: number;
  high: number;
  lying: boolean; airborne: boolean;
}
export interface SmartThreat extends SmartBody { id: string; weight: number }
export interface SmartInput {
  dt: number;
  placed: boolean;
  me: SmartBody & { vx: number; vz: number; floor: number; scale: number };
  foe?: SmartBody & { id: string; vx: number; vz: number };
  sole: boolean;
  threats: readonly SmartThreat[]; threatCount: number;
  manual: number; manualTilt: number;
  aspect: number;
  bound?: { halfX: number; halfZ: number; out: number };
  frozen: boolean;
  latched?: boolean;
}

interface Projected { x: number; y: number; depth: number }

export class SmartRig {
  lensX = 0; lensY = 2; lensZ = 0; lookX = 0; lookY = 1; lookZ = 1; fov = FOV;
  heading = Math.PI;
  bearing = 0; foeBearing = 0;
  engaged = 0;
  away = 0;
  side = 1;
  get shoulder() { return this.shoulderEase; }
  readonly state = { window: 0, lo: 0, hi: 0, phi: 0, goal: 0, urgent: 0, pass: 0, run: 0, drift: 0, dolly: DOLLY_BASE, need: DOLLY_BASE, turnSpeed: 0, pull: 0, shoulder: SHOULDER, bounded: 0, group: 0, tilt: 0, hard: 0 };

  private initialized = false;
  private age = 0;
  private pivotX = 0; private pivotY = 1; private pivotZ = 0;
  private bodyX = 0; private bodyY = 1; private bodyZ = 0; private bvx = 0; private bvy = 0; private bvz = 0;
  private offX = 0; private offY = 0; private offZ = 0; private ovx = 0; private ovy = 0; private ovz = 0;
  private turnVelocity = 0; private turnAccel = 0;
  private dolly = DOLLY_BASE; private needAt = -Infinity;
  private tilt = 0;
  private shoulderEase = 1; private sideFrom = 1; private sideAt = -Infinity; private flipFor = 0;
  private lastTurn = -Infinity;
  private lastFoe = ''; private foeAt = -Infinity;
  private hiddenFor = 0; private urgent = 0;
  private choiceSide = 1; private threatSeen = 0; private costTanH = 1; private costScale = 1; private bearingRate = 0; private lastFight = ''; private atEdge = false;
  private passing = false; private wasPassing = false; private passFor = 0; private passFrom = 0; private passSide = 1; private commitFor = 0; private run = 0;
  private recentreFor = 0;
  private pitchOffset = 0; private lastTilt = -Infinity;
  private fovNow = FOV; private crowd = 0; private crowdRise = 0; private squeeze = 0; private squeezeV = 0; private hard = 0; private hardV = 0;
  private wasLying = false; private chestStep = 0; private chestStepV = 0;
  private readonly weights = new Map<string, number>();
  private readonly seen = new Set<string>();

  reset() {
    this.initialized = false; this.age = 0; this.turnVelocity = 0; this.turnAccel = 0; this.dolly = DOLLY_BASE; this.needAt = -Infinity; this.tilt = 0;
    this.side = this.shoulderEase = this.sideFrom = 1; this.sideAt = -Infinity; this.flipFor = 0; this.lastTurn = -Infinity; this.lastFoe = ''; this.foeAt = -Infinity;
    this.hiddenFor = 0; this.urgent = 0; this.choiceSide = 1; this.passing = this.wasPassing = false; this.passFor = this.commitFor = 0; this.run = 0; this.recentreFor = 0; this.pitchOffset = 0; this.lastTilt = -Infinity; this.fovNow = FOV; this.crowd = 0; this.crowdRise = 0; this.squeeze = this.squeezeV = 0; this.hard = this.hardV = 0; this.wasLying = false; this.chestStep = this.chestStepV = 0; this.away = 0; this.engaged = 0;
    this.weights.clear(); this.bvx = this.bvy = this.bvz = this.ovx = this.ovy = this.ovz = 0;
  }
  lookAlong(yaw: number) { this.heading = yaw; this.initialized = false; this.away = 0; }

  update(i: SmartInput) {
    const dt = clamp(Number.isFinite(i.dt) ? i.dt : 0, 0, .25), placed = i.placed || !this.initialized;
    this.age += dt;
    const me = i.me, scale = clamp(me.scale || 1, .4, 4);
    if (!placed && Math.abs(i.manual) > 1e-7) {
      this.heading = wrapped(this.heading + i.manual);
      if (Math.abs(i.manual) > IDLE * dt) { this.lastTurn = this.age; this.turnVelocity *= .2; }
      this.away = wrapped(this.away + i.manual);
    }
    if (!placed && Math.abs(i.manualTilt) > 1e-7) { this.pitchOffset = clamp(this.pitchOffset + i.manualTilt, -.35, .45); this.lastTilt = this.age; }
    else if (this.age - this.lastTilt > PITCH_AFTER) this.pitchOffset -= this.pitchOffset * blend(PITCH_BACK, dt);
    const mine = smooth(this.age - this.lastTurn, YIELD_AFTER, YIELD_AFTER + YIELD_OVER);

    const foe = i.foe;
    const fd = foe ? Math.hypot(foe.x - me.x, foe.z - me.z) : Infinity;
    if (foe && fd > .45) this.foeBearing = Math.atan2(foe.x - me.x, foe.z - me.z);
    const engageGoal = foe ? (i.sole ? 1 : 1 - smooth(fd, ENGAGE_NEAR, ENGAGE_FAR)) : 0;
    this.engaged = placed ? engageGoal : this.engaged + (engageGoal - this.engaged) * blend(engageGoal > this.engaged ? ENGAGE_IN : ENGAGE_OUT, dt);
    if (this.engaged < 1e-3 && engageGoal === 0) this.engaged = 0;
    const e = this.engaged;
    if (foe && foe.id !== this.lastFoe) { if (this.lastFoe && !placed) this.foeAt = this.age; this.lastFoe = foe.id; this.hiddenFor = 0; }
    this.seen.clear();
    let gw = foe ? 1 : 0, gx = foe ? foe.x + foe.vx * LEAD : 0, gz = foe ? foe.z + foe.vz * LEAD : 0, gy = foe ? this.chest(foe) : 0, groupW = 0;
    for (let k = 0; k < i.threatCount; k++) {
      const t = i.threats[k]; if (foe && t.id === foe.id) continue;
      const was = this.weights.get(t.id) ?? 0, goal = clamp(t.weight, 0, THREAT_MOST);
      const w = placed ? goal : was + (goal - was) * blend(goal > was ? THREAT_IN : THREAT_OUT, dt);
      this.weights.set(t.id, w); this.seen.add(t.id);
      if (w < .02) continue;
      gw += w; gx += t.x * w; gz += t.z * w; gy += this.chest(t) * w; groupW += w;
    }
    for (const [id, w] of this.weights) if (!this.seen.has(id)) { const left = w - w * blend(THREAT_OUT, dt); if (left < .01) this.weights.delete(id); else this.weights.set(id, left); }
    const hasGroup = gw > 1e-6;
    if (hasGroup) { gx /= gw; gz /= gw; gy /= gw; }
    this.state.group = groupW;
    const meChest = this.chest(me), mx = me.x + me.vx * LEAD * .5, mz = me.z + me.vz * LEAD * .5;
    if (placed || !LYING_EASE) { this.chestStep = this.chestStepV = 0; }
    else {
      if (me.lying !== this.wasLying) this.chestStep += (me.lying ? 1 : -1) * (Math.max(CHEST_LEAST, me.high * MIDDLE) - LYING_LOOK);
      spring(this.chestStep, this.chestStepV, 0, LYING_EASE, dt); this.chestStep = sprung.x; this.chestStepV = sprung.v;
    }
    this.wasLying = me.lying;
    const hardChest = meChest + this.chestStep;
    const ax = foe ? foe.x + foe.vx * LEAD : gx, az = foe ? foe.z + foe.vz * LEAD : gz;
    const gd = hasGroup ? Math.hypot(ax - mx, az - mz) : Infinity;
    if (hasGroup && gd > .45) {
      const b = Math.atan2(ax - mx, az - mz);
      if (!placed && dt > 0 && this.lastFight === (foe?.id ?? '')) { const jump = wrapped(b - this.bearing), rate = Math.abs(jump) < .8 ? clamp(jump / dt, -URGENT_SPEED, URGENT_SPEED) : 0; this.bearingRate += (rate - this.bearingRate) * blend(RATE_EASE, dt); }
      else this.bearingRate = 0;
      this.bearing = b;
    } else this.bearingRate -= this.bearingRate * blend(RATE_EASE, dt);
    this.lastFight = foe?.id ?? '';

    const rest = lerp(DOLLY_BASE, lerp(DOLLY_NEAR, DOLLY_BASE, smooth(gd, PULL_FROM, PULL_TO)), e) * scale;
    const pull = hasGroup ? e * lerp(PULL_FAR, PULL_NEAR, 1 - smooth(gd, PULL_FROM, PULL_TO)) : 0;
    const shoulder = lerp(SHOULDER, lerp(SHOULDER_NEAR, SHOULDER, smooth(gd, PULL_FROM, PULL_TO)), e) * scale;
    const near = hasGroup ? 1 - smooth(gd, WINDOW_FROM, WINDOW_TO) : 1;
    const apartNeed = SEPARATE * (scale + (foe ? foe.high / 1.95 : 1)) / 2;
    const lo = Math.max(lerp(WINDOW_LO_FAR, WINDOW_LO_NEAR, near), hasGroup && gd > apartNeed ? Math.asin(Math.min(.95, apartNeed / gd)) : WINDOW_LO_NEAR);
    const hi = Math.max(lerp(WINDOW_HI_FAR, WINDOW_HI_NEAR, near), lo + WINDOW_SPAN);
    this.state.lo = lo; this.state.hi = hi;
    let goal = this.heading, phi = 0;
    this.passing = false;
    if (placed) {
      if (hasGroup && e > 0) { this.side = 1; this.choiceSide = 1; goal = wrapped(this.bearing + this.side * (lo + REST_SHARE * (hi - lo))); this.heading = goal; this.away = 0; }
      this.sideFrom = this.shoulderEase = this.side; this.sideAt = -Infinity; this.turnVelocity = 0; this.turnAccel = 0;
    } else if (hasGroup && e > 0) {
      if (mine >= 1) { this.away -= this.away * blend(AWAY_BACK, dt); if (Math.abs(this.away) < 1e-4) this.away = 0; }
      phi = wrapped(this.heading - this.away - this.bearing);
      const back = Math.max(this.dolly, rest) * Math.cos(ELEVATION);
      this.costTanH = Math.tan((this.fovNow * Math.PI / 180) / 2) * i.aspect; this.threatSeen = 0; this.costScale = scale;
      this.costPull = pull; this.costShoulder = shoulder;
      for (let k = 0; k < i.threatCount; k++) if ((this.weights.get(i.threats[k].id) ?? 0) >= THREAT_SEEN) this.threatSeen++;
      let best = phi, bestCost = this.costAt(phi, phi, lo, hi, i, back), pos = NaN, posCost = Infinity, neg = NaN, negCost = Infinity;
      const consider = (p: number) => {
        const c = this.costAt(p, phi, lo, hi, i, back);
        if (c < bestCost) { best = p; bestCost = c; }
        if (p >= 0) { if (c < posCost) { pos = p; posCost = c; } } else if (c < negCost) { neg = p; negCost = c; }
      };
      consider(phi); consider(lo); consider(-lo); consider(hi); consider(-hi);
      for (let p = -Math.PI; p < Math.PI; p += CHOOSE_STEP) consider(p);
      const drift = foe && fd > .45 ? -((foe.vx - me.vx) * Math.cos(this.foeBearing) - (foe.vz - me.vz) * Math.sin(this.foeBearing)) / fd : 0, across = Math.abs(drift);
      this.state.drift = drift;
      this.lensFor(phi, clamp(phi / Math.max(SHOULDER_FULL, lo), -1, 1), back, i);
      const walled = this.squeeze > .05 || this.pastBound(this.lensX0, this.lensZ0, i, WALL_NEAR) > 0;
      if (!walled && this.threatSeen === 0 && Math.abs(phi) < lo && across > PASS_RATE && this.passFor < PASS_TIME * 2) {
        const going = Math.sign(drift), side = this.passFor > 0 ? this.passSide : going;
        const left = Math.sign(phi) === side ? lo - Math.abs(phi) : Math.abs(phi) + lo;
        const progress = this.passFor <= PASS_CHECK || (phi - this.passFrom) * side >= .5 * across * this.passFor;
        if (going === side && left / across < PASS_TIME && progress) {
          this.lensFor(phi, side, back, i);
          if (this.pastBound(this.lensX0, this.lensZ0, i) < .05) {
            if (this.passFor === 0) { this.passFrom = phi; this.passSide = side; }
            this.passing = true; best = phi; this.choiceSide = side;
          }
        }
        if (!this.passing && this.passFor > 0) this.passFor = PASS_TIME * 2;
      }
      if (this.wasPassing && !this.passing && Math.abs(phi) < lo) this.commitFor = PASS_COMMIT;
      this.wasPassing = this.passing;
      this.commitFor = Math.abs(phi) < lo ? Math.max(0, this.commitFor - dt) : 0;
      this.passFor = this.passing ? this.passFor + dt : Math.abs(phi) < lo ? this.passFor : 0;
      if (!this.passing) {
        const last = this.commitFor > 0 ? this.passSide : this.choiceSide, same = last > 0 ? pos : neg, sameCost = last > 0 ? posCost : negCost;
        if (last !== 0 && Math.sign(best) !== last && Number.isFinite(same) && (this.commitFor > 0 || sameCost <= bestCost + (walled ? CHOOSE_KEEP_WALL : CHOOSE_KEEP))) best = same;
        this.choiceSide = Math.abs(best) > .02 ? Math.sign(best) : this.choiceSide;
      }
      const other = Math.sign(best) !== this.side && Math.abs(best) > SIDE_MARGIN && gd > SIDE_FROM;
      this.flipFor = other ? this.flipFor + dt : 0;
      if (this.flipFor >= SIDE_HOLD && this.age - this.sideAt >= SIDE_REST) { this.sideFrom = this.shoulderEase; this.side = -this.side; this.sideAt = this.age; this.flipFor = 0; }
      goal = wrapped(this.bearing + best + this.away);
      this.atEdge = Math.abs(wrapped(best - phi)) > .01;
      this.state.window = Math.abs(phi) >= lo && Math.abs(phi) <= hi ? 1 : 0;
    } else {
      this.away = 0;
      const speed = Math.hypot(me.vx, me.vz);
      this.recentreFor = speed > RECENTRE_SPEED && mine >= 1 ? this.recentreFor + dt : 0;
      if (this.recentreFor > RECENTRE_AFTER) {
        const run = Math.atan2(me.vx, me.vz), off = wrapped(run - this.heading);
        if (Math.abs(off) < 2.2) goal = wrapped(this.heading + clamp(off, -RECENTRE_RATE * dt * 4, RECENTRE_RATE * dt * 4));
      }
    }
    this.state.phi = phi; this.state.goal = goal; this.state.pass = this.passing ? 1 : 0;
    const runGoal = placed || !i.latched ? 0 : smooth(Math.hypot(me.vx, me.vz), RUN_FROM, RUN_FULL);
    this.run += (runGoal - this.run) * blend(runGoal > this.run ? RUN_IN : RUN_OUT, dt); this.state.run = this.run;
    const lost = foe && e > .5 && !this.passing ? this.lostFoe(foe, scale, i.aspect) : false;
    this.hiddenFor = lost ? this.hiddenFor + dt : 0;
    const after = lerp(URGENT_AFTER, RUN_URGENT_AFTER, this.run);
    this.urgent += ((this.hiddenFor >= after ? 1 : 0) - this.urgent) * blend(this.hiddenFor >= after ? 8 : 3, dt);
    this.state.urgent = this.urgent;
    if (!placed) {
      let speed = lerp(TURN_SPEED, URGENT_SPEED, this.urgent), accel = lerp(TURN_ACCEL, URGENT_ACCEL, this.urgent);
      const pan = 1 - smooth(this.age - this.foeAt, PAN_FOR * .5, PAN_FOR);
      if (pan > 0) speed = lerp(speed, Math.min(speed, lerp(PAN_SPEED, PAN_URGENT, this.urgent)), pan);
      if (e <= 0) { speed = RECENTRE_RATE; accel = 2; }
      const gain = mine;
      let error = wrapped(goal - this.heading);
      const lead = e > 0 && this.atEdge ? this.bearingRate * RATE_SHARE : 0;
      if (Math.abs(lead) > speed) speed = Math.min(URGENT_SPEED, Math.abs(lead));
      if (this.run > 0 && foe && e > 0 && Math.abs(phi) > hi) {
        const q = this.project(foe.x, this.chest(foe), foe.z, Math.tan((this.fovNow * Math.PI / 180) / 2), Math.tan((this.fovNow * Math.PI / 180) / 2) * i.aspect);
        if (q.depth > .5) speed = lerp(speed, Math.min(speed, RUN_SOFT), this.run * (1 - smooth(Math.abs(q.x), RUN_ZONE - .3, RUN_ZONE)));
      }
      if (i.frozen) { this.turnVelocity *= Math.exp(-20 * dt); this.turnAccel = 0; }
      else for (let left = dt; left > 1e-9; left -= STEP) {
        const h = Math.min(STEP, left), size = Math.abs(error);
        const wanted = gain * clamp(Math.sign(error) * Math.min(speed, Math.sqrt(1.6 * accel * size), TURN_GAIN * size) + lead, -speed, speed);
        const push = clamp((wanted - this.turnVelocity) / h, -accel, accel);
        this.turnAccel += clamp(push - this.turnAccel, -TURN_JERK * h, TURN_JERK * h);
        if (Math.sign(this.turnAccel) !== Math.sign(push) && Math.abs(push) < Math.abs(this.turnAccel)) this.turnAccel = push;
        this.turnVelocity += this.turnAccel * h;
        if (Math.abs(this.turnVelocity) > speed) { this.turnVelocity = Math.sign(this.turnVelocity) * speed; this.turnAccel = 0; }
        let stepped = this.turnVelocity * h;
        if (Math.abs(lead) < 1e-6 && Math.sign(stepped) === Math.sign(error) && Math.abs(stepped) > Math.abs(error)) { stepped = error; this.turnVelocity = 0; this.turnAccel = 0; }
        this.heading = wrapped(this.heading + stepped); error -= stepped;
      }
    }
    this.state.turnSpeed = this.turnVelocity;
    const shoulderGoal = hasGroup && e > 0 ? (this.passing ? this.choiceSide : clamp(phi / Math.max(SHOULDER_FULL, lo), -1, 1)) : Math.sign(this.shoulderEase) || 1;
    this.shoulderEase = placed ? (hasGroup && e > 0 ? this.side : 1) : this.shoulderEase + (shoulderGoal - this.shoulderEase) * blend(SHOULDER_RATE, dt);

    this.state.pull = pull; this.state.shoulder = shoulder;
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading), rx = -fz, rz = fx;
    const tx0 = foe ? foe.x : gx, tz0 = foe ? foe.z : gz, ty0 = foe ? this.chest(foe) : gy;
    let ox = hasGroup ? (tx0 - me.x) * pull : 0, oz = hasGroup ? (tz0 - me.z) * pull : 0;
    ox += rx * shoulder * this.shoulderEase; oz += rz * shoulder * this.shoulderEase;
    if (e < 1) { const k = (1 - e) * Math.min(1, EXPLORE_LEAD / Math.max(1, Math.hypot(me.vx, me.vz) * .25)); ox += me.vx * .25 * k; oz += me.vz * .25 * k; }
    const above = hasGroup ? Math.max(0, ty0 - meChest - AIR_FROM) : 0;
    let oy = (hasGroup ? (ty0 - meChest) * pull : 0) + above * AIR_LIFT * e * .3;
    { const reach = Math.hypot(ox, oz), most = OFFSET_MOST * scale; if (reach > most) { ox *= most / reach; oz *= most / reach; } oy = clamp(oy, -OFFSET_UP_MOST * scale, OFFSET_UP_MOST * scale); }
    if (placed) {
      this.bodyX = me.x; this.bodyZ = me.z; this.bodyY = meChest; this.bvx = this.bvz = this.bvy = 0;
      this.offX = ox; this.offZ = oz; this.offY = oy; this.ovx = this.ovz = this.ovy = 0;
    } else {
      const zx = this.bodyX - me.x, zz = this.bodyZ - me.z, zone = Math.hypot(zx, zz), keep = zone > PIVOT_ZONE * scale ? PIVOT_ZONE * scale / zone : 1;
      const tx = zone > PIVOT_ZONE * scale ? me.x + zx * keep : this.bodyX, tz = zone > PIVOT_ZONE * scale ? me.z + zz * keep : this.bodyZ;
      spring(this.bodyX, this.bvx, tx, PIVOT_RATE, dt); this.bodyX = sprung.x; this.bvx = sprung.v;
      spring(this.bodyZ, this.bvz, tz, PIVOT_RATE, dt); this.bodyZ = sprung.x; this.bvz = sprung.v;
      const zy = this.bodyY - meChest, ty = Math.abs(zy) > PIVOT_ZONE_UP ? meChest + Math.sign(zy) * PIVOT_ZONE_UP : this.bodyY;
      spring(this.bodyY, this.bvy, ty, PIVOT_RISE, dt); this.bodyY = sprung.x; this.bvy = sprung.v;
      const lx = this.bodyX - me.x, lz = this.bodyZ - me.z, lag = Math.hypot(lx, lz);
      if (lag > PIVOT_LAG) { const k = PIVOT_LAG / lag; this.bodyX = me.x + lx * k; this.bodyZ = me.z + lz * k; }
      if (!i.frozen) {
        spring(this.offX, this.ovx, ox, OFFSET_RATE, dt); this.offX = sprung.x; this.ovx = sprung.v;
        spring(this.offZ, this.ovz, oz, OFFSET_RATE, dt); this.offZ = sprung.x; this.ovz = sprung.v;
        spring(this.offY, this.ovy, oy, OFFSET_RISE, dt); this.offY = sprung.x; this.ovy = sprung.v;
      }
    }
    this.pivotX = this.bodyX + this.offX; this.pivotY = this.bodyY + this.offY; this.pivotZ = this.bodyZ + this.offZ;

    const tiltGoal = clamp(above * AIR_TILT, 0, AIR_MOST) * e;
    this.tilt = placed ? tiltGoal : this.tilt + (tiltGoal - this.tilt) * blend(tiltGoal > this.tilt ? AIR_RATE : AIR_RATE * .5, dt);
    this.state.tilt = this.tilt;
    const crowdGoal = Math.min(CROWD_RISE_MOST, CROWD_RISE * this.state.group) * e;
    this.crowdRise = placed ? crowdGoal : this.crowdRise + (crowdGoal - this.crowdRise) * blend(crowdGoal > this.crowdRise ? 1.5 : .6, dt);
    const elevation = clamp(lerp(ELEVATION, ELEVATION_NEAR, e * (1 - smooth(gd, PULL_FROM, PULL_TO))) - this.tilt + this.pitchOffset + this.crowdRise, -.3, .8);

    const big = Math.min(FOV_BIG_MOST, FOV_BIG * Math.max(0, scale - 1));
    const most = Math.max(rest, DOLLY_BASE * scale) * DOLLY_MOST;
    const tanV = Math.tan((this.fovNow * Math.PI / 180) / 2), tanH = tanV * i.aspect;
    let need = this.fit(i, rest, most, elevation, tanV, tanH, scale);
    const short = need > most - 1e-3 ? 1 : 0;
    this.crowd = placed ? short : this.crowd + (short - this.crowd) * blend(short > this.crowd ? 2 : .7, dt);
    need = Math.min(need, most);
    const fovGoal = FOV + big + FOV_CROWD * this.crowd * e;
    this.fovNow = placed ? fovGoal : this.fovNow + (fovGoal - this.fovNow) * blend(FOV_RATE, dt);
    this.fov = this.fovNow;
    if (need > this.dolly + DOLLY_SLACK) this.needAt = this.age;
    if (placed) this.dolly = need;
    else if (need > this.dolly + DOLLY_SLACK * .5) this.dolly += (need - this.dolly) * blend(DOLLY_OUT, dt);
    else if (need < this.dolly - DOLLY_SLACK && this.age - this.needAt > DOLLY_HOLD && !i.frozen) this.dolly += (need - this.dolly) * blend(DOLLY_IN, dt);
    this.state.need = need; this.state.dolly = this.dolly;

    const cos0 = Math.cos(elevation), back0 = this.dolly * cos0;
    let squeezeGoal = 0;
    if (i.bound) {
      const ex0 = this.pivotX - fx * back0, ez0 = this.pivotZ - fz * back0, ax = i.bound.halfX + i.bound.out, az = i.bound.halfZ + i.bound.out;
      let k = 1;
      if (Math.abs(ex0) > ax) k = Math.min(k, (ax * Math.sign(ex0) - this.pivotX) / (ex0 - this.pivotX));
      if (Math.abs(ez0) > az) k = Math.min(k, (az * Math.sign(ez0) - this.pivotZ) / (ez0 - this.pivotZ));
      const ahead = (me.x - this.pivotX) * fx + (me.z - this.pivotZ) * fz, least = Math.max(0, MIN_BEHIND * scale + ahead) / Math.max(back0, 1e-3);
      squeezeGoal = 1 - clamp(Number.isFinite(k) ? Math.max(k, least) : 1, 1 - SQUEEZE_MOST, 1);
    }
    if (placed) { this.squeeze = squeezeGoal; this.squeezeV = 0; }
    else { spring(this.squeeze, this.squeezeV, squeezeGoal, squeezeGoal > this.squeeze ? SQUEEZE_IN : SQUEEZE_OUT, dt); this.squeeze = clamp(sprung.x, 0, SQUEEZE_MOST); this.squeezeV = sprung.v; }
    if (this.squeeze < 1e-4 && Math.abs(this.squeezeV) < 1e-3) this.squeeze = this.squeezeV = 0;
    const q = this.squeeze, elev = elevation + q * SQUEEZE_TILT, cos = Math.cos(elev), sin = Math.sin(elev);
    let back = this.dolly * cos * (1 - q), lift = this.dolly * sin + this.dolly * cos * q * BOUND_RISE;
    this.state.bounded = this.dolly * cos * q;
    let lookX = lerp(this.pivotX, this.bodyX, q * SQUEEZE_LOOK), lookY = lerp(this.pivotY, this.bodyY, q * SQUEEZE_LOOK), lookZ = lerp(this.pivotZ, this.bodyZ, q * SQUEEZE_LOOK);
    let ex = lookX - fx * back, ez = lookZ - fz * back, ey = Math.max(lookY + lift, me.floor + GROUND_CLEAR);
    if (i.bound) {
      const ax = i.bound.halfX + i.bound.out, az = i.bound.halfZ + i.bound.out;
      let k = 1;
      if (Math.abs(ex) > ax) k = Math.min(k, (ax * Math.sign(ex) - lookX) / (ex - lookX));
      if (Math.abs(ez) > az) k = Math.min(k, (az * Math.sign(ez) - lookZ) / (ez - lookZ));
      if (Number.isFinite(k) && k < 1) { k = Math.max(k, 0); ex = lookX + (ex - lookX) * k; ez = lookZ + (ez - lookZ) * k; }
    }
    this.fov = this.fovNow + q * SQUEEZE_FOV;
    const hv = Math.tan((this.fov * Math.PI / 180) / 2), hh = hv * i.aspect;
    let hardGoal = 1;
    for (let k = 0; k <= HARD_STEPS; k++) {
      const t = k / HARD_STEPS, lx = lerp(lookX, me.x, t), ly = lerp(lookY, hardChest, t), lz = lerp(lookZ, me.z, t);
      const top = this.project(me.x, me.lying ? me.y + .5 : me.y + me.high, me.z, hv, hh, ex, ey, ez, lx, ly, lz, VIEW_TILT);
      const okTop = top.depth > .2 && top.y < HARD_TOP && Math.abs(top.x) < HARD_SIDE;
      const sole = this.project(me.x, me.y + .03, me.z, hv, hh, ex, ey, ez, lx, ly, lz, VIEW_TILT);
      const okSole = sole.depth > .2 && sole.y > -HARD_BOTTOM && Math.abs(sole.x) < HARD_SIDE;
      if (okTop && okSole) { hardGoal = t; break; }
    }
    if (placed) { this.hard = hardGoal; this.hardV = 0; }
    else { spring(this.hard, this.hardV, hardGoal, hardGoal > this.hard ? HARD_IN : HARD_OUT, dt); this.hard = clamp(sprung.x, 0, 1); this.hardV = sprung.v; }
    lookX = lerp(lookX, me.x, this.hard); lookY = lerp(lookY, hardChest, this.hard); lookZ = lerp(lookZ, me.z, this.hard); this.state.hard = this.hard;
    {
      const dx = lookX - ex, dy = lookY - ey, dz = lookZ - ez, across = Math.hypot(dx, dz), reach = Math.hypot(across, dy), pitch = Math.atan2(dy, across) + VIEW_TILT;
      if (across > 1e-6) { const k = Math.cos(pitch) * reach / across; lookX = ex + dx * k; lookZ = ez + dz * k; lookY = ey + Math.sin(pitch) * reach; }
    }
    this.lensX = ex; this.lensY = ey; this.lensZ = ez;
    this.lookX = lookX; this.lookY = lookY; this.lookZ = lookZ;
    this.selfCover = foe ? this.cover(me, foe, scale, hv, hh) : 0;
    this.initialized = true;
  }
  selfCover = 0;
  private cover(me: SmartBody, foe: SmartBody, scale: number, tanV: number, tanH: number) {
    const box = (b: SmartBody, half: number, out: { x0: number; x1: number; y0: number; y1: number; d: number }) => {
      const top = this.project(b.x, b.lying ? b.y + .5 : b.y + b.high, b.z, tanV, tanH); const ty = top.y, td = top.depth;
      const low = this.project(b.x, b.y + .03, b.z, tanV, tanH); const ly = low.y, ld = low.depth;
      const mid = this.project(b.x, this.chest(b), b.z, tanV, tanH); if (mid.depth <= .2 || td <= .2 || ld <= .2) return false;
      const w = half / (mid.depth * tanH); out.x0 = mid.x - w; out.x1 = mid.x + w; out.y0 = Math.min(ty, ly); out.y1 = Math.max(ty, ly); out.d = mid.depth; return true;
    };
    const a = this.boxA, b = this.boxB;
    if (!box(foe, BODY_HALF * foe.high / 1.95, b) || !box(me, BODY_HALF * scale, a) || a.d >= b.d) return 0;
    const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0), area = (b.x1 - b.x0) * (b.y1 - b.y0);
    return w > 0 && h > 0 && area > 1e-9 ? Math.min(1, w * h / area) : 0;
  }
  private boxA = { x0: 0, x1: 0, y0: 0, y1: 0, d: 0 }; private boxB = { x0: 0, x1: 0, y0: 0, y1: 0, d: 0 };

  private chest(b: SmartBody) { return b.y + (b.lying ? LYING_LOOK : Math.max(CHEST_LEAST, b.high * MIDDLE)); }

  private lostFoe(foe: SmartBody, scale: number, aspect: number) {
    const tanV = Math.tan((this.fovNow * Math.PI / 180) / 2), tanH = tanV * aspect;
    const p = this.project(foe.x, this.chest(foe), foe.z, tanV, tanH);
    if (p.depth <= .2 || Math.abs(p.x) > 1 || Math.abs(p.y) > 1) return true;
    const m = this.projectedMe;
    if (m.depth > .2 && p.depth > m.depth) { const half = .34 * scale / (m.depth * tanH); return Math.abs(p.x - m.x) < half * .8; }
    return false;
  }
  private projectedMe: Projected = { x: 0, y: 0, depth: 1 };

  private out: Projected = { x: 0, y: 0, depth: 0 };
  private project(x: number, y: number, z: number, tanV: number, tanH: number, ex = this.lensX, ey = this.lensY, ez = this.lensZ, lx = this.lookX, ly = this.lookY, lz = this.lookZ, tilt = 0): Projected {
    let fx = lx - ex, fy = ly - ey, fz = lz - ez; const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
    let rx = -fz, rz = fx; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
    let ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;
    if (tilt) { const c = Math.cos(tilt), s = Math.sin(tilt), gx = fx * c + ux * s, gy = fy * c + uy * s, gz = fz * c + uz * s; ux = ux * c - fx * s; uy = uy * c - fy * s; uz = uz * c - fz * s; fx = gx; fy = gy; fz = gz; }
    const qx = x - ex, qy = y - ey, qz = z - ez, depth = qx * fx + qy * fy + qz * fz;
    const o = this.out; o.depth = depth;
    if (depth <= .2) { o.x = o.y = 9; return o; }
    o.x = (qx * rx + qz * rz) / (depth * tanH); o.y = (qx * ux + qy * uy + qz * uz) / (depth * tanV);
    return o;
  }

  private fit(i: SmartInput, rest: number, most: number, elevation: number, tanV: number, tanH: number, scale: number) {
    const m = this.project(i.me.x, this.chest(i.me), i.me.z, tanV, tanH);
    this.projectedMe.x = m.x; this.projectedMe.y = m.y; this.projectedMe.depth = m.depth;
    this.fitFx = Math.sin(this.heading); this.fitFz = Math.cos(this.heading); this.fitCos = Math.cos(elevation); this.fitSin = Math.sin(elevation);
    if (this.fits(i, rest, tanV, tanH)) return rest;
    if (!this.fits(i, most, tanV, tanH)) return most;
    let lo = rest, hi = most;
    for (let k = 0; k < 9; k++) { const mid = (lo + hi) / 2; if (this.fits(i, mid, tanV, tanH)) hi = mid; else lo = mid; }
    return hi;
  }
  private fitFx = 0; private fitFz = 1; private fitCos = 1; private fitSin = 0;
  private fits(i: SmartInput, d: number, tanV: number, tanH: number) {
    const me = i.me, foe = i.foe;
    const ex = this.pivotX - this.fitFx * d * this.fitCos, ez = this.pivotZ - this.fitFz * d * this.fitCos, ey = Math.max(this.pivotY + d * this.fitSin, me.floor + GROUND_CLEAR);
    const px = this.pivotX, py = this.pivotY, pz = this.pivotZ;
    let p = this.project(me.x, me.lying ? me.y + .5 : me.y + me.high, me.z, tanV, tanH, ex, ey, ez, px, py, pz);
    if (p.depth <= .2 || p.y > FRAME_TOP || Math.abs(p.x) > FRAME_SIDE) return false;
    p = this.project(me.x, me.y + .03, me.z, tanV, tanH, ex, ey, ez, px, py, pz);
    if (p.y < -FRAME_BOTTOM || Math.abs(p.x) > FRAME_SIDE) return false;
    if (foe && this.engaged > .3) {
      const fd = Math.hypot(foe.x - me.x, foe.z - me.z);
      p = this.project(foe.x, this.chest(foe), foe.z, tanV, tanH, ex, ey, ez, px, py, pz);
      if (p.depth <= .2 || Math.abs(p.x) > FRAME_SIDE || Math.abs(p.y) > FRAME_TOP + .25) return false;
      if (fd < FIT_WHOLE) {
        p = this.project(foe.x, foe.lying ? foe.y + .5 : foe.y + foe.high, foe.z, tanV, tanH, ex, ey, ez, px, py, pz); if (p.y > FRAME_TOP) return false;
        p = this.project(foe.x, foe.y + .03, foe.z, tanV, tanH, ex, ey, ez, px, py, pz); if (p.y < -FRAME_BOTTOM - .06) return false;
      }
    }
    for (let k = 0; k < i.threatCount; k++) {
      const t = i.threats[k]; if (foe && t.id === foe.id) continue;
      if ((this.weights.get(t.id) ?? 0) < THREAT_FIT) continue;
      p = this.project(t.x, this.chest(t), t.z, tanV, tanH, ex, ey, ez, px, py, pz);
      if (p.depth <= .2 || Math.abs(p.x) > FRAME_SIDE || Math.abs(p.y) > FRAME_TOP + .25) return false;
    }
    return true;
  }

  private lensFor(p: number, side: number, back: number, i: SmartInput) {
    const h = this.bearing + p + this.away, fx = Math.sin(h), fz = Math.cos(h), foe = i.foe;
    let px = this.bodyX + side * -fz * this.costShoulder, pz = this.bodyZ + side * fx * this.costShoulder;
    if (foe) { px += (foe.x - i.me.x) * this.costPull; pz += (foe.z - i.me.z) * this.costPull; }
    this.lensX0 = px - fx * back; this.lensZ0 = pz - fz * back;
  }
  private lensX0 = 0; private lensZ0 = 0; private costPull = 0; private costShoulder = 0;

  private pastBound(x: number, z: number, i: SmartInput, margin = 0) { const b = i.bound; return b ? Math.max(0, Math.abs(x) - (b.halfX + b.out - margin), Math.abs(z) - (b.halfZ + b.out - margin)) : 0; }

  private costAt(p: number, phi: number, lo: number, hi: number, i: SmartInput, back: number) {
    const h = this.bearing + p + this.away, ex = this.pivotX - Math.sin(h) * back, ez = this.pivotZ - Math.cos(h) * back;
    const size = Math.abs(p), outside = size < lo ? (lo - size) * W_HIDDEN : size > hi ? size - hi : 0;
    let cost = outside * W_WINDOW + Math.abs(wrapped(p - phi)) * W_TURN;
    if (this.threatSeen > 0) {
      const h = this.bearing + p + this.away, half = Math.atan(this.costTanH * THREAT_ZONE);
      for (let k = 0; k < i.threatCount; k++) {
        const t = i.threats[k]; if (i.foe && t.id === i.foe.id) continue;
        const w = this.weights.get(t.id) ?? 0; if (w < THREAT_SEEN) continue;
        const off = Math.abs(wrapped(Math.atan2(t.x - i.me.x, t.z - i.me.z) - h));
        if (off > half) cost += w * (off - half) * W_THREAT;
      }
    }
    cost += this.pastBound(ex, ez, i) * W_BOUND;
    const foe = i.foe;
    if (foe) {
      const mx = i.me.x - ex, mz = i.me.z - ez, fx = foe.x - ex, fz = foe.z - ez, dm = Math.hypot(mx, mz), df = Math.hypot(fx, fz);
      if (df > dm + .2 && dm > .3) {
        const apart = Math.abs(Math.atan2(mx * fz - mz * fx, mx * fx + mz * fz)), cover = Math.atan(BODY_HALF * this.costScale / dm) + Math.atan(BODY_HALF * .6 * foe.high / 1.95 / df);
        if (apart < cover) cost += W_HIDE * (1 - apart / cover);
      }
    }
    return cost;
  }
}

const sprung = { x: 0, v: 0 };
function spring(x: number, v: number, goal: number, rate: number, dt: number) {
  if (dt <= 0) { sprung.x = x; sprung.v = v; return; }
  const decay = Math.exp(-rate * dt), offset = x - goal, drive = v + rate * offset;
  sprung.x = goal + (offset + drive * dt) * decay; sprung.v = (v - rate * drive * dt) * decay;
}
