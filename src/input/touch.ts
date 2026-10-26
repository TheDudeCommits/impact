import type { Input, TouchAction } from '../input';
import { pageHeight, pageWidth } from '../ui/viewport';
import type { PlayerState } from '../game/types';
import { ULTIMATE_COST } from '../game/moves';
import { AWAKENING_COST, AWAKENING_SECONDS } from '../game/awakening';
import { phone, tablet } from './device';
import '../ui/handheld.css';

export type TouchButton = TouchAction | 'area' | 'guard' | 'pause' | 'emote';
export const TOUCH_BUTTONS: readonly [TouchButton, string][] = [
  ['light', 'LIGHT'], ['heavy', 'HEAVY'], ['special', 'SPECIAL'], ['ultimate', 'ULT'], ['area', 'AREA'], ['awaken', 'AWAKEN'],
  ['jump', 'JUMP'], ['dash', 'DASH'], ['guard', 'GUARD'], ['target', 'LOCK'], ['pause', '❚❚'], ['emote', '!?'],
];
export const STICK_RADIUS = 58;
export const STICK_DEADZONE = .14, STICK_FULL = .8;
export const STICK_SHARE = .42;
const TOP_PIECES = '#interface .combat-hud .fighter-meter,#interface .combat-hud .fighter-meter>.hd-skin>:not([data-hd-glow]),#interface .combat-hud .hd-clock,#interface .combat-hud .match-status,#interface .mode-hud>:is([data-zone="2"],[data-zone="2b"],[data-zone="3"],[data-zone="1b"],[data-zone="3b"])>*,#interface .waiting-dock,#interface .rift-scoreboard,.sv-hud>*';
const OWN_PLATE = '#interface .combat-hud .fighter-meter.own,#interface .combat-hud .fighter-meter.own>.hd-skin';
export function firstGap(taken: readonly (readonly [number, number])[], from: number, to: number, want: number): number | undefined {
  let x = from;
  for (const [left, right] of [...taken].sort((a, b) => a[0] - b[0])) {
    if (right <= x) continue;
    if (left >= x + want) break;
    x = right;
  }
  return x + want <= to ? x : undefined;
}
const KEEP = 'button,a[href],input,select,textarea,summary,label,details,dialog,[role="button"],[role="dialog"],[contenteditable]';

export function stickVector(dx: number, dy: number, radius = STICK_RADIUS, deadzone = STICK_DEADZONE, full = STICK_FULL): [number, number] {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || !(radius > 0)) return [0, 0];
  const length = Math.hypot(dx, dy) / radius;
  if (length <= deadzone) return [0, 0];
  const scale = Math.min(1, (length - deadzone) / (full - deadzone)) / length / radius;
  return [-dy * scale || 0, dx * scale || 0];
}
export function dragBase(baseX: number, baseY: number, x: number, y: number, reach: number): [number, number] {
  const dx = x - baseX, dy = y - baseY, length = Math.hypot(dx, dy);
  if (length <= reach || !(length > 0)) return [baseX, baseY];
  const k = (length - reach) / length;
  return [baseX + dx * k, baseY + dy * k];
}
export const AIM_RADIUS = 120;
export const AIM_SLOP = 10;
export type AimStep = { phase: 'move'; right: number; forward: number } | { phase: 'cancel' };
export class AreaDrag {
  private aiming = false;
  private out = false;
  private cancelled = false;
  constructor(readonly cx: number, readonly cy: number, readonly button: number, readonly reach = AIM_RADIUS, readonly x0 = cx, readonly y0 = cy) {}
  move(x: number, y: number): AimStep | undefined {
    if (this.cancelled || !Number.isFinite(x) || !Number.isFinite(y)) return undefined;
    const dx = x - this.cx, dy = y - this.cy, from = Math.hypot(dx, dy);
    if (from > this.button + AIM_SLOP) this.out = true;
    else if (this.out && from <= this.button) { this.cancelled = true; return { phase: 'cancel' }; }
    if (!this.aiming && Math.hypot(x - this.x0, y - this.y0) < AIM_SLOP) return undefined;
    this.aiming = true;
    const k = 1 / Math.max(from, this.reach);
    return { phase: 'move', right: dx * k || 0, forward: -dy * k || 0 };
  }
  get casts() { return !this.cancelled; }
}
export class CooldownLeft {
  private peak = 0;
  of(left: number) { if (left <= 0) { this.peak = 0; return 0; } if (left > this.peak) this.peak = left; return left / this.peak; }
}

