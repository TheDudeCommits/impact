import type * as THREE from 'three';
import { viewHeight, viewWidth } from './viewport';
import { bracketArm, bracketFade, box, lockFrame, measureLock, padBox, pinWidth, PIN_H, PIN_W, type Box, type LockBody, type LockFrame } from '../render/lockAnchors';


export const SMOOTH = .075;
export const SNAP = .19, FLASH_HOLD = .075, FLASH_OUT = .06, DROP = .24, DROP_PX = 20;
export const TRAVEL = .135, SETTLE = .11;
export const RELEASE = .15, RELEASE_SCALE = 1.3;
export const STAMP = 1.35, STAMP_POP = .16, STAMP_OUT = .24;
export const BURST = .25, BURST_PEAK = .55;
export const EDGE_POP = .16, CROSS = .1;
export const PIN_GAP = 12;
export const BOOST_HOLD = .3, BOOST_OUT = .2;

const clamp01 = (x: number) => x < 0 ? 0 : x > 1 ? 1 : x;
export const easeOutCubic = (t: number) => { const u = 1 - clamp01(t); return 1 - u * u * u; };
export const easeOutBack = (t: number) => { const c = 1.70158, u = clamp01(t) - 1; return 1 + (c + 1) * u * u * u + c * u * u; };
export const snapScale = (t: number) => 1.5 - .5 * easeOutBack(t / SNAP);
export const flashAt = (t: number) => t < FLASH_HOLD ? 1 : 1 - clamp01((t - FLASH_HOLD) / FLASH_OUT);
export const dropAt = (t: number) => -DROP_PX * (1 - easeOutBack(t / DROP));
export const travelAt = (t: number) => easeOutCubic(t / TRAVEL);
export const releaseScale = (t: number) => 1 + (RELEASE_SCALE - 1) * easeOutCubic(t / RELEASE);
export const releaseOpacity = (t: number) => { const k = clamp01(t / RELEASE); return 1 - k * k; };

export function smoothDamp(s: Float64Array, i: number, target: number, time: number, dt: number) {
  const omega = 2 / Math.max(1e-4, time), x = omega * dt, e = 1 / (1 + x + .48 * x * x + .235 * x * x * x);
  const change = s[i] - target, temp = (s[i + 1] + omega * change) * dt;
  s[i + 1] = (s[i + 1] - omega * temp) * e;
  s[i] = target + (change + temp) * e;
  return s[i];
}

export interface SafeArea { panels: Float64Array; count: number; edge: number; pad: number }
export const safeArea = (capacity = 8): SafeArea => ({ panels: new Float64Array(capacity * 4), count: 0, edge: 34, pad: 26 });
export function setPanel(area: SafeArea, i: number, l: number, t: number, r: number, b: number) {
  area.panels[i * 4] = l; area.panels[i * 4 + 1] = t; area.panels[i * 4 + 2] = r; area.panels[i * 4 + 3] = b;
}
export function defaultPanels(area: SafeArea, w: number, h: number) {
  setPanel(area, 0, 0, 0, .38 * w, .19 * h);
  setPanel(area, 1, .62 * w, 0, w, .19 * h);
  setPanel(area, 2, .44 * w, 0, .56 * w, .1 * h);
  setPanel(area, 3, .53 * w, .715 * h, w, h);
  setPanel(area, 4, 0, .895 * h, .46 * w, h);
  area.count = 5;
  return area;
}

export interface EdgePlace { x: number; y: number; angle: number }
export function edgePlacement(dx: number, dy: number, w: number, h: number, area: SafeArea, out: EdgePlace): EdgePlace {
  if (dx === 0 && dy === 0) dy = 1;
  const cx = w / 2, cy = h / 2, e = area.edge, pad = area.pad;
  const len = Math.hypot(dx, dy); dx /= len; dy /= len;
  let t = Infinity;
  if (dx > 1e-9) t = Math.min(t, (w - e - cx) / dx); else if (dx < -1e-9) t = Math.min(t, (e - cx) / dx);
  if (dy > 1e-9) t = Math.min(t, (h - e - cy) / dy); else if (dy < -1e-9) t = Math.min(t, (e - cy) / dy);
  t = Math.max(0, t);
  const p = area.panels;
  for (let i = 0; i < area.count; i++) {
    const l = p[i * 4] - pad, top = p[i * 4 + 1] - pad, r = p[i * 4 + 2] + pad, b = p[i * 4 + 3] + pad;
    if (cx > l && cx < r && cy > top && cy < b) continue;
    let t0 = 0, t1 = t;
    if (Math.abs(dx) < 1e-9) { if (cx < l || cx > r) continue; }
    else { let a = (l - cx) / dx, c = (r - cx) / dx; if (a > c) { const s = a; a = c; c = s; } t0 = Math.max(t0, a); t1 = Math.min(t1, c); }
    if (Math.abs(dy) < 1e-9) { if (cy < top || cy > b) continue; }
    else { let a = (top - cy) / dy, c = (b - cy) / dy; if (a > c) { const s = a; a = c; c = s; } t0 = Math.max(t0, a); t1 = Math.min(t1, c); }
    if (t0 <= t1 && t0 < t) t = t0;
  }
  out.x = cx + dx * t; out.y = cy + dy * t; out.angle = Math.atan2(dy, dx);
  return out;
}
export function topLimit(x: number, half: number, area: SafeArea, h: number, gap = 6) {
  let limit = gap;
  const p = area.panels;
  for (let i = 0; i < area.count; i++) {
    const l = p[i * 4], t = p[i * 4 + 1], r = p[i * 4 + 2], b = p[i * 4 + 3];
    if (t > h * .4 || x + half < l || x - half > r) continue;
    limit = Math.max(limit, b + gap);
  }
  return limit;
}

export const LOCK_NOTICES: ReadonlySet<string> = new Set(['LOCKED ON', 'LOCK RELEASED']);
export const quietNotice = (text: string, live: boolean) => live && LOCK_NOTICES.has(text);

export interface LockInput {
  visible: boolean;
  locked: boolean;
  id: string | null;
  name: string;
  distance: number;
  frame: LockFrame | null;
  w: number; h: number;
  area: SafeArea;
  effects: number;
  reduced: boolean;
  glow?: boolean;
}
export interface LockPlan {
  show: boolean;
  bracket: boolean; l: number; t: number; r: number; b: number; arm: number; bOpacity: number; flash: number;
  pin: boolean; px: number; py: number; pScale: number; pOpacity: number; solid: boolean;
  stamp: boolean; sx: number; sy: number; sScale: number; sOpacity: number; side: boolean; stampText: string;
  edge: boolean; ex: number; ey: number; angle: number; eScale: number; eOpacity: number; edgeLocked: boolean; lx: number; ly: number; distance: number;
  burst: boolean; burstX: number; burstY: number; burstR: number; burstPeak: number;
  boost: number;
}
const NONE = Infinity;
const tick = (t: number, dt: number) => t === NONE ? NONE : t + dt;
const copyBox = (from: Box, to: Box) => { to.l = from.l; to.t = from.t; to.r = from.r; to.b = from.b; return to; };

export class LockOnModel {
  readonly plan: LockPlan = { show: false, bracket: false, l: 0, t: 0, r: 0, b: 0, arm: 10, bOpacity: 0, flash: 0, pin: false, px: 0, py: 0, pScale: 1, pOpacity: 0, solid: false, stamp: false, sx: 0, sy: 0, sScale: 1, sOpacity: 0, side: false, stampText: '', edge: false, ex: 0, ey: 0, angle: 0, eScale: 1, eOpacity: 0, edgeLocked: false, lx: 0, ly: 0, distance: 0, burst: false, burstX: 0, burstY: 0, burstR: 0, burstPeak: 0, boost: 0 };
  lockedId: string | null = null;
  shownId: string | null = null;
  private smooth = new Float64Array(12);
  private smoothed = false;
  private live = box();
  private liveUnpadded = box();
  private crownX = 0; private crownY = 0;
  private haveBox = false;
  private drawn = box();
  private drawnValid = false;
  private pinX = 0; private pinY = 0; private pinValid = false;
  private eventT = NONE; private acquireT = NONE; private switchT = NONE; private releaseT = NONE; private stampT = NONE; private crossT = NONE; private edgeT = NONE; private pinMoveT = NONE;
  private switchFrom = box(); private switchFromValid = false;
  private releaseBox = box(); private releaseTrack = false;
  private pinFromX = 0; private pinFromY = 0;
  private pinAlpha = 0;
  private offscreen = false;
  private edgeState = new Float64Array(4); private edgeSeated = false;
  private place: EdgePlace = { x: 0, y: 0, angle: 0 };
  private stampName = '';