type Finger = { role: 'stick' | 'look' | TouchButton; x: number; y: number };
const page = () => [pageWidth(), pageHeight()] as const;

export class TouchControls {
  readonly root = document.createElement('div');
  private readonly turn = document.createElement('div');
  private readonly fingers = new Map<number, Finger>();
  private readonly buttons = new Map<TouchButton, HTMLElement>();
  private readonly stickNode: HTMLElement;
  private readonly knob: HTMLElement;
  private readonly wheel: HTMLElement;
  private readonly cooldowns = { light: new CooldownLeft(), heavy: new CooldownLeft(), special: new CooldownLeft(), area: new CooldownLeft() };
  private aiming?: { id: number; drag: AreaDrag };
  private readonly aimDot: HTMLElement;
  private base: [number, number] = [0, 0];
  private forward = 0;
  private right = 0;
  private shown = false;
  private playing = false;
  private upright = false;
  private pausedForTurn = false;
  private wheelUntil = 0;
  private placedAt = 0;
  private isPhone = phone();
  onEmote = (_slot: number) => {};

  constructor(private readonly input: Input, parent: HTMLElement = document.body) {
    this.root.className = 'touch-controls'; this.root.hidden = true; this.root.setAttribute('aria-hidden', 'true');
    this.root.innerHTML = `<div class="tc-stick"><i class="tc-base"></i><i class="tc-knob"></i></div><i class="tc-stick-home"></i>`
      + TOUCH_BUTTONS.map(([id, label]) => `<button type="button" tabindex="-1" class="tc-btn tc-${id}" data-tc="${id}"><b>${label}</b>${id === 'area' ? '<i class="tc-aim" aria-hidden="true"><i class="tc-aim-dot"></i></i>' : ''}</button>`).join('')
      + `<div class="tc-wheel" hidden>${[1, 2, 3, 4].map(n => `<button type="button" tabindex="-1" class="tc-btn tc-slot" data-tc-slot="${n - 1}"><b>${n}</b></button>`).join('')}</div>`;
    this.stickNode = this.root.querySelector('.tc-stick')!; this.knob = this.root.querySelector('.tc-knob')!; this.wheel = this.root.querySelector('.tc-wheel')!;
    this.aimDot = this.root.querySelector('.tc-aim-dot')!;
    for (const [id] of TOUCH_BUTTONS) this.buttons.set(id, this.root.querySelector<HTMLElement>(`[data-tc="${id}"]`)!);
    this.turn.className = 'tc-turn'; this.turn.setAttribute('role', 'alert');
    this.turn.innerHTML = '<div><i aria-hidden="true">⟳</i><strong>TURN YOUR PHONE</strong><span>Fights play in landscape.</span></div>';
    parent.append(this.root, this.turn);
    const size = () => { this.isPhone = phone(); this.root.classList.toggle('tc-tablet', tablet()); };
    size(); window.addEventListener('resize', size);
    const options = { capture: true, passive: false } as const;
    window.addEventListener('touchstart', event => this.start(event), options);
    window.addEventListener('touchmove', event => this.move(event), options);
    window.addEventListener('touchend', event => this.end(event), options);
    window.addEventListener('touchcancel', event => this.end(event), options);
    document.addEventListener('gesturestart', event => { if (this.shown) event.preventDefault(); });
    this.root.addEventListener('contextmenu', event => event.preventDefault());
    window.addEventListener('blur', () => this.release());
  }