  step(input: LockInput, dt: number): LockPlan {
    const plan = this.plan, { id, locked, frame, w, h, reduced } = input;
    dt = Math.max(0, Math.min(.1, dt));
    plan.burst = false;
    this.eventT = tick(this.eventT, dt); this.acquireT = tick(this.acquireT, dt); this.switchT = tick(this.switchT, dt); this.releaseT = tick(this.releaseT, dt); this.stampT = tick(this.stampT, dt);
    this.crossT = tick(this.crossT, dt); this.edgeT = tick(this.edgeT, dt); this.pinMoveT = tick(this.pinMoveT, dt);
    if (this.acquireT > Math.max(SNAP, DROP)) this.acquireT = NONE;
    if (this.switchT > TRAVEL + SETTLE) this.switchT = NONE;
    if (this.releaseT > RELEASE) this.releaseT = NONE;
    if (this.stampT > STAMP) this.stampT = NONE;
    if (this.pinMoveT > TRAVEL) this.pinMoveT = NONE;
    if (this.eventT > 1) this.eventT = NONE;
    if (this.crossT > 1) this.crossT = NONE;
    if (this.edgeT > 1) this.edgeT = NONE;
    const was = this.lockedId, lockNow = locked && id !== null;
    const fresh = lockNow && was === null, switched = lockNow && was !== null && was !== id, released = !lockNow && was !== null;
    const retarget = id !== this.shownId;
    if (released) {
      this.releaseT = this.drawnValid && !reduced ? 0 : NONE;
      copyBox(this.drawn, this.releaseBox); this.releaseTrack = id === was;
      this.acquireT = this.switchT = this.stampT = NONE;
    }
    if (fresh || switched) {
      this.releaseT = NONE;
      this.stampT = 0; this.stampName = input.name;
      if (switched) { this.switchT = reduced ? NONE : 0; this.switchFromValid = this.drawnValid; copyBox(this.drawn, this.switchFrom); this.acquireT = NONE; }
      else { this.acquireT = reduced ? NONE : 0; this.switchT = NONE; }
    }
    if (retarget) {
      this.smoothed = false;
      if (!fresh && !switched) this.stampT = NONE;
      if (this.pinValid && !fresh && !reduced) { this.pinMoveT = 0; this.pinFromX = this.pinX; this.pinFromY = this.pinY; }
      else this.pinMoveT = NONE;
    }
    if ((fresh || switched) && this.offscreen) this.edgeT = 0;
    if (fresh || switched || released) this.eventT = 0;
    this.lockedId = lockNow ? id : null;
    this.shownId = id;
    const usable = !!frame && frame.ok && frame.inFront;
    if (frame && id !== null) {
      const margin = this.offscreen ? 26 : 2;
      const off = !usable || frame.ax < margin || frame.ax > w - margin || frame.ay < margin || frame.ay > h - margin;
      if (off !== this.offscreen) { this.offscreen = off; this.crossT = 0; if (off) { this.edgeT = 0; this.edgeSeated = false; } }
    }
    this.haveBox = false;
    if (usable && frame) {
      const s = this.smooth, ax = frame.ax, ay = frame.ay;
      const tl = frame.l - ax, tt = frame.t - ay, tr = frame.r - ax, tb = frame.b - ay, tcx = frame.cx - ax, tcy = frame.cy - ay;
      if (!this.smoothed) { s[0] = tl; s[2] = tt; s[4] = tr; s[6] = tb; s[8] = tcx; s[10] = tcy; s[1] = s[3] = s[5] = s[7] = s[9] = s[11] = 0; this.smoothed = true; }
      else { smoothDamp(s, 0, tl, SMOOTH, dt); smoothDamp(s, 2, tt, SMOOTH, dt); smoothDamp(s, 4, tr, SMOOTH, dt); smoothDamp(s, 6, tb, SMOOTH, dt); smoothDamp(s, 8, tcx, SMOOTH, dt); smoothDamp(s, 10, tcy, SMOOTH, dt); }
      const u = this.liveUnpadded; u.l = ax + Math.min(s[0], s[4]); u.r = ax + Math.max(s[0], s[4]); u.t = ay + Math.min(s[2], s[6]); u.b = ay + Math.max(s[2], s[6]);
      padBox(u.l, u.t, u.r, u.b, this.live);
      this.crownX = ax + s[8]; this.crownY = ay + s[10];
      this.haveBox = true;
    }
    plan.bracket = false; plan.flash = 0;
    const onScreen = this.haveBox && !this.offscreen;
    if (input.glow) { this.drawnValid = false; this.releaseT = NONE; }
    else if (this.lockedId !== null && onScreen) {
      const live = this.live; let l = live.l, t = live.t, r = live.r, b = live.b, scale = 1, opacity = 1;
      if (this.switchT !== NONE && this.switchFromValid && this.switchT < TRAVEL) {
        const k = travelAt(this.switchT), f = this.switchFrom;
        l = f.l + (l - f.l) * k; t = f.t + (t - f.t) * k; r = f.r + (r - f.r) * k; b = f.b + (b - f.b) * k;
      } else if (this.switchT !== NONE) {
        const since = this.switchFromValid ? this.switchT - TRAVEL : this.switchT;
        scale = 1 + (this.switchFromValid ? .1 : .25) * (1 - easeOutCubic(since / SETTLE));
        plan.flash = this.switchFromValid ? .55 * (1 - clamp01(since / SETTLE)) : 0;
      }
      if (this.acquireT !== NONE && this.acquireT < SNAP) {
        scale = snapScale(this.acquireT); opacity = .4 + .6 * clamp01(this.acquireT / .05); plan.flash = flashAt(this.acquireT);
      } else if (this.acquireT !== NONE) plan.flash = flashAt(this.acquireT);
      if (this.crossT !== NONE && this.crossT < CROSS + SETTLE && this.acquireT === NONE && this.switchT === NONE) {
        opacity *= clamp01(this.crossT / CROSS); scale *= 1 + .2 * (1 - easeOutCubic(this.crossT / (CROSS + SETTLE)));
      }
      this.drawn.l = l; this.drawn.t = t; this.drawn.r = r; this.drawn.b = b; this.drawnValid = true;
      this.setBrackets(l, t, r, b, reduced ? 1 : scale, opacity * bracketFade(b - t, h));
    } else if (this.releaseT !== NONE) {
      const rb = this.releaseBox;
      if (this.releaseTrack && onScreen) copyBox(this.live, rb);
      this.setBrackets(rb.l, rb.t, rb.r, rb.b, releaseScale(this.releaseT), releaseOpacity(this.releaseT) * bracketFade(rb.b - rb.t, h));
      this.drawnValid = false;
    } else {
      if (this.lockedId !== null && this.offscreen && this.crossT !== NONE && this.crossT < CROSS && this.drawnValid && !reduced) {
        const d = this.drawn; this.setBrackets(d.l, d.t, d.r, d.b, 1 + .15 * this.crossT / CROSS, 1 - this.crossT / CROSS);
      } else this.drawnValid = false;
    }
    const wantPin = input.visible && onScreen;
    this.pinAlpha = wantPin ? Math.min(1, this.pinAlpha + dt / .08) : Math.max(0, this.pinAlpha - dt / .1);
    plan.pin = this.pinAlpha > 0 && this.haveBox;
    plan.solid = this.lockedId !== null;
    if (this.haveBox) {
      const boxH = this.liveUnpadded.b - this.liveUnpadded.t, scale = pinWidth(boxH) / PIN_W;
      let x = this.crownX, y = this.crownY - PIN_GAP;
      const half = PIN_W * scale / 2, height = PIN_H * scale;
      const live = this.live, arm = bracketArm(live.r - live.l, live.b - live.t), lo = live.l + arm + half + 3, hi = live.r - arm - half - 3;
      x = lo <= hi ? Math.max(lo, Math.min(hi, x)) : (live.l + live.r) / 2;
      y = Math.min(y, live.t + 6);
      x = Math.max(half + 4, Math.min(w - half - 4, x));
      y = Math.max(topLimit(x, half, input.area, h) + height, Math.min(h - 4, y));
      if (this.pinMoveT !== NONE) {
        const k = travelAt(this.pinMoveT); x = this.pinFromX + (x - this.pinFromX) * k; y = this.pinFromY + (y - this.pinFromY) * k;
      }
      this.pinX = x; this.pinY = y;
      let opacity = this.pinAlpha;
      if (this.acquireT !== NONE && !reduced) { y += dropAt(this.acquireT); opacity *= .5 + .5 * clamp01(this.acquireT / .06); }
      plan.px = x; plan.py = y; plan.pScale = scale; plan.pOpacity = opacity;
    }
    this.pinValid = this.haveBox && this.pinAlpha > 0;
    plan.edge = false;
    if (id !== null && frame && this.offscreen && (input.visible || this.lockedId !== null)) {
      edgePlacement(frame.dx, frame.dy, w, h, input.area, this.place);
      const e = this.edgeState;
      if (!this.edgeSeated) { e[0] = this.place.x; e[2] = this.place.y; e[1] = e[3] = 0; this.edgeSeated = true; }
      else { smoothDamp(e, 0, this.place.x, .06, dt); smoothDamp(e, 2, this.place.y, .06, dt); }
      const pop = reduced || this.edgeT === NONE ? 1 : easeOutBack(this.edgeT / EDGE_POP);
      plan.edge = true; plan.ex = e[0]; plan.ey = e[2]; plan.angle = this.place.angle;
      plan.edgeLocked = this.lockedId !== null;
      plan.eScale = (plan.edgeLocked ? 1 : .78) * (.6 + .4 * pop);
      plan.eOpacity = reduced || this.edgeT === NONE ? 1 : clamp01(this.edgeT / .08);
      const back = plan.edgeLocked ? 34 : 28;
      plan.lx = plan.ex - Math.cos(plan.angle) * back; plan.ly = plan.ey - Math.sin(plan.angle) * back;
      plan.distance = Math.round(input.distance);
    }
    plan.stamp = false;
    if (this.stampT !== NONE && id !== null && (plan.pin || plan.edge)) {
      const t = this.stampT;
      plan.stamp = true; plan.stampText = this.stampName;
      plan.sScale = reduced ? 1 : .55 + .45 * easeOutBack(t / STAMP_POP);
      plan.sOpacity = clamp01(t / .05) * (1 - clamp01((t - (STAMP - STAMP_OUT)) / STAMP_OUT));
      if (plan.pin) {
        const top = plan.py - PIN_H * plan.pScale - 7, limit = topLimit(plan.px, 70, input.area, h) + 22;
        plan.side = top < limit;
        if (plan.side) { plan.sx = plan.px + PIN_W * plan.pScale / 2 + 9; plan.sy = plan.py - PIN_H * plan.pScale / 2; }
        else { plan.sx = plan.px; plan.sy = top; }
      } else {
        plan.side = false; plan.sx = plan.lx; plan.sy = plan.ly - 16;
      }
      plan.sy -= reduced ? 0 : 5 * clamp01((t - (STAMP - STAMP_OUT)) / STAMP_OUT);
    }
    if (fresh && onScreen && !reduced && input.effects > .02) {
      const d = this.live;
      plan.burst = true; plan.burstX = (d.l + d.r) / 2; plan.burstY = (d.t + d.b) / 2;
      plan.burstR = .5 * Math.hypot(d.r - d.l, d.b - d.t) * 1.08; plan.burstPeak = BURST_PEAK * Math.min(1, input.effects);
    }
    plan.boost = this.eventT === NONE ? 0 : 1 - clamp01((this.eventT - BOOST_HOLD) / BOOST_OUT);
    plan.show = plan.bracket || plan.pin || plan.edge || plan.stamp;
    return plan;
  }
  private setBrackets(l: number, t: number, r: number, b: number, scale: number, opacity: number) {
    const plan = this.plan, cx = (l + r) / 2, cy = (t + b) / 2;
    plan.bracket = opacity > .003;
    plan.l = cx + (l - cx) * scale; plan.r = cx + (r - cx) * scale; plan.t = cy + (t - cy) * scale; plan.b = cy + (b - cy) * scale;
    plan.arm = bracketArm(plan.r - plan.l, plan.b - plan.t);
    plan.bOpacity = Math.min(1, opacity);
  }
  get idle() { return !this.plan.show && this.releaseT === NONE; }
}