  update(playing: boolean, inMatch: boolean) {
    this.playing = playing;
    let upright = false;
    if (inMatch && this.isPhone) { const [width, height] = page(); upright = height > width; }
    if (upright !== this.upright) { this.upright = upright; document.documentElement.classList.toggle('tc-upright', upright); if (!upright) this.pausedForTurn = false; }
    if (upright && playing && !this.pausedForTurn) { this.pausedForTurn = true; this.release(); this.input.onMenu('keyboard'); }
    const want = playing && !upright && this.input.mode === 'touch';
    if (want !== this.shown) this.show(want);
    if (!this.shown) return;
    let guard = false, jumpHeld = false;
    for (const finger of this.fingers.values()) { if (finger.role === 'guard') guard = true; else if (finger.role === 'jump') jumpHeld = true; }
    this.input.touchHold(this.forward, this.right, guard, jumpHeld);
    if (this.wheelUntil && performance.now() > this.wheelUntil) this.openWheel(false);
    if (performance.now() - this.placedAt > 500) this.placeTop();
  }
  private placeTop() {
    this.placedAt = performance.now();
    const pause = this.buttons.get('pause')!, emote = this.buttons.get('emote')!, origin = this.root.getBoundingClientRect();
    const size = pause.getBoundingClientRect().width || 44, gap = 8, top = 10, width = origin.width || page()[0];
    const all = [...document.querySelectorAll<HTMLElement>(TOP_PIECES)].map(el => el.getBoundingClientRect())
      .filter(r => r.width > 0 && r.height > 0 && r.width < width * .6);
    const row = (y: number) => all.filter(r => r.top - origin.top < y + size + gap && r.bottom - origin.top > y - gap)
      .map(r => [r.left - origin.left - gap, r.right - origin.left + gap] as const);
    const own = [...document.querySelectorAll<HTMLElement>(OWN_PLATE)].map(el => el.getBoundingClientRect()).filter(r => r.width > 0)
      .reduce<DOMRect | undefined>((wide, r) => !wide || r.right > wide.right ? r : wide, undefined);
    const from = (y: number) => y === top && own && own.width > 0 ? own.right - origin.left + gap : 16;
    const rows = [0, 1, 2, 3].map(i => top + i * (size + gap)), emoting = getComputedStyle(emote).display !== 'none';
    let px: number | undefined, py = top, ex: number | undefined, ey = top;
    for (const y of rows) {
      const x = firstGap(row(y), from(y), width - 16, emoting ? size * 2 + gap : size);
      if (x !== undefined) { px = x; py = y; ex = x + size + gap; ey = y; break; }
    }
    if (px === undefined) for (const y of rows) {
      const taken = px === undefined ? row(y) : [...row(y), ...(y === py ? [[px - gap, px + size + gap] as const] : [])];
      const x = firstGap(taken, from(y), width - 16, size);
      if (x === undefined) continue;
      if (px === undefined) { px = x; py = y; } else { ex = x; ey = y; break; }
    }
    if (px === undefined) { px = Math.max(16, (own ? own.right - origin.left : 16 + size) - size * 2 - gap); py = (own ? own.bottom - origin.top : top + size) + gap; }
    if (ex === undefined) { ex = px + size + gap; ey = py; }
    const set = (node: HTMLElement, left: number, at: number) => { const l = `${Math.round(left)}px`, t = `${Math.round(at)}px`; if (node.style.left !== l) node.style.left = l; if (node.style.top !== t) node.style.top = t; };
    const wheel = size * 4 + gap * 3;
    set(pause, px, py); set(emote, ex, ey); set(this.wheel, Math.max(16, Math.min(ex, width - 16 - wheel)), ey + size + 10);
  }
  meters(self: PlayerState, serverTime: number) {
    if (!this.shown) return;
    const ultimate = Math.max(0, Math.min(1, self.ultimate / ULTIMATE_COST));
    const awake = !!self.awakened, awakening = awake ? Math.max(0, (self.awakenedUntil ?? 0) - serverTime) / AWAKENING_SECONDS : Math.min(1, (self.awakening ?? 0) / AWAKENING_COST);
    this.meter('ultimate', '--charge', ultimate); this.flag('ultimate', 'ready', ultimate >= 1);
    this.meter('awaken', '--charge', Math.max(0, Math.min(1, awakening))); this.flag('awaken', 'ready', !awake && awakening >= 1); this.flag('awaken', 'awake', awake);
    for (const slot of ['light', 'heavy', 'special', 'area'] as const) this.meter(slot, '--cool', this.cooldowns[slot].of(Math.max(0, (self.cooldowns[slot] ?? 0) - serverTime)));
  }
  private meter(id: TouchButton, name: string, value: number) { const node = this.buttons.get(id)!, text = value.toFixed(3); if (node.style.getPropertyValue(name) !== text) node.style.setProperty(name, text); }
  private flag(id: TouchButton, name: string, on: boolean) { const node = this.buttons.get(id)!; if (node.classList.contains(name) !== on) node.classList.toggle(name, on); }