export interface LockTarget {
  id?: string; name: string; distance: number; color?: string; inFront?: boolean;
  body?: LockBody; centre?: THREE.Vector3; size?: number; camera?: THREE.Camera;
  glow?: boolean; threat?: string;
}

class Part {
  private x = NaN; private y = NaN; private s = NaN; private a = NaN; private o = NaN; private on: boolean;
  constructor(readonly el: HTMLElement, private readonly tail = '') { this.on = !el.classList.contains('off'); }
  move(x: number, y: number, s = 1, a = 0) {
    x = Math.round(x * 4) / 4; y = Math.round(y * 4) / 4; s = Math.round(s * 1000) / 1000; a = Math.round(a * 500) / 500;
    if (x === this.x && y === this.y && s === this.s && a === this.a) return;
    this.x = x; this.y = y; this.s = s; this.a = a;
    this.el.style.transform = `translate3d(${x}px,${y}px,0)${a ? ` rotate(${a}rad)` : ''}${s !== 1 ? ` scale(${s})` : ''}${this.tail}`;
  }
  fade(o: number) {
    o = Math.round(Math.max(0, Math.min(1, o)) * 100) / 100;
    if (o === this.o) return; this.o = o; this.el.style.opacity = o >= 1 ? '' : String(o);
  }
  show(on: boolean) { if (on === this.on) return; this.on = on; this.el.classList.toggle('off', !on); }
}

const CORNERS = ['tl', 'tr', 'bl', 'br'] as const;
const corner = (c: string) => `<span class="lk-c ${c}" data-part="${c}"><i class="ink h"></i><i class="ink v"></i><i class="core h"></i><i class="core v"></i><i class="flash h"></i><i class="flash v"></i></span>`;
const ARROWHEAD = 'M1.5 1.5 12 7.2 22.5 1.5 12 19Z';
const PIN_SVG = `<svg viewBox="-3 -3 31 27" width="31" height="27" aria-hidden="true"><g class="solid"><path d="${ARROWHEAD}" transform="translate(2.2 2.6)" fill="#06151c" stroke="#06151c" stroke-width="3.4" stroke-linejoin="round"/><path d="${ARROWHEAD}" fill="var(--lk)" stroke="#101d27" stroke-width="3.4" stroke-linejoin="round" paint-order="stroke"/><path d="M4.4 3.6 11.2 15.4" stroke="#f4eddb" stroke-width="1.5" stroke-linecap="round" fill="none"/></g><g class="hollow"><path d="${ARROWHEAD}" transform="translate(1.6 2)" fill="none" stroke="rgba(6,21,28,.5)" stroke-width="5.4" stroke-linejoin="round"/><path d="${ARROWHEAD}" fill="rgba(16,29,39,.3)" stroke="#101d27" stroke-width="5.4" stroke-linejoin="round"/><path d="${ARROWHEAD}" fill="none" stroke="#f4eddb" stroke-width="2.4" stroke-linejoin="round"/></g></svg>`;
const DART = 'M-10 -11 -3.5 0 -10 11 13 0Z';
const EDGE_SVG = `<svg viewBox="-16 -16 34 34" width="34" height="34" aria-hidden="true"><g class="solid"><path d="${DART}" transform="translate(2 2.5)" fill="#06151c" stroke="#06151c" stroke-width="3.6" stroke-linejoin="round"/><path d="${DART}" fill="var(--lk)" stroke="#101d27" stroke-width="3.6" stroke-linejoin="round" paint-order="stroke"/><path d="M-7.6 -8 9.4 -0.6" stroke="#f4eddb" stroke-width="1.5" stroke-linecap="round" fill="none"/></g><g class="hollow"><path d="${DART}" transform="translate(1.6 2)" fill="none" stroke="rgba(6,21,28,.5)" stroke-width="5.4" stroke-linejoin="round"/><path d="${DART}" fill="rgba(16,29,39,.3)" stroke="#101d27" stroke-width="5.4" stroke-linejoin="round"/><path d="${DART}" fill="none" stroke="#f4eddb" stroke-width="2.4" stroke-linejoin="round"/></g></svg>`;