  private show(on: boolean) {
    this.shown = on; this.root.hidden = !on; this.placedAt = 0;
    document.documentElement.classList.toggle('touch-play', on);
    if (!on) this.release();
  }
  private release() {
    if (this.aiming) { this.aiming = undefined; this.buttons.get('area')?.classList.remove('aiming', 'cancelled'); if (this.input.aim.view.source === 'touch') this.input.aim.cancel(); }
    this.fingers.clear(); this.forward = 0; this.right = 0; this.stickNode.classList.remove('on');
    for (const node of this.buttons.values()) node.classList.remove('down');
    this.input.touchHold(0, 0, false, false); this.openWheel(false);
  }
  private openWheel(open: boolean) { this.wheel.hidden = !open; this.wheelUntil = open ? performance.now() + 3000 : 0; this.buttons.get('emote')?.classList.toggle('down', open); }

  private start(event: TouchEvent) {
    this.input.useMode('touch');
    if (!this.playing || this.upright) return;
    if (!this.shown) this.show(true);
    let taken = false;
    for (const touch of Array.from(event.changedTouches)) {
      const target = touch.target instanceof Element ? touch.target : null;
      const slot = target?.closest<HTMLElement>('[data-tc-slot]');
      if (slot && this.root.contains(slot)) { taken = true; this.onEmote(Number(slot.dataset.tcSlot)); this.openWheel(false); continue; }
      const button = target?.closest<HTMLElement>('[data-tc]');
      if (button && this.root.contains(button)) { taken = true; this.press(touch.identifier, button.dataset.tc as TouchButton, touch); continue; }
      if (target?.closest(KEEP)) continue;
      taken = true;
      const stick = touch.clientX < page()[0] * STICK_SHARE && ![...this.fingers.values()].some(f => f.role === 'stick');
      this.fingers.set(touch.identifier, { role: stick ? 'stick' : 'look', x: touch.clientX, y: touch.clientY });
      if (stick) this.placeStick(touch.clientX, touch.clientY);
    }
    if (taken && event.cancelable) event.preventDefault();
  }
  private press(id: number, button: TouchButton, touch: Touch) {
    this.fingers.set(id, { role: button, x: touch.clientX, y: touch.clientY });
    this.buttons.get(button)?.classList.add('down');
    if (button === 'pause') { this.release(); this.input.onMenu('keyboard'); return; }
    if (button === 'emote') { this.openWheel(this.wheel.hasAttribute('hidden')); return; }
    if (button === 'guard') return;
    if (button === 'area') { this.aimStart(id, touch); return; }
    this.input.touchPress(button);
  }
  private aimStart(id: number, touch: Touch) {
    if (this.aiming) return;
    const node = this.buttons.get('area')!, box = node.getBoundingClientRect(), reach = this.aimReach();
    this.aiming = { id, drag: new AreaDrag(box.left + box.width / 2, box.top + box.height / 2, box.width / 2, reach, touch.clientX, touch.clientY) };
    node.style.setProperty('--reach', `${reach}px`); this.placeDot(0, 0);
    node.classList.remove('cancelled'); node.classList.add('aiming');
    this.input.touchAim('start');
  }
  private aimMove(touch: Touch) {
    const aim = this.aiming; if (aim?.id !== touch.identifier) return;
    const step = aim.drag.move(touch.clientX, touch.clientY);
    if (step?.phase === 'move') { this.input.touchAim('move', step.right, step.forward); this.placeDot(step.right, step.forward); }
    else if (step?.phase === 'cancel') { this.input.touchAim('cancel'); const node = this.buttons.get('area')!; node.classList.remove('aiming'); node.classList.add('cancelled'); }
  }
  private aimEnd(id: number, cancelled: boolean) {
    const aim = this.aiming; if (aim?.id !== id) return;
    this.aiming = undefined; this.buttons.get('area')!.classList.remove('aiming', 'cancelled');
    if (aim.drag.casts) this.input.touchAim(cancelled ? 'cancel' : 'end');
  }
  private placeDot(right: number, forward: number) { const r = this.aimReach(); this.aimDot.style.transform = `translate(${(right * r).toFixed(1)}px,${(-forward * r).toFixed(1)}px)`; }
  private aimReach() { return AIM_RADIUS * (this.root.classList.contains('tc-tablet') ? 1.3 : 1); }
  private placeStick(x: number, y: number) {
    const r = this.reach(), margin = 10, [width, height] = page();
    this.base = [Math.max(r + margin, Math.min(width - r - margin, x)), Math.max(r + margin, Math.min(height - r - margin, y))];
    this.stickNode.style.transform = `translate(${this.base[0]}px,${this.base[1]}px)`;
    this.stickNode.classList.add('on');
    this.moveStick(x, y);
  }
  private moveStick(x: number, y: number) {
    const r = this.reach();
    this.base = dragBase(this.base[0], this.base[1], x, y, r);
    this.stickNode.style.transform = `translate(${this.base[0]}px,${this.base[1]}px)`;
    const dx = x - this.base[0], dy = y - this.base[1];
    [this.forward, this.right] = stickVector(dx, dy, r);
    this.knob.style.transform = `translate(${dx}px,${dy}px)`;
  }
  private reach() { return STICK_RADIUS * (this.root.classList.contains('tc-tablet') ? 1.3 : 1); }
  private move(event: TouchEvent) {
    let taken = false;
    for (const touch of Array.from(event.changedTouches)) {
      const finger = this.fingers.get(touch.identifier);
      if (!finger) continue;
      taken = true;
      if (finger.role === 'stick') this.moveStick(touch.clientX, touch.clientY);
      else if (finger.role === 'look') this.input.touchLook(touch.clientX - finger.x, touch.clientY - finger.y);
      else if (finger.role === 'area') this.aimMove(touch);
      finger.x = touch.clientX; finger.y = touch.clientY;
    }
    if (taken && event.cancelable) event.preventDefault();
  }
  private end(event: TouchEvent) {
    let taken = false;
    for (const touch of Array.from(event.changedTouches)) {
      const finger = this.fingers.get(touch.identifier);
      if (!finger) continue;
      taken = true; this.fingers.delete(touch.identifier);
      if (finger.role === 'area') this.aimEnd(touch.identifier, event.type === 'touchcancel');
      if (finger.role === 'stick') { this.forward = 0; this.right = 0; this.stickNode.classList.remove('on'); }
      else if (finger.role !== 'look' && finger.role !== 'emote' && ![...this.fingers.values()].some(f => f.role === finger.role)) this.buttons.get(finger.role)?.classList.remove('down');
    }
    if (taken && event.cancelable) event.preventDefault();
  }
}