function burstWedges(count = 72) {
  let seed = 0x2f6e2b1;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const out: string[] = [], far = 6000;
  for (let i = 0; i < count; i++) {
    const a = (i + rand() * .8) / count * Math.PI * 2, spread = (.25 + rand() * rand() * 1.3) * Math.PI / 180;
    const inner = 100 * (1 + rand() * .7 + (i % 3 === 0 ? rand() * .9 : 0));
    const p = (r: number, t: number) => `${(Math.cos(t) * r).toFixed(1)} ${(Math.sin(t) * r).toFixed(1)}`;
    out.push(`M${p(inner, a)}L${p(far, a - spread)}L${p(far, a + spread)}Z`);
  }
  return out.join('');
}

export class LockOnView {
  private readonly model = new LockOnModel();
  private readonly frame = lockFrame();
  private readonly area = safeArea();
  private readonly input: LockInput = { visible: false, locked: false, id: null, name: '', distance: 0, frame: null, w: 0, h: 0, area: this.area, effects: 1, reduced: false };
  private opacity = 1;
  private areaW = 0; private areaH = 0;
  private areaDirty = true;
  private readonly corners: Part[];
  private readonly brackets: HTMLElement;
  private readonly pin: Part; private readonly pinEl: HTMLElement;
  private readonly stamp: Part; private readonly stampEl: HTMLElement; private readonly stampText: HTMLElement;
  private readonly edge: Part; private readonly edgeEl: HTMLElement; private readonly label: Part; private readonly labelEl: HTMLElement;
  private readonly burstEl: HTMLElement; private readonly burstGroup: SVGGElement; private readonly burstHole: SVGCircleElement; private readonly burstSvg: SVGSVGElement;
  private burstUntil = 0;
  private last = 0;
  private arm = NaN; private flash = NaN; private bracketOpacity = NaN; private bracketsOn = false;
  private solid: boolean | null = null; private side: boolean | null = null; private edgeLocked: boolean | null = null;
  private tint = ''; private threat = '';
  private distance = NaN; private name = '';
  private hidden = true;
  private reduced = false;
  live = false;

  constructor(readonly root: HTMLElement, private readonly settings: { effects: number }) {
    root.innerHTML = `<div class="lk-burst off" data-part="burst" aria-hidden="true"><svg width="100%" height="100%"><defs><radialGradient id="lk-burst-fade"><stop offset=".55" stop-color="#000"/><stop offset="1" stop-color="#fff"/></radialGradient><mask id="lk-burst-mask" maskUnits="userSpaceOnUse" x="-100000" y="-100000" width="200000" height="200000"><rect x="-100000" y="-100000" width="200000" height="200000" fill="#fff"/><circle class="lk-burst-hole" r="1" fill="url(#lk-burst-fade)"/></mask></defs><g mask="url(#lk-burst-mask)"><g class="lk-burst-lines"><path d="${burstWedges()}"/></g></g></svg></div>`
      + `<div class="lk-brackets" data-part="brackets">${CORNERS.map(corner).join('')}</div>`
      + `<div class="lk-pin off" data-part="pin"><div class="lk-bob">${PIN_SVG}</div></div>`
      + `<div class="lk-stamp off" data-part="stamp"><span></span></div>`
      + `<div class="lk-edge off" data-part="edge">${EDGE_SVG}</div><div class="lk-dist off" data-part="dist"><em></em></div>`;
    if (root.parentElement && root.parentElement.firstElementChild !== root) root.parentElement.prepend(root);
    const q = <T extends Element>(s: string) => root.querySelector<T>(s)!;
    this.brackets = q<HTMLElement>('.lk-brackets');
    this.corners = CORNERS.map(c => new Part(q<HTMLElement>(`.lk-c.${c}`), c === 'tl' ? '' : c === 'tr' ? ' scaleX(-1)' : c === 'bl' ? ' scaleY(-1)' : ' scale(-1,-1)'));
    this.pinEl = q<HTMLElement>('.lk-pin'); this.pin = new Part(this.pinEl);
    this.stampEl = q<HTMLElement>('.lk-stamp'); this.stamp = new Part(this.stampEl); this.stampText = q<HTMLElement>('.lk-stamp span');
    this.edgeEl = q<HTMLElement>('.lk-edge'); this.edge = new Part(this.edgeEl);
    this.labelEl = q<HTMLElement>('.lk-dist'); this.label = new Part(this.labelEl);
    this.burstEl = q<HTMLElement>('.lk-burst'); this.burstSvg = q<SVGSVGElement>('.lk-burst svg'); this.burstGroup = q<SVGGElement>('.lk-burst-lines'); this.burstHole = q<SVGCircleElement>('.lk-burst-hole');
    this.brackets.classList.add('off');
    if (typeof matchMedia === 'function') {
      const query = matchMedia('(prefers-reduced-motion: reduce)');
      this.reduced = query.matches; query.addEventListener?.('change', e => { this.reduced = e.matches; });
    }
    if (typeof addEventListener === 'function') addEventListener('resize', () => { this.areaDirty = true; }, { passive: true });
  }

  private measureArea(w: number, h: number) {
    if (!this.areaDirty && w === this.areaW && h === this.areaH) return;
    this.areaDirty = false; this.areaW = w; this.areaH = h;
    defaultPanels(this.area, w, h);
    const hud = this.root.parentElement; if (!hud) return;
    let n = 0;
    for (const selector of ['.fighter-meter.own', '.fighter-meter.foe', '.match-status', '.move-bar', '.controls-hint', '.objective-hud', '.stand-level']) {
      const el = hud.querySelector<HTMLElement>(selector); if (!el) continue;
      const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
      setPanel(this.area, n++, r.left, r.top, r.right, r.bottom);
    }
    if (n >= 3) this.area.count = n;
  }

  update(x: number, y: number, visible: boolean, locked: boolean, info: LockTarget | undefined, fade: number) {
    const now = performance.now() / 1000, dt = this.last ? now - this.last : 0; this.last = now;
    this.live = !!info;
    const root = this.root;
    if (!info && this.model.idle && now >= this.burstUntil) {
      if (!this.hidden) { this.hidden = true; root.classList.add('hidden'); this.model.lockedId = this.model.shownId = null; }
      this.areaDirty = true;
      return;
    }
    const w = viewWidth(), h = viewHeight(), frame = this.frame;
    if (info?.camera) measureLock(frame, info.body, info.centre, info.size ?? 1, info.camera, w, h);
    else if (info) {
      frame.ok = true; frame.inFront = info.inFront !== false; frame.ax = frame.cx = x; frame.ay = frame.cy = y; frame.dx = x - w / 2; frame.dy = y - h / 2;
      frame.l = frame.r = x; frame.t = frame.b = y;
    }
    if (this.hidden) { this.hidden = false; root.classList.remove('hidden'); }
    this.measureArea(w, h);
    const tint = info?.color ?? '';
    if (tint !== this.tint) { this.tint = tint; if (tint) root.style.setProperty('--lk', tint); else root.style.removeProperty('--lk'); }
    const threat = info?.threat ?? '';
    if (threat !== this.threat) { this.threat = threat; if (threat) root.dataset.threat = threat; else delete root.dataset.threat; }
    const input = this.input;
    input.visible = visible; input.locked = locked; input.id = info ? info.id ?? info.name : null; input.name = info?.name ?? ''; input.distance = info?.distance ?? 0;
    input.frame = info ? frame : null; input.w = w; input.h = h; input.effects = this.settings.effects; input.reduced = this.reduced; input.glow = !!info?.glow;
    const plan = this.model.step(input, dt);
    const shown = Math.round(Math.max(Math.max(0, fade), plan.boost) * 100) / 100;
    if (shown !== this.opacity) { this.opacity = shown; root.style.opacity = shown >= 1 ? '' : String(shown); }
    this.draw(now, w, h);
    if (!plan.show && now >= this.burstUntil && !info) { this.hidden = true; root.classList.add('hidden'); }
  }

  private draw(now: number, w: number, h: number) {
    const plan = this.model.plan;
    if (plan.bracket !== this.bracketsOn) { this.bracketsOn = plan.bracket; this.brackets.classList.toggle('off', !plan.bracket); }
    if (plan.bracket) {
      const c = this.corners;
      c[0].move(plan.l, plan.t); c[1].move(plan.r, plan.t); c[2].move(plan.l, plan.b); c[3].move(plan.r, plan.b);
      const arm = Math.round(plan.arm);
      if (arm !== this.arm) { this.arm = arm; this.brackets.style.setProperty('--arm', String(arm)); }
      const flash = Math.round(plan.flash * 50) / 50;
      if (flash !== this.flash) { this.flash = flash; this.brackets.style.setProperty('--flash', String(flash)); }
      const o = Math.round(plan.bOpacity * 100) / 100;
      if (o !== this.bracketOpacity) { this.bracketOpacity = o; this.brackets.style.opacity = o >= 1 ? '' : String(o); }
    }
    this.pin.show(plan.pin);
    if (plan.pin) {
      if (plan.solid !== this.solid) { this.solid = plan.solid; this.pinEl.classList.toggle('solid', plan.solid); }
      this.pin.move(plan.px, plan.py, plan.pScale); this.pin.fade(plan.pOpacity);
    }
    this.edge.show(plan.edge); this.label.show(plan.edge);
    if (plan.edge) {
      if (plan.edgeLocked !== this.edgeLocked) { this.edgeLocked = plan.edgeLocked; this.edgeEl.classList.toggle('solid', plan.edgeLocked); this.labelEl.classList.toggle('solid', plan.edgeLocked); }
      this.edge.move(plan.ex, plan.ey, plan.eScale, plan.angle); this.edge.fade(plan.eOpacity);
      this.label.move(plan.lx, plan.ly); this.label.fade(plan.eOpacity);
      if (plan.distance !== this.distance) { this.distance = plan.distance; this.labelEl.firstElementChild!.textContent = `${plan.distance}m`; }
    }
    this.stamp.show(plan.stamp);
    if (plan.stamp) {
      if (plan.stampText !== this.name) { this.name = plan.stampText; this.stampText.textContent = plan.stampText.toUpperCase(); }
      if (plan.side !== this.side) { this.side = plan.side; this.stampEl.classList.toggle('side', plan.side); }
      this.stamp.move(plan.sx, plan.sy, plan.sScale); this.stamp.fade(plan.sOpacity);
    }
    if (plan.burst) this.startBurst(plan.burstX, plan.burstY, plan.burstR, plan.burstPeak, w, h, now);
    else if (this.burstUntil && now >= this.burstUntil) { this.burstUntil = 0; this.burstEl.classList.add('off'); }
  }

  private startBurst(x: number, y: number, radius: number, peak: number, w: number, h: number, now: number) {
    const el = this.burstEl;
    this.burstSvg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    this.burstGroup.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${(radius / 100).toFixed(4)})`);
    this.burstHole.setAttribute('cx', (w / 2).toFixed(1)); this.burstHole.setAttribute('cy', (h / 2).toFixed(1)); this.burstHole.setAttribute('r', (Math.min(w, h) * .2).toFixed(1));
    el.style.transformOrigin = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
    el.classList.remove('off');
    this.burstUntil = now + BURST + .02;
    if (typeof el.animate === 'function') {
      el.getAnimations().forEach(a => a.cancel());
      el.animate([{ opacity: 0, transform: 'scale(1.35)' }, { opacity: peak, transform: 'scale(1.1)', offset: .3 }, { opacity: 0, transform: 'scale(1)' }], { duration: BURST * 1000, easing: 'linear' });
    }
  }
}
